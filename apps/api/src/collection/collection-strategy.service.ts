import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CollectionActionType,
  CollectionMethod,
  CollectionAttemptStatus,
  EntityDomain,
  EntityRole,
  EntityRelationType,
  EntityType,
  IntakePhase,
  Product,
  type CollectionLoop,
  type DossierEntity,
} from '@prisma/client';
import type { CompletenessResponse, NextAction } from '@nova/shared-types';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DatapointsService } from '../datapoints/datapoints.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from '../datapoints/requirement-profile.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  COLLECTION_CAPABILITIES,
  actionTypeFor,
} from './collection-capabilities';
import { EntityLifecycleService } from '../datapoints/entity-lifecycle.service';
import { SectionReviewService } from '../datapoints/section-review.service';
import { buildInputContract } from '../datapoints/input-contract';
import { QuestionSequenceService } from '../datapoints/question-sequence.service';
import { EntityRelationService } from '../datapoints/entity-relation.service';

type RelationPrompt =
  'PRIMARY_DRIVER' | 'OCCASIONAL_DRIVER_EXISTS' | 'OCCASIONAL_DRIVER_SELECT';

type DriverOption = { entityId: string; label: string };

const driverIdentityKeys = new Set([
  'driver.first_name',
  'driver.last_name',
  'driver.date_of_birth',
]);

type AssignmentMetadata = {
  prompt?: RelationPrompt;
  vehicleId?: string;
  vehicleOrdinal?: number;
  relationType?: EntityRelationType;
  promptedByAttemptId?: string;
  answer?: unknown;
  driverId?: string;
};

@Injectable()
export class CollectionStrategyService {
  productSelectionAction(): NextAction {
    return {
      type: 'SELECT_PRODUCT',
      actionId: 'select-product',
      options: [
        { value: 'AUTO', label: 'Auto' },
        { value: 'HOME', label: 'Home' },
        { value: 'AUTO_HOME', label: 'Auto + Home' },
      ],
    };
  }

  async selectForLead(leadId: string): Promise<NextAction> {
    const product = await this.profiles.selectedForLead(leadId);
    if (!product) return this.productSelectionAction();
    const completeness = await this.datapoints.completeness(leadId, product);
    return this.select(leadId, product, completeness);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    private readonly conversations: ConversationsService,
    private readonly profiles: RequirementProfileService,
    private readonly entities: EntityLifecycleService,
    private readonly reviews?: SectionReviewService,
    @Optional()
    private readonly sequence?: QuestionSequenceService,
    @Optional()
    private readonly relations?: EntityRelationService,
  ) {}

