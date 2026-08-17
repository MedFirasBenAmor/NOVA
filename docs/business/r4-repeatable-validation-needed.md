# R4 Repeatable Validation Needed

R4 preserves the 132-definition R1 catalog and does not silently add business keys. The following business/catalog gaps remain explicit.

## Additional Driver Required Subset

Mapped from existing DRIVER definitions:

- `driver.first_name`
- `driver.last_name`
- `driver.date_of_birth`
- `driver.relationship_to_proposer`
- `driver.occupation`
- `driver.license_type`
- `driver.driving_start_year_quebec`

Validation needed:

- The catalog has no `auto.additional_driver_exists` trigger.
- The business reference asks for profession; current equivalent is `driver.occupation`.
- The reference asks for year driving began; current equivalent is `driver.driving_start_year_quebec`.

## Additional Driver Claim Relationship

`ADDITIONAL_DRIVER_CLAIM_RELATION = BUSINESS/ARCHITECTURE_GAP`

The current model has no authoritative relationship between a `CLAIM` entity and a specific additional `DRIVER` entity. R4 does not mix additional-driver claims into the main AUTO claim loop.

## Claim Year Versus Date

The current catalog uses `claim.year`, not a full claim date. Business validation is needed if exact dates are required.

HOME currently uses property-scoped summary fields:

- `property.claims_last_5_years`
- `property.claim_count_last_5_years`
- `property.claim_most_recent_year`
- `property.claim_type`

The catalog does not contain HOME `CLAIM`-scoped detail keys for type/year/description.

## Max Counts

No authoritative maximum claim count is present.

No authoritative maximum additional driver count is present.

## Co-applicant Required Subset

Current required supported fields when `property.has_co_applicant = true`:

- `co_applicant.first_name`
- `co_applicant.last_name`
- `co_applicant.date_of_birth`

Business reference fields not currently represented as required catalog keys:

- co-applicant title
- co-applicant profession
- co-applicant relationship is present but optional
- co-applicant-as-driver indicator

## Co-applicant-as-driver Relationship

No canonical datapoint or relationship model currently links a HOME `CO_APPLICANT` to an AUTO `DRIVER`. R4 does not create a driver from a co-applicant.

## Multi-vehicle Decision

Additional vehicle lifecycle is intentionally deferred. The current catalog has `vehicle.multi_vehicle_policy_requested`, but R4 does not create additional VEHICLE entities.
