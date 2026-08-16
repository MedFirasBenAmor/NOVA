import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionMethod,
  DataType,
  DatapointStatus,
  EntityType,
  Prisma,
  Product,
  type DatapointDefinition,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCompleteness } from './completeness.resolver';
import { UpsertDatapointDto } from './dto/upsert-datapoint.dto';
import {
  RequirementProfileService,
  type SelectedProduct,
} from './requirement-profile.service';

const scopedEntities = new Set<EntityType>([
  EntityType.VEHICLE,
  EntityType.DRIVER,
  EntityType.CLAIM,
]);

@Injectable()
export class DatapointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: RequirementProfileService,
  ) {}

  definitions(product: Product) {
    if (this.profiles.isSelectable(product))
      return this.profiles.forProduct(product);
    return this.prisma.datapointDefinition.findMany({
      where: { product, active: true },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async values(leadId: string) {
    const folder = await this.folderForLead(this.prisma, leadId);
    return this.prisma.datapointValue.findMany({
      where: { customerFolderId: folder.id },
      include: { definition: true, sources: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
    });
  }

  upsert(leadId: string, dto: UpsertDatapointDto) {
    return this.write(leadId, dto, false).then((result) => result.value);
  }

  upsertCandidate(leadId: string, dto: UpsertDatapointDto) {
    return this.write(leadId, dto, true);
  }

  private write(
    leadId: string,
    dto: UpsertDatapointDto,
    preserveConflicts: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.datapointDefinition.findFirst({
        where: { key: dto.key, active: true },
        orderBy: { version: 'desc' },
      });
      if (!definition)
        throw new BadRequestException(`Unknown datapoint key: ${dto.key}`);

      this.validateInput(definition, dto);
      const folder = await this.folderForLead(tx, leadId);
      const entityType = dto.entityType ?? definition.entityType;
      const scopeKey = `${entityType}:${dto.entityId ?? 'ROOT'}`;
      const status = dto.status ?? this.defaultStatus(dto.collectionMethod);
      const now = new Date();
      const existing = await tx.datapointValue.findUnique({
        where: {
          customerFolderId_definitionId_scopeKey: {
            customerFolderId: folder.id,
            definitionId: definition.id,
            scopeKey,
          },
        },
      });
      if (
        preserveConflicts &&
        existing &&
        JSON.stringify(existing.value) !== JSON.stringify(dto.value)
      ) {
        const source = await tx.datapointSource.create({
          data: {
            datapointValueId: existing.id,
            sourceType: dto.sourceType,
            collectionMethod: dto.collectionMethod,
            sourceReferenceId: dto.sourceReferenceId,
            observedValue: dto.value as Prisma.InputJsonValue,
            confidence: dto.confidence,
            ...(dto.metadata
              ? { metadata: dto.metadata as Prisma.InputJsonValue }
              : {}),
          },
        });
        await tx.auditEvent.createMany({
          data: [
            {
              action: 'INTELLIGENCE_CANDIDATE_REJECTED',
              entityType: 'DatapointValue',
              entityId: existing.id,
            },
            {
              action: 'DATAPOINT_SOURCE_ADDED',
              entityType: 'DatapointSource',
              entityId: source.id,
            },
          ],
        });
        const value = await tx.datapointValue.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            definition: true,
            sources: { orderBy: { createdAt: 'asc' } },
          },
        });
        return { value, accepted: false, conflict: true };
      }
      const valueData = {
        value: dto.value as Prisma.InputJsonValue,
        status,
        confidence: dto.confidence,
        collectedAt: now,
        confirmedAt:
          status === DatapointStatus.CONFIRMED ? now : existing?.confirmedAt,
        validatedAt:
          status === DatapointStatus.VALIDATED ? now : existing?.validatedAt,
      };
      const datapointValue = existing
        ? await tx.datapointValue.update({
            where: { id: existing.id },
            data: valueData,
          })
        : await tx.datapointValue.create({
            data: {
              ...valueData,
              customerFolderId: folder.id,
              definitionId: definition.id,
              entityType,
              entityId: dto.entityId,
              scopeKey,
            },
          });
      const source = await tx.datapointSource.create({
        data: {
          datapointValueId: datapointValue.id,
          sourceType: dto.sourceType,
          collectionMethod: dto.collectionMethod,
          sourceReferenceId: dto.sourceReferenceId,
          observedValue: dto.value as Prisma.InputJsonValue,
          confidence: dto.confidence,
          ...(dto.metadata
            ? { metadata: dto.metadata as Prisma.InputJsonValue }
            : {}),
        },
      });
      const actions = [
        existing ? 'DATAPOINT_UPDATED' : 'DATAPOINT_CREATED',
        'DATAPOINT_SOURCE_ADDED',
      ];
      if (status === DatapointStatus.CONFIRMED)
        actions.push('DATAPOINT_CONFIRMED');
      await tx.auditEvent.createMany({
        data: actions.map((action) => ({
          action,
          entityType:
            action === 'DATAPOINT_SOURCE_ADDED'
              ? 'DatapointSource'
              : 'DatapointValue',
          entityId:
            action === 'DATAPOINT_SOURCE_ADDED' ? source.id : datapointValue.id,
        })),
      });

      const value = await tx.datapointValue.findUniqueOrThrow({
        where: { id: datapointValue.id },
        include: {
          definition: true,
          sources: { orderBy: { createdAt: 'asc' } },
        },
      });
      return { value, accepted: true, conflict: false };
    });
  }

  async completeness(leadId: string, product: SelectedProduct) {
    const folder = await this.folderForLead(this.prisma, leadId);
    const [definitions, values] = await Promise.all([
      this.profiles.forProduct(product),
      this.prisma.datapointValue.findMany({
        where: { customerFolderId: folder.id },
        include: { definition: { select: { key: true } } },
      }),
    ]);
    return resolveCompleteness(product, definitions, values);
  }

  async completenessForSelected(leadId: string, product: SelectedProduct) {
    const selectedProduct = await this.profiles.selectedForLead(leadId);
    if (!selectedProduct)
      throw new BadRequestException('Product must be selected first');
    if (selectedProduct !== product)
      throw new BadRequestException('Product does not match selected product');
    return this.completeness(leadId, selectedProduct);
  }

  private async folderForLead(
    db: Prisma.TransactionClient | PrismaService,
    leadId: string,
  ) {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    return db.customerFolder.upsert({
      where: { leadId },
      update: {},
      create: { leadId },
    });
  }

  validateInput(definition: DatapointDefinition, dto: UpsertDatapointDto) {
    const entityType = dto.entityType ?? definition.entityType;
    if (entityType !== definition.entityType) {
      throw new BadRequestException(
        `${definition.key} must use entity type ${definition.entityType}`,
      );
    }
    if (scopedEntities.has(definition.entityType) && !dto.entityId) {
      throw new BadRequestException(`${definition.key} requires an entityId`);
    }

    const validType =
      (definition.dataType === DataType.STRING &&
        typeof dto.value === 'string') ||
      (definition.dataType === DataType.NUMBER &&
        typeof dto.value === 'number') ||
      (definition.dataType === DataType.BOOLEAN &&
        typeof dto.value === 'boolean') ||
      (definition.dataType === DataType.DATE &&
        typeof dto.value === 'string' &&
        !Number.isNaN(Date.parse(dto.value))) ||
      (definition.dataType === DataType.ENUM &&
        typeof dto.value === 'string') ||
      (definition.dataType === DataType.OBJECT &&
        typeof dto.value === 'object' &&
        dto.value !== null);
    if (!validType)
      throw new BadRequestException(`Invalid value for ${definition.key}`);

    const rules = definition.validationRules as {
      allowedValues?: unknown[];
    } | null;
    if (rules?.allowedValues && !rules.allowedValues.includes(dto.value)) {
      throw new BadRequestException(`Unsupported value for ${definition.key}`);
    }
  }

  private defaultStatus(method: CollectionMethod) {
    if (
      method === CollectionMethod.EXTRACTED ||
      method === CollectionMethod.TARGETED_CAPTURE
    )
      return DatapointStatus.EXTRACTED;
    if (method === CollectionMethod.DERIVED) return DatapointStatus.INFERRED;
    if (method === CollectionMethod.ENRICHED) return DatapointStatus.ENRICHED;
    if (method === CollectionMethod.CONFIRMED) return DatapointStatus.CONFIRMED;
    return DatapointStatus.CANDIDATE;
  }
}
