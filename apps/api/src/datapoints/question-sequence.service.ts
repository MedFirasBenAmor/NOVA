import { Injectable } from '@nestjs/common';
import { EntityType, Product, type DatapointDefinition } from '@prisma/client';
import type { CompletenessResponse } from '@nova/shared-types';
import { type SelectedProduct } from './requirement-profile.service';

type MissingItem = CompletenessResponse['missing'][number];

type SectionCode =
  | 'COMMON'
  | 'AUTO_VEHICLE_IDENTIFICATION'
  | 'AUTO_ACQUISITION'
  | 'AUTO_FINANCING'
  | 'AUTO_USE_PROTECTION'
  | 'AUTO_DRIVER'
  | 'AUTO_INSURANCE_HISTORY'
  | 'AUTO_CLAIMS'
  | 'AUTO_ADDITIONAL_DRIVER'
  | 'HOME_PROPERTY_BASICS'
  | 'HOME_FIRE_LOCATION'
  | 'HOME_ELECTRICAL'
  | 'HOME_HEATING'
  | 'HOME_WATER_PLUMBING'
  | 'HOME_POOL_SPA'
  | 'HOME_ROOF'
  | 'HOME_SAFETY_LIFESTYLE'
  | 'HOME_INSURANCE_HISTORY'
  | 'HOME_CLAIMS'
  | 'HOME_CO_APPLICANT'
  | 'FINAL_CONSENTS'
  | 'REVIEW';

const commonOrder = [
  'request.type',
  'request.desired_coverage_date',
  'customer.first_name',
  'customer.last_name',
  'customer.date_of_birth',
  'customer.gender',
  'customer.marital_status',
  'customer.occupation',
  'customer.phone',
  'customer.email',
  'customer.address.street',
  'customer.address.city',
  'customer.address.region',
  'customer.address.postal_code',
  'customer.address.country',
  'customer.address.since',
  'customer.occupancy_status',
];

const autoOrder = [
  'vehicle.vin',
  'vehicle.year',
  'vehicle.make',
  'vehicle.model',
  'vehicle.purchase_or_lease_date',
  'vehicle.acquisition_condition',
  'vehicle.financing_status',
  'vehicle.financing_rate_above_10_percent',
  'vehicle.financing_term_months',
  'vehicle.financing_interest_rate',
  'vehicle.creditor_or_lessor_name',
  'vehicle.value_before_tax',
  'vehicle.odometer_at_acquisition',
  'vehicle.tracking_or_antitheft_system',
  'vehicle.anti_theft_marking',
  'vehicle.requested_coverages',
  'vehicle.has_fpq5',
  'vehicle.winter_tires',
  'vehicle.primary_use',
  'vehicle.annual_mileage',
  'vehicle.commercial_use',
  'vehicle.commercial_use_type',
  'vehicle.commercial_annual_mileage',
  'vehicle.garage_location',
  'vehicle.outside_quebec_more_than_30_days',
  'driver.license_type',
  'driver.driving_start_year_quebec',
  'driver.first_name',
  'driver.last_name',
  'driver.date_of_birth',
  'driver.relationship_to_proposer',
  'driver.occupation',
  'driver.training_completed',
  'driver.years_licensed_other_jurisdiction',
  'driver.license_suspended_last_3_years',
  'auto.current_insurer',
  'auto.years_with_current_insurer',
  'auto.prior_policy_expiry_date',
  'auto.interruption_for_non_payment',
  'auto.cancelled_or_refused_last_3_years',
  'vehicle.modified_rebuilt_competition_or_exhibition',
  'auto.has_claims_last_6_years',
  'claim.type',
  'claim.year',
  'claim.description',
  'auto.additional_driver_exists',
  'vehicle.multi_vehicle_policy_requested',
  'auto.liability_limit_requested',
];

const homeOrder = [
  'property.ownership_status',
  'property.occupancy_type',
  'property.address.street',
  'property.address.city',
  'property.address.region',
  'property.address.postal_code',
  'property.address.country',
  'property.dwelling_type',
  'property.number_of_storeys',
  'property.foundation_type',
  'property.has_sump_pump',
  'property.basement_type',
  'property.construction_type',
  'property.reconstruction_cost',
  'property.market_value',
  'property.living_area_sqft',
  'property.year_built',
  'property.purchase_date',
  'property.distance_to_fire_hydrant_m',
  'property.distance_to_fire_station_km',
  'property.electrical_panel_amps',
  'property.heating_type',
  'property.primary_heat_source',
  'property.plumbing_type',
  'property.has_backwater_valve',
  'property.sump_pump_battery_backup',
  'property.has_pool_spa',
  'property.pool_installation_year',
  'property.pool_spa_fenced',
  'property.roof_type',
  'property.roof_year',
  'property.has_alarm_system',
  'property.alarm_monitoring_company',
  'property.has_smoke_detectors',
  'property.has_carbon_monoxide_detectors',
  'property.has_mortgage',
  'property.mortgage_holder_name',
  'property.mortgage_loan_number',
  'property.has_animals',
  'property.animal_type',
  'property.dog_breed',
  'property.business_use',
  'property.business_use_type',
  'property.business_clients_on_premises',
  'property.short_term_rental',
  'property.short_term_rental_platform',
  'property.vacant_or_unoccupied',
  'property.vacancy_reason',
  'property.prior_insurer',
  'property.coverage_start_date',
  'property.claims_last_5_years',
  'home_claim.type',
  'home_claim.year',
  'home_claim.description',
  'property.has_co_applicant',
  'co_applicant.civility',
  'co_applicant.first_name',
  'co_applicant.last_name',
  'co_applicant.date_of_birth',
  'co_applicant.occupation',
  'co_applicant.relationship',
  'co_applicant.is_vehicle_driver',
];

