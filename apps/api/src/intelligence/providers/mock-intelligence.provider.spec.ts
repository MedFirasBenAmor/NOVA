import type {
  IntelligenceCatalogItem,
  IntelligenceInput,
} from '@nova/shared-types';
import { MockIntelligenceProvider } from './mock-intelligence.provider';

const vehicleId = '00000000-0000-4000-8000-000000000001';
const catalog: IntelligenceCatalogItem[] = [
  {
    key: 'vehicle.year',
    label: 'Year',
    dataType: 'NUMBER',
    entityType: 'VEHICLE',
  },
  {
    key: 'vehicle.model',
    label: 'Model',
    dataType: 'STRING',
    entityType: 'VEHICLE',
  },
  {
    key: 'vehicle.make',
    label: 'Make',
    dataType: 'STRING',
    entityType: 'VEHICLE',
  },
  {
    key: 'vehicle.financing_status',
    label: 'Financing',
    dataType: 'ENUM',
    entityType: 'VEHICLE',
    allowedValues: ['FINANCED', 'LEASED', 'PAID'],
  },
  {
    key: 'vehicle.annual_mileage',
    label: 'Mileage',
    dataType: 'NUMBER',
    entityType: 'VEHICLE',
  },
  {
    key: 'vehicle.primary_use',
    label: 'Primary use',
    dataType: 'ENUM',
    entityType: 'VEHICLE',
    allowedValues: ['PLEASURE', 'WORK', 'SCHOOL', 'BUSINESS'],
  },
  {
    key: 'vehicle.commercial_use',
    label: 'Commercial use',
    dataType: 'BOOLEAN',
    entityType: 'VEHICLE',
  },
  {
    key: 'vehicle.commercial_use_type',
    label: 'Commercial type',
    dataType: 'ENUM',
    entityType: 'VEHICLE',
    allowedValues: ['UBER', 'TURO', 'DELIVERY', 'OTHER'],
  },
  {
    key: 'auto.current_insurer',
    label: 'Insurer',
    dataType: 'STRING',
    entityType: 'CUSTOMER',
  },
  {
    key: 'auto.has_claims_last_6_years',
    label: 'Claims',
    dataType: 'BOOLEAN',
    entityType: 'CUSTOMER',
  },
  {
    key: 'claim.year',
    label: 'Claim year',
    dataType: 'NUMBER',
    entityType: 'CLAIM',
  },
  {
    key: 'claim.type',
    label: 'Claim type',
    dataType: 'STRING',
    entityType: 'CLAIM',
  },
  {
    key: 'claim.description',
    label: 'Claim description',
    dataType: 'STRING',
    entityType: 'CLAIM',
  },
  {
    key: 'request.type',
    label: 'Request type',
    dataType: 'STRING',
    entityType: 'REQUEST',
  },
  {
    key: 'request.desired_coverage_date',
    label: 'Coverage date',
    dataType: 'DATE',
    entityType: 'REQUEST',
  },
];

const input = (
  message: string,
  overrides: Partial<IntelligenceInput> = {},
): IntelligenceInput => ({
  message,
  currentProduct: 'AUTO',
  entityContext: { vehicleId },
  knownDatapoints: [],
  catalog,
  ...overrides,
});

const candidate = (
  result: Awaited<ReturnType<MockIntelligenceProvider['analyze']>>,
  key: string,
) => result.candidateDatapoints.find((item) => item.key === key);

