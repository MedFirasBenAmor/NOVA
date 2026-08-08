import {
  CollectionMethod,
  DataType,
  EntityType,
  ImpactLevel,
  PrismaClient,
  Product,
  RequirementType,
  SourceType,
} from '@prisma/client';

const prisma = new PrismaClient();

const commonSources = [
  SourceType.CUSTOMER_CHAT,
  SourceType.CUSTOMER_FORM,
  SourceType.CUSTOMER_CONFIRMATION,
  SourceType.EXISTING_NOVA,
  SourceType.BROKER,
  SourceType.DERIVED,
  SourceType.ENRICHED,
];
const autoSources = [
  ...commonSources,
  SourceType.FULL_DOCUMENT,
  SourceType.TARGETED_DOCUMENT_CAPTURE,
  SourceType.EXTERNAL_API,
];
const commonMethods = [
  CollectionMethod.REUSED,
  CollectionMethod.MANUAL_QUESTION,
  CollectionMethod.CONFIRMED,
  CollectionMethod.BROKER_ENTERED,
  CollectionMethod.DERIVED,
  CollectionMethod.ENRICHED,
];
const autoMethods = [
  ...commonMethods,
  CollectionMethod.EXTRACTED,
  CollectionMethod.TARGETED_CAPTURE,
  CollectionMethod.API_FETCHED,
];

type Definition = {
  key: string;
  label: string;
  description: string;
  product: Product;
  category: string;
  entityType: EntityType;
  dataType: DataType;
  requirementType: RequirementType;
  requiredWhen?: object;
  possibleSources: SourceType[];
  preferredCollectionMethods: CollectionMethod[];
  validationRules?: object;
  riskImpact: ImpactLevel;
  eligibilityImpact: ImpactLevel;
  active: boolean;
  version: number;
};

function definition(
  key: string,
  label: string,
  description: string,
  options: Omit<
    Definition,
    | 'key'
    | 'label'
    | 'description'
    | 'active'
    | 'version'
    | 'riskImpact'
    | 'eligibilityImpact'
  > &
    Partial<
      Pick<
        Definition,
        'requiredWhen' | 'validationRules' | 'riskImpact' | 'eligibilityImpact'
      >
    >,
): Definition {
  const {
    riskImpact = ImpactLevel.NONE,
    eligibilityImpact = ImpactLevel.NONE,
    ...rest
  } = options;
  return {
    key,
    label,
    description,
    active: true,
    version: 1,
    riskImpact,
    eligibilityImpact,
    ...rest,
  };
}

