import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionLoopStatus,
  EntityDomain,
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
export type ScopedEntityMap = Partial<Record<EntityType, string[]>>;

export const additionalDriverRequiredKeys = new Set([
  'driver.first_name',
  'driver.last_name',
  'driver.date_of_birth',
  'driver.relationship_to_proposer',
  'driver.occupation',
  'driver.license_type',
  'driver.driving_start_year_quebec',
]);

export const coApplicantRequiredKeys = [
  'co_applicant.first_name',
  'co_applicant.last_name',
  'co_applicant.date_of_birth',
];

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
        customerFolderId_entityType_role_domain_ordinal: {
          customerFolderId: folder.id,
          entityType,
          role: EntityRole.PRIMARY,
          domain: EntityDomain.NONE,
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

  assertEntityCompatibleWithDefinition(
    entity: DossierEntity,
    definition: { key: string; product: Product; entityType: EntityType },
  ) {
    if (entity.entityType !== definition.entityType) {
      throw new BadRequestException(`Entity must be ${definition.entityType}`);
    }
    if (definition.entityType === EntityType.CLAIM) {
      if (entity.role !== EntityRole.REPEATABLE) {
        throw new BadRequestException('Claim entity must be repeatable');
      }
      if (
        definition.product === Product.AUTO &&
        entity.domain !== EntityDomain.AUTO
      ) {
        throw new BadRequestException('Claim domain does not match AUTO');
      }
      if (
        definition.product === Product.HOME &&
        entity.domain !== EntityDomain.HOME
      ) {
        throw new BadRequestException('Claim domain does not match HOME');
      }
    }
    if (
      definition.entityType === EntityType.CO_APPLICANT &&
      (entity.role !== EntityRole.ADDITIONAL ||
        entity.domain !== EntityDomain.HOME)
    ) {
      throw new BadRequestException('Co-applicant entity must be HOME scoped');
    }
    if (
      definition.entityType === EntityType.DRIVER &&
      entity.role === EntityRole.ADDITIONAL &&
      entity.domain !== EntityDomain.AUTO
    ) {
      throw new BadRequestException(
        'Additional driver entity must be AUTO scoped',
      );
    }
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
        customerFolderId_entityType_role_domain_ordinal: {
          customerFolderId: folder.id,
          entityType,
          role: EntityRole.PRIMARY,
          domain: EntityDomain.NONE,
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
          domain: EntityDomain.NONE,
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
            customerFolderId_entityType_role_domain_ordinal: {
              customerFolderId: folder.id,
              entityType,
              role: EntityRole.PRIMARY,
              domain: EntityDomain.NONE,
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

  async scopedEntityIdsForProduct(leadId: string, product: SelectedProduct) {
    const primary = await this.ensurePrimaryEntitiesForProduct(leadId, product);
    await this.ensureTriggeredEntities(leadId, product);
    const folder = await this.folderForLead(this.prisma, leadId);
    const entities = await this.prisma.dossierEntity.findMany({
      where: { customerFolderId: folder.id },
      orderBy: [{ entityType: 'asc' }, { role: 'asc' }, { ordinal: 'asc' }],
    });
    const result: ScopedEntityMap = {};
    for (const [entityType, id] of Object.entries(primary)) {
      result[entityType as EntityType] = [id];
    }
    for (const entity of entities) {
      if (
        entity.entityType === EntityType.CLAIM ||
        entity.entityType === EntityType.CO_APPLICANT ||
        (entity.entityType === EntityType.DRIVER &&
          entity.role === EntityRole.ADDITIONAL)
      ) {
        result[entity.entityType] = [
          ...(result[entity.entityType] ?? []),
          entity.id,
        ];
      }
    }
    return result;
  }

  async ensureTriggeredEntities(leadId: string, product: SelectedProduct) {
    const folder = await this.folderForLead(this.prisma, leadId);
    const values = await this.prisma.datapointValue.findMany({
      where: { customerFolderId: folder.id },
      include: { definition: { select: { key: true } } },
    });
    const valueFor = (key: string) =>
      values.find((value) => value.definition.key === key)?.value;

    if (
      (product === Product.AUTO || product === Product.AUTO_HOME) &&
      valueFor('auto.has_claims_last_6_years') === true
    ) {
      await this.ensureLoopAndEntity({
        leadId,
        entityType: EntityType.CLAIM,
        role: EntityRole.REPEATABLE,
        domain: EntityDomain.AUTO,
        ordinal: 1,
        triggerKey: 'auto.has_claims_last_6_years',
      });
    }
    if (
      (product === Product.HOME || product === Product.AUTO_HOME) &&
      valueFor('property.claims_last_5_years') === true
    ) {
      await this.ensureLoopAndEntity({
        leadId,
        entityType: EntityType.CLAIM,
        role: EntityRole.REPEATABLE,
        domain: EntityDomain.HOME,
        ordinal: 1,
        triggerKey: 'property.claims_last_5_years',
      });
    }
    if (
      (product === Product.HOME || product === Product.AUTO_HOME) &&
      valueFor('property.has_co_applicant') === true
    ) {
      await this.ensureCoApplicant(leadId);
    }
  }

  ensureCoApplicant(leadId: string) {
    return this.prisma.$transaction(async (tx) => {
      const folder = await this.folderForLead(tx, leadId);
      const existing = await tx.dossierEntity.findUnique({
        where: {
          customerFolderId_entityType_role_domain_ordinal: {
            customerFolderId: folder.id,
            entityType: EntityType.CO_APPLICANT,
            role: EntityRole.ADDITIONAL,
            domain: EntityDomain.HOME,
            ordinal: 1,
          },
        },
      });
      if (existing) return existing;
      const created = await tx.dossierEntity.create({
        data: {
          customerFolderId: folder.id,
          entityType: EntityType.CO_APPLICANT,
          role: EntityRole.ADDITIONAL,
          domain: EntityDomain.HOME,
          ordinal: 1,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: 'CO_APPLICANT_CREATED',
          entityType: 'DossierEntity',
          entityId: created.id,
        },
      });
      return created;
    });
  }

  ensureAdditionalDriverLoop(leadId: string) {
    return this.ensureLoopAndEntity({
      leadId,
      entityType: EntityType.DRIVER,
      role: EntityRole.ADDITIONAL,
      domain: EntityDomain.AUTO,
      ordinal: 2,
      triggerKey: 'auto.additional_driver_exists',
    });
  }

  async ensureLoopAndEntity(input: {
    leadId: string;
    entityType: EntityType;
    role: EntityRole;
    domain: EntityDomain;
    ordinal: number;
    triggerKey: string;
    createdByAttemptId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const folder = await this.folderForLead(tx, input.leadId);
      const loop = await tx.collectionLoop.upsert({
        where: {
          customerFolderId_entityType_role_domain: {
            customerFolderId: folder.id,
            entityType: input.entityType,
            role: input.role,
            domain: input.domain,
          },
        },
        update: {},
        create: {
          customerFolderId: folder.id,
          entityType: input.entityType,
          role: input.role,
          domain: input.domain,
          currentOrdinal: input.ordinal,
          triggerKey: input.triggerKey,
          ...(input.createdByAttemptId
            ? { createdByAttemptId: input.createdByAttemptId }
            : {}),
        },
      });
      if (loop.status === CollectionLoopStatus.CLOSED) return loop;
      await this.ensureLoopEntityWithDb(tx, folder, {
        entityType: input.entityType,
        role: input.role,
        domain: input.domain,
        ordinal: input.ordinal,
      });
      return loop;
    });
  }

  async createNextLoopEntity(
    leadId: string,
    loopId: string,
    attemptId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const folder = await this.folderForLead(tx, leadId);
      const loop = await tx.collectionLoop.findFirst({
        where: { id: loopId, customerFolderId: folder.id },
      });
      if (!loop) throw new NotFoundException('Collection loop not found');
      if (loop.status !== CollectionLoopStatus.COLLECTING) {
        throw new BadRequestException('Collection loop is closed');
      }
      const attempt = await tx.collectionAttempt.findUnique({
        where: { id: attemptId },
        select: { metadata: true },
      });
      const metadata = (attempt?.metadata ?? {}) as {
        createdEntityId?: string;
      };
      if (metadata.createdEntityId) {
        return tx.dossierEntity.findUniqueOrThrow({
          where: { id: metadata.createdEntityId },
        });
      }
      const ordinal = loop.currentOrdinal + 1;
      const entity = await this.ensureLoopEntityWithDb(tx, folder, {
        entityType: loop.entityType,
        role: loop.role,
        domain: loop.domain,
        ordinal,
      });
      await tx.collectionLoop.update({
        where: { id: loop.id },
        data: { currentOrdinal: ordinal },
      });
      await tx.collectionAttempt.update({
        where: { id: attemptId },
        data: {
          metadata: {
            ...((attempt?.metadata ?? {}) as Record<string, unknown>),
            createdEntityId: entity.id,
            answer: true,
          },
        },
      });
      return entity;
    });
  }

  async closeCollectionLoop(leadId: string, loopId: string, attemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const folder = await this.folderForLead(tx, leadId);
      const loop = await tx.collectionLoop.findFirst({
        where: { id: loopId, customerFolderId: folder.id },
      });
      if (!loop) throw new NotFoundException('Collection loop not found');
      if (loop.status === CollectionLoopStatus.CLOSED) return loop;
      const closed = await tx.collectionLoop.update({
        where: { id: loop.id },
        data: {
          status: CollectionLoopStatus.CLOSED,
          closedAt: new Date(),
          closedByAttemptId: attemptId,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: 'COLLECTION_LOOP_CLOSED',
          entityType: 'CollectionLoop',
          entityId: loop.id,
        },
      });
      return closed;
    });
  }

  async openLoopsForLead(leadId: string) {
    const folder = await this.folderForLead(this.prisma, leadId);
    return this.prisma.collectionLoop.findMany({
      where: {
        customerFolderId: folder.id,
        status: CollectionLoopStatus.COLLECTING,
      },
      orderBy: [
        { entityType: 'asc' },
        { domain: 'asc' },
        { currentOrdinal: 'asc' },
      ],
    });
  }

  private async ensureLoopEntityWithDb(
    db: Db,
    folder: Folder,
    input: {
      entityType: EntityType;
      role: EntityRole;
      domain: EntityDomain;
      ordinal: number;
    },
  ) {
    const existing = await db.dossierEntity.findUnique({
      where: {
        customerFolderId_entityType_role_domain_ordinal: {
          customerFolderId: folder.id,
          entityType: input.entityType,
          role: input.role,
          domain: input.domain,
          ordinal: input.ordinal,
        },
      },
    });
    if (existing) return existing;
    const created = await db.dossierEntity.create({
      data: {
        customerFolderId: folder.id,
        entityType: input.entityType,
        role: input.role,
        domain: input.domain,
        ordinal: input.ordinal,
      },
    });
    await db.auditEvent.createMany({
      data: [
        {
          action:
            input.entityType === EntityType.DRIVER
              ? 'ADDITIONAL_DRIVER_CREATED'
              : 'REPEATABLE_ENTITY_CREATED',
          entityType: 'DossierEntity',
          entityId: created.id,
        },
        {
          action: 'COLLECTION_LOOP_OPENED',
          entityType: 'DossierEntity',
          entityId: created.id,
        },
      ],
    });
    return created;
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
