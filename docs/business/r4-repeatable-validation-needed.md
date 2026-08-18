# R4.1 Repeatable Validation Notes

R4.1 reconciles repeatable collection with the Auto + Habitation reference without preserving the old 132-definition count artificially.

## Implemented

- AUTO additional-driver trigger: `auto.additional_driver_exists`.
- AUTO additional-driver required subset using existing DRIVER keys:
  - `driver.first_name`
  - `driver.last_name`
  - `driver.date_of_birth`
  - `driver.relationship_to_proposer`
  - `driver.occupation`
  - `driver.license_type`
  - `driver.driving_start_year_quebec`
- HOME repeatable claim detail keys scoped to `CLAIM`:
  - `home_claim.type`
  - `home_claim.year`
  - `home_claim.description`
- Legacy property-level HOME claim summaries are non-blocking optional summaries:
  - `property.claim_count_last_5_years`
  - `property.claim_most_recent_year`
  - `property.claim_type`
- Co-applicant conditional required subset:
  - `co_applicant.civility`
  - `co_applicant.first_name`
  - `co_applicant.last_name`
  - `co_applicant.date_of_birth`
  - `co_applicant.occupation`
  - `co_applicant.relationship`
  - `co_applicant.is_vehicle_driver`

## Source-Supported But Not Implemented

- Additional-driver claim relationship: the source asks whether each additional driver has claims and then asks claim details. The current model does not have an explicit `CLAIM belongs to DRIVER` relationship. R4.1 does not model that association implicitly.

## Business Ambiguous

- Maximum number of claims: no source maximum identified.
- Maximum number of additional drivers: no source maximum identified.
- Exact claim date: the source-supported reconstructed concept is claim year; no exact date is defined.
- Civility/title allowed values: captured as a string because no authoritative enum values were found.

## Deferred

- Additional vehicle lifecycle and multi-vehicle entity creation.
- Driver-to-vehicle assignment.
- Co-applicant-to-driver person-role linking beyond capturing `co_applicant.is_vehicle_driver`.
- Section confirmation, review, and reconfirmation.
- Document OCR reconstruction beyond already restored flows.
- Global Resume, Merge, Validation, Risk, and Eligibility engines.
