import {
  CollectionAttemptStatus,
  DataType,
  EntityType,
  Product,
  RequirementType,
} from '@prisma/client';
import { CollectionStrategyService } from './collection-strategy.service';

const missing = (
  key: string,
  entityId = '00000000-0000-4000-8000-000000000001',
) => ({
  key,
  entityType: EntityType.DRIVER,
  entityId,
  reason: 'REQUIRED' as const,
});
const definitions = [
  'driver.first_name',
  'driver.last_name',
  'driver.date_of_birth',
].map((key) => ({
  key,
  dataType: key.endsWith('date_of_birth') ? DataType.DATE : DataType.STRING,
  validationRules: null,
  entityType: EntityType.DRIVER,
  requirementType: RequirementType.REQUIRED,
}));

function setup(
  attempts: object[] = [],
  catalog: object[] = definitions,
  reviews?: object,
) {
  const prisma = {
    datapointDefinition: { findMany: jest.fn().mockResolvedValue(catalog) },
    collectionAttempt: {
      findMany: jest.fn().mockResolvedValue(attempts),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: '00000000-0000-4000-8000-000000000099',
          ...data,
        }),
      ),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(attempts[0]),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    datapointValue: { findMany: jest.fn().mockResolvedValue([]) },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    service: new CollectionStrategyService(
      prisma as never,
      { upsert: jest.fn() } as never,
      { addCustomerMessage: jest.fn() } as never,
      { forProduct: jest.fn().mockResolvedValue(catalog) } as never,
      { openLoopsForLead: jest.fn().mockResolvedValue([]) } as never,
      reviews as never,
    ),
    prisma,
  };
}

describe('CollectionStrategyService', () => {
  it('suggests a full document for several current missing values', async () => {
    const { service } = setup();
    const result = await service.select(
      '00000000-0000-4000-8000-000000000002',
      Product.AUTO,
      {
        product: 'AUTO',
        completeness: 0,
        known: [],
        missing: [
          missing('driver.first_name'),
          missing('driver.last_name'),
          missing('driver.date_of_birth'),
        ],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('SUGGEST_FULL_DOCUMENT');
    expect(result).toMatchObject({
      questionsPotentiallyAvoided: 3,
      documentType: 'DRIVER_LICENSE',
    });
  });

  it('falls back to targeted capture then manual after declines', async () => {
    const leadId = '00000000-0000-4000-8000-000000000002';
    const declinedFull = {
      id: '1',
      leadId,
      capabilityId: 'DRIVER_LICENSE_FULL',
      status: CollectionAttemptStatus.DECLINED,
      createdAt: new Date(),
      product: Product.AUTO,
    };
    const { service } = setup([declinedFull]);
    const complete = {
      product: 'AUTO' as const,
      completeness: 0,
      known: [],
      missing: [
        missing('driver.first_name'),
        missing('driver.last_name'),
        missing('driver.date_of_birth'),
      ],
      conditionalRequired: [],
    };
    expect((await service.select(leadId, Product.AUTO, complete)).type).toBe(
      'SUGGEST_TARGETED_CAPTURE',
    );
    const declinedTargeted = {
      ...declinedFull,
      id: '2',
      capabilityId: 'DRIVER_LICENSE_TARGETED',
    };
    const manual = setup([declinedTargeted, declinedFull]);
    const result = await manual.service.select(leadId, Product.AUTO, complete);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('driver.first_name');
      expect(result.ui.inputType).toBe('TEXT');
    }
  });

  it('returns COMPLETE when nothing is missing', async () => {
    const { service } = setup();
    const result = await service.select(
      '00000000-0000-4000-8000-000000000002',
      Product.AUTO,
      {
        product: 'AUTO',
        completeness: 100,
        known: [],
        missing: [],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('COMPLETE');
  });

  it('returns REVIEW_SECTION before COMPLETE when data is complete but unconfirmed', async () => {
    const { service } = setup([], definitions, {
      nextReviewAction: jest.fn().mockResolvedValue({
        type: 'REVIEW_SECTION',
        actionId: 'review-action',
        confirmationId: 'confirmation-1',
        sectionCode: 'AUTO_DRIVER',
        title: 'Drivers',
        snapshotHash: 'hash',
        groups: [],
      }),
    });
    const result = await service.select(
      '00000000-0000-4000-8000-000000000002',
      Product.AUTO,
      {
        product: 'AUTO',
        completeness: 100,
        known: [],
        missing: [],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('REVIEW_SECTION');
  });

  it('waits for an uploaded document instead of asking covered questions', async () => {
    const { service, prisma } = setup();
    prisma.document.findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000088',
        documentType: 'DRIVER_LICENSE',
        status: 'UPLOADED',
      },
    ]);
    const result = await service.select(
      '00000000-0000-4000-8000-000000000002',
      Product.AUTO,
      {
        product: 'AUTO',
        completeness: 0,
        known: [],
        missing: [missing('driver.first_name')],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('WAIT_FOR_PROCESSING');
  });

  it.each([
    [
      'vehicle.primary_use',
      DataType.ENUM,
      { allowedValues: ['PLEASURE', 'WORK'] },
      'SINGLE_CHOICE',
      ['PLEASURE', 'WORK'],
    ],
    ['vehicle.commercial_use', DataType.BOOLEAN, null, 'YES_NO', undefined],
  ])(
    'derives UI semantics for %s from the catalog',
    async (key, dataType, validationRules, inputType, options) => {
      const entityId = '00000000-0000-4000-8000-000000000003';
      const { service } = setup(
        [],
        [{ key, dataType, validationRules, entityType: EntityType.VEHICLE }],
      );
      const result = await service.select(
        '00000000-0000-4000-8000-000000000002',
        Product.AUTO,
        {
          product: 'AUTO',
          completeness: 0,
          known: [],
          missing: [
            {
              key,
              entityType: EntityType.VEHICLE,
              entityId,
              reason: 'REQUIRED',
            },
          ],
          conditionalRequired: [],
        },
      );
      expect(result.type).toBe('ASK_DATAPOINT');
      if (result.type === 'ASK_DATAPOINT')
        expect(result).toMatchObject({
          datapoint: { key, entityId },
          ui: { inputType, ...(options ? { options } : {}) },
        });
    },
  );
});