const finalConsentOrder = [
  'consent.credit_check',
  'consent.claims_consultation',
  'consent.data_collection_analysis_transmission',
];

const keyOrder = new Map<string, number>(
  [...commonOrder, ...autoOrder, ...homeOrder, ...finalConsentOrder].map(
    (key, index) => [key, index],
  ),
);

const finalConsentKeys = new Set(finalConsentOrder);
const autoDriverDocumentKeys = new Set([
  'driver.first_name',
  'driver.last_name',
  'driver.date_of_birth',
]);

@Injectable()
export class QuestionSequenceService {
  orderedMissing(
    product: SelectedProduct,
    definitions: DatapointDefinition[],
    missing: MissingItem[],
  ) {
    const definitionByKey = new Map(
      definitions.map((definition) => [definition.key, definition]),
    );
    return [...missing].sort((left, right) => {
      const leftDefinition = definitionByKey.get(left.key);
      const rightDefinition = definitionByKey.get(right.key);
      return (
        this.rank(product, left, leftDefinition) -
          this.rank(product, right, rightDefinition) ||
        this.entityRank(left) - this.entityRank(right) ||
        left.key.localeCompare(right.key)
      );
    });
  }

  sectionForKey(key: string): SectionCode {
    if (finalConsentKeys.has(key)) return 'FINAL_CONSENTS';
    if (commonOrder.includes(key)) return 'COMMON';
    if (
      ['vehicle.vin', 'vehicle.year', 'vehicle.make', 'vehicle.model'].includes(
        key,
      )
    )
      return 'AUTO_VEHICLE_IDENTIFICATION';
    if (
      [
        'vehicle.purchase_or_lease_date',
        'vehicle.acquisition_condition',
      ].includes(key)
    )
      return 'AUTO_ACQUISITION';
    if (
      [
        'vehicle.financing_status',
        'vehicle.financing_rate_above_10_percent',
        'vehicle.financing_term_months',
        'vehicle.financing_interest_rate',
        'vehicle.creditor_or_lessor_name',
        'vehicle.value_before_tax',
        'vehicle.odometer_at_acquisition',
      ].includes(key)
    )
      return 'AUTO_FINANCING';
    if (key.startsWith('vehicle.')) return 'AUTO_USE_PROTECTION';
    if (key.startsWith('driver.')) return 'AUTO_DRIVER';
    if (key.startsWith('auto.') && key !== 'auto.has_claims_last_6_years')
      return key === 'auto.additional_driver_exists'
        ? 'AUTO_ADDITIONAL_DRIVER'
        : 'AUTO_INSURANCE_HISTORY';
    if (key.startsWith('claim.') || key === 'auto.has_claims_last_6_years')
      return 'AUTO_CLAIMS';
    if (
      [
        'property.ownership_status',
        'property.occupancy_type',
        'property.address.street',
        'property.address.city',
        'property.address.region',
        'property.address.postal_code',
        'property.address.country',
        'property.dwelling_type',
        'property.number_of_storeys',
        'property.foundation_type',
        'property.has_sump_pump',
        'property.basement_type',
        'property.construction_type',
        'property.reconstruction_cost',
        'property.market_value',
        'property.living_area_sqft',
        'property.year_built',
        'property.purchase_date',
      ].includes(key)
    )
      return 'HOME_PROPERTY_BASICS';
    if (key.includes('fire_')) return 'HOME_FIRE_LOCATION';
    if (key.includes('electrical')) return 'HOME_ELECTRICAL';
    if (key.includes('heating') || key.includes('heat_')) return 'HOME_HEATING';
    if (
      key.includes('plumbing') ||
      key.includes('backwater') ||
      key.includes('sump_pump')
    )
      return 'HOME_WATER_PLUMBING';
    if (key.includes('pool')) return 'HOME_POOL_SPA';
    if (key.includes('roof')) return 'HOME_ROOF';
    if (key.startsWith('property.claim') || key.startsWith('home_claim.'))
      return 'HOME_CLAIMS';
    if (key.startsWith('co_applicant.') || key === 'property.has_co_applicant')
      return 'HOME_CO_APPLICANT';
    if (key.startsWith('property.prior') || key.includes('coverage_start'))
      return 'HOME_INSURANCE_HISTORY';
    if (key.startsWith('property.')) return 'HOME_SAFETY_LIFESTYLE';
    return 'COMMON';
  }

  shouldConsiderDocumentForNextMissing(
    missing: MissingItem[],
    capabilityEntityType: EntityType,
  ) {
    const next = missing[0];
    if (!next) return false;
    if (capabilityEntityType !== EntityType.DRIVER) return true;
    return autoDriverDocumentKeys.has(next.key);
  }

  private rank(
    product: SelectedProduct,
    missing: MissingItem,
    definition: DatapointDefinition | undefined,
  ) {
    const productRank =
      definition?.product === Product.COMMON
        ? 0
        : definition?.product === Product.AUTO
          ? 1
          : definition?.product === Product.HOME
            ? product === Product.AUTO_HOME
              ? 2
              : 1
            : 3;
    const keyRank = keyOrder.get(missing.key) ?? 10_000;
    const finalBump = finalConsentKeys.has(missing.key) ? 50_000 : 0;
    return productRank * 20_000 + finalBump + keyRank;
  }

  private entityRank(missing: MissingItem) {
    if (missing.entityType === EntityType.VEHICLE) return 0;
    if (missing.entityType === EntityType.PROPERTY) return 1;
    if (missing.entityType === EntityType.DRIVER) return 2;
    if (missing.entityType === EntityType.CLAIM) return 3;
    if (missing.entityType === EntityType.CO_APPLICANT) return 4;
    return 5;
  }
}
