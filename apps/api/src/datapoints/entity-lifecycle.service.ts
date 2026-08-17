import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityRole,
  EntityType,
  Product,
  Prisma,
  type DossierEntity,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type SelectedProduct } from './requirement-profile.service';

const primaryTypes = new Set<EntityType>([
  EntityType.VEHICLE,
  EntityType.DRIVER,
  EntityType.PROPERTY,
]);

const scopedPrimaryTypes = new Set<EntityType>([
  EntityType.VEHICLE,
  EntityType.DRIVER,
  EntityType.PROPERTY,
]);

export type PrimaryEntityMap = Partial<Record<EntityType, string>>;

type Db = PrismaService | Prisma.TransactionClient;

type Folder = { id: string };

@Injectable()
export class EntityLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  primaryTypesForProduct(product: SelectedProduct): EntityType[] {
    if (product === Product.AUTO)
      return [EntityType.VEHICLE, EntityType.DRIVER];
    if (product === Product.HOME) return [EntityType.PROPERTY];
    return [EntityType.VEHICLE, EntityType.DRIVER, EntityType.PROPERTY];
  }

  isPrimaryScopedType(entityType: EntityType) {
    return scopedPrimaryTypes.has(entityType);
  }

  async ensurePrimaryEntitiesForProduct(
    leadId: string,
    product: SelectedProduct,
  ) {
    const entries = await Promise.all(
      this.primaryTypesForProduct(product).map(
        async (entityType) =>
          [
            entityType,
            (await this.ensurePrimaryEntity(leadId, entityType)).id,
          ] as const,
      ),
    );
    return Object.fromEntries(entries) as PrimaryEntityMap;
  }

  async primaryEntityIdsForProduct(leadId: string, product: SelectedProduct) {
    const entities = await this.ensurePrimaryEntitiesForProduct(
      leadId,
      product,
    );
    return entities;
  }

  ensurePrimaryEntity(leadId: string, entityType: EntityType) {
    if (!primaryTypes.has(entityType)) {
      throw new BadRequestException(
        `${entityType} primary lifecycle is not active`,
      );
    }
    return this.prisma.$transaction((tx) =>
      this.ensurePrimaryEntityWithDb(tx, leadId, entityType),
    );
  }

  async getPrimaryEntity(leadId: string, entityType: EntityType) {
    const folder = await this.folderForLead(this.prisma, leadId);
    const entity = await this.prisma.dossierEntity.findUnique({
      where: {
        customerFolderId_entityType_role_ordinal: {
          customerFolderId: folder.id,
          entityType,
          role: EntityRole.PRIMARY,
          ordinal: 1,
        },
      },
    });
    if (!entity) throw new NotFoundException(`Primary ${entityType} not found`);
    return entity;
  }

  async assertOwnedEntity(leadId: string, entityId: string) {
    const folder = await this.folderForLead(this.prisma, leadId);
    const entity = await this.prisma.dossierEntity.findFirst({
      where: { id: entityId, customerFolderId: folder.id },
    });
    if (!entity)
      throw new BadRequestException('Entity does not belong to lead');
    return entity;
  }

  async assertOwnedEntityType(
    leadId: string,
    entityId: string,
    expectedType: EntityType,
  ) {
    const entity = await this.assertOwnedEntity(leadId, entityId);
    if (entity.entityType !== expectedType) {
      throw new BadRequestException(`Entity must be ${expectedType}`);
    }
    return entity;
  }

  async listEntitiesForLead(leadId: string) {
    const folder = await this.folderForLead(this.prisma, leadId);
    return this.prisma.dossierEntity.findMany({
      where: { customerFolderId: folder.id },
      orderBy: [{ entityType: 'asc' }, { role: 'asc' }, { ordinal: 'asc' }],
    });
  }

  async ensurePrimaryEntityWithDb(
    db: Db,
    leadId: string,
    entityType: EntityType,
  ): Promise<DossierEntity> {
    if (!primaryTypes.has(entityType)) {
      throw new BadRequestException(
        `${entityType} primary lifecycle is not active`,
      );
    }
    const folder = await this.folderForLead(db, leadId);
    const existing = await db.dossierEntity.findUnique({
      where: {
        customerFolderId_entityType_role_ordinal: {
          customerFolderId: folder.id,
          entityType,
          role: EntityRole.PRIMARY,
          ordinal: 1,
        },
      },
    });
    if (existing) return existing;

    const adoptedId = await this.adoptableHistoricalEntityId(
      db,
      folder,
      entityType,
    );
    try {
      const created = await db.dossierEntity.create({
        data: {
          ...(adoptedId ? { id: adoptedId } : {}),
          customerFolderId: folder.id,
          entityType,
          role: EntityRole.PRIMARY,
          ordinal: 1,
        },
      });
      await db.auditEvent.create({
        data: {
          action: adoptedId
            ? 'PRIMARY_ENTITY_ADOPTED'
            : 'PRIMARY_ENTITY_CREATED',
          entityType: 'DossierEntity',
          entityId: created.id,
        },
      });
      return created;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return db.dossierEntity.findUniqueOrThrow({
          where: {
            customerFolderId_entityType_role_ordinal: {
              customerFolderId: folder.id,
              entityType,
              role: EntityRole.PRIMARY,
              ordinal: 1,
            },
          },
        });
      }
      throw error;
    }
  }

  private async adoptableHistoricalEntityId(
    db: Db,
    folder: Folder,
    entityType: EntityType,
  ) {
    const values = await db.datapointValue.findMany({
      where: {
        customerFolderId: folder.id,
        entityType,
        entityId: { not: null },
      },
      distinct: ['entityId'],
      select: { entityId: true },
    });
    const ids = values
      .map((value) => value.entityId)
      .filter((id): id is string => Boolean(id));
    return ids.length === 1 ? ids[0] : undefined;
  }

  private async folderForLead(db: Db, leadId: string) {
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

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
