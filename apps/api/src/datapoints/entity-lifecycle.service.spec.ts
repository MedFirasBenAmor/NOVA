/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { BadRequestException } from '@nestjs/common';
import { EntityLifecycleService } from './entity-lifecycle.service';
import {
  CollectionLoopStatus,
  EntityDomain,
  EntityRole,
  EntityType,
  Product,
} from '@prisma/client';

const leadId = '00000000-0000-4000-8000-000000000001';
const folderId = '00000000-0000-4000-8000-000000000002';

function setup() {
  const entities: Array<{
    id: string;
    customerFolderId: string;
    entityType: EntityType;
    role: EntityRole;
    domain: EntityDomain;
    ordinal: number;
  }> = [];
  let seq = 10;
  const loops: Array<{
    id: string;
    customerFolderId: string;
    entityType: EntityType;
    role: EntityRole;
    domain: EntityDomain;
    status: CollectionLoopStatus;
    currentOrdinal: number;
    triggerKey?: string;
  }> = [];
  const attempts = new Map<string, { metadata?: Record<string, unknown> }>();
  const db = {
    lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
    customerFolder: { upsert: jest.fn().mockResolvedValue({ id: folderId }) },
    datapointValue: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    collectionAttempt: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(attempts.get(where.id) ?? { metadata: {} }),
        ),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const current = attempts.get(where.id) ?? {};
        attempts.set(where.id, { ...current, ...data });
        return Promise.resolve(attempts.get(where.id));
      }),
    },
    collectionLoop: {
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        const key = where.customerFolderId_entityType_role_domain;
        const existing = loops.find(
          (loop) =>
            loop.customerFolderId === key.customerFolderId &&
            loop.entityType === key.entityType &&
            loop.role === key.role &&
            loop.domain === key.domain,
        );
        if (existing) return Promise.resolve(existing);
        const loop = {
          id: `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
          status: CollectionLoopStatus.COLLECTING,
          ...create,
        };
        loops.push(loop);
        return Promise.resolve(loop);
      }),
      findFirst: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            loops.find(
              (loop) =>
                loop.id === where.id &&
                loop.customerFolderId === where.customerFolderId,
            ) ?? null,
          ),
        ),
      findMany: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            loops.filter(
              (loop) =>
                loop.customerFolderId === where.customerFolderId &&
                loop.status === where.status,
            ),
          ),
        ),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const loop = loops.find((item) => item.id === where.id);
        if (!loop) throw new Error('loop not found');
        Object.assign(loop, data);
        return Promise.resolve(loop);
      }),
    },
    dossierEntity: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = where.customerFolderId_entityType_role_domain_ordinal;
        return Promise.resolve(
          entities.find(
            (entity) =>
              entity.customerFolderId === key.customerFolderId &&
              entity.entityType === key.entityType &&
              entity.role === key.role &&
              entity.domain === key.domain &&
              entity.ordinal === key.ordinal,
          ) ?? null,
        );
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
        const key = where.customerFolderId_entityType_role_domain_ordinal;
        const found = entities.find(
          (entity) =>
            entity.customerFolderId === key.customerFolderId &&
            entity.entityType === key.entityType &&
            entity.role === key.role &&
            entity.domain === key.domain &&
            entity.ordinal === key.ordinal,
        );
        if (!found) throw new Error('not found');
        return Promise.resolve(found);
      }),
      findFirst: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            entities.find(
              (entity) =>
                entity.id === where.id &&
                entity.customerFolderId === where.customerFolderId,
            ) ?? null,
          ),
        ),
      findMany: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            entities.filter(
              (entity) => entity.customerFolderId === where.customerFolderId,
            ),
          ),
        ),
      create: jest.fn().mockImplementation(({ data }) => {
        const entity = {
          id:
            data.id ??
            `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
          customerFolderId: data.customerFolderId,
          entityType: data.entityType,
          role: data.role,
          domain: data.domain ?? EntityDomain.NONE,
          ordinal: data.ordinal,
        };
        entities.push(entity);
        return Promise.resolve(entity);
      }),
    },
  };
  const prisma = {
    ...db,
    $transaction: jest.fn((callback: (tx: typeof db) => unknown) =>
      callback(db),
    ),
  };
  return {
    service: new EntityLifecycleService(prisma as never),
    entities,
    loops,
    db,
  };
}

