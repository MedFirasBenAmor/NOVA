import {
  DatapointStatus,
  EntityType,
  Product,
  RequirementType,
  type Prisma,
} from '@prisma/client';
import { resolveCompleteness } from './completeness.resolver';

const id = (value: number) =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;

function definition(
  key: string,
  entityType: EntityType,
  requirementType: RequirementType,
  requiredWhen?: Prisma.JsonObject,
): {
  id: string;
  key: string;
  entityType: EntityType;
  requirementType: RequirementType;
  requiredWhen: Prisma.JsonValue | null;
} {
  return {
    id: id(definitionCounter++),
    key,
    entityType,
    requirementType,
    requiredWhen: requiredWhen ?? null,
  };
}

let definitionCounter = 100;

function value(
  definitionId: string,
  key: string,
  entityType: EntityType,
  observedValue: Prisma.JsonValue,
  entityId?: string,
): {
  definitionId: string;
  definition: { key: string };
  entityType: EntityType;
  entityId: string | null;
  value: Prisma.JsonValue;
  status: DatapointStatus;
} {
  return {
    definitionId,
    definition: { key },
    entityType,
    entityId: entityId ?? null,
    value: observedValue,
    status: DatapointStatus.CANDIDATE,
  };
}

describe('resolveCompleteness', () => {
  it('reports required values as missing and provided', () => {
    const required = definition(
      'vehicle.vin',
      EntityType.VEHICLE,
      RequirementType.REQUIRED,
    );
    const missing = resolveCompleteness(Product.AUTO, [required], []);
    expect(missing.completeness).toBe(0);
    expect(missing.missing[0]).toMatchObject({
      key: 'vehicle.vin',
      reason: 'REQUIRED',
    });

    const known = resolveCompleteness(
      Product.AUTO,
      [required],
      [value(required.id, required.key, EntityType.VEHICLE, 'VIN', id(1))],
    );
    expect(known.completeness).toBe(100);
    expect(known.missing).toHaveLength(0);
  });

  it('evaluates financing and commercial conditional requirements', () => {
    const financing = definition(
      'vehicle.financing_status',
      EntityType.VEHICLE,
      RequirementType.REQUIRED,
    );
    const creditor = definition(
      'vehicle.creditor_or_lessor_name',
      EntityType.VEHICLE,
      RequirementType.CONDITIONAL,
      { key: financing.key, operator: 'IN', value: ['FINANCED', 'LEASED'] },
    );
    const commercial = definition(
      'vehicle.commercial_use',
      EntityType.VEHICLE,
      RequirementType.REQUIRED,
    );
    const mileage = definition(
      'vehicle.commercial_annual_mileage',
      EntityType.VEHICLE,
      RequirementType.CONDITIONAL,
      { key: commercial.key, operator: 'EQ', value: true },
    );
    const vehicleId = id(2);

    const financingResult = resolveCompleteness(
      Product.AUTO,
      [financing, creditor],
      [
        value(
          financing.id,
          financing.key,
          EntityType.VEHICLE,
          'FINANCED',
          vehicleId,
        ),
      ],
    );
    expect(financingResult.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: creditor.key,
          reason: 'CONDITIONAL',
          triggeredBy: financing.key,
        }),
      ]),
    );

    const falseResult = resolveCompleteness(
      Product.AUTO,
      [commercial, mileage],
      [
        value(
          commercial.id,
          commercial.key,
          EntityType.VEHICLE,
          false,
          vehicleId,
        ),
      ],
    );
    expect(falseResult.missing).toHaveLength(0);

    const trueResult = resolveCompleteness(
      Product.AUTO,
      [commercial, mileage],
      [
        value(
          commercial.id,
          commercial.key,
          EntityType.VEHICLE,
          true,
          vehicleId,
        ),
      ],
    );
    expect(trueResult.missing[0]).toMatchObject({
      key: mileage.key,
      reason: 'CONDITIONAL',
    });
  });

  it('requires claim details when claims exist', () => {
    const hasClaims = definition(
      'auto.has_claims_last_6_years',
      EntityType.CUSTOMER,
      RequirementType.REQUIRED,
    );
    const claimType = definition(
      'claim.type',
      EntityType.CLAIM,
      RequirementType.CONDITIONAL,
      { key: hasClaims.key, operator: 'EQ', value: true },
    );
    const claimYear = definition(
      'claim.year',
      EntityType.CLAIM,
      RequirementType.CONDITIONAL,
      { key: hasClaims.key, operator: 'EQ', value: true },
    );
    const claimDescription = definition(
      'claim.description',
      EntityType.CLAIM,
      RequirementType.CONDITIONAL,
      { key: hasClaims.key, operator: 'EQ', value: true },
    );
    const result = resolveCompleteness(
      Product.AUTO,
      [hasClaims, claimType, claimYear, claimDescription],
      [value(hasClaims.id, hasClaims.key, EntityType.CUSTOMER, true)],
    );
    expect(result.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'claim.type', reason: 'CONDITIONAL' }),
        expect.objectContaining({ key: 'claim.year', reason: 'CONDITIONAL' }),
        expect.objectContaining({
          key: 'claim.description',
          reason: 'CONDITIONAL',
        }),
      ]),
    );
  });

  it('ignores values marked not applicable', () => {
    const required = definition(
      'vehicle.vin',
      EntityType.VEHICLE,
      RequirementType.REQUIRED,
    );
    const notApplicable = {
      ...value(
        required.id,
        required.key,
        EntityType.VEHICLE,
        'ignored',
        id(30),
      ),
      status: DatapointStatus.NOT_APPLICABLE,
    };
    const result = resolveCompleteness(
      Product.AUTO,
      [required],
      [notApplicable],
    );
    expect(result.completeness).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('keeps multiple entity instances on the same definition', () => {
    const year = definition(
      'vehicle.year',
      EntityType.VEHICLE,
      RequirementType.REQUIRED,
    );
    const first = id(10);
    const second = id(11);
    const result = resolveCompleteness(
      Product.AUTO,
      [year],
      [
        value(year.id, year.key, EntityType.VEHICLE, 2024, first),
        value(year.id, year.key, EntityType.VEHICLE, null, second),
      ],
    );
    expect(result.known).toEqual([
      expect.objectContaining({ key: year.key, entityId: first }),
    ]);
    expect(result.missing).toEqual([
      expect.objectContaining({ key: year.key, entityId: second }),
    ]);
  });

  it('calculates completeness across required entries', () => {
    const first = definition(
      'customer.first_name',
      EntityType.CUSTOMER,
      RequirementType.REQUIRED,
    );
    const last = definition(
      'customer.last_name',
      EntityType.CUSTOMER,
      RequirementType.REQUIRED,
    );
    const result = resolveCompleteness(
      Product.AUTO,
      [first, last],
      [value(first.id, first.key, EntityType.CUSTOMER, 'NOVA')],
    );
    expect(result.completeness).toBe(50);
  });

  it('handles HOME property conditionals without blocking when untriggered', () => {
    const hasMortgage = definition(
      'property.has_mortgage',
      EntityType.PROPERTY,
      RequirementType.REQUIRED,
    );
    const holder = definition(
      'property.mortgage_holder_name',
      EntityType.PROPERTY,
      RequirementType.CONDITIONAL,
      { key: hasMortgage.key, operator: 'EQ', value: true },
    );
    const propertyId = id(40);

    const untriggered = resolveCompleteness(
      Product.HOME,
      [hasMortgage, holder],
      [
        value(
          hasMortgage.id,
          hasMortgage.key,
          EntityType.PROPERTY,
          false,
          propertyId,
        ),
      ],
    );
    expect(untriggered.missing).toHaveLength(0);

    const triggered = resolveCompleteness(
      Product.HOME,
      [hasMortgage, holder],
      [
        value(
          hasMortgage.id,
          hasMortgage.key,
          EntityType.PROPERTY,
          true,
          propertyId,
        ),
      ],
    );
    expect(triggered.missing).toEqual([
      expect.objectContaining({
        key: holder.key,
        reason: 'CONDITIONAL',
        triggeredBy: hasMortgage.key,
        entityId: propertyId,
      }),
    ]);
  });

  it('does not let optional definitions block completion', () => {
    const optional = definition(
      'property.pool_installation_year',
      EntityType.PROPERTY,
      RequirementType.OPTIONAL,
    );
    const result = resolveCompleteness(Product.HOME, [optional], []);
    expect(result.completeness).toBe(100);
    expect(result.missing).toHaveLength(0);
  });
});

it('uses canonical primary entity ids for scoped primary requirements', () => {
  const year = definition(
    'vehicle.year',
    EntityType.VEHICLE,
    RequirementType.REQUIRED,
  );
  const canonicalVehicle = id(70);
  const randomVehicle = id(71);
  const wrongScopedValue = value(
    year.id,
    year.key,
    EntityType.VEHICLE,
    2024,
    randomVehicle,
  );
  const result = resolveCompleteness(Product.AUTO, [year], [wrongScopedValue], {
    [EntityType.VEHICLE]: canonicalVehicle,
  });
  expect(result.completeness).toBe(0);
  expect(result.missing).toEqual([
    expect.objectContaining({ key: year.key, entityId: canonicalVehicle }),
  ]);
});
