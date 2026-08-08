/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import {
  DataType,
  EntityType,
  SourceType,
  CollectionMethod,
} from '@prisma/client';
import { DatapointsService } from './datapoints.service';

const leadId = '00000000-0000-4000-8000-000000000001';
const folderId = '00000000-0000-4000-8000-000000000002';
const valueId = '00000000-0000-4000-8000-000000000003';
const sourceId = '00000000-0000-4000-8000-000000000004';

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
    const service = new DatapointsService(prisma);

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
    const service = new DatapointsService(prisma);

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
    const service = new DatapointsService({
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(tx),
      ),
    } as never);

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
