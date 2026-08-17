/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { EntityLifecycleService } from './entity-lifecycle.service';
import { EntityRole, EntityType, Product } from '@prisma/client';

const leadId = '00000000-0000-4000-8000-000000000001';
const folderId = '00000000-0000-4000-8000-000000000002';

function setup() {
  const entities: Array<{
    id: string;
    customerFolderId: string;
    entityType: EntityType;
    role: EntityRole;
    ordinal: number;
  }> = [];
  let seq = 10;
  const db = {
    lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
    customerFolder: { upsert: jest.fn().mockResolvedValue({ id: folderId }) },
    datapointValue: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    dossierEntity: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = where.customerFolderId_entityType_role_ordinal;
        return Promise.resolve(
          entities.find(
            (entity) =>
              entity.customerFolderId === key.customerFolderId &&
              entity.entityType === key.entityType &&
              entity.role === key.role &&
              entity.ordinal === key.ordinal,
          ) ?? null,
        );
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
        const key = where.customerFolderId_entityType_role_ordinal;
        const found = entities.find(
          (entity) =>
            entity.customerFolderId === key.customerFolderId &&
            entity.entityType === key.entityType &&
            entity.role === key.role &&
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
  return { service: new EntityLifecycleService(prisma as never), entities, db };
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
});
