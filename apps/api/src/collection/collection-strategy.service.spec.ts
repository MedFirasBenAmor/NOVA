import {
  CollectionAttemptStatus,
  CollectionActionType,
  DataType,
  DatapointStatus,
  EntityDomain,
  EntityRole,
  EntityRelationType,
  EntityType,
  Product,
  CollectionMethod,
  RequirementType,
  type Prisma,
} from '@prisma/client';
import { resolveCompleteness } from '../datapoints/completeness.resolver';
import { CollectionStrategyService } from './collection-strategy.service';
import { QuestionSequenceService } from '../datapoints/question-sequence.service';

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
  sequence?: QuestionSequenceService,
) {
  const datapoints = {
    upsert: jest.fn().mockResolvedValue({}),
    completeness: jest.fn().mockResolvedValue({
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    }),
  };
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
      findFirst: jest.fn(({ where }) =>
        Promise.resolve(
          attempts.find((attempt) => {
            const item = attempt as {
              id?: string;
              actionType?: CollectionActionType;
              status?: CollectionAttemptStatus;
            };
            if (where?.id && item.id !== where.id) return false;
            if (where?.actionType && item.actionType !== where.actionType)
              return false;
            if (where?.status && item.status !== where.status) return false;
            return true;
          }),
        ),
      ),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    datapointValue: { findMany: jest.fn().mockResolvedValue([]) },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    service: new CollectionStrategyService(
      prisma as never,
      datapoints as never,
      { addCustomerMessage: jest.fn() } as never,
      { forProduct: jest.fn().mockResolvedValue(catalog) } as never,
      {
        openLoopsForLead: jest.fn().mockResolvedValue([]),
        ensureVehicleLoop: jest.fn().mockResolvedValue(undefined),
      } as never,
      reviews as never,
      sequence,
    ),
    prisma,
    datapoints,
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

  it('offers a supported document before manual collection when it can avoid later driver questions', async () => {
    const entityId = '00000000-0000-4000-8000-000000000003';
    const catalog = [
      {
        key: 'request.type',
        dataType: DataType.ENUM,
        validationRules: { allowedValues: ['NEW_PURCHASE'] },
        entityType: EntityType.CUSTOMER,
        product: Product.COMMON,
        requirementType: RequirementType.REQUIRED,
      },
      ...[
        'driver.license_type',
        'driver.first_name',
        'driver.last_name',
        'driver.date_of_birth',
      ].map((key) => ({
        key,
        dataType: key.endsWith('date_of_birth')
          ? DataType.DATE
          : key === 'driver.license_type'
            ? DataType.ENUM
            : DataType.STRING,
        validationRules:
          key === 'driver.license_type'
            ? { allowedValues: ['QUEBEC_VALID_OR_PROBATIONARY'] }
            : null,
        entityType: EntityType.DRIVER,
        product: Product.AUTO,
        requirementType: RequirementType.REQUIRED,
      })),
    ];
    const { service } = setup(
      [],
      catalog,
      undefined,
      new QuestionSequenceService(),
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
            key: 'request.type',
            entityType: EntityType.CUSTOMER,
            reason: 'REQUIRED',
          },
          {
            key: 'driver.license_type',
            entityType: EntityType.DRIVER,
            entityId,
            reason: 'REQUIRED',
          },
          {
            key: 'driver.first_name',
            entityType: EntityType.DRIVER,
            entityId,
            reason: 'REQUIRED',
          },
          {
            key: 'driver.last_name',
            entityType: EntityType.DRIVER,
            entityId,
            reason: 'REQUIRED',
          },
        ],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('SUGGEST_FULL_DOCUMENT');
    expect(result).toMatchObject({
      documentType: 'DRIVER_LICENSE',
      entityType: EntityType.DRIVER,
      entityId,
      questionsPotentiallyAvoided: 2,
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
    expect(result.type).toBe('ASK_GROUPED_DATAPOINTS');
    if (result.type === 'ASK_GROUPED_DATAPOINTS') {
      expect(result.title).toBe('Identité du conducteur');
      expect(result.datapoints.map((item) => item.key)).toEqual([
        'driver.first_name',
        'driver.last_name',
        'driver.date_of_birth',
      ]);
    }
  });

  it('saves grouped driver identity fields in one completed action', async () => {
    const leadId = '00000000-0000-4000-8000-000000000002';
    const attempt = {
      id: 'group-1',
      leadId,
      actionType: CollectionActionType.ASK_GROUPED_DATAPOINTS,
      entityType: EntityType.DRIVER,
      entityId: '00000000-0000-4000-8000-000000000001',
      status: CollectionAttemptStatus.PROPOSED,
      product: Product.AUTO,
      metadata: {
        keys: [
          'driver.first_name',
          'driver.last_name',
          'driver.date_of_birth',
        ],
      },
    };
    const { service, datapoints, prisma } = setup([attempt]);

    await service.answer(leadId, attempt.id, {
      'driver.first_name': 'Ahmed',
      'driver.last_name': 'Ben Ali',
      'driver.date_of_birth': '1988-04-12',
    });

    expect(datapoints.upsert).toHaveBeenCalledTimes(3);
    expect(datapoints.upsert).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'driver.first_name',
        entityType: EntityType.DRIVER,
        entityId: attempt.entityId,
        collectionMethod: CollectionMethod.MANUAL_QUESTION,
      }),
    );
    expect(prisma.collectionAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attempt.id },
        data: expect.objectContaining({
          status: CollectionAttemptStatus.COMPLETED,
        }),
      }),
    );
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
      {
        type: 'SINGLE_CHOICE',
        options: [
          { value: 'PLEASURE', label: 'Pleasure' },
          { value: 'WORK', label: 'Work' },
        ],
      },
    ],
    ['vehicle.commercial_use', DataType.BOOLEAN, null, { type: 'YES_NO' }],
  ])(
    'derives input semantics for %s from the catalog',
    async (key, dataType, validationRules, input) => {
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
          input,
        });
    },
  );
});

