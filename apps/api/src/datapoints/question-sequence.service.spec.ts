import {
  type DatapointDefinition,
  DataType,
  EntityType,
  Product,
  RequirementType,
} from '@prisma/client';
import { QuestionSequenceService } from './question-sequence.service';

const service = new QuestionSequenceService();

const definition = (
  key: string,
  product: Product,
  entityType: EntityType,
  category = 'TEST',
): DatapointDefinition => ({
  id: key,
  key,
  label: key,
  description: key,
  product,
  category,
  entityType,
  dataType: DataType.STRING,
  requirementType: RequirementType.REQUIRED,
  requiredWhen: null,
  possibleSources: [],
  preferredCollectionMethods: [],
  validationRules: null,
  riskImpact: 'NONE',
  eligibilityImpact: 'NONE',
  active: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const missing = (key: string, entityType: EntityType) => ({
  key,
  entityType,
  reason: 'REQUIRED' as const,
});

function order(keys: string[]) {
  const definitions = keys.map((key) => {
    const product =
      key.startsWith('property.') ||
      key.startsWith('home_claim.') ||
      key.startsWith('co_applicant.')
        ? Product.HOME
        : key.startsWith('consent.') ||
            key.startsWith('customer.') ||
            key.startsWith('request.')
          ? Product.COMMON
          : Product.AUTO;
    const entityType = key.startsWith('property.')
      ? EntityType.PROPERTY
      : key.startsWith('driver.')
        ? EntityType.DRIVER
        : key.startsWith('claim.') || key.startsWith('home_claim.')
          ? EntityType.CLAIM
          : key.startsWith('vehicle.')
            ? EntityType.VEHICLE
            : EntityType.CUSTOMER;
    return definition(key, product, entityType);
  });
  return service
    .orderedMissing(
      Product.AUTO_HOME,
      definitions,
      definitions.map((item) => missing(item.key, item.entityType)),
    )
    .map((item) => item.key);
}

describe('QuestionSequenceService', () => {
  it('puts COMMON request context before product-domain questions', () => {
    expect(
      order(['vehicle.vin', 'request.type', 'property.dwelling_type']),
    ).toEqual(['request.type', 'vehicle.vin', 'property.dwelling_type']);
  });

  it('forbids vehicle acquisition before vehicle identification', () => {
    expect(
      order([
        'vehicle.acquisition_condition',
        'vehicle.financing_status',
        'vehicle.vin',
        'vehicle.year',
      ]),
    ).toEqual([
      'vehicle.vin',
      'vehicle.year',
      'vehicle.acquisition_condition',
      'vehicle.financing_status',
    ]);
  });

  it('places claims after use/history and before additional driver trigger', () => {
    expect(
      order([
        'auto.additional_driver_exists',
        'auto.has_claims_last_6_years',
        'vehicle.primary_use',
        'claim.type',
      ]),
    ).toEqual([
      'vehicle.primary_use',
      'auto.has_claims_last_6_years',
      'claim.type',
      'auto.additional_driver_exists',
    ]);
  });

  it('places HOME co-applicant after property basics and home claims', () => {
    expect(
      order([
        'property.has_co_applicant',
        'co_applicant.first_name',
        'property.dwelling_type',
        'property.claims_last_5_years',
        'home_claim.type',
      ]),
    ).toEqual([
      'property.dwelling_type',
      'property.claims_last_5_years',
      'home_claim.type',
      'property.has_co_applicant',
      'co_applicant.first_name',
    ]);
  });

  it('keeps final consents after product collection', () => {
    expect(
      order([
        'consent.credit_check',
        'request.desired_coverage_date',
        'vehicle.vin',
        'property.dwelling_type',
      ]),
    ).toEqual([
      'request.desired_coverage_date',
      'vehicle.vin',
      'property.dwelling_type',
      'consent.credit_check',
    ]);
  });

  it('only considers driver-license documents inside the driver section', () => {
    expect(
      service.shouldConsiderDocumentForNextMissing(
        [missing('vehicle.vin', EntityType.VEHICLE)],
        EntityType.DRIVER,
      ),
    ).toBe(false);
    expect(
      service.shouldConsiderDocumentForNextMissing(
        [missing('driver.first_name', EntityType.DRIVER)],
        EntityType.DRIVER,
      ),
    ).toBe(true);
  });
});