  async select(
    leadId: string,
    product: SelectedProduct,
    completeness: CompletenessResponse,
  ): Promise<NextAction> {
    const [definitions, attempts, documents] = await Promise.all([
      this.profiles.forProduct(product),
      this.prisma.collectionAttempt.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.findMany({
        where: { leadId, status: { in: ['UPLOADED', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ]);
    const orderedMissing = this.sequence
      ? this.sequence.orderedMissing(product, definitions, completeness.missing)
      : completeness.missing;
    if (documents[0]) {
      return {
        type: 'WAIT_FOR_PROCESSING',
        documentId: documents[0].id,
        documentType: documents[0].documentType,
        status:
          documents[0].status === 'PROCESSING' ? 'PROCESSING' : 'UPLOADED',
      };
    }
    const loopAction = await this.loopAction(
      leadId,
      product,
      orderedMissing,
      definitions,
    );
    if (loopAction) return loopAction;
    if (!completeness.missing.length) {
      const assignmentAction = await this.assignmentAction(leadId, product);
      if (assignmentAction) return assignmentAction;
      const reviewAction = await this.reviews?.nextReviewAction(
        leadId,
        product,
      );
      if (reviewAction) return reviewAction;
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { intakePhase: IntakePhase.COMPLETE },
      });
      return { type: 'COMPLETE', actionId: randomUUID() };
    }
    const resolved = new Map(
      attempts
        .filter(
          (a) =>
            a.status !== CollectionAttemptStatus.PROPOSED && a.capabilityId,
        )
        .map((a) => [a.capabilityId as string, a.status]),
    );
    const capability = COLLECTION_CAPABILITIES.filter(
      (cap) =>
        !resolved.has(cap.id) &&
        (cap.type === 'FULL_DOCUMENT' ||
          resolved.get(cap.id.replace('_TARGETED', '_FULL')) ===
            CollectionAttemptStatus.DECLINED ||
          resolved.get(cap.id.replace('_TARGETED', '_FULL')) ===
            CollectionAttemptStatus.SKIPPED),
    )
      .map((cap) => ({
        cap,
        covered: orderedMissing.filter(
          (m) =>
            m.entityType === cap.entityType &&
            cap.providesDatapoints.includes(m.key),
        ),
      }))
      .filter(({ covered }) => covered.length >= 2)
      .filter(({ cap }) =>
        this.sequence
          ? this.sequence.shouldConsiderDocumentForNextMissing(
              orderedMissing,
              cap.entityType,
            )
          : true,
      )
      .sort((a, b) => a.cap.priority - b.cap.priority)[0];
    const accepted = attempts.find(
      (attempt) =>
        attempt.status === CollectionAttemptStatus.ACCEPTED &&
        attempt.capabilityId,
    );
    if (accepted) {
      const cap = COLLECTION_CAPABILITIES.find(
        (candidate) => candidate.id === accepted.capabilityId,
      );
      const covered = cap
        ? orderedMissing.filter(
            (item) =>
              item.entityType === cap.entityType &&
              cap.providesDatapoints.includes(item.key),
          )
        : [];
      if (cap && (covered.length || accepted.documentType)) {
        const metadata = (accepted.metadata ?? {}) as {
          coveredMissingDatapoints?: string[];
        };
        const coveredKeys = covered.length
          ? covered.map((item) => item.key)
          : (metadata.coveredMissingDatapoints ?? cap.providesDatapoints);
        return {
          type:
            cap.type === 'FULL_DOCUMENT'
              ? 'SUGGEST_FULL_DOCUMENT'
              : 'SUGGEST_TARGETED_CAPTURE',
          actionId: accepted.id,
          documentType: cap.documentType,
          entityType: cap.entityType,
          ...(accepted.entityId ? { entityId: accepted.entityId } : {}),
          coveredMissingDatapoints: coveredKeys,
          questionsPotentiallyAvoided: coveredKeys.length,
          required: false,
          accepted: true,
        };
      }
    }
    if (capability) {
      const { cap, covered } = capability;
      const actionType = actionTypeFor(cap);
      const existing = attempts.find(
        (a) =>
          a.status === CollectionAttemptStatus.PROPOSED &&
          a.capabilityId === cap.id,
      );
      const actionId =
        existing?.id ??
        (
          await this.prisma.collectionAttempt.create({
            data: {
              leadId,
              actionType,
              capabilityId: cap.id,
              documentType: cap.documentType,
              entityType: cap.entityType,
              entityId: covered[0]?.entityId,
              product,
              metadata: { coveredMissingDatapoints: covered.map((m) => m.key) },
            },
          })
        ).id;
      if (!existing) await this.audit('COLLECTION_ACTION_PROPOSED', leadId);
      await this.audit('NEXT_ACTION_SELECTED', leadId);
      return {
        type:
          actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
            ? 'SUGGEST_FULL_DOCUMENT'
            : 'SUGGEST_TARGETED_CAPTURE',
        actionId,
        documentType: cap.documentType,
        entityType: cap.entityType,
        ...(covered[0]?.entityId ? { entityId: covered[0].entityId } : {}),
        coveredMissingDatapoints: covered.map((m) => m.key),
        questionsPotentiallyAvoided: covered.length,
        required: false,
      };
    }
    const lastDeclinedCapability = COLLECTION_CAPABILITIES.find(
      (cap) =>
        cap.id ===
        attempts.find(
          (attempt) =>
            attempt.status === CollectionAttemptStatus.DECLINED &&
            attempt.capabilityId,
        )?.capabilityId,
    );
    const item =
      orderedMissing.find((missing) =>
        lastDeclinedCapability?.providesDatapoints.includes(missing.key),
      ) ??
      orderedMissing.find((missing) => missing.reason === 'CONDITIONAL') ??
      orderedMissing[0];
    const definition = definitions.find((d) => d.key === item.key);
    if (!definition)
      throw new NotFoundException(`Definition not found for ${item.key}`);
    const grouped = await this.driverIdentityGroupAction(
      leadId,
      product,
      item,
      orderedMissing,
      definitions,
    );
    if (grouped) return grouped;
    const input = buildInputContract(definition);
    const attempt = await this.prisma.collectionAttempt.create({
      data: {
        leadId,
        actionType: CollectionActionType.ASK_DATAPOINT,
        entityType: item.entityType as EntityType,
        entityId: item.entityId,
        product,
        metadata: { key: item.key },
      },
    });
    const action = {
      type: 'ASK_DATAPOINT' as const,
      actionId: attempt.id,
      datapoint: {
        key: item.key,
        entityType: item.entityType as `${EntityType}`,
        ...(item.entityId ? { entityId: item.entityId } : {}),
        ...(definition?.label ? { label: definition.label } : {}),
        ...(definition?.description
          ? { description: definition.description }
          : {}),
      },
      input,
    };
    await this.audit('NEXT_ACTION_SELECTED', leadId);
    return action;
  }

  async respond(
    leadId: string,
    actionId: string,
    decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED',
  ) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: { id: actionId, leadId },
    });
    if (!attempt) throw new NotFoundException('Collection action not found');
    await this.prisma.collectionAttempt.update({
      where: { id: attempt.id },
      data: { status: decision, resolvedAt: new Date() },
    });
    await this.audit(`COLLECTION_ACTION_${decision}`, leadId);
    const product = attempt.product as SelectedProduct;
    const completeness = await this.datapoints.completeness(leadId, product);
    const nextAction = await this.select(leadId, product, completeness);
    return {
      nextAction,
      metrics: {
        fullDocumentDeclines:
          decision === 'DECLINED' &&
          attempt.actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
            ? 1
            : 0,
        targetedCaptureDeclines:
          decision === 'DECLINED' &&
          attempt.actionType === CollectionActionType.SUGGEST_TARGETED_CAPTURE
            ? 1
            : 0,
      },
    };
  }

