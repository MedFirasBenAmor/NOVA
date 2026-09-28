import {
  CollectionActionType,
  DataType,
  EntityDomain,
  EntityType,
  EntityRole,
  Product,
  RequirementType,
} from '@prisma/client';
import { CollectionStrategyService } from './collection-strategy.service';
import {
  AUTO_CLAIM_CARDS,
  AUTO_CONSENT_CARD,
  AUTO_CUSTOMER_CARDS,
  AUTO_DRIVER_CARDS,
  AUTO_PROTECTION_CARDS,
  AUTO_VEHICLE_CARDS,
} from './auto-phone-flow.fr-ca';

const VEHICLE_ID = '00000000-0000-4000-8000-0000000000v1';
const DRIVER_ID = '00000000-0000-4000-8000-0000000000d1';

type Stored = Record<string, unknown>;

function entityTypeFor(key: string) {
  if (key.startsWith('vehicle.')) return EntityType.VEHICLE;
  if (key.startsWith('driver.')) return EntityType.DRIVER;
  return EntityType.CUSTOMER;
}

function catalogFor(keys: string[]) {
  return keys.map((key) => ({
    key,
    dataType: DataType.STRING,
    validationRules: null,
    entityType: entityTypeFor(key),
    requirementType: RequirementType.OPTIONAL,
  }));
}

