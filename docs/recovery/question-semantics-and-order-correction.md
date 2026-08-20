# Question Semantics and Order Correction

## Catalog Drift: 132 to 139

The catalog did not drift accidentally. R4.1 intentionally moved the validated
runtime catalog from `20 / 47 / 65 / 132` to `20 / 48 / 71 / 139` to close
repeatable collection and co-applicant gaps.

Added definitions:

| Key | Product | Entity | Requirement | Purpose | Reference support | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `auto.additional_driver_exists` | AUTO | CUSTOMER | REQUIRED | Trigger additional driver lifecycle | Auto reference asks whether to add an additional driver | KEEP |
| `home_claim.type` | HOME | CLAIM | CONDITIONAL | Repeatable HOME claim type | Home reference asks claim type | KEEP |
| `home_claim.year` | HOME | CLAIM | CONDITIONAL | Repeatable HOME claim year | Home reference asks claim year | KEEP |
| `home_claim.description` | HOME | CLAIM | CONDITIONAL | Repeatable HOME claim description | Home reference asks claim description | KEEP |
| `co_applicant.civility` | HOME | CO_APPLICANT | CONDITIONAL | Co-applicant title/civility | Source asks civility/title, option set unresolved | KEEP, BUSINESS_VALIDATION_REQUIRED for options |
| `co_applicant.occupation` | HOME | CO_APPLICANT | CONDITIONAL | Co-applicant profession | Source asks profession | KEEP |
| `co_applicant.is_vehicle_driver` | HOME | CO_APPLICANT | CONDITIONAL | Whether co-applicant is also a vehicle driver | Source asks the boolean fact | KEEP |

Final catalog remains `COMMON = 20`, `AUTO = 48`, `HOME = 71`, `TOTAL = 139`.

## Finite-choice Corrections

- `request.type` now uses a catalog finite-choice contract for the source
  situation question.
- `customer.occupancy_status` now uses a catalog finite-choice contract for the
  three source-supported occupancy statuses.

NOVA still refuses to invent option sets for gender, marital status,
co-applicant civility, requested coverages, animals, and structured home data.
Those are documented in `docs/business/question-semantics-validation-needed.md`.

## QuestionSequenceService

`QuestionSequenceService` is the centralized authority for manual question
ordering. `CollectionStrategyService` asks it to order the current applicable
missing datapoints and then chooses the earliest unresolved item.

The service does not make values required. Completeness and conditional logic
still determine applicability. The sequence only orders applicable missing work.

## Dependency Precedence

Hard dependencies still override static order:

- current repeatable loop fields are completed before unrelated questions;
- repeatable entity completion is followed by `ASK_ADD_ANOTHER_ENTITY`;
- conditional children appear only after their trigger is true;
- known values from existing dossier/document/intelligence sources are skipped
  by completeness and are not re-asked as normal manual questions.

## Document Placement

Document actions are contextual. Driver-license capture is only considered when
the next business work is inside the primary driver section. It is no longer
injected before COMMON request/identity questions or before vehicle basics.

Current policy document opportunity remains part of R2 intake routing.

## Business Order

COMMON:

1. request situation
2. desired coverage date
3. identity and date of birth
4. optional personal/contact/address facts when applicable
5. final consents are deliberately deferred

AUTO:

1. vehicle identification
2. acquisition
3. financing
4. use/protection
5. primary driver and driver-license opportunity
6. insurance/history
7. claims and repeatable claim loop
8. additional driver trigger and loop
9. additional vehicle placeholder/current liability fields
10. final consents

HOME:

1. property basics
2. fire/location context
3. electrical/heating/plumbing/water
4. pool/spa and roof
5. safety/lifestyle/property finance
6. home insurance history
7. home claims and repeatable loop
8. co-applicant trigger and fields
9. final consents

AUTO_HOME:

R2 prerequisites remain `AUTO insurance branch -> HOME insurance branch`.
Core collection then proceeds `COMMON -> AUTO -> HOME -> FINAL`.

## Review Placement

Reviews remain after all applicable data and final consent questions are
complete. Section confirmation still uses the R5 snapshot and reconfirmation
architecture.

## Section Switch Counts

The same section-switch helper was applied to the previous audit trace and the
post-correction trace.

| Product | Before | After |
| --- | ---: | ---: |
| AUTO | 25 | 22 |
| HOME | 30 | 24 |
| AUTO_HOME | 51 | 42 |

The reduction comes from ordering by business sequence instead of category/key
sorting while preserving dependency and review boundaries.
