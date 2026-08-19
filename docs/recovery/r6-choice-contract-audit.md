# R6 Choice Contract Audit

Catalog baseline:

- COMMON: 20
- AUTO: 48
- HOME: 71
- TOTAL: 139
- AUTO profile: 68
- HOME profile: 91
- AUTO_HOME profile: 139

Input contract counts:

- BOOLEAN / YES_NO: 36
- FINITE SINGLE_CHOICE: 14
- MULTI_CHOICE: 0
- DATE: 10
- NUMBER: 25
- TEXT: 47
- MISCONFIGURED: 0
- BUSINESS_VALIDATION_REQUIRED: 7

`BUSINESS_VALIDATION_REQUIRED` is explicit. NOVA must not invent choices or
object editors for these definitions:

- `customer.gender`: ENUM missing authoritative `allowedValues`
- `customer.marital_status`: ENUM missing authoritative `allowedValues`
- `customer.occupancy_status`: ENUM missing authoritative `allowedValues`
- `property.detached_structures`: OBJECT has no customer input contract
- `property.renovations_summary`: OBJECT has no customer input contract
- `property.valuable_items_summary`: OBJECT has no customer input contract
- `vehicle.requested_coverages`: OBJECT has no customer input contract

Multi-choice audit: no active definition currently declares authoritative
multi-choice semantics.

The known additional-driver claim relationship gap remains out of scope for R6.

## Definition Table