describe('CollectionStrategyService CURRENT_AUTO_POLICY_FULL', () => {
  const autoPolicyCatalog = [
    'auto.current_insurer',
    'auto.years_with_current_insurer',
    'auto.prior_policy_expiry_date',
    'auto.liability_limit_requested',
  ].map((key) => ({
    key,
    dataType: DataType.STRING,
    validationRules: null,
    entityType: EntityType.CUSTOMER,
    product: Product.AUTO,
    requirementType: RequirementType.OPTIONAL,
  }));

  it('suggests the current policy document when renewal datapoints are missing', async () => {
    const { service } = setup([], autoPolicyCatalog);
    const result = await service.select(
      '00000000-0000-4000-8000-000000000002',
      Product.AUTO,
      {
        product: 'AUTO',
        completeness: 0,
        known: [],
        missing: [
          {
            key: 'auto.current_insurer',
            entityType: EntityType.CUSTOMER,
            reason: 'OPTIONAL',
          },
          {
            key: 'auto.years_with_current_insurer',
            entityType: EntityType.CUSTOMER,
            reason: 'OPTIONAL',
          },
          {
            key: 'auto.prior_policy_expiry_date',
            entityType: EntityType.CUSTOMER,
            reason: 'CONDITIONAL',
          },
        ],
        conditionalRequired: [],
      },
    );
    expect(result.type).toBe('SUGGEST_FULL_DOCUMENT');
    expect(result).toMatchObject({
      documentType: 'CURRENT_AUTO_POLICY',
      entityType: EntityType.CUSTOMER,
    });
  });

  it('does not repeat a declined current policy suggestion', async () => {
    const leadId = '00000000-0000-4000-8000-000000000002';
    const declined = {
      id: '1',
      leadId,
      capabilityId: 'CURRENT_AUTO_POLICY_FULL',
      status: CollectionAttemptStatus.DECLINED,
      createdAt: new Date(),
      product: Product.AUTO,
    };
    const { service } = setup([declined], autoPolicyCatalog);
    const result = await service.select(leadId, Product.AUTO, {
      product: 'AUTO',
      completeness: 0,
      known: [],
      missing: [
        {
          key: 'auto.current_insurer',
          entityType: EntityType.CUSTOMER,
          reason: 'OPTIONAL',
        },
        {
          key: 'auto.years_with_current_insurer',
          entityType: EntityType.CUSTOMER,
          reason: 'OPTIONAL',
        },
      ],
      conditionalRequired: [],
    });
    expect(result.type).not.toBe('SUGGEST_FULL_DOCUMENT');
    expect(result).not.toMatchObject({ documentType: 'CURRENT_AUTO_POLICY' });
  });

  it('does not surface renewal-only policy datapoints for new business', () => {
    const renewalOnly: {
      id: string;
      key: string;
      product: Product;
      entityType: EntityType;
      requirementType: RequirementType;
      requiredWhen: Prisma.JsonValue | null;
      appliesToAdditionalEntities: boolean;
      preferredCollectionMethods: CollectionMethod[];
    }[] = autoPolicyCatalog.map((definition, index) => ({
      id: `policy-def-${index}`,
      key: definition.key,
      product: Product.AUTO,
      entityType: EntityType.CUSTOMER,
      requirementType:
        definition.key === 'auto.prior_policy_expiry_date' ||
        definition.key === 'auto.liability_limit_requested'
          ? RequirementType.CONDITIONAL
          : definition.requirementType,
      requiredWhen: {
        key: 'request.type',
        operator: 'IN',
        value: ['RENEWAL', 'BUNDLE_POLICIES'],
      },
      appliesToAdditionalEntities: true,
      preferredCollectionMethods: [],
    }));
    const result = resolveCompleteness(Product.AUTO, renewalOnly, [
      {
        definitionId: 'request-type-id',
        definition: { key: 'request.type' },
        entityType: EntityType.CUSTOMER,
        entityId: null,
        value: 'NEW_PURCHASE',
        status: DatapointStatus.CANDIDATE,
      },
    ]);
    expect(result.missing.map((item) => item.key)).not.toContain(
      'auto.prior_policy_expiry_date',
    );
  });
});

