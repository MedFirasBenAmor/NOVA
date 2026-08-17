/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import {
  DataType,
  EntityType,
  SourceType,
  CollectionMethod,
  Product,
} from '@prisma/client';
import { DatapointsService } from './datapoints.service';

const leadId = '00000000-0000-4000-8000-000000000001';
const folderId = '00000000-0000-4000-8000-000000000002';
const valueId = '00000000-0000-4000-8000-000000000003';
const sourceId = '00000000-0000-4000-8000-000000000004';

const profilesFor = (definition: object) => ({
  selectedForLead: jest.fn().mockResolvedValue(Product.AUTO),
  forProduct: jest.fn().mockResolvedValue([definition]),
});
const entities = {
  assertOwnedEntityType: jest.fn().mockResolvedValue({}),
  primaryEntityIdsForProduct: jest.fn().mockResolvedValue({}),
};

describe('DatapointsService', () => {
  it('rejects undeclared datapoint keys', async () => {
    const tx = {
      datapointDefinition: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new DatapointsService(
      prisma,
      {} as never,
      entities as never,
    );

    await expect(
      service.upsert(leadId, {
        key: 'vehicle.not_declared',
        value: 'x',
        sourceType: SourceType.CUSTOMER_FORM,
        collectionMethod: CollectionMethod.MANUAL_QUESTION,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores source provenance and audit events with a value', async () => {
    const definition = {
      id: '00000000-0000-4000-8000-000000000005',
      key: 'customer.first_name',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      validationRules: null,
    };
    const tx = {
      lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
      customerFolder: { upsert: jest.fn().mockResolvedValue({ id: folderId }) },
      datapointDefinition: {
        findFirst: jest.fn().mockResolvedValue(definition),
      },
      datapointValue: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: valueId }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: valueId }),
      },
      datapointSource: {
        create: jest.fn().mockResolvedValue({ id: sourceId }),
      },
      auditEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(tx),
      ),
    } as never;
    const service = new DatapointsService(
      prisma,
      profilesFor(definition) as never,
      entities as never,
    );

    await service.upsert(leadId, {
      key: definition.key,
      value: 'NOVA',
      sourceType: SourceType.CUSTOMER_CHAT,
      collectionMethod: CollectionMethod.MANUAL_QUESTION,
      sourceReferenceId: 'message-1',
      confidence: 1,
    });

    const sourceCall: unknown = tx.datapointSource.create.mock.calls[0]?.[0];
    expect(sourceCall).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          datapointValueId: valueId,
          sourceType: SourceType.CUSTOMER_CHAT,
          sourceReferenceId: 'message-1',
          observedValue: 'NOVA',
        }),
      }),
    );
    const auditCall: unknown = tx.auditEvent.createMany.mock.calls[0]?.[0];
    expect(auditCall).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: 'DATAPOINT_CREATED' }),
          expect.objectContaining({ action: 'DATAPOINT_SOURCE_ADDED' }),
        ]),
      }),
    );
  });

  it('preserves the canonical value while appending a conflicting observation', async () => {
    const definition = {
      id: '00000000-0000-4000-8000-000000000005',
      key: 'vehicle.year',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      validationRules: null,
    };
    const existing = { id: valueId, value: 2023 };
    const tx = {
      lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
      customerFolder: { upsert: jest.fn().mockResolvedValue({ id: folderId }) },
      datapointDefinition: {
        findFirst: jest.fn().mockResolvedValue(definition),
      },
      datapointValue: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(existing),
      },
      datapointSource: {
        create: jest.fn().mockResolvedValue({ id: sourceId }),
      },
      auditEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new DatapointsService(
      {
        $transaction: jest.fn((callback: (value: unknown) => unknown) =>
          callback(tx),
        ),
      } as never,
      profilesFor(definition) as never,
      entities as never,
    );

    const result = await service.upsertCandidate(leadId, {
      key: definition.key,
      value: 2024,
      entityType: EntityType.VEHICLE,
      entityId: '00000000-0000-4000-8000-000000000006',
      sourceType: SourceType.CUSTOMER_CHAT,
      collectionMethod: CollectionMethod.EXTRACTED,
      confidence: 0.99,
    });

    expect(result).toMatchObject({
      accepted: false,
      conflict: true,
      value: existing,
    });
    expect(tx.datapointValue.update).not.toHaveBeenCalled();
    expect(tx.datapointSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observedValue: 2024 }),
      }),
    );
  });
});