describe('MockIntelligenceProvider', () => {
  const provider = new MockIntelligenceProvider();

  it('extracts a model and enriches its make without hallucinating other facts', async () => {
    const result = await provider.analyze(input('I bought a RAV4.'));
    expect(result.product.type).toBe('AUTO');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'VEHICLE_PURCHASE' }),
      ]),
    );
    expect(candidate(result, 'vehicle.model')).toMatchObject({
      value: 'RAV4',
      method: 'EXTRACTED',
    });
    expect(candidate(result, 'vehicle.make')).toMatchObject({
      value: 'TOYOTA',
      method: 'ENRICHED',
    });
    expect(candidate(result, 'vehicle.year')).toBeUndefined();
    expect(candidate(result, 'vehicle.financing_status')).toBeUndefined();
  });

  it('extracts multiple acquisition datapoints from one message', async () => {
    const result = await provider.analyze(
      input('I bought a financed 2024 RAV4.'),
    );
    expect(candidate(result, 'vehicle.year')?.value).toBe(2024);
    expect(candidate(result, 'vehicle.model')?.value).toBe('RAV4');
    expect(candidate(result, 'vehicle.make')?.value).toBe('TOYOTA');
    expect(candidate(result, 'vehicle.financing_status')?.value).toBe(
      'FINANCED',
    );
    expect(candidate(result, 'request.type')).toMatchObject({
      value: 'NEW_ACQUISITION',
      method: 'INFERRED',
    });
  });

  it('extracts annual mileage', async () => {
    const result = await provider.analyze(
      input('I drive around 15,000 km per year.'),
    );
    expect(candidate(result, 'vehicle.annual_mileage')).toMatchObject({
      value: 15000,
      method: 'EXTRACTED',
    });
  });

  it('extracts work as the catalog primary-use enum', async () => {
    const result = await provider.analyze(
      input('I mainly use it to go to work.'),
    );
    expect(candidate(result, 'vehicle.primary_use')?.value).toBe('WORK');
  });

  it('distinguishes commercial use and its type', async () => {
    const result = await provider.analyze(
      input('I use it for Uber on weekends.'),
    );
    expect(candidate(result, 'vehicle.commercial_use')?.value).toBe(true);
    expect(candidate(result, 'vehicle.commercial_use_type')).toMatchObject({
      value: 'UBER',
      method: 'EXTRACTED',
    });
  });

  it('extracts the current insurer', async () => {
    const result = await provider.analyze(input('My insurer is Intact.'));
    expect(candidate(result, 'auto.current_insurer')?.value).toBe('Intact');
  });

  it('recognizes renewal without inventing a date', async () => {
    const result = await provider.analyze(
      input('My insurance renews next month.'),
    );
    expect(result.intent.type).toBe('RENEWAL');
    expect(candidate(result, 'request.desired_coverage_date')).toBeUndefined();
  });

  it('extracts claim year without inventing claim details or vehicle year', async () => {
    const result = await provider.analyze(input('I had an accident in 2023.'));
    expect(candidate(result, 'auto.has_claims_last_6_years')?.value).toBe(true);
    expect(candidate(result, 'claim.year')?.value).toBe(2023);
    expect(candidate(result, 'claim.type')).toBeUndefined();
    expect(candidate(result, 'claim.description')).toBeUndefined();
    expect(candidate(result, 'vehicle.year')).toBeUndefined();
  });

  it('recognizes a commercial-use denial', async () => {
    const result = await provider.analyze(
      input("I don't use the car for Uber, Turo or delivery."),
    );
    expect(candidate(result, 'vehicle.commercial_use')?.value).toBe(false);
    expect(candidate(result, 'vehicle.commercial_use_type')).toBeUndefined();
  });

  it('records document refusal as context without fake datapoints', async () => {
    const result = await provider.analyze(
      input("I don't want to upload my driver's license."),
    );
    expect(result.intent.type).toBe('DOCUMENT_REFUSAL');
    expect(result.events[0]?.type).toBe('DOCUMENT_UPLOAD_REFUSED');
    expect(result.candidateDatapoints).toHaveLength(0);
  });

  it('does not duplicate already-known values and may return zero datapoints', async () => {
    const known = [
      {
        key: 'vehicle.model',
        value: 'RAV4',
        entityType: 'VEHICLE' as const,
        entityId: vehicleId,
      },
      {
        key: 'vehicle.make',
        value: 'TOYOTA',
        entityType: 'VEHICLE' as const,
        entityId: vehicleId,
      },
    ];
    const knownResult = await provider.analyze(
      input('I bought a RAV4.', { knownDatapoints: known }),
    );
    expect(candidate(knownResult, 'vehicle.model')).toBeUndefined();
    expect(candidate(knownResult, 'vehicle.make')).toBeUndefined();

    const emptyResult = await provider.analyze(input('Hello there.'));
    expect(emptyResult.candidateDatapoints).toHaveLength(0);
  });
});
