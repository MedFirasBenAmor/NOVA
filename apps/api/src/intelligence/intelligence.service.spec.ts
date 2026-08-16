import { BadGatewayException } from '@nestjs/common';
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
  active: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function serviceWith(
  result: object,
  definitions: object[],
  selectedProduct: Product | undefined = Product.AUTO,
) {
  const prisma = {
    lead: { findUnique: jest.fn().mockResolvedValue({ id: leadId }) },
    datapointDefinition: { findMany: jest.fn().mockResolvedValue(definitions) },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prismaForValidation = new DatapointsService({} as never, {} as never);
  const profiles = {
    selectedForLead: jest.fn().mockResolvedValue(selectedProduct),
    forProduct: jest.fn().mockResolvedValue(definitions),
    isSelectable: jest.fn((product: Product) =>
      [Product.AUTO, Product.HOME, Product.AUTO_HOME].includes(
        product as never,
      ),
    ),
  };
  const datapoints = {
    values: jest.fn().mockResolvedValue([]),
    validateInput: prismaForValidation.validateInput.bind(prismaForValidation),
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
  return {
    service: new IntelligenceService(
      { analyze: jest.fn().mockResolvedValue(result) },
      prisma as never,
      datapoints as never,
      { addCustomerMessage: jest.fn().mockResolvedValue({}) } as never,
      {
        select: jest
          .fn()
          .mockResolvedValue({ type: 'COMPLETE', actionId: 'action' }),
        productSelectionAction: jest.fn().mockReturnValue({
          type: 'SELECT_PRODUCT',
          actionId: 'select-product',
          options: [],
        }),
      } as never,
      profiles as never,
    ),
    prisma,
    datapoints,
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
});