describe('DatapointsService entity boundary', () => {
  const scopedDefinition = {
    id: '00000000-0000-4000-8000-000000000105',
    key: 'vehicle.year',
    entityType: EntityType.VEHICLE,
    dataType: DataType.NUMBER,
    validationRules: null,
  };

  function boundaryService(
    options: {
      definitions?: object[];
      assertError?: Error;
      entityType?: EntityType;
    } = {},
  ) {
    const definition = {
      ...scopedDefinition,
      entityType: options.entityType ?? EntityType.VEHICLE,
      key:
        options.entityType === EntityType.DRIVER
          ? 'driver.first_name'
          : options.entityType === EntityType.PROPERTY
            ? 'property.year_built'
            : scopedDefinition.key,
      dataType:
        options.entityType === EntityType.DRIVER
          ? DataType.STRING
          : DataType.NUMBER,
    };
    const tx = {
      lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
      customerFolder: { upsert: jest.fn().mockResolvedValue({ id: folderId }) },
      datapointDefinition: {
        findFirst: jest.fn().mockResolvedValue(definition),
      },
      datapointValue: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      datapointSource: { create: jest.fn() },
      auditEvent: { createMany: jest.fn() },
    };
    const service = new DatapointsService(
      {
        $transaction: jest.fn((callback: (value: unknown) => unknown) =>
          callback(tx),
        ),
      } as never,
      {
        selectedForLead: jest.fn().mockResolvedValue(Product.AUTO),
        forProduct: jest
          .fn()
          .mockResolvedValue(options.definitions ?? [definition]),
      } as never,
      {
        assertOwnedEntityType: options.assertError
          ? jest.fn().mockRejectedValue(options.assertError)
          : jest.fn().mockResolvedValue({ id: 'entity' }),
      } as never,
    );
    return { service, tx, definition };
  }

  it.each([
    ['cross-lead VEHICLE', EntityType.VEHICLE],
    ['cross-lead DRIVER', EntityType.DRIVER],
    ['cross-lead PROPERTY', EntityType.PROPERTY],
    ['nonexistent entity', EntityType.VEHICLE],
  ])(
    'rejects %s writes before value/source creation',
    async (_label, entityType) => {
      const { service, tx, definition } = boundaryService({
        entityType,
        assertError: new BadRequestException('Entity does not belong to lead'),
      });
      await expect(
        service.upsert(leadId, {
          key: definition.key,
          value: entityType === EntityType.DRIVER ? 'Alice' : 2020,
          entityType,
          entityId: '00000000-0000-4000-8000-000000000999',
          sourceType: SourceType.CUSTOMER_FORM,
          collectionMethod: CollectionMethod.MANUAL_ENTRY,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.datapointValue.create).not.toHaveBeenCalled();
    },
  );

  it('rejects wrong entity type through lifecycle validation', async () => {
    const { service } = boundaryService({
      assertError: new BadRequestException('Entity must be VEHICLE'),
    });
    await expect(
      service.upsert(leadId, {
        key: 'vehicle.year',
        value: 2020,
        entityType: EntityType.VEHICLE,
        entityId: '00000000-0000-4000-8000-000000000200',
        sourceType: SourceType.CUSTOMER_FORM,
        collectionMethod: CollectionMethod.MANUAL_ENTRY,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects product-domain incompatible scoped values', async () => {
    const { service } = boundaryService({ definitions: [] });
    await expect(
      service.upsert(leadId, {
        key: 'vehicle.year',
        value: 2020,
        entityType: EntityType.VEHICLE,
        entityId: '00000000-0000-4000-8000-000000000200',
        sourceType: SourceType.CUSTOMER_FORM,
        collectionMethod: CollectionMethod.MANUAL_ENTRY,
      }),
    ).rejects.toThrow('selected product');
  });
});
