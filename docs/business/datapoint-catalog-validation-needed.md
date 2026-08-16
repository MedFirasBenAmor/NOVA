# Datapoint Catalog Validation Needed

R1 restores the product profile and catalog foundation without silently resolving unresolved business semantics.

The following items remain BUSINESS_VALIDATION_REQUIRED:

- vehicle.primary_use taxonomy and wording.
- commercial use type taxonomy and mapping.
- pool/spa normalization.
- property.pool_installation_year condition semantics.
- property.pool_spa_fenced condition semantics.
- animals taxonomy and dog-specific scope.
- special situations taxonomy.
- customer.gender allowed values and collection/legal handling.
- customer.marital_status allowed values and collection/legal handling.
- additional-driver exact required subset.
- co-applicant exact required subset.
- claim date/year/count semantics.
- multi-vehicle business rule.
- criminal-record scope.
- FAQ / FPQ semantics.

R1 intentionally leaves property.pool_installation_year and property.pool_spa_fenced as optional unresolved definitions. They are not modeled as blocking conditionals until an authoritative condition is available.