describe('EntityLifecycleService', () => {
  it.each([EntityType.VEHICLE, EntityType.DRIVER, EntityType.PROPERTY])(
    'ensures one primary %s idempotently',
    async (entityType) => {
      const { service, entities } = setup();
      const created = await service.ensurePrimaryEntity(leadId, entityType);
      for (let i = 0; i < 9; i += 1) {
        await expect(
          service.ensurePrimaryEntity(leadId, entityType),
        ).resolves.toEqual(created);
      }
      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        entityType,
        role: EntityRole.PRIMARY,
        domain: EntityDomain.NONE,
        ordinal: 1,
      });
    },
  );

  it('maps selected products to primary entity types', () => {
    const { service } = setup();
    expect(service.primaryTypesForProduct(Product.AUTO)).toEqual([
      EntityType.VEHICLE,
      EntityType.DRIVER,
    ]);
    expect(service.primaryTypesForProduct(Product.HOME)).toEqual([
      EntityType.PROPERTY,
    ]);
    expect(service.primaryTypesForProduct(Product.AUTO_HOME)).toEqual([
      EntityType.VEHICLE,
      EntityType.DRIVER,
      EntityType.PROPERTY,
    ]);
  });

  it('adopts exactly one historical scoped entity id', async () => {
    const { service, db } = setup();
    db.datapointValue.findMany.mockResolvedValueOnce([
      { entityId: '00000000-0000-4000-8000-000000000099' },
    ]);
    const entity = await service.ensurePrimaryEntity(
      leadId,
      EntityType.VEHICLE,
    );
    expect(entity.id).toBe('00000000-0000-4000-8000-000000000099');
    expect(db.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PRIMARY_ENTITY_ADOPTED' }),
      }),
    );
  });

  it('rejects inactive primary lifecycle types', () => {
    const { service } = setup();
    expect(() => service.ensurePrimaryEntity(leadId, EntityType.CLAIM)).toThrow(
      BadRequestException,
    );
  });

  it('opens an AUTO claim loop with exactly one first claim entity', async () => {
    const { service, entities, loops } = setup();
    await service.ensureLoopAndEntity({
      leadId,
      entityType: EntityType.CLAIM,
      role: EntityRole.REPEATABLE,
      domain: EntityDomain.AUTO,
      ordinal: 1,
      triggerKey: 'auto.has_claims_last_6_years',
    });
    await service.ensureLoopAndEntity({
      leadId,
      entityType: EntityType.CLAIM,
      role: EntityRole.REPEATABLE,
      domain: EntityDomain.AUTO,
      ordinal: 1,
      triggerKey: 'auto.has_claims_last_6_years',
    });
    expect(loops).toHaveLength(1);
    expect(
      entities.filter((entity) => entity.entityType === EntityType.CLAIM),
    ).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      entityType: EntityType.CLAIM,
      role: EntityRole.REPEATABLE,
      domain: EntityDomain.AUTO,
      ordinal: 1,
    });
  });

  it('creates the next loop entity with the next ordinal and closes the loop', async () => {
    const { service, entities, loops } = setup();
    const loop = await service.ensureLoopAndEntity({
      leadId,
      entityType: EntityType.CLAIM,
      role: EntityRole.REPEATABLE,
      domain: EntityDomain.AUTO,
      ordinal: 1,
      triggerKey: 'auto.has_claims_last_6_years',
    });
    await service.createNextLoopEntity(
      leadId,
      loop.id,
      '00000000-0000-4000-8000-000000000077',
    );
    expect(
      entities.filter((entity) => entity.entityType === EntityType.CLAIM),
    ).toHaveLength(2);
    expect(entities.map((entity) => entity.ordinal)).toEqual([1, 2]);
    expect(loops[0].currentOrdinal).toBe(2);
    await service.closeCollectionLoop(
      leadId,
      loop.id,
      '00000000-0000-4000-8000-000000000078',
    );
    expect(loops[0].status).toBe(CollectionLoopStatus.CLOSED);
  });

  it('ensures one HOME co-applicant singleton', async () => {
    const { service, entities } = setup();
    const first = await service.ensureCoApplicant(leadId);
    const second = await service.ensureCoApplicant(leadId);
    expect(first).toEqual(second);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      entityType: EntityType.CO_APPLICANT,
      role: EntityRole.ADDITIONAL,
      domain: EntityDomain.HOME,
      ordinal: 1,
    });
  });
});
