import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataType, EntityType, Product, RequirementType } from '@prisma/client';
import { DatapointsService } from '../datapoints/datapoints.service';
import { IntelligenceService } from './intelligence.service';

const leadId = '00000000-0000-4000-8000-000000000001';
const vehicleId = '00000000-0000-4000-8000-000000000002';
const valueId = '00000000-0000-4000-8000-000000000003';

const definition = (
  key: string,
  dataType: DataType,
  validationRules: object | null = null,
) => ({
  id: `00000000-0000-4000-8000-${String(key.length).padStart(12, '0')}`,
  key,
  label: key,
  description: key,
  product: Product.AUTO,
  category: 'TEST',
  entityType: EntityType.VEHICLE,
  dataType,
  requirementType: RequirementType.OPTIONAL,
  requiredWhen: null,
  possibleSources: [],
  preferredCollectionMethods: [],
  validationRules,
  riskImpact: 'NONE',
  eligibilityImpact: 'NONE',
  appliesToAdditionalEntities: true,
  active: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function serviceWith(
  result: object,
  definitions: object[],
  selectedProduct: Product | null = Product.AUTO,
  options: { values?: object[]; provider?: { analyze: jest.Mock } } = {},
) {
  const prisma = {
    lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
    datapointDefinition: { findMany: jest.fn().mockResolvedValue(definitions) },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prismaForValidation = new DatapointsService(
    {} as never,
    {} as never,
    {} as never,
  );
  const profiles = {
    selectedForLead: jest.fn().mockResolvedValue(selectedProduct ?? undefined),
    forProduct: jest.fn().mockResolvedValue(definitions),
    isSelectable: jest.fn((product: Product) =>
      [Product.AUTO, Product.HOME, Product.AUTO_HOME].includes(
        product as never,
      ),
    ),
  };
  const datapoints = {
    values: jest.fn().mockResolvedValue(options.values ?? []),
    validateInput: prismaForValidation.validateInput.bind(prismaForValidation),
    upsert: jest.fn().mockResolvedValue({ id: valueId }),
    upsertCandidate: jest.fn().mockResolvedValue({
      accepted: true,
      conflict: false,
      value: { id: valueId },
    }),
    completeness: jest.fn().mockResolvedValue({
      product: 'AUTO',
      completeness: 50,
      known: [],
      missing: [],
      conditionalRequired: [],
    }),
  };
  const intake = {
    currentAction: jest
      .fn()
      .mockResolvedValue({ type: 'COMPLETE', actionId: 'action' }),
    selectProduct: jest.fn().mockResolvedValue({}),
    productSelectionAction: jest.fn().mockReturnValue({
      type: 'SELECT_PRODUCT',
      actionId: 'select-product',
      options: [],
    }),
  };
  const entities = {
    ensurePrimaryEntitiesForProduct: jest.fn().mockResolvedValue({
      VEHICLE: vehicleId,
      DRIVER: '00000000-0000-4000-8000-000000000077',
      PROPERTY: '00000000-0000-4000-8000-000000000088',
    }),
    isPrimaryScopedType: jest.fn((entityType: EntityType) =>
      [EntityType.VEHICLE, EntityType.DRIVER, EntityType.PROPERTY].includes(
        entityType as never,
      ),
    ),
  };
  return {
    service: new IntelligenceService(
      options.provider ?? { analyze: jest.fn().mockResolvedValue(result) },
      prisma as never,
      datapoints as never,
      { addCustomerMessage: jest.fn().mockResolvedValue({}) } as never,
      intake as never,
      entities as never,
      profiles as never,
    ),
    prisma,
    datapoints,
    intake,
    entities,
    profiles,
  };
}

describe('IntelligenceService', () => {
  it('ingests multiple valid candidates and returns updated completeness metrics', async () => {
    const definitions = [
      definition('vehicle.model', DataType.STRING),
      definition('vehicle.year', DataType.NUMBER),
    ];
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'NEW_ACQUISITION', confidence: 0.9 },
        product: { type: 'AUTO', confidence: 0.99 },
        events: [{ type: 'VEHICLE_PURCHASE', confidence: 0.95 }],
        candidateDatapoints: [
          {
            key: 'vehicle.model',
            value: 'RAV4',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.99,
          },
          {
            key: 'vehicle.year',
            value: 2024,
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
    );

    const response = await service.analyze(leadId, {
      message: 'synthetic message',
      entityContext: { vehicleId },
    });
    expect(response.metrics).toMatchObject({
      candidateDatapointsDetected: 2,
      acceptedCandidateDatapoints: 2,
      newDatapointsAdded: 2,
    });
    expect(response.completeness.completeness).toBe(50);
    expect(response.nextAction).toEqual({
      type: 'COMPLETE',
      actionId: 'action',
    });
    expect(datapoints.upsertCandidate).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown keys, wrong datatypes, and invalid enum values', async () => {
    const definitions = [
      definition('vehicle.model', DataType.STRING),
      definition('vehicle.year', DataType.NUMBER),
      definition('vehicle.financing_status', DataType.ENUM, {
        allowedValues: ['FINANCED', 'LEASED', 'PAID'],
      }),
    ];
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.8 },
        product: { type: 'AUTO', confidence: 0.9 },
        events: [],
        candidateDatapoints: [
          {
            key: 'vehicle.unknown',
            value: 'x',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.9,
          },
          {
            key: 'vehicle.year',
            value: '2024',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.9,
          },
          {
            key: 'vehicle.financing_status',
            value: 'UNKNOWN',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.9,
          },
        ],
      },
      definitions,
    );

    const response = await service.analyze(leadId, {
      message: 'synthetic message',
      entityContext: { vehicleId },
    });
    expect(response.metrics).toMatchObject({
      candidateDatapointsDetected: 3,
      acceptedCandidateDatapoints: 0,
      rejectedCandidateDatapoints: 3,
    });
    expect(datapoints.upsertCandidate).not.toHaveBeenCalled();
  });

  it('allows explicit customer correction to update an existing candidate value', async () => {
    const definitions = [definition('vehicle.model', DataType.STRING)];
    const existing = {
      value: 'RAV4',
      entityId: vehicleId,
      status: 'EXTRACTED',
      definition: definitions[0],
    };
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.8 },
        product: { type: 'AUTO', confidence: 0.95 },
        events: [],
        candidateDatapoints: [
          {
            key: 'vehicle.model',
            value: 'CR-V',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
      Product.AUTO,
      { values: [existing] },
    );

    const response = await service.analyze(leadId, {
      message: 'No, you are wrong, it is a CR-V.',
    });

    expect(response.metrics.acceptedCandidateDatapoints).toBe(1);
    expect(datapoints.upsert).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({ key: 'vehicle.model', value: 'CR-V' }),
    );
    expect(datapoints.upsertCandidate).not.toHaveBeenCalled();
  });

  it('supports a zero-datapoint interaction', async () => {
    const { service } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.7 },
        product: { type: 'COMMON', confidence: 0.7 },
        events: [],
        candidateDatapoints: [],
      },
      [],
    );
    const response = await service.analyze(leadId, { message: 'Hello' });
    expect(response.metrics).toMatchObject({
      candidateDatapointsDetected: 0,
      acceptedCandidateDatapoints: 0,
      rejectedCandidateDatapoints: 0,
    });
  });

  it.each([Product.AUTO, Product.HOME, Product.AUTO_HOME])(
    'keeps selected %s authoritative over provider product output',
    async (selectedProduct) => {
      const definitions = [definition('vehicle.model', DataType.STRING)];
      const { service, datapoints, profiles } = serviceWith(
        {
          intent: { type: 'INSURANCE_SHOPPING', confidence: 0.9 },
          product: {
            type: selectedProduct === Product.HOME ? 'AUTO' : 'HOME',
            confidence: 0.99,
          },
          events: [],
          candidateDatapoints: [],
        },
        definitions,
        selectedProduct,
      );

      await service.analyze(leadId, { message: 'synthetic message' });
      expect(profiles.forProduct).toHaveBeenCalledWith(selectedProduct);
      expect(datapoints.completeness).toHaveBeenCalledWith(
        leadId,
        selectedProduct,
      );
    },
  );

  it('returns SELECT_PRODUCT when no product is selected and provider confidence is not authoritative', async () => {
    const { service, datapoints, profiles } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.7 },
        product: { type: 'COMMON', confidence: 0.7 },
        events: [],
        candidateDatapoints: [],
      },
      [],
      undefined,
    );
    profiles.selectedForLead.mockResolvedValueOnce(undefined);
    const response = await service.analyze(leadId, { message: 'Hello' });
    expect(response.nextAction.type).toBe('SELECT_PRODUCT');
    expect(datapoints.completeness).not.toHaveBeenCalled();
  });

  it('persists high-confidence auto product intent from chat before datapoint ingestion', async () => {
    const definitions = [definition('vehicle.model', DataType.STRING)];
    const { service, datapoints, intake, entities } = serviceWith(
      {
        intent: { type: 'INSURANCE_SHOPPING', confidence: 0.95 },
        product: { type: 'AUTO', confidence: 0.99 },
        events: [],
        candidateDatapoints: [
          {
            key: 'vehicle.model',
            value: 'RAV4',
            entityType: 'VEHICLE',
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
      null,
    );

    const response = await service.analyze(leadId, {
      message: 'Hi, I want to insure my car. It is a RAV4.',
    });

    expect(intake.selectProduct).toHaveBeenCalledWith(leadId, Product.AUTO);
    expect(entities.ensurePrimaryEntitiesForProduct).toHaveBeenCalledWith(
      leadId,
      Product.AUTO,
    );
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'vehicle.model',
        entityId: vehicleId,
      }),
    );
    expect(response.metrics.productSelectedByIntelligence).toBe(1);
  });

  it('can persist common customer facts before product selection', async () => {
    const definitions = [
      {
        ...definition('customer.first_name', DataType.STRING),
        product: Product.COMMON,
        entityType: EntityType.CUSTOMER,
      },
    ];
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.8 },
        product: { type: 'COMMON', confidence: 0.7 },
        events: [],
        candidateDatapoints: [
          {
            key: 'customer.first_name',
            value: 'Alice',
            entityType: 'CUSTOMER',
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
      null,
    );

    const response = await service.analyze(leadId, {
      message: 'My name is Alice.',
    });

    expect(response.nextAction.type).toBe('SELECT_PRODUCT');
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'customer.first_name',
        value: 'Alice',
      }),
    );
  });

  it('extracts full name and birth date from a mixed common paragraph', async () => {
    const definitions = [
      {
        ...definition('customer.first_name', DataType.STRING),
        product: Product.COMMON,
        entityType: EntityType.CUSTOMER,
      },
      {
        ...definition('customer.last_name', DataType.STRING),
        product: Product.COMMON,
        entityType: EntityType.CUSTOMER,
      },
      {
        ...definition('customer.date_of_birth', DataType.DATE),
        product: Product.COMMON,
        entityType: EntityType.CUSTOMER,
      },
    ];
    const provider = {
      analyze: jest.fn().mockResolvedValue({
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.8 },
        product: { type: 'COMMON', confidence: 0.7 },
        events: [],
        candidateDatapoints: [],
      }),
    };
    const { service, datapoints } = serviceWith({}, definitions, null, {
      provider,
    });

    const response = await service.analyze(leadId, {
      message: 'my full name is Med Firas Ben Amor, i have born on 15/09/2003',
    });

    expect(response.metrics.acceptedCandidateDatapoints).toBe(3);
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'customer.first_name',
        value: 'Med Firas',
      }),
    );
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'customer.last_name',
        value: 'Ben Amor',
      }),
    );
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'customer.date_of_birth',
        value: '2003-09-15',
      }),
    );
  });

  it('extracts explicit product and vehicle facts from one paragraph when Gemini degrades', async () => {
    const definitions = [
      definition('vehicle.year', DataType.NUMBER),
      definition('vehicle.make', DataType.STRING),
      definition('vehicle.model', DataType.STRING),
    ];
    const provider = {
      analyze: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('GEMINI_TIMEOUT')),
    };
    const { service, datapoints, intake } = serviceWith({}, definitions, null, {
      provider,
    });

    const response = await service.analyze(leadId, {
      message:
        'hi, i was born on 15/09/2003 and i want to insure my car, it is a 2024 Toyota RAV4',
    });

    expect(intake.selectProduct).toHaveBeenCalledWith(leadId, Product.AUTO);
    expect(response.metrics.productSelectedByIntelligence).toBe(1);
    expect(response.metrics.acceptedCandidateDatapoints).toBe(3);
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({ key: 'vehicle.year', value: 2024 }),
    );
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({ key: 'vehicle.make', value: 'Toyota' }),
    );
    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({ key: 'vehicle.model', value: 'RAV4' }),
    );
  });

  it('rejects invalid pre-product candidates without blocking product selection', async () => {
    const definitions = [definition('vehicle.model', DataType.STRING)];
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.8 },
        product: { type: 'COMMON', confidence: 0.7 },
        events: [],
        candidateDatapoints: [
          {
            key: 'vehicle.model',
            value: 'RAV4',
            entityType: 'VEHICLE',
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
      null,
    );
    datapoints.upsertCandidate.mockRejectedValueOnce(
      new BadRequestException('Product must be selected first'),
    );

    // A product-neutral message keeps the candidate unscoped: the provider still
    // emits the RAV4 candidate, but no product can be inferred from the text.
    const response = await service.analyze(leadId, {
      message: 'Hello, I need some help.',
    });

    expect(response.nextAction.type).toBe('SELECT_PRODUCT');
    expect(response.rejections).toEqual([
      { key: 'vehicle.model', reason: 'vehicle.model requires an entityId' },
    ]);
  });

  it('rejects malformed provider output before ingestion', async () => {
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'NOT_A_REAL_INTENT', confidence: 0.8 },
        product: { type: 'AUTO', confidence: 0.9 },
        events: [],
        candidateDatapoints: [],
      },
      [],
    );
    await expect(
      service.analyze(leadId, { message: 'synthetic message' }),
    ).rejects.toThrow(BadGatewayException);
    expect(datapoints.upsertCandidate).not.toHaveBeenCalled();
  });

  it('continues deterministic collection when the intelligence provider times out', async () => {
    const provider = {
      analyze: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('GEMINI_TIMEOUT')),
    };
    const definitions = [definition('vehicle.model', DataType.STRING)];
    const { service, datapoints, intake, prisma } = serviceWith(
      {},
      definitions,
      Product.AUTO,
      { provider },
    );

    const response = await service.analyze(leadId, {
      message: 'Synthetic timeout fallback.',
    });

    expect(provider.analyze).toHaveBeenCalledTimes(1);
    expect(datapoints.upsertCandidate).not.toHaveBeenCalled();
    expect(response.intelligence.candidateDatapoints).toEqual([]);
    expect(response.metrics).toMatchObject({
      candidateDatapointsDetected: 0,
      acceptedCandidateDatapoints: 0,
      intelligenceProviderDegraded: 1,
    });
    expect(intake.currentAction).toHaveBeenCalledWith(leadId);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        action: 'INTELLIGENCE_ANALYSIS_COMPLETED',
        entityType: 'Lead',
        entityId: leadId,
      },
    });
  });

  it('selects an explicit auto product phrase even when Gemini is unavailable', async () => {
    const provider = {
      analyze: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException('GEMINI_PROVIDER_UNAVAILABLE'),
        ),
    };
    const { service, intake } = serviceWith({}, [], null, { provider });

    const response = await service.analyze(leadId, {
      message: 'hi, i want to insure my car',
    });

    expect(intake.selectProduct).toHaveBeenCalledWith(leadId, Product.AUTO);
    expect(response.nextAction.type).toBe('COMPLETE');
    expect(response.metrics.intelligenceProviderDegraded).toBe(1);
    expect(response.metrics.productSelectedByIntelligence).toBe(1);
  });

  it('returns product selection without Gemini when product is unknown', async () => {
    const provider = {
      analyze: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException('GEMINI_PROVIDER_UNAVAILABLE'),
        ),
    };
    const { service, datapoints } = serviceWith({}, [], null, { provider });

    const response = await service.analyze(leadId, {
      message: 'Synthetic unavailable fallback.',
    });

    expect(response.nextAction.type).toBe('SELECT_PRODUCT');
    expect(response.intelligence.candidateDatapoints).toEqual([]);
    expect(response.metrics.intelligenceProviderDegraded).toBe(1);
    expect(datapoints.upsertCandidate).not.toHaveBeenCalled();
  });
});

