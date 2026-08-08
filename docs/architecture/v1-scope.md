# NOVA V1.0 Scope

NOVA V1.0 ends at Risk & Eligibility:

```text
Inputs
  ↓
Capture
  ↓
Intelligence + Document/OCR
  ↓
Merge
  ↓
Validation
  ↓
Risk & Eligibility
```

The V1 output is a **Qualified Customer Dossier** plus an **Eligibility Result**.

Eligibility outcomes:

- `ELIGIBLE`
- `SEGMENTED`
- `NON_ELIGIBLE`

This repository currently provides only the technical foundation. Capture, intelligence, document/OCR, merge, validation, and Risk & Eligibility engines are not implemented in this task.

## Out of scope for V1

- Market Matching & Submission
- Binding
- Policy issuance
- Finalization & Management
- Full Continuous Support
