import { BadRequestException } from '@nestjs/common';
import { EntityRelationType, EntityType } from '@prisma/client';
import { EntityRelationService } from './entity-relation.service';

type Entity = {
  id: string;
  customerFolderId: string;
  entityType: EntityType;
  ordinal: number;
};

type Relation = {
  id: string;
  customerFolderId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: EntityRelationType;
  createdAt: Date;
};

type RelationCreate = Omit<Relation, 'id' | 'createdAt'>;
type RelationWhere = Partial<
  Pick<Relation, 'customerFolderId' | 'fromEntityId' | 'toEntityId'>
> & {
  relationType?: EntityRelationType | { in: EntityRelationType[] };
};
type EntityFindUniqueArgs = { where: { id: string } };

function relationMatches(relation: Relation, where: RelationWhere) {
  return (
    (!where.customerFolderId ||
      relation.customerFolderId === where.customerFolderId) &&
    (!where.fromEntityId || relation.fromEntityId === where.fromEntityId) &&
    (!where.toEntityId || relation.toEntityId === where.toEntityId) &&
    (!where.relationType ||
      (typeof where.relationType === 'object'
        ? where.relationType.in.includes(relation.relationType)
        : relation.relationType === where.relationType))
  );
}

function setup() {
  let seq = 1;
  const entities: Entity[] = [
    {
      id: 'vehicle-1',
      customerFolderId: 'folder-1',
      entityType: EntityType.VEHICLE,
      ordinal: 1,
    },
    {
      id: 'vehicle-2',
      customerFolderId: 'folder-1',
      entityType: EntityType.VEHICLE,
      ordinal: 2,
    },
    {
      id: 'driver-a',
      customerFolderId: 'folder-1',
      entityType: EntityType.DRIVER,
      ordinal: 1,
    },
    {
      id: 'driver-b',
      customerFolderId: 'folder-1',
      entityType: EntityType.DRIVER,
      ordinal: 2,
    },
    {
      id: 'driver-other-lead',
      customerFolderId: 'folder-2',
      entityType: EntityType.DRIVER,
      ordinal: 1,
    },
    {
      id: 'claim-1',
      customerFolderId: 'folder-1',
      entityType: EntityType.CLAIM,
      ordinal: 1,
    },
  ];
  const relations: Relation[] = [];
  const db = {
    dossierEntity: {
      findUnique: jest.fn(({ where }: EntityFindUniqueArgs) =>
        Promise.resolve(
          entities.find((entity) => entity.id === where.id) ?? null,
        ),
      ),
    },
    entityRelation: {
      findFirst: jest.fn(({ where }: { where: RelationWhere }) =>
        Promise.resolve(
          relations.find((relation) => relationMatches(relation, where)) ??
            null,
        ),
      ),
      deleteMany: jest.fn(({ where }: { where: RelationWhere }) => {
        const before = relations.length;
        for (let index = relations.length - 1; index >= 0; index -= 1) {
          const relation = relations[index];
          if (relationMatches(relation, where)) {
            relations.splice(index, 1);
          }
        }
        return Promise.resolve({ count: before - relations.length });
      }),
      create: jest.fn(({ data }: { data: RelationCreate }) => {
        const relation = {
          id: `relation-${seq++}`,
          createdAt: new Date(seq),
          ...data,
        };
        relations.push(relation);
        return Promise.resolve(relation);
      }),
      upsert: jest.fn(
        ({
          where,
          create,
        }: {
          where: {
            customerFolderId_fromEntityId_toEntityId_relationType: RelationCreate;
          };
          create: RelationCreate;
        }) => {
          const key =
            where.customerFolderId_fromEntityId_toEntityId_relationType;
          const existing = relations.find(
            (relation) =>
              relation.customerFolderId === key.customerFolderId &&
              relation.fromEntityId === key.fromEntityId &&
              relation.toEntityId === key.toEntityId &&
              relation.relationType === key.relationType,
          );
          if (existing) return Promise.resolve(existing);
          const relation = {
            id: `relation-${seq++}`,
            createdAt: new Date(seq),
            ...create,
          };
          relations.push(relation);
          return Promise.resolve(relation);
        },
      ),
      findMany: jest.fn(({ where }: { where: RelationWhere }) =>
        Promise.resolve(
          relations.filter((relation) => relationMatches(relation, where)),
        ),
      ),
    },
  };
  const prisma = {
    ...db,
    $transaction: jest.fn((callback: (tx: typeof db) => unknown) =>
      callback(db),
    ),
  };
  return {
    service: new EntityRelationService(prisma as never),
    relations,
  };
}

describe('EntityRelationService', () => {
  it('creates a primary DRIVER to VEHICLE relation', async () => {
    const { service, relations } = setup();
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    expect(relations).toEqual([
      expect.objectContaining({
        fromEntityId: 'driver-a',
        toEntityId: 'vehicle-1',
        relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
      }),
    ]);
  });

  it('keeps primary assignment idempotent for the same driver', async () => {
    const { service, relations } = setup();
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    expect(relations).toHaveLength(1);
  });

  it('replaces the previous primary driver for a vehicle', async () => {
    const { service, relations } = setup();
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    await service.assignPrimaryDriver('vehicle-1', 'driver-b');
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ fromEntityId: 'driver-b' });
  });

  it('allows two vehicles to have different primary drivers', async () => {
    const { service, relations } = setup();
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    await service.assignPrimaryDriver('vehicle-2', 'driver-b');
    expect(relations.map((relation) => relation.toEntityId).sort()).toEqual([
      'vehicle-1',
      'vehicle-2',
    ]);
  });

  it('allows the same driver to be primary for multiple vehicles', async () => {
    const { service, relations } = setup();
    await service.assignPrimaryDriver('vehicle-1', 'driver-a');
    await service.assignPrimaryDriver('vehicle-2', 'driver-a');
    expect(relations).toHaveLength(2);
  });

  it('creates and removes occasional driver relations idempotently', async () => {
    const { service, relations } = setup();
    await service.addOccasionalDriver('vehicle-1', 'driver-b');
    await service.addOccasionalDriver('vehicle-1', 'driver-b');
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
    });
    await service.removeOccasionalDriver('vehicle-1', 'driver-b');
    await service.removeOccasionalDriver('vehicle-1', 'driver-b');
    expect(relations).toHaveLength(0);
  });

  it('rejects cross-lead relations', async () => {
    const { service } = setup();
    await expect(
      service.assignPrimaryDriver('vehicle-1', 'driver-other-lead'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects wrong entity types', async () => {
    const { service } = setup();
    await expect(
      service.assignPrimaryDriver('claim-1', 'driver-a'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.assignPrimaryDriver('vehicle-1', 'claim-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