function vehicleSetup(opts: {
  product: Product;
  loop: object;
  currentVehicle?: object;
  missing?: object[];
}) {
  const catalog = [
    {
      key: 'vehicle.vin',
      dataType: DataType.STRING,
      validationRules: null,
      entityType: EntityType.VEHICLE,
      requirementType: RequirementType.REQUIRED,
    },
  ];
  const prisma = {
    datapointDefinition: { findMany: jest.fn().mockResolvedValue(catalog) },
    collectionAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'attempt-vehicle-1', ...opts.loop }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(undefined),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    datapointValue: { findMany: jest.fn().mockResolvedValue([]) },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { update: jest.fn().mockResolvedValue({}) },
    dossierEntity: {
      findFirst: jest.fn().mockResolvedValue(opts.currentVehicle),
    },
  };
  const entities = {
    openLoopsForLead: jest.fn().mockResolvedValue([opts.loop]),
    ensureVehicleLoop: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new CollectionStrategyService(
      prisma as never,
      { upsert: jest.fn() } as never,
      { addCustomerMessage: jest.fn() } as never,
      { forProduct: jest.fn().mockResolvedValue(catalog) } as never,
      entities as never,
      undefined,
      undefined,
    ),
    ensureVehicleLoop: entities.ensureVehicleLoop,
    prisma,
  };
}