| KEY | DATA TYPE | INPUT CONTRACT | OPTION COUNT | ENTITY TYPE | PRODUCT | VALID | SECTION | NOTES |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| consent.claims_consultation | BOOLEAN | YES_NO | 0 | CUSTOMER | COMMON | YES | REQUEST_CONSENTS |  |
| consent.credit_check | BOOLEAN | YES_NO | 0 | CUSTOMER | COMMON | YES | REQUEST_CONSENTS |  |
| consent.data_collection_analysis_transmission | BOOLEAN | YES_NO | 0 | CUSTOMER | COMMON | YES | REQUEST_CONSENTS |  |
| customer.address.city | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.address.country | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.address.postal_code | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.address.region | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.address.since | DATE | DATE | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.address.street | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.date_of_birth | DATE | DATE | 0 | CUSTOMER | COMMON | YES | PERSONAL |  |
| customer.email | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| customer.first_name | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | PERSONAL |  |
| customer.gender | ENUM | BUSINESS_VALIDATION_REQUIRED | 0 | CUSTOMER | COMMON | NO | PERSONAL | ENUM missing allowedValues |
| customer.last_name | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | PERSONAL |  |
| customer.marital_status | ENUM | BUSINESS_VALIDATION_REQUIRED | 0 | CUSTOMER | COMMON | NO | PERSONAL | ENUM missing allowedValues |
| customer.occupancy_status | ENUM | BUSINESS_VALIDATION_REQUIRED | 0 | CUSTOMER | COMMON | NO | CONTACT_ADDRESS | ENUM missing allowedValues |
| customer.occupation | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | PERSONAL |  |
| customer.phone | STRING | TEXT | 0 | CUSTOMER | COMMON | YES | CONTACT_ADDRESS |  |
| request.desired_coverage_date | DATE | DATE | 0 | REQUEST | COMMON | YES | REQUEST_CONSENTS |  |
| request.type | STRING | TEXT | 0 | REQUEST | COMMON | YES | REQUEST_CONSENTS |  |
| auto.additional_driver_exists | BOOLEAN | YES_NO | 0 | CUSTOMER | AUTO | YES | AUTO_DRIVER |  |
| auto.cancelled_or_refused_last_3_years | BOOLEAN | YES_NO | 0 | CUSTOMER | AUTO | YES | AUTO_CURRENT_INSURANCE |  |
| auto.current_insurer | STRING | TEXT | 0 | CUSTOMER | AUTO | YES | AUTO_CURRENT_INSURANCE |  |
| auto.has_claims_last_6_years | BOOLEAN | YES_NO | 0 | CUSTOMER | AUTO | YES | AUTO_CLAIMS |  |
| auto.interruption_for_non_payment | BOOLEAN | YES_NO | 0 | CUSTOMER | AUTO | YES | AUTO_CURRENT_INSURANCE |  |
| auto.liability_limit_requested | NUMBER | NUMBER | 0 | CUSTOMER | AUTO | YES | AUTO_USE_PROTECTION |  |
| auto.prior_policy_expiry_date | DATE | DATE | 0 | CUSTOMER | AUTO | YES | AUTO_CURRENT_INSURANCE |  |
| auto.years_with_current_insurer | NUMBER | NUMBER | 0 | CUSTOMER | AUTO | YES | AUTO_CURRENT_INSURANCE |  |
| claim.description | STRING | TEXT | 0 | CLAIM | AUTO | YES | AUTO_CLAIMS |  |
| claim.type | STRING | TEXT | 0 | CLAIM | AUTO | YES | AUTO_CLAIMS |  |
| claim.year | NUMBER | NUMBER | 0 | CLAIM | AUTO | YES | AUTO_CLAIMS |  |
| driver.date_of_birth | DATE | DATE | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.driving_start_year_quebec | NUMBER | NUMBER | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.first_name | STRING | TEXT | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.last_name | STRING | TEXT | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.license_suspended_last_3_years | BOOLEAN | YES_NO | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.license_type | ENUM | SINGLE_CHOICE | 4 | DRIVER | AUTO | YES | AUTO_DRIVER | catalog allowedValues |
| driver.occupation | STRING | TEXT | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.relationship_to_proposer | STRING | TEXT | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.training_completed | BOOLEAN | YES_NO | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| driver.years_licensed_other_jurisdiction | NUMBER | NUMBER | 0 | DRIVER | AUTO | YES | AUTO_DRIVER |  |
| vehicle.acquisition_condition | ENUM | SINGLE_CHOICE | 3 | VEHICLE | AUTO | YES | AUTO_ACQUISITION | catalog allowedValues |
| vehicle.annual_mileage | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.anti_theft_marking | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.commercial_annual_mileage | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.commercial_use | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.commercial_use_type | ENUM | SINGLE_CHOICE | 4 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION | catalog allowedValues |
| vehicle.creditor_or_lessor_name | STRING | TEXT | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.financing_interest_rate | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.financing_rate_above_10_percent | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.financing_status | ENUM | SINGLE_CHOICE | 3 | VEHICLE | AUTO | YES | AUTO_ACQUISITION | catalog allowedValues |
| vehicle.financing_term_months | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.garage_location | STRING | TEXT | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.has_fpq5 | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.make | STRING | TEXT | 0 | VEHICLE | AUTO | YES | AUTO_VEHICLE_IDENTIFICATION |  |
| vehicle.model | STRING | TEXT | 0 | VEHICLE | AUTO | YES | AUTO_VEHICLE_IDENTIFICATION |  |
| vehicle.modified_rebuilt_competition_or_exhibition | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.multi_vehicle_policy_requested | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.odometer_at_acquisition | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.outside_quebec_more_than_30_days | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.primary_use | ENUM | SINGLE_CHOICE | 4 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION | catalog allowedValues |
| vehicle.purchase_or_lease_date | DATE | DATE | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.requested_coverages | OBJECT | BUSINESS_VALIDATION_REQUIRED | 0 | VEHICLE | AUTO | NO | AUTO_USE_PROTECTION | OBJECT has no customer input contract |
| vehicle.tracking_or_antitheft_system | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.value_before_tax | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_ACQUISITION |  |
| vehicle.vin | STRING | TEXT | 0 | VEHICLE | AUTO | YES | AUTO_VEHICLE_IDENTIFICATION |  |
| vehicle.winter_tires | BOOLEAN | YES_NO | 0 | VEHICLE | AUTO | YES | AUTO_USE_PROTECTION |  |
| vehicle.year | NUMBER | NUMBER | 0 | VEHICLE | AUTO | YES | AUTO_VEHICLE_IDENTIFICATION |  |
| co_applicant.civility | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.date_of_birth | DATE | DATE | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.email | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.first_name | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.is_vehicle_driver | BOOLEAN | YES_NO | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.last_name | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.occupation | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| co_applicant.relationship | STRING | TEXT | 0 | CO_APPLICANT | HOME | YES | HOME_CO_APPLICANT |  |
| home_claim.description | STRING | TEXT | 0 | CLAIM | HOME | YES | HOME_CLAIMS |  |
| home_claim.type | STRING | TEXT | 0 | CLAIM | HOME | YES | HOME_CLAIMS |  |
| home_claim.year | NUMBER | NUMBER | 0 | CLAIM | HOME | YES | HOME_CLAIMS |  |
| property.address.city | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.address.country | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.address.postal_code | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.address.region | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.address.street | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.alarm_monitoring_company | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.animal_type | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.basement_type | ENUM | SINGLE_CHOICE | 5 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.business_clients_on_premises | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.business_use | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.business_use_type | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.claim_count_last_5_years | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_CLAIMS |  |
| property.claim_most_recent_year | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_CLAIMS |  |
| property.claim_type | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_CLAIMS |  |
| property.claims_last_5_years | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_CLAIMS |  |
| property.construction_type | ENUM | SINGLE_CHOICE | 5 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.coverage_start_date | DATE | DATE | 0 | PROPERTY | HOME | YES | HOME_CURRENT_INSURANCE |  |
| property.detached_structures | OBJECT | BUSINESS_VALIDATION_REQUIRED | 0 | PROPERTY | HOME | NO | HOME_SAFETY_LIFESTYLE | OBJECT has no customer input contract |
| property.distance_to_fire_hydrant_m | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.distance_to_fire_station_km | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.dog_breed | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.dwelling_type | ENUM | SINGLE_CHOICE | 6 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.electrical_panel_amps | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.foundation_type | ENUM | SINGLE_CHOICE | 6 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.has_alarm_system | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.has_animals | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.has_backwater_valve | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.has_carbon_monoxide_detectors | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.has_co_applicant | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_CO_APPLICANT |  |
| property.has_mortgage | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.has_pool_spa | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.has_smoke_detectors | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.has_sump_pump | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.heating_type | ENUM | SINGLE_CHOICE | 6 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.inspection_date | DATE | DATE | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.living_area_sqft | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.market_value | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.mortgage_holder_name | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.mortgage_loan_number | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.number_of_storeys | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.occupancy_type | ENUM | SINGLE_CHOICE | 4 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS | catalog allowedValues |
| property.ownership_status | ENUM | SINGLE_CHOICE | 3 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS | catalog allowedValues |
| property.plumbing_type | ENUM | SINGLE_CHOICE | 5 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.pool_installation_year | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.pool_spa_fenced | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.primary_heat_source | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.prior_insurer | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_CURRENT_INSURANCE |  |
| property.purchase_date | DATE | DATE | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.reconstruction_cost | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_PROPERTY_BASICS |  |
| property.renovations_summary | OBJECT | BUSINESS_VALIDATION_REQUIRED | 0 | PROPERTY | HOME | NO | HOME_BUILDING_SYSTEMS | OBJECT has no customer input contract |
| property.roof_type | ENUM | SINGLE_CHOICE | 5 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS | catalog allowedValues |
| property.roof_year | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.security_camera | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.short_term_rental | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.short_term_rental_platform | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.sump_pump_battery_backup | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
| property.vacancy_reason | STRING | TEXT | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.vacant_or_unoccupied | BOOLEAN | YES_NO | 0 | PROPERTY | HOME | YES | HOME_SAFETY_LIFESTYLE |  |
| property.valuable_items_summary | OBJECT | BUSINESS_VALIDATION_REQUIRED | 0 | PROPERTY | HOME | NO | HOME_SAFETY_LIFESTYLE | OBJECT has no customer input contract |
| property.year_built | NUMBER | NUMBER | 0 | PROPERTY | HOME | YES | HOME_BUILDING_SYSTEMS |  |