const common: Definition[] = [
  definition(
    'customer.first_name',
    'First name',
    "The customer's legal first name.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.last_name',
    'Last name',
    "The customer's legal last name.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.date_of_birth',
    'Date of birth',
    "The customer's date of birth.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.DATE,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.gender',
    'Gender',
    "The customer's gender, when provided.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.ENUM,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.marital_status',
    'Marital status',
    "The customer's marital status.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.ENUM,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.occupation',
    'Occupation',
    "The customer's current occupation.",
    {
      product: Product.COMMON,
      category: 'CUSTOMER',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.phone',
    'Phone number',
    "The customer's preferred phone number.",
    {
      product: Product.COMMON,
      category: 'CONTACT',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.email',
    'Email address',
    "The customer's preferred email address.",
    {
      product: Product.COMMON,
      category: 'CONTACT',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.street',
    'Street address',
    "The street portion of the customer's address.",
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.city',
    'City',
    "The city portion of the customer's address.",
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.region',
    'Region',
    "The province, state, or region of the customer's address.",
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.postal_code',
    'Postal code',
    "The postal code of the customer's address.",
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.country',
    'Country',
    "The country of the customer's address.",
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.address.since',
    'Address since',
    'The date the customer began living at this address.',
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.DATE,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'customer.occupancy_status',
    'Occupancy status',
    'Whether the customer owns, rents, or otherwise occupies the address.',
    {
      product: Product.COMMON,
      category: 'ADDRESS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.ENUM,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'request.type',
    'Request type',
    'The type of insurance request being prepared.',
    {
      product: Product.COMMON,
      category: 'REQUEST',
      entityType: EntityType.REQUEST,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'request.desired_coverage_date',
    'Desired coverage date',
    'The date on which the customer wants coverage to begin.',
    {
      product: Product.COMMON,
      category: 'REQUEST',
      entityType: EntityType.REQUEST,
      dataType: DataType.DATE,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'consent.credit_check',
    'Credit check consent',
    'Whether the customer consents to a credit check when applicable.',
    {
      product: Product.COMMON,
      category: 'CONSENT',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'consent.claims_consultation',
    'Claims consultation consent',
    'Whether the customer consents to claims-history consultation.',
    {
      product: Product.COMMON,
      category: 'CONSENT',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
  definition(
    'consent.data_collection_analysis_transmission',
    'Data processing consent',
    'Whether the customer consents to collection, analysis, and transmission of their data.',
    {
      product: Product.COMMON,
      category: 'CONSENT',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: commonSources,
      preferredCollectionMethods: commonMethods,
    },
  ),
];

const auto: Definition[] = [
  definition(
    'vehicle.vin',
    'Vehicle identification number',
    'The vehicle identification number (VIN).',
    {
      product: Product.AUTO,
      category: 'VEHICLE_IDENTIFICATION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      riskImpact: ImpactLevel.HIGH,
      eligibilityImpact: ImpactLevel.HIGH,
    },
  ),
  definition('vehicle.year', 'Vehicle year', 'The model year of the vehicle.', {
    product: Product.AUTO,
    category: 'VEHICLE_IDENTIFICATION',
    entityType: EntityType.VEHICLE,
    dataType: DataType.NUMBER,
    requirementType: RequirementType.REQUIRED,
    possibleSources: autoSources,
    preferredCollectionMethods: autoMethods,
  }),
  definition(
    'vehicle.make',
    'Vehicle make',
    'The manufacturer of the vehicle.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_IDENTIFICATION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.model',
    'Vehicle model',
    'The model name of the vehicle.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_IDENTIFICATION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.purchase_or_lease_date',
    'Purchase or lease date',
    'The date the vehicle was purchased or leased.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.DATE,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.acquisition_condition',
    'Acquisition condition',
    'Whether the vehicle was acquired new, used, or as a demo.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.ENUM,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: { allowedValues: ['NEW', 'USED', 'DEMO'] },
    },
  ),
  definition(
    'vehicle.financing_status',
    'Financing status',
    'Whether the vehicle is financed, leased, or paid.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.ENUM,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: { allowedValues: ['FINANCED', 'LEASED', 'PAID'] },
    },
  ),
  definition(
    'vehicle.financing_rate_above_10_percent',
    'Financing rate above 10 percent',
    'Whether the financing rate is above ten percent.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.financing_term_months',
    'Financing term',
    'The financing term in months.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.financing_interest_rate',
    'Financing interest rate',
    'The financing interest rate.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.creditor_or_lessor_name',
    'Creditor or lessor',
    'The name of the vehicle creditor or lessor.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.STRING,
      requirementType: RequirementType.CONDITIONAL,
      requiredWhen: {
        key: 'vehicle.financing_status',
        operator: 'IN',
        value: ['FINANCED', 'LEASED'],
      },
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      riskImpact: ImpactLevel.MEDIUM,
      eligibilityImpact: ImpactLevel.MEDIUM,
    },
  ),
  definition(
    'vehicle.value_before_tax',
    'Value before tax',
    'The vehicle value before tax at acquisition.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.odometer_at_acquisition',
    'Odometer at acquisition',
    'The odometer reading when the vehicle was acquired.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_ACQUISITION',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.tracking_or_antitheft_system',
    'Tracking or anti-theft system',
    'Whether the vehicle has a tracking or anti-theft system.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_SECURITY',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.has_fpq5',
    'FPQ5',
    'Whether the vehicle has the FPQ5 protection feature.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_SECURITY',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.requested_coverages',
    'Requested coverages',
    'The coverages the customer is asking to consider, stored as a flexible structure.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_SECURITY',
      entityType: EntityType.VEHICLE,
      dataType: DataType.OBJECT,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: {
        supportedCodes: ['FAQ2', 'FAQ20A', 'FAQ27', 'FAQ33', 'FAQ34', 'FAQ43'],
      },
    },
  ),
  definition(
    'vehicle.primary_use',
    'Primary use',
    'The primary use of the vehicle.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.ENUM,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: {
        allowedValues: ['PLEASURE', 'WORK', 'SCHOOL', 'BUSINESS'],
      },
    },
  ),
  definition(
    'vehicle.annual_mileage',
    'Annual mileage',
    'The expected annual mileage for the vehicle.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.outside_quebec_more_than_30_days',
    'Outside Quebec over 30 days',
    'Whether the vehicle is outside Quebec for more than 30 days per year.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.commercial_use',
    'Commercial use',
    'Whether the vehicle is used commercially.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.commercial_use_type',
    'Commercial use type',
    'The type of commercial use, when applicable.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.ENUM,
      requirementType: RequirementType.CONDITIONAL,
      requiredWhen: {
        key: 'vehicle.commercial_use',
        operator: 'EQ',
        value: true,
      },
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: { allowedValues: ['UBER', 'TURO', 'DELIVERY', 'OTHER'] },
    },
  ),
  definition(
    'vehicle.commercial_annual_mileage',
    'Commercial annual mileage',
    'The annual mileage attributable to commercial use.',
    {
      product: Product.AUTO,
      category: 'VEHICLE_USE',
      entityType: EntityType.VEHICLE,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.CONDITIONAL,
      requiredWhen: {
        key: 'vehicle.commercial_use',
        operator: 'EQ',
        value: true,
      },
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'auto.current_insurer',
    'Current insurer',
    "The customer's current auto insurer.",
    {
      product: Product.AUTO,
      category: 'CURRENT_AUTO_INSURANCE',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.STRING,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'auto.years_with_current_insurer',
    'Years with current insurer',
    'The number of years with the current auto insurer.',
    {
      product: Product.AUTO,
      category: 'CURRENT_AUTO_INSURANCE',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'auto.interruption_for_non_payment',
    'Interruption for non-payment',
    'Whether auto insurance was interrupted for non-payment.',
    {
      product: Product.AUTO,
      category: 'CURRENT_AUTO_INSURANCE',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'auto.cancelled_or_refused_last_3_years',
    'Cancelled or refused in last three years',
    'Whether coverage was cancelled or refused in the last three years.',
    {
      product: Product.AUTO,
      category: 'CURRENT_AUTO_INSURANCE',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.OPTIONAL,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.first_name',
    'Driver first name',
    "The driver's first name.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.last_name',
    'Driver last name',
    "The driver's last name.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.date_of_birth',
    'Driver date of birth',
    "The driver's date of birth.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.DATE,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.relationship_to_proposer',
    'Relationship to proposer',
    "The driver's relationship to the proposer.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.occupation',
    'Driver occupation',
    "The driver's occupation.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.STRING,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.license_type',
    'License type',
    "The driver's license type.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.ENUM,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
      validationRules: {
        allowedValues: [
          'QUEBEC_VALID_OR_PROBATIONARY',
          'LEARNER',
          'OTHER_PROVINCE',
          'FOREIGN',
        ],
      },
    },
  ),
  definition(
    'driver.driving_start_year_quebec',
    'Driving start year in Quebec',
    'The year the driver began driving in Quebec.',
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.NUMBER,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'driver.license_suspended_last_3_years',
    'License suspended in last three years',
    "Whether the driver's license was suspended in the last three years.",
    {
      product: Product.AUTO,
      category: 'DRIVER',
      entityType: EntityType.DRIVER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'vehicle.modified_rebuilt_competition_or_exhibition',
    'Modified, rebuilt, competition, or exhibition vehicle',
    'Whether the vehicle is modified, rebuilt, for competition, or for exhibition.',
    {
      product: Product.AUTO,
      category: 'SPECIAL_VEHICLE_RISK',
      entityType: EntityType.VEHICLE,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition(
    'auto.has_claims_last_6_years',
    'Claims in last six years',
    'Whether the customer has auto claims in the last six years.',
    {
      product: Product.AUTO,
      category: 'AUTO_CLAIMS',
      entityType: EntityType.CUSTOMER,
      dataType: DataType.BOOLEAN,
      requirementType: RequirementType.REQUIRED,
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
  definition('claim.type', 'Claim type', 'The type of an auto claim.', {
    product: Product.AUTO,
    category: 'AUTO_CLAIMS',
    entityType: EntityType.CLAIM,
    dataType: DataType.STRING,
    requirementType: RequirementType.CONDITIONAL,
    requiredWhen: {
      key: 'auto.has_claims_last_6_years',
      operator: 'EQ',
      value: true,
    },
    possibleSources: autoSources,
    preferredCollectionMethods: autoMethods,
  }),
  definition('claim.year', 'Claim year', 'The year of an auto claim.', {
    product: Product.AUTO,
    category: 'AUTO_CLAIMS',
    entityType: EntityType.CLAIM,
    dataType: DataType.NUMBER,
    requirementType: RequirementType.CONDITIONAL,
    requiredWhen: {
      key: 'auto.has_claims_last_6_years',
      operator: 'EQ',
      value: true,
    },
    possibleSources: autoSources,
    preferredCollectionMethods: autoMethods,
  }),
  definition(
    'claim.description',
    'Claim description',
    'A concise description of an auto claim.',
    {
      product: Product.AUTO,
      category: 'AUTO_CLAIMS',
      entityType: EntityType.CLAIM,
      dataType: DataType.STRING,
      requirementType: RequirementType.CONDITIONAL,
      requiredWhen: {
        key: 'auto.has_claims_last_6_years',
        operator: 'EQ',
        value: true,
      },
      possibleSources: autoSources,
      preferredCollectionMethods: autoMethods,
    },
  ),
];

async function main() {
  for (const item of [...common, ...auto]) {
    const { key, version, ...data } = item;
    await prisma.datapointDefinition.upsert({
      where: { key_version: { key, version } },
      update: data,
      create: { key, version, ...data },
    });
  }
  console.log(
    `Seeded ${common.length} COMMON and ${auto.length} AUTO datapoint definitions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