function journeySetup(stored: Stored, attempts: unknown[] = []) {
  const allKeys = [
    ...AUTO_CUSTOMER_CARDS,
    ...AUTO_VEHICLE_CARDS,
    ...AUTO_DRIVER_CARDS,
    ...AUTO_CLAIM_CARDS,
    ...AUTO_PROTECTION_CARDS,
    AUTO_CONSENT_CARD,
  ].flatMap((card) => card.datapointKeys);
  const valueRows = Object.entries(stored).map(
    ([key, value]: [string, unknown]) => ({
      id: `value-${key}`,
      definitionId: `def-${key}`,
      definition: { key },
      entityType: entityTypeFor(key),
      entityId: key.startsWith('vehicle.')
        ? VEHICLE_ID
        : key.startsWith('driver.')
          ? DRIVER_ID
          : null,
      value,
      status: 'CONFIRMED',
    }),
  );
  const createMock: jest.Mock = jest
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: `attempt-${data.actionType as string}`,
        ...data,
      }),
    );
  const prisma = {
    datapointDefinition: {
      findMany: jest.fn().mockResolvedValue(catalogFor(allKeys)),
    },
    collectionAttempt: {
      findMany: jest.fn().mockResolvedValue(attempts),
      create: createMock,
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(undefined),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    datapointValue: { findMany: jest.fn().mockResolvedValue(valueRows) },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { update: jest.fn().mockResolvedValue({}) },
    customerFolder: {
      upsert: jest.fn().mockResolvedValue({ id: 'folder-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'folder-1' }),
    },
    dossierEntity: {
      findMany: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { entityType?: EntityType } }) => {
            if (where.entityType === EntityType.VEHICLE) {
              return Promise.resolve([
                {
                  id: VEHICLE_ID,
                  entityType: EntityType.VEHICLE,
                  ordinal: 1,
                  role: EntityRole.PRIMARY,
                  domain: EntityDomain.NONE,
                },
              ]);
            }
            if (where.entityType === EntityType.DRIVER) {
              return Promise.resolve([
                {
                  id: DRIVER_ID,
                  entityType: EntityType.DRIVER,
                  ordinal: 1,
                  role: EntityRole.PRIMARY,
                  domain: EntityDomain.NONE,
                },
              ]);
            }
            return Promise.resolve([]);
          },
        ),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const entities = {
    openLoopsForLead: jest.fn().mockResolvedValue([]),
    ensureVehicleLoop: jest.fn().mockResolvedValue({
      id: 'loop-1',
      status: 'CLOSED',
      currentOrdinal: 1,
    }),
    ensurePrimaryEntitiesForProduct: jest.fn().mockResolvedValue([]),
  };
  const service = new CollectionStrategyService(
    prisma as never,
    {
      upsert: jest.fn().mockResolvedValue({}),
      completeness: jest.fn().mockResolvedValue({
        product: 'AUTO',
        completeness: 100,
        known: [],
        missing: [],
        conditionalRequired: [],
      }),
    } as never,
    { addCustomerMessage: jest.fn() } as never,
    {
      forProduct: jest.fn().mockResolvedValue(catalogFor(allKeys)),
    } as never,
    entities as never,
    undefined,
    undefined,
  );
  return { service, prisma, entities, createMock };
}

const MARITAL_QUESTION = 'Quel est votre état civil ?';
const VIN_QUESTION = 'Avez-vous le numéro de série du véhicule (NIV) ?';
const TENURE_QUESTION = 'Depuis combien de temps êtes-vous avec cet assureur ?';
const INTERRUPTION_QUESTION =
  'Y a-t-il eu une interruption d’assurance automobile ? ( règle depuis 6 mois non assuré en auto = interruption d’assurance)';
const REFUSED_QUESTION =
  'Une compagnie d’assurance vous a-t-elle déjà refusé ou annulé une police ?';

function completeCustomerAddress() {
  return {
    'customer.first_name': 'Ahmed',
    'customer.last_name': 'Ben Ali',
    'customer.address.civic_number': '123',
    'customer.address.street': 'Rue Principale',
    'customer.address.city': 'Montréal',
    'customer.address.region': 'Québec',
    'customer.address.postal_code': 'H2X 1Y4',
  };
}

function completeCustomerSection() {
  return {
    ...completeCustomerAddress(),
    'customer.marital_status': 'Célibataire',
    'customer.occupation': 'Technologie / Informatique',
    'request.desired_coverage_date': '2026-10-01',
    'auto.current_insurer': 'Promutuel',
  };
}

function completeVehicleSection() {
  return {
    'vehicle.vin_available': false,
    'vehicle.make': 'Toyota',
    'vehicle.model': 'RAV4',
    'vehicle.year': 2024,
    'vehicle.purchase_or_lease_date': '2024-01-15',
    'vehicle.acquisition_condition': 'Neuf',
    'vehicle.odometer_at_acquisition': 100,
    'vehicle.value_before_tax': 30000,
    'vehicle.financing_status': 'Payé',
    'vehicle.primary_use': 'Promenade',
    'vehicle.commercial_use_type': 'Non',
    'vehicle.commercial_use': false,
    'vehicle.annual_mileage_band': '10 000 à 15 000 km',
    'vehicle.used_outside_quebec': false,
    'vehicle.tracking_or_antitheft_system': false,
  };
}

function completeThroughCard31() {
  return {
    ...completeCustomerSection(),
    'auto.current_insurer_tenure_band': 'LESS_THAN_1_YEAR',
    ...completeVehicleSection(),
    'driver.license_type': 'Permis Québec',
    'driver.driving_start_age_quebec': 18,
    'driver.license_suspended_last_3_years': false,
  };
}

async function selectAuto(service: CollectionStrategyService) {
  return service.select('lead-1', Product.AUTO, {
    product: 'AUTO',
    completeness: 100,
    known: [],
    missing: [],
    conditionalRequired: [],
  });
}

describe('CollectionStrategyService canonical AUTO journey', () => {
  it('emits CARD 4 (marital status) without re-asking the grouped address card', async () => {
    const { service, createMock } = journeySetup(completeCustomerAddress());
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('customer.marital_status');
      expect(result.datapoint.question).toBe(MARITAL_QUESTION);
    }
    const created = createMock.mock.calls.map(
      (call: unknown[]) =>
        (call[0] as { data?: { actionType?: string } }).data?.actionType,
    );
    expect(created).not.toContain(CollectionActionType.ASK_GROUPED_DATAPOINTS);
  });

  it('still reaches marital status when the optional apartment is provided', async () => {
    const { service } = journeySetup({
      ...completeCustomerAddress(),
      'customer.address.apartment': '4B',
    });
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('customer.marital_status');
      expect(result.datapoint.question).toBe(MARITAL_QUESTION);
    }
  });

  it('asks CARD 8 while the tenure band is missing', async () => {
    const { service } = journeySetup(completeCustomerSection());
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('auto.current_insurer_tenure_band');
      expect(result.datapoint.question).toBe(TENURE_QUESTION);
    }
  });

  it.each([
    ['LESS_THAN_1_YEAR'],
    ['YEARS_1_TO_3'],
    ['YEARS_3_TO_5'],
    ['YEARS_5_PLUS'],
  ])('treats persisted tenure band %s as complete', async (band) => {
    const { service } = journeySetup({
      ...completeCustomerSection(),
      'auto.current_insurer_tenure_band': band,
    });
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe('vehicle.vin_available');
      expect(result.datapoint.question).toBe(VIN_QUESTION);
    }
  });

  it('asks CARD 32 as a root-scoped boolean customer datapoint after driver CARD 31', async () => {
    const { service, createMock } = journeySetup(completeThroughCard31());
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe(
        'auto.insurance_interruption_last_6_months',
      );
      expect(result.datapoint.entityType).toBe(EntityType.CUSTOMER);
      expect(result.datapoint).not.toHaveProperty('entityId');
      expect(result.datapoint.question).toBe(INTERRUPTION_QUESTION);
      expect(result.input).toEqual({ type: 'YES_NO' });
    }
    type CreateAttemptCall = [
      {
        data: {
          actionType: CollectionActionType;
          entityType: EntityType;
          entityId?: string;
          metadata?: { autoFlowCardId?: string; key?: string };
        };
      },
    ];
    const calls = createMock.mock.calls as CreateAttemptCall[];
    const created = calls.at(-1)?.[0];
    expect(created?.data).toMatchObject({
      actionType: CollectionActionType.ASK_DATAPOINT,
      entityType: EntityType.CUSTOMER,
      metadata: {
        autoFlowCardId: 'CARD_32',
        key: 'auto.insurance_interruption_last_6_months',
      },
    });
    expect(created?.data.entityId).toBeUndefined();
  });

  it('skips CARD 32 on resume when false is persisted and asks CARD 33 next', async () => {
    const { service } = journeySetup({
      ...completeThroughCard31(),
      'auto.insurance_interruption_last_6_months': false,
    });
    const result = await selectAuto(service);
    expect(result.type).toBe('ASK_DATAPOINT');
    if (result.type === 'ASK_DATAPOINT') {
      expect(result.datapoint.key).toBe(
        'auto.cancelled_or_refused_last_3_years',
      );
      expect(result.datapoint.entityType).toBe(EntityType.CUSTOMER);
      expect(result.datapoint).not.toHaveProperty('entityId');
      expect(result.datapoint.question).toBe(REFUSED_QUESTION);
      expect(result.input).toEqual({ type: 'YES_NO' });
    }
  });

  it('reaches the closing text once every canonical card is answered', async () => {
    const stored: Stored = {};
    [
      ...AUTO_CUSTOMER_CARDS,
      ...AUTO_VEHICLE_CARDS,
      ...AUTO_DRIVER_CARDS,
      ...AUTO_CLAIM_CARDS,
      ...AUTO_PROTECTION_CARDS,
      AUTO_CONSENT_CARD,
    ].forEach((card) =>
      card.datapointKeys.forEach((key) => {
        stored[key] = 'provided';
      }),
    );
    const { service } = journeySetup(stored);
    const result = await selectAuto(service);
    expect(result.type).toBe('COMPLETE');
    if (result.type === 'COMPLETE') {
      expect(result.message).toContain('Parfait, merci beaucoup');
    }
  });
});