describe('CollectionStrategyService VEHICLE loop', () => {
  it('ensures the vehicle loop for AUTO', async () => {
    const { service, ensureVehicleLoop } = vehicleSetup({
      product: Product.AUTO,
      loop: { id: 'loop-1' },
    });
    await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(ensureVehicleLoop).toHaveBeenCalledWith('lead-1');
    expect(ensureVehicleLoop).toHaveBeenCalledTimes(1);
  });

  it('ensures the vehicle loop for AUTO_HOME', async () => {
    const { service, ensureVehicleLoop } = vehicleSetup({
      product: Product.AUTO_HOME,
      loop: { id: 'loop-1' },
    });
    await service.select('lead-1', Product.AUTO_HOME, {
      product: 'AUTO_HOME',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(ensureVehicleLoop).toHaveBeenCalledWith('lead-1');
  });

  it('does not ensure the vehicle loop for HOME', async () => {
    const { service, ensureVehicleLoop } = vehicleSetup({
      product: Product.HOME,
      loop: { id: 'loop-1' },
    });
    await service.select('lead-1', Product.HOME, {
      product: 'HOME',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(ensureVehicleLoop).not.toHaveBeenCalled();
  });

  it('asks the missing vehicle datapoint while the current vehicle is incomplete', async () => {
    const vehicleId = 'vehicle-1';
    const { service, prisma } = vehicleSetup({
      product: Product.AUTO,
      loop: { id: 'loop-1', entityType: EntityType.VEHICLE, currentOrdinal: 1 },
      currentVehicle: { id: vehicleId },
      missing: [
        {
          key: 'vehicle.vin',
          entityType: EntityType.VEHICLE,
          entityId: vehicleId,
          reason: 'REQUIRED',
        },
      ],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 0,
      known: [],
      missing: [
        {
          key: 'vehicle.vin',
          entityType: EntityType.VEHICLE,
          entityId: vehicleId,
          reason: 'REQUIRED',
        },
      ],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('vehicle.vin');
      expect(result.datapoint.entityId).toBe(vehicleId);
      expect(result.datapoint.entityLabel).toBeUndefined();
    }
    expect(prisma.dossierEntity.findFirst).toHaveBeenCalledWith({
      where: {
        customerFolder: { leadId: 'lead-1' },
        entityType: EntityType.VEHICLE,
        role: EntityRole.PRIMARY,
        domain: EntityDomain.NONE,
        ordinal: 1,
      },
    });
  });

  it('offers to add another vehicle once Vehicle 1 is complete', async () => {
    const loop = {
      id: 'loop-1',
      entityType: EntityType.VEHICLE,
      role: 'REPEATABLE',
      domain: 'AUTO',
      currentOrdinal: 1,
    };
    const { service, prisma } = vehicleSetup({
      product: Product.AUTO,
      loop,
      currentVehicle: { id: 'vehicle-1' },
      missing: [],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_ADD_ANOTHER_ENTITY');
    if (result.type === 'ASK_ADD_ANOTHER_ENTITY') {
      expect(result.entityType).toBe('VEHICLE');
      expect(result.question).toBe('Voulez-vous ajouter un autre véhicule ?');
      expect(result.label).toBe('Véhicule 1');
      expect(result.ordinal).toBe(1);
    }
    expect(prisma.dossierEntity.findFirst).toHaveBeenCalledWith({
      where: {
        customerFolder: { leadId: 'lead-1' },
        entityType: EntityType.VEHICLE,
        role: EntityRole.PRIMARY,
        domain: EntityDomain.NONE,
        ordinal: 1,
      },
    });
  });

  it('asks Vehicle 2 datapoints after the first YES-created vehicle exists', async () => {
    const vehicleId = 'vehicle-2';
    const { service, prisma } = vehicleSetup({
      product: Product.AUTO,
      loop: {
        id: 'loop-1',
        entityType: EntityType.VEHICLE,
        role: EntityRole.REPEATABLE,
        domain: EntityDomain.AUTO,
        currentOrdinal: 2,
      },
      currentVehicle: { id: vehicleId },
      missing: [
        {
          key: 'vehicle.vin',
          entityType: EntityType.VEHICLE,
          entityId: vehicleId,
          reason: 'REQUIRED',
        },
      ],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 50,
      known: [],
      missing: [
        {
          key: 'vehicle.vin',
          entityType: EntityType.VEHICLE,
          entityId: vehicleId,
          reason: 'REQUIRED',
        },
      ],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('vehicle.vin');
      expect(result.datapoint.entityId).toBe(vehicleId);
      expect(result.datapoint.entityLabel).toBe('Véhicule 2');
    }
    expect(prisma.dossierEntity.findFirst).toHaveBeenCalledWith({
      where: {
        customerFolder: { leadId: 'lead-1' },
        entityType: EntityType.VEHICLE,
        role: EntityRole.REPEATABLE,
        domain: EntityDomain.AUTO,
        ordinal: 2,
      },
    });
  });

  it('offers to add another vehicle once Vehicle 2 is complete', async () => {
    const { service } = vehicleSetup({
      product: Product.AUTO,
      loop: {
        id: 'loop-1',
        entityType: EntityType.VEHICLE,
        role: EntityRole.REPEATABLE,
        domain: EntityDomain.AUTO,
        currentOrdinal: 2,
      },
      currentVehicle: { id: 'vehicle-2' },
      missing: [],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_ADD_ANOTHER_ENTITY');
    if (result.type === 'ASK_ADD_ANOTHER_ENTITY') {
      expect(result.entityType).toBe('VEHICLE');
      expect(result.question).toBe('Voulez-vous ajouter un autre véhicule ?');
      expect(result.label).toBe('Véhicule 2');
      expect(result.ordinal).toBe(2);
    }
  });

  it('labels the next vehicle with the loop ordinal', async () => {
    const { service } = vehicleSetup({
      product: Product.AUTO,
      loop: {
        id: 'loop-1',
        entityType: EntityType.VEHICLE,
        role: 'REPEATABLE',
        domain: 'AUTO',
        currentOrdinal: 3,
      },
      currentVehicle: { id: 'vehicle-3' },
      missing: [],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_ADD_ANOTHER_ENTITY');
    if (result.type === 'ASK_ADD_ANOTHER_ENTITY') {
      expect(result.label).toBe('Véhicule 3');
    }
  });

  it('keeps DRIVER loop wording unchanged', async () => {
    const { service } = vehicleSetup({
      product: Product.AUTO,
      loop: {
        id: 'driver-loop',
        entityType: EntityType.DRIVER,
        role: 'ADDITIONAL',
        domain: 'AUTO',
        currentOrdinal: 2,
      },
      currentVehicle: { id: 'driver-2' },
      missing: [],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_ADD_ANOTHER_ENTITY');
    if (result.type === 'ASK_ADD_ANOTHER_ENTITY') {
      expect(result.entityType).toBe('DRIVER');
      expect(result.question).toBe('Do you want to add another driver?');
      expect(result.label).toBe('Additional driver 1');
    }
  });

  it('keeps CLAIM loop wording unchanged', async () => {
    const { service } = vehicleSetup({
      product: Product.AUTO,
      loop: {
        id: 'claim-loop',
        entityType: EntityType.CLAIM,
        role: 'REPEATABLE',
        domain: 'AUTO',
        currentOrdinal: 1,
      },
      currentVehicle: { id: 'claim-1' },
      missing: [],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASK_ADD_ANOTHER_ENTITY');
    if (result.type === 'ASK_ADD_ANOTHER_ENTITY') {
      expect(result.entityType).toBe('CLAIM');
      expect(result.question).toBe('Do you want to add another claim?');
      expect(result.label).toBe('Auto claim 1');
    }
  });
});

function assignmentSetup(opts: {
  vehicles: Array<{ id: string; ordinal: number }>;
  drivers: Array<{
    id: string;
    ordinal: number;
    first?: string;
    last?: string;
  }>;
  relations?: Array<{
    fromEntityId: string;
    toEntityId: string;
    relationType: EntityRelationType;
  }>;
  attempts?: object[];
}) {
  const folderId = 'folder-1';
  const entities = [
    ...opts.vehicles.map((vehicle) => ({
      id: vehicle.id,
      customerFolderId: folderId,
      entityType: EntityType.VEHICLE,
      role: vehicle.ordinal === 1 ? EntityRole.PRIMARY : EntityRole.REPEATABLE,
      domain: vehicle.ordinal === 1 ? EntityDomain.NONE : EntityDomain.AUTO,
      ordinal: vehicle.ordinal,
    })),
    ...opts.drivers.map((driver) => ({
      id: driver.id,
      customerFolderId: folderId,
      entityType: EntityType.DRIVER,
      role: driver.ordinal === 1 ? EntityRole.PRIMARY : EntityRole.ADDITIONAL,
      domain: driver.ordinal === 1 ? EntityDomain.NONE : EntityDomain.AUTO,
      ordinal: driver.ordinal,
    })),
  ];
  const attempts = opts.attempts ?? [];
  type FindManyArgs = {
    where?: { actionType?: CollectionActionType };
  };
  type FindUniqueArgs = { where: { id: string } };
  const prisma = {
    datapointDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    collectionAttempt: {
      findMany: jest.fn(({ where }: FindManyArgs) =>
        Promise.resolve(
          where?.actionType === CollectionActionType.ASSIGN_ENTITY_RELATION
            ? attempts
            : [],
        ),
      ),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: 'assign-attempt-1',
          status: CollectionAttemptStatus.PROPOSED,
          createdAt: new Date(),
          ...data,
        }),
      ),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(undefined),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    datapointValue: {
      findMany: jest.fn().mockResolvedValue(
        opts.drivers.flatMap((driver) => [
          {
            entityId: driver.id,
            value: driver.first,
            definition: { key: 'driver.first_name' },
          },
          {
            entityId: driver.id,
            value: driver.last,
            definition: { key: 'driver.last_name' },
          },
        ]),
      ),
    },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { update: jest.fn().mockResolvedValue({}) },
    customerFolder: {
      findUnique: jest.fn().mockResolvedValue({ id: folderId }),
    },
    dossierEntity: {
      findMany: jest.fn().mockResolvedValue(entities),
      findUnique: jest.fn(({ where }: FindUniqueArgs) =>
        Promise.resolve(entities.find((entity) => entity.id === where.id)),
      ),
    },
    entityRelation: {
      findMany: jest.fn().mockResolvedValue(
        (opts.relations ?? []).map((relation, index) => ({
          id: `relation-${index}`,
          customerFolderId: folderId,
          createdAt: new Date(index),
          ...relation,
        })),
      ),
    },
  };
  return {
    service: new CollectionStrategyService(
      prisma as never,
      { upsert: jest.fn() } as never,
      { addCustomerMessage: jest.fn() } as never,
      { forProduct: jest.fn().mockResolvedValue([]) } as never,
      {
        openLoopsForLead: jest.fn().mockResolvedValue([]),
        ensureVehicleLoop: jest.fn().mockResolvedValue(undefined),
      } as never,
      undefined,
      undefined,
      {} as never,
    ),
    prisma,
  };
}

describe('CollectionStrategyService DRIVER to VEHICLE assignment', () => {
  it('asks Vehicle 1 assignment first with dynamic driver names', async () => {
    const { service } = assignmentSetup({
      vehicles: [
        { id: 'vehicle-1', ordinal: 1 },
        { id: 'vehicle-2', ordinal: 2 },
      ],
      drivers: [
        { id: 'driver-a', ordinal: 1, first: 'Ahmed', last: 'Ben Ali' },
        { id: 'driver-b', ordinal: 2, first: 'Sarah', last: 'Ben Ali' },
      ],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASSIGN_ENTITY_RELATION');
    if (result.type === 'ASSIGN_ENTITY_RELATION') {
      expect(result.prompt).toBe('PRIMARY_DRIVER');
      expect(result.targetEntityId).toBe('vehicle-1');
      expect(result.vehicleLabel).toBe('Véhicule 1');
      expect(result.question).toBe(
        'Qui conduit principalement le véhicule 1 ?',
      );
      expect(result.options).toEqual([
        { entityId: 'driver-a', label: 'Ahmed Ben Ali' },
        { entityId: 'driver-b', label: 'Sarah Ben Ali' },
      ]);
    }
  });

  it('does not ask Vehicle 2 when only Vehicle 1 exists and is assigned', async () => {
    const { service } = assignmentSetup({
      vehicles: [{ id: 'vehicle-1', ordinal: 1 }],
      drivers: [
        { id: 'driver-a', ordinal: 1, first: 'Ahmed', last: 'Ben Ali' },
      ],
      relations: [
        {
          fromEntityId: 'driver-a',
          toEntityId: 'vehicle-1',
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        },
      ],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('COMPLETE');
  });

  it('skips already assigned Vehicle 1 and resumes at Vehicle 2', async () => {
    const { service } = assignmentSetup({
      vehicles: [
        { id: 'vehicle-1', ordinal: 1 },
        { id: 'vehicle-2', ordinal: 2 },
      ],
      drivers: [
        { id: 'driver-a', ordinal: 1, first: 'Ahmed', last: 'Ben Ali' },
        { id: 'driver-b', ordinal: 2, first: 'Sarah', last: 'Ben Ali' },
      ],
      relations: [
        {
          fromEntityId: 'driver-a',
          toEntityId: 'vehicle-1',
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        },
      ],
    });
    const result = await service.select('lead-1', Product.AUTO, {
      product: 'AUTO',
      completeness: 100,
      known: [],
      missing: [],
      conditionalRequired: [],
    });
    expect(result.type).toBe('ASSIGN_ENTITY_RELATION');
    if (result.type === 'ASSIGN_ENTITY_RELATION') {
      expect(result.targetEntityId).toBe('vehicle-2');
      expect(result.vehicleLabel).toBe('Véhicule 2');
    }
  });
});
