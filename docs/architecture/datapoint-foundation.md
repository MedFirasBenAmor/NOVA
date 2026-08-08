# Datapoint Foundation

NOVA is not a digital questionnaire or Jotform clone. Questions are a collection mechanism; datapoints are the durable facts required to build a qualified customer dossier.

## Definitions and values

`DatapointDefinition` describes what a fact means, its type, product, category, requirement level, allowed sources, validation metadata, and conditional requirement. Definitions are versioned catalog records.

`DatapointValue` is the canonical value NOVA currently holds for one customer folder and entity scope. Heterogeneous values are stored as JSON while the definition controls their expected type and allowed enum values.

A future customer sentence may produce several values from one interaction. For example, “I bought a 2024 RAV4, it is financed, and I drive 15,000 km per year” can eventually populate year, make, model, financing status, and annual mileage without turning that sentence into one opaque field.

## Provenance

Every write appends a `DatapointSource`. The source records the observed value, source type, collection method, confidence, source reference, and non-sensitive metadata. Updating the canonical value never deletes older evidence.

This separation prepares the future Merge Engine to compare conflicting observations without losing history. Derived and enriched observations remain distinguishable from customer-provided or confirmed observations.

## Entity scoping

Definitions use stable keys such as `vehicle.year`, not numbered keys such as `vehicle_1.year`.

Values carry `entityType` and `entityId`. Multiple vehicles, drivers, and claims can therefore reuse the same definition. The canonical uniqueness boundary is folder, definition, and entity scope.

## Conditional requirements

V1 conditions are deliberately small JSON predicates:

```json
{
  "key": "vehicle.financing_status",
  "operator": "IN",
  "value": ["FINANCED", "LEASED"]
}
```

The deterministic resolver currently supports `EQ` and `IN`. Same-entity conditions, such as vehicle financing or commercial use, are evaluated within the vehicle scope. Root facts, such as whether claims exist, can trigger claim-scoped requirements. This is not an eligibility or generic rules engine.

## Completeness

The completeness resolver loads active COMMON and product definitions, evaluates required and triggered conditional entries, and compares them with canonical values. `NOT_APPLICABLE` values do not count as missing. The response contains known values, missing values, newly triggered conditional requirements, and a required-value completion percentage.

NOVA should not ask for information it already holds with usable status. Reducing customer effort is a core product KPI.

## Collection sources and methods

Sources distinguish customer chat/form/confirmation, existing NOVA data, full documents, targeted document capture, external APIs, brokers, derived values, and enriched values.

Methods distinguish reuse, extraction, targeted capture, API fetching, derivation, enrichment, confirmation, manual questions or entry, and broker entry.

The future document fallback is:

```text
full document
  ↓ if refused
targeted capture
  ↓ if refused
manual targeted question
```

This task only models those origins. It does not upload, inspect, or extract documents.

## Future engines

- Intelligence may convert one interaction into multiple candidate values and sources.
- Merge may choose a canonical value from conflicting evidence.
- Validation may promote or reject values.
- Risk and Eligibility may consume validated dossier values.

None of those engines are implemented in this foundation.
