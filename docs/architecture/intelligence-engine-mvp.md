# Intelligence Engine MVP

The Intelligence Engine turns one customer interaction into structured intent, product, event, and candidate datapoints. Its objective is not to make the conversation look smart. Its objective is to reduce how much information the customer must manually provide.

```text
customer interaction
  ↓
ingestion boundary
  ↓
IntelligenceProvider
  ↓
validated IntelligenceResult
  ↓
candidate datapoint ingestion
  ↓
DatapointSource provenance
  ↓
Completeness Resolver
```

## Responsibility and contract

`POST /leads/:leadId/interactions` accepts a synthetic or real customer message and optional entity context. The service loads only active COMMON plus the currently supported product catalog and a compact list of known usable datapoints. It does not send audit history, unrelated database records, or document content to a provider.

The shared `IntelligenceResult` contains:

- intent and confidence
- product and confidence
- zero or more typed events
- zero or more candidate datapoints

Every candidate has a catalog key, value, entity scope, confidence, semantic method, and optional evidence.

## EXTRACTED, ENRICHED, INFERRED

- `EXTRACTED`: directly stated by the customer, such as `15,000 km per year`.
- `ENRICHED`: obtained from a small trusted knowledge mapping, such as `RAV4 → TOYOTA`.
- `INFERRED`: a contextual interpretation, such as `bought a vehicle → NEW_ACQUISITION`.

These remain separate in the result and are mapped to the existing provenance methods/statuses:

```text
EXTRACTED → CUSTOMER_CHAT + EXTRACTED
ENRICHED  → ENRICHED + ENRICHED
INFERRED  → DERIVED + INFERRED
```

No candidate is automatically confirmed.

## Catalog-aware extraction

The provider receives only compact catalog entries: key, label, datatype, entity type, and allowed values. The service validates the returned product, event, confidence, key, entity type, UUID scope, datatype, and enum values before ingestion. Undeclared keys are rejected; the provider cannot write arbitrary columns or facts to PostgreSQL.

The current catalog does not contain `vehicle.trim`. It is intentionally not produced by the MVP and should be added through a catalog change before extraction is supported.

## Context minimization and non-hallucination

Only the current message, optional vehicle/driver/claim context, and known usable datapoints are sent to the provider. Existing equivalent values are not written again. A message such as “I bought a RAV4” produces model and the explicit small enrichment `TOYOTA`, but not VIN, year, financing, mileage, driver age, or claim history.

The deterministic mock supports the initial reference scenarios without a network dependency. A Gemini adapter exists behind the same provider interface and is selected only with `AI_PROVIDER=gemini` and a locally supplied key.

## Provenance and conflicts

Every accepted candidate uses the existing datapoint ingestion service, which updates the canonical value and appends a `DatapointSource` with the interaction reference, semantic method, confidence, and evidence.

If a candidate conflicts with an existing canonical value, the existing canonical value is retained and the new observation is appended as provenance. The interaction response exposes the conflict; full Merge resolution is deliberately deferred.

## Completeness and future strategy

After ingestion, the existing Completeness Resolver recalculates required and conditional missing information. The response also exposes detected, accepted, rejected, and newly added candidate counts. `questionsPotentiallyAvoided` is currently a conservative count of newly added datapoints, not a time-saved claim.

Future Intelligence, Merge, Validation, Risk, and Eligibility engines can consume these contracts. Intelligent Collection Strategy can later use provenance and completeness to choose among reuse, full document, targeted capture, confirmation, manual question, and broker intervention. That strategy and all document/OCR behavior remain out of scope for this MVP.

