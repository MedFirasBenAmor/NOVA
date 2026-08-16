# R1 Product Profiles And Catalog

## Baseline

Authoritative repository: /home/ziii/Documents/NOVA
Base commit: 094a058 feat: run PaddleOCR in local CPU container
Recovery branch: recovery/intake-v1-rebuild

R0 verification established the source baseline from MedFirasBenAmor/NOVA main. Docker is not installed on this Ubuntu host and sudo requires an interactive password, so Docker infrastructure, database migration, seed execution, API /health, and live web route probes are blocked until Docker is installed by the user.

## Changes

R1 restores first-class selected product authority and centralized profile composition:

- Lead.selectedProduct persists the backend-authoritative selected product.
- Product supports AUTO_HOME for selection/profile composition.
- AUTO_HOME is not a duplicated catalog; it composes COMMON + AUTO + HOME.
- EntityType now includes PROPERTY and CO_APPLICANT for future lifecycle milestones.
- RequirementProfileService is the single active requirement composition source.
- Completeness, collection strategy, documents follow-up, and intelligence catalog filtering consume the profile service.
- SELECT_PRODUCT is a deterministic next action when product is unknown.
- Provider product output cannot override a persisted selected product.

## Catalog Counts

COMMON definitions: 20
AUTO definitions: 47
HOME definitions: 65
TOTAL definitions: 132

Requirement breakdown:

- COMMON: 8 required, 12 optional, 0 conditional
- AUTO: 30 required, 11 optional, 6 conditional
- HOME: 40 required, 9 optional, 16 conditional
- TOTAL: 78 required, 32 optional, 22 conditional

Profile counts:

- AUTO: 67 definitions
- HOME: 85 definitions
- AUTO_HOME: 132 definitions

## Product Authority

Selected product is nullable on Lead for UNKNOWN. Valid selected values are AUTO, HOME, and AUTO_HOME. Once selected, the persisted value remains authoritative. Gemini/mock provider inference can classify the current interaction, but cannot replace the selected product.

## Product Isolation

AUTO profiles contain COMMON + AUTO only. HOME profiles contain COMMON + HOME only. AUTO_HOME contains COMMON + AUTO + HOME with COMMON exactly once. Cross-sell or opportunity datapoints must not block completion of a selected single product.

## Known Unresolved Business Rules

See docs/business/datapoint-catalog-validation-needed.md. R1 preserves unresolved semantics as BUSINESS_VALIDATION_REQUIRED rather than turning them into false validated rules. In particular, property.pool_installation_year and property.pool_spa_fenced are optional unresolved definitions in R1, not dead conditionals.

## Tests

Baseline before R1:

- API tests: 43 passed
- Web tests: 14 passed

After R1:

- Prisma generate: passed
- Prisma validate: passed with DATABASE_URL from .env.example
- API lint: passed
- API tests: 56 passed
- API build: passed
- Web lint: passed
- Web tests: 14 passed
- Web build: passed

Docker-dependent checks blocked:

- docker --version: docker command not found
- docker compose version: docker command not found
- docker info: docker command not found
- docker compose config --services: blocked until Docker installed
- PostgreSQL/Redis/PaddleOCR health: blocked until Docker installed
- migrate deploy and seed twice against local DB: blocked until Docker installed
- API /health, Web /, Web /chat live probes: blocked until Docker/API runtime available

## Acceptance Evidence

Unit coverage proves exact catalog counts, profile composition, COMMON de-duplication, AUTO/HOME isolation, optional non-blocking behavior, triggered and untriggered conditionals, selected-product authority, SELECT_PRODUCT availability, seed idempotency by canonical key uniqueness, finite choices from catalog metadata, and backend enum validation.