describe('IntelligenceService entity normalization', () => {
  const typedDefinition = (
    key: string,
    entityType: EntityType,
    dataType = DataType.STRING,
  ) => ({
    ...definition(key, dataType),
    entityType,
  });

  it.each([
    ['vehicle.model', EntityType.VEHICLE, vehicleId],
    [
      'driver.first_name',
      EntityType.DRIVER,
      '00000000-0000-4000-8000-000000000077',
    ],
    [
      'property.address.street',
      EntityType.PROPERTY,
      '00000000-0000-4000-8000-000000000088',
    ],
  ])(
    'normalizes %s to the canonical primary entity',
    async (key, entityType, canonicalId) => {
      const definitions = [typedDefinition(key, entityType)];
      const { service, datapoints } = serviceWith(
        {
          intent: { type: 'INSURANCE_SHOPPING', confidence: 0.9 },
          product: { type: 'AUTO_HOME', confidence: 0.99 },
          events: [],
          candidateDatapoints: [
            {
              key,
              value: 'value',
              entityType,
              entityId: '00000000-0000-4000-8000-000000009999',
              method: 'EXTRACTED',
              confidence: 0.99,
            },
          ],
        },
        definitions,
        Product.AUTO_HOME,
      );

      await service.analyze(leadId, { message: 'synthetic message' });
      expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
        leadId,
        expect.objectContaining({ key, entityType, entityId: canonicalId }),
      );
    },
  );

  it('uses current datapoint context for scoped chat answers', async () => {
    const additionalDriverId = '00000000-0000-4000-8000-000000000222';
    const definitions = [
      typedDefinition('driver.first_name', EntityType.DRIVER),
    ];
    const { service, datapoints } = serviceWith(
      {
        intent: { type: 'GENERAL_INQUIRY', confidence: 0.9 },
        product: { type: 'AUTO', confidence: 0.99 },
        events: [],
        candidateDatapoints: [
          {
            key: 'driver.first_name',
            value: 'Alice',
            entityType: 'DRIVER',
            entityId: vehicleId,
            method: 'EXTRACTED',
            confidence: 0.99,
          },
        ],
      },
      definitions,
      Product.AUTO,
    );

    await service.analyze(leadId, {
      message: 'Alice',
      entityContext: {
        driverId: additionalDriverId,
        currentDatapoint: {
          key: 'driver.first_name',
          entityType: 'DRIVER',
          entityId: additionalDriverId,
        },
      },
    });

    expect(datapoints.upsertCandidate).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        key: 'driver.first_name',
        entityType: EntityType.DRIVER,
        entityId: additionalDriverId,
      }),
    );
  });
});