  async answer(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
      },
    });
    if (!attempt) throw new NotFoundException('Collection action not found');
    if (attempt.actionType === CollectionActionType.ASK_ADD_ANOTHER_ENTITY) {
      return this.answerAddAnother(leadId, attempt.id, value, message);
    }
    if (attempt.actionType === CollectionActionType.ASSIGN_ENTITY_RELATION) {
      return this.answerEntityRelation(leadId, attempt.id, value, message);
    }
    if (attempt.actionType === CollectionActionType.ASK_GROUPED_DATAPOINTS) {
      return this.answerGroupedDatapoints(leadId, attempt.id, value, message);
    }
    if (attempt.actionType === CollectionActionType.REVIEW_SECTION) {
      await this.reviews?.confirm(leadId, attempt.id, value, message);
      return {
        nextAction: await this.selectForLead(leadId),
      };
    }
    if (attempt.actionType !== CollectionActionType.ASK_DATAPOINT) {
      throw new NotFoundException('Datapoint action not found');
    }
    const metadata = (attempt.metadata ?? {}) as { key?: string };
    if (!metadata.key || !attempt.entityType)
      throw new NotFoundException('Datapoint action is incomplete');
    if (message) await this.conversations.addCustomerMessage(leadId, message);
    const datapoint = await this.datapoints.upsert(leadId, {
      key: metadata.key,
      value,
      entityType: attempt.entityType,
      entityId: attempt.entityId ?? undefined,
      sourceType: 'CUSTOMER_FORM',
      collectionMethod: 'MANUAL_QUESTION',
      sourceReferenceId: actionId,
    });
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
      },
    });
    const completeness = await this.datapoints.completeness(
      leadId,
      attempt.product as SelectedProduct,
    );
    return {
      datapoint,
      completeness,
      nextAction: await this.select(
        leadId,
        attempt.product as SelectedProduct,
        completeness,
      ),
    };
  }

  private audit(action: string, leadId: string) {
    return this.prisma.auditEvent.create({
      data: { action, entityType: 'Lead', entityId: leadId },
    });
  }

  private async loopAction(
    leadId: string,
    product: SelectedProduct,
    orderedMissing: CompletenessResponse['missing'],
    definitions: Awaited<ReturnType<RequirementProfileService['forProduct']>>,
  ): Promise<NextAction | undefined> {
    if (product === Product.AUTO || product === Product.AUTO_HOME) {
      await this.entities.ensureVehicleLoop(leadId);
    }
    const loops = await this.entities.openLoopsForLead(leadId);
    for (const loop of loops) {
      const currentEntity = await this.currentLoopEntity(leadId, loop);
      if (!currentEntity) continue;
      const missing = orderedMissing.find(
        (item) => item.entityId === currentEntity.id,
      );
      if (missing) {
        const grouped = await this.driverIdentityGroupAction(
          leadId,
          product,
          missing,
          orderedMissing,
          definitions,
        );
        if (grouped) return grouped;
        return this.askDatapoint(
          leadId,
          product,
          missing,
          loop.entityType === EntityType.VEHICLE && loop.currentOrdinal > 1
            ? this.loopLabel(loop)
            : undefined,
        );
      }
      return this.askAddAnother(leadId, product, loop);
    }
    return undefined;
  }

  private async driverIdentityGroupAction(
    leadId: string,
    product: SelectedProduct,
    item: CompletenessResponse['missing'][number],
    orderedMissing: CompletenessResponse['missing'],
    definitions: Awaited<ReturnType<RequirementProfileService['forProduct']>>,
  ): Promise<NextAction | undefined> {
    if (
      item.entityType !== EntityType.DRIVER ||
      !item.entityId ||
      !driverIdentityKeys.has(item.key)
    ) {
      return undefined;
    }
    const missingIdentity = orderedMissing.filter(
      (missing) =>
        missing.entityType === EntityType.DRIVER &&
        missing.entityId === item.entityId &&
        driverIdentityKeys.has(missing.key),
    );
    if (missingIdentity.length < 2) return undefined;
    const definitionByKey = new Map(
      definitions.map((definition) => [definition.key, definition]),
    );
    const existing = await this.prisma.collectionAttempt.findFirst({
      where: {
        leadId,
        actionType: CollectionActionType.ASK_GROUPED_DATAPOINTS,
        entityType: EntityType.DRIVER,
        entityId: item.entityId,
        status: CollectionAttemptStatus.PROPOSED,
      },
      orderBy: { createdAt: 'desc' },
    });
    const keys = missingIdentity.map((missing) => missing.key);
    const attempt =
      existing ??
      (await this.prisma.collectionAttempt.create({
        data: {
          leadId,
          actionType: CollectionActionType.ASK_GROUPED_DATAPOINTS,
          entityType: EntityType.DRIVER,
          entityId: item.entityId,
          product,
          metadata: {
            group: 'DRIVER_IDENTITY',
            keys,
          },
        },
      }));
    return {
      type: 'ASK_GROUPED_DATAPOINTS',
      actionId: attempt.id,
      title: 'Identité du conducteur',
      datapoints: keys.map((key) => {
        const definition = definitionByKey.get(key);
        if (!definition)
          throw new NotFoundException(`Definition not found for ${key}`);
        return {
          key,
          entityType: EntityType.DRIVER,
          entityId: item.entityId,
          label: definition.label,
          input: buildInputContract(definition),
        };
      }),
    };
  }

  private async answerGroupedDatapoints(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
        actionType: CollectionActionType.ASK_GROUPED_DATAPOINTS,
      },
    });
    if (!attempt) throw new NotFoundException('Grouped datapoint action not found');
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      return { nextAction: await this.selectForLead(leadId) };
    }
    const metadata = (attempt.metadata ?? {}) as { keys?: string[] };
    if (!attempt.entityType || !Array.isArray(metadata.keys)) {
      throw new NotFoundException('Grouped datapoint action is incomplete');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Grouped datapoints require an object value');
    }
    const values = value as Record<string, unknown>;
    if (message) await this.conversations.addCustomerMessage(leadId, message);
    for (const key of metadata.keys) {
      if (!(key in values) || values[key] === '' || values[key] === null) {
        throw new BadRequestException(`${key} is required`);
      }
      await this.datapoints.upsert(leadId, {
        key,
        value: values[key],
        entityType: attempt.entityType,
        entityId: attempt.entityId ?? undefined,
        sourceType: 'CUSTOMER_FORM',
        collectionMethod: CollectionMethod.MANUAL_QUESTION,
        sourceReferenceId: actionId,
      });
    }
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
      },
    });
    const completeness = await this.datapoints.completeness(
      leadId,
      attempt.product as SelectedProduct,
    );
    return {
      completeness,
      nextAction: await this.select(
        leadId,
        attempt.product as SelectedProduct,
        completeness,
      ),
    };
  }

  private async currentLoopEntity(leadId: string, loop: CollectionLoop) {
    const isPrimaryVehicle =
      loop.entityType === EntityType.VEHICLE && loop.currentOrdinal === 1;
    return this.prisma.dossierEntity.findFirst({
      where: {
        customerFolder: { leadId },
        entityType: loop.entityType,
        role: isPrimaryVehicle ? EntityRole.PRIMARY : loop.role,
        domain: isPrimaryVehicle ? EntityDomain.NONE : loop.domain,
        ordinal: loop.currentOrdinal,
      },
    });
  }

  private async askDatapoint(
    leadId: string,
    product: SelectedProduct,
    item: CompletenessResponse['missing'][number],
    entityLabel?: string,
  ): Promise<NextAction> {
    const definitions = await this.profiles.forProduct(product);
    const definition = definitions.find((d) => d.key === item.key);
    if (!definition)
      throw new NotFoundException(`Definition not found for ${item.key}`);
    const input = buildInputContract(definition);
    const attempt = await this.prisma.collectionAttempt.create({
      data: {
        leadId,
        actionType: CollectionActionType.ASK_DATAPOINT,
        entityType: item.entityType as EntityType,
        entityId: item.entityId,
        product,
        metadata: { key: item.key },
      },
    });
    await this.audit('NEXT_ACTION_SELECTED', leadId);
    return {
      type: 'ASK_DATAPOINT',
      actionId: attempt.id,
      datapoint: {
        key: item.key,
        entityType: item.entityType as `${EntityType}`,
        ...(item.entityId ? { entityId: item.entityId } : {}),
        ...(entityLabel ? { entityLabel } : {}),
        ...(definition?.label ? { label: definition.label } : {}),
        ...(definition?.description
          ? { description: definition.description }
          : {}),
      },
      input,
    };
  }

  private async askAddAnother(
    leadId: string,
    product: SelectedProduct,
    loop: CollectionLoop,
  ): Promise<NextAction> {
    const existing = await this.prisma.collectionAttempt.findFirst({
      where: {
        leadId,
        actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
        status: CollectionAttemptStatus.PROPOSED,
        metadata: { path: ['loopId'], equals: loop.id },
      },
      orderBy: { createdAt: 'desc' },
    });
    const attempt =
      existing ??
      (await this.prisma.collectionAttempt.create({
        data: {
          leadId,
          actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
          entityType: loop.entityType,
          product,
          metadata: {
            loopId: loop.id,
            entityType: loop.entityType,
            role: loop.role,
            domain: loop.domain,
            ordinal: loop.currentOrdinal,
          },
        },
      }));
    return {
      type: 'ASK_ADD_ANOTHER_ENTITY',
      actionId: attempt.id,
      entityType: loop.entityType,
      domain: loop.domain === EntityDomain.NONE ? undefined : loop.domain,
      loopId: loop.id,
      ordinal: loop.currentOrdinal,
      label: this.loopLabel(loop),
      question: this.loopQuestion(loop),
      input: { type: 'YES_NO' },
    };
  }

  private async answerAddAnother(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    if (typeof value !== 'boolean')
      throw new NotFoundException('Add-another answer must be true or false');
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
        actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
      },
    });
    if (!attempt) throw new NotFoundException('Add-another action not found');
    const metadata = (attempt.metadata ?? {}) as {
      loopId?: string;
      answer?: boolean;
    };
    if (!metadata.loopId)
      throw new NotFoundException('Add-another action is incomplete');
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      return {
        nextAction: await this.selectForLead(leadId),
      };
    }
    if (message) await this.conversations.addCustomerMessage(leadId, message);
    if (value) {
      await this.entities.createNextLoopEntity(
        leadId,
        metadata.loopId,
        actionId,
      );
    } else {
      await this.entities.closeCollectionLoop(
        leadId,
        metadata.loopId,
        actionId,
      );
      await this.prisma.collectionAttempt.update({
        where: { id: actionId },
        data: {
          metadata: { ...metadata, answer: false },
        },
      });
    }
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
      },
    });
    return {
      nextAction: await this.selectForLead(leadId),
    };
  }

  private async assignmentAction(
    leadId: string,
    product: SelectedProduct,
  ): Promise<NextAction | undefined> {
    if (!this.relations) return undefined;
    if (product !== Product.AUTO && product !== Product.AUTO_HOME)
      return undefined;
    const folder = await this.prisma.customerFolder.findUnique({
      where: { leadId },
      select: { id: true },
    });
    if (!folder) return undefined;
    const [entities, relationRows, attempts, values] = await Promise.all([
      this.prisma.dossierEntity.findMany({
        where: { customerFolderId: folder.id },
        orderBy: [{ entityType: 'asc' }, { role: 'asc' }, { ordinal: 'asc' }],
      }),
      this.prisma.entityRelation.findMany({
        where: {
          customerFolderId: folder.id,
          relationType: {
            in: [
              EntityRelationType.DRIVER_VEHICLE_PRIMARY,
              EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.collectionAttempt.findMany({
        where: {
          leadId,
          actionType: CollectionActionType.ASSIGN_ENTITY_RELATION,
          status: {
            in: [
              CollectionAttemptStatus.PROPOSED,
              CollectionAttemptStatus.COMPLETED,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.datapointValue.findMany({
        where: {
          customerFolderId: folder.id,
          entityType: EntityType.DRIVER,
          definition: {
            key: { in: ['driver.first_name', 'driver.last_name'] },
          },
        },
        include: { definition: { select: { key: true } } },
      }),
    ]);
    const vehicles = entities
      .filter((entity) => entity.entityType === EntityType.VEHICLE)
      .sort((left, right) => left.ordinal - right.ordinal);
    const drivers = entities
      .filter((entity) => entity.entityType === EntityType.DRIVER)
      .sort((left, right) => left.ordinal - right.ordinal);
    if (!vehicles.length || !drivers.length) return undefined;
    const driverOptions = this.driverOptions(drivers, values);

    const primaryByVehicle = new Map(
      relationRows
        .filter(
          (relation) =>
            relation.relationType === EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        )
        .map((relation) => [relation.toEntityId, relation]),
    );

    for (const vehicle of vehicles) {
      const primary = primaryByVehicle.get(vehicle.id);
      if (!primary) {
        return this.askEntityRelation({
          leadId,
          product,
          vehicle,
          prompt: 'PRIMARY_DRIVER',
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
          options: driverOptions,
        });
      }
    }

    for (const vehicle of vehicles) {
      const primary = relationRows.find(
        (relation) =>
          relation.toEntityId === vehicle.id &&
          relation.relationType === EntityRelationType.DRIVER_VEHICLE_PRIMARY,
      );
      if (!primary) continue;

      const occasionalRelations = relationRows.filter(
        (relation) =>
          relation.toEntityId === vehicle.id &&
          relation.relationType ===
            EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
      );
      const remaining = driverOptions.filter(
        (option) =>
          option.entityId !== primary.fromEntityId &&
          !occasionalRelations.some(
            (relation) => relation.fromEntityId === option.entityId,
          ),
      );
      if (!remaining.length) continue;

      const proposed = attempts.find((attempt) => {
        if (attempt.status !== CollectionAttemptStatus.PROPOSED) return false;
        const metadata = (attempt.metadata ?? {}) as AssignmentMetadata;
        return (
          metadata.vehicleId === vehicle.id &&
          (metadata.prompt === 'OCCASIONAL_DRIVER_EXISTS' ||
            metadata.prompt === 'OCCASIONAL_DRIVER_SELECT')
        );
      });
      if (proposed) {
        const metadata = (proposed.metadata ?? {}) as AssignmentMetadata;
        return this.relationActionFromAttempt(
          proposed.id,
          metadata.prompt!,
          vehicle,
          metadata.prompt === 'OCCASIONAL_DRIVER_SELECT'
            ? remaining
            : undefined,
        );
      }

      const latestPrompt = attempts
        .filter((attempt) => {
          const metadata = (attempt.metadata ?? {}) as AssignmentMetadata;
          return (
            attempt.status === CollectionAttemptStatus.COMPLETED &&
            metadata.vehicleId === vehicle.id &&
            metadata.prompt === 'OCCASIONAL_DRIVER_EXISTS'
          );
        })
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )[0];
      if (latestPrompt) {
        const metadata = (latestPrompt.metadata ?? {}) as AssignmentMetadata;
        if (metadata.answer === false) continue;
        const completedSelect = attempts.some((attempt) => {
          const selectMetadata = (attempt.metadata ?? {}) as AssignmentMetadata;
          return (
            attempt.status === CollectionAttemptStatus.COMPLETED &&
            selectMetadata.prompt === 'OCCASIONAL_DRIVER_SELECT' &&
            selectMetadata.promptedByAttemptId === latestPrompt.id
          );
        });
        if (!completedSelect) {
          return this.askEntityRelation({
            leadId,
            product,
            vehicle,
            prompt: 'OCCASIONAL_DRIVER_SELECT',
            relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
            options: remaining,
            promptedByAttemptId: latestPrompt.id,
          });
        }
      }

      return this.askEntityRelation({
        leadId,
        product,
        vehicle,
        prompt: 'OCCASIONAL_DRIVER_EXISTS',
        relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
      });
    }
    return undefined;
  }

  private async askEntityRelation(input: {
    leadId: string;
    product: SelectedProduct;
    vehicle: DossierEntity;
    prompt: RelationPrompt;
    relationType: EntityRelationType;
    options?: DriverOption[];
    promptedByAttemptId?: string;
  }): Promise<NextAction> {
    const existing = await this.prisma.collectionAttempt.findFirst({
      where: {
        leadId: input.leadId,
        actionType: CollectionActionType.ASSIGN_ENTITY_RELATION,
        status: CollectionAttemptStatus.PROPOSED,
        metadata: { path: ['vehicleId'], equals: input.vehicle.id },
      },
      orderBy: { createdAt: 'desc' },
    });
    const attempt =
      existing ??
      (await this.prisma.collectionAttempt.create({
        data: {
          leadId: input.leadId,
          actionType: CollectionActionType.ASSIGN_ENTITY_RELATION,
          entityType: EntityType.VEHICLE,
          entityId: input.vehicle.id,
          product: input.product,
          metadata: {
            prompt: input.prompt,
            vehicleId: input.vehicle.id,
            vehicleOrdinal: input.vehicle.ordinal,
            relationType: input.relationType,
            ...(input.promptedByAttemptId
              ? { promptedByAttemptId: input.promptedByAttemptId }
              : {}),
          },
        },
      }));
    return this.relationActionFromAttempt(
      attempt.id,
      input.prompt,
      input.vehicle,
      input.options,
    );
  }

  private relationActionFromAttempt(
    actionId: string,
    prompt: RelationPrompt,
    vehicle: Pick<DossierEntity, 'id' | 'ordinal'>,
    options?: DriverOption[],
  ): NextAction {
    const relationType =
      prompt === 'PRIMARY_DRIVER'
        ? EntityRelationType.DRIVER_VEHICLE_PRIMARY
        : EntityRelationType.DRIVER_VEHICLE_OCCASIONAL;
    const question =
      prompt === 'PRIMARY_DRIVER'
        ? `Qui conduit principalement le véhicule ${vehicle.ordinal} ?`
        : prompt === 'OCCASIONAL_DRIVER_EXISTS'
          ? 'Y a-t-il un autre conducteur qui utilise occasionnellement ce véhicule ?'
          : `Qui utilise occasionnellement le véhicule ${vehicle.ordinal} ?`;
    return {
      type: 'ASSIGN_ENTITY_RELATION',
      actionId,
      relationType,
      prompt,
      sourceEntityType: 'DRIVER',
      targetEntityType: 'VEHICLE',
      targetEntityId: vehicle.id,
      vehicleOrdinal: vehicle.ordinal,
      vehicleLabel: `Véhicule ${vehicle.ordinal}`,
      question,
      ...(options ? { options } : {}),
      input:
        prompt === 'OCCASIONAL_DRIVER_EXISTS'
          ? { type: 'YES_NO' }
          : { type: 'SINGLE_CHOICE' },
    };
  }

  private async answerEntityRelation(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    if (!this.relations)
      throw new NotFoundException('Entity relation service not available');
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
        actionType: CollectionActionType.ASSIGN_ENTITY_RELATION,
      },
    });
    if (!attempt)
      throw new NotFoundException('Entity relation action not found');
    const metadata = (attempt.metadata ?? {}) as AssignmentMetadata;
    if (!metadata.prompt || !metadata.vehicleId) {
      throw new NotFoundException('Entity relation action is incomplete');
    }
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      return { nextAction: await this.selectForLead(leadId) };
    }
    if (message) await this.conversations.addCustomerMessage(leadId, message);

    if (metadata.prompt === 'OCCASIONAL_DRIVER_EXISTS') {
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          'Occasional driver answer must be true or false',
        );
      }
      await this.prisma.collectionAttempt.update({
        where: { id: actionId },
        data: {
          status: CollectionAttemptStatus.COMPLETED,
          resolvedAt: new Date(),
          metadata: { ...metadata, answer: value },
        },
      });
      return { nextAction: await this.selectForLead(leadId) };
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Driver selection must be a driver id');
    }
    if (metadata.prompt === 'PRIMARY_DRIVER') {
      await this.relations.assignPrimaryDriver(metadata.vehicleId, value);
    } else {
      const allowed = await this.availableOccasionalDriverIds(
        metadata.vehicleId,
      );
      if (!allowed.has(value)) {
        throw new BadRequestException(
          'Driver is not available for this vehicle',
        );
      }
      await this.relations.addOccasionalDriver(metadata.vehicleId, value);
    }
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
        metadata: { ...metadata, answer: value, driverId: value },
      },
    });
    return { nextAction: await this.selectForLead(leadId) };
  }

  private async availableOccasionalDriverIds(vehicleId: string) {
    const vehicle = await this.prisma.dossierEntity.findUnique({
      where: { id: vehicleId },
      select: { customerFolderId: true },
    });
    if (!vehicle) return new Set<string>();
    const [drivers, relations] = await Promise.all([
      this.prisma.dossierEntity.findMany({
        where: {
          customerFolderId: vehicle.customerFolderId,
          entityType: EntityType.DRIVER,
        },
        select: { id: true },
      }),
      this.prisma.entityRelation.findMany({
        where: {
          customerFolderId: vehicle.customerFolderId,
          toEntityId: vehicleId,
          relationType: {
            in: [
              EntityRelationType.DRIVER_VEHICLE_PRIMARY,
              EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
            ],
          },
        },
        select: { fromEntityId: true },
      }),
    ]);
    const alreadyAssigned = new Set(
      relations.map((relation) => relation.fromEntityId),
    );
    return new Set(
      drivers
        .map((driver) => driver.id)
        .filter((driverId) => !alreadyAssigned.has(driverId)),
    );
  }

  private driverOptions(
    drivers: DossierEntity[],
    values: Array<{
      entityId: string | null;
      value: unknown;
      definition: { key: string };
    }>,
  ): DriverOption[] {
    return drivers.map((driver) => {
      const first = values.find(
        (value) =>
          value.entityId === driver.id &&
          value.definition.key === 'driver.first_name',
      )?.value;
      const last = values.find(
        (value) =>
          value.entityId === driver.id &&
          value.definition.key === 'driver.last_name',
      )?.value;
      const label = [first, last]
        .filter((part) => typeof part === 'string' && part.trim())
        .join(' ');
      return {
        entityId: driver.id,
        label: label || `Conducteur ${driver.ordinal}`,
      };
    });
  }

  private loopQuestion(loop: CollectionLoop) {
    if (loop.entityType === EntityType.DRIVER) {
      return 'Do you want to add another driver?';
    }
    if (loop.entityType === EntityType.VEHICLE) {
      return 'Voulez-vous ajouter un autre véhicule ?';
    }
    return 'Do you want to add another claim?';
  }

  private loopLabel(loop: CollectionLoop) {
    if (loop.entityType === EntityType.DRIVER) {
      return `Additional driver ${Math.max(1, loop.currentOrdinal - 1)}`;
    }
    if (loop.entityType === EntityType.VEHICLE) {
      return `Véhicule ${loop.currentOrdinal}`;
    }
    const domain =
      loop.domain === EntityDomain.AUTO
        ? 'Auto'
        : loop.domain === EntityDomain.HOME
          ? 'Home'
          : '';
    return `${domain} claim ${loop.currentOrdinal}`.trim();
  }
}
