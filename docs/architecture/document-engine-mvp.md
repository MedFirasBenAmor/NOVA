# Document Engine MVP

The async boundary is:

```text
UPLOADED → BullMQ PROCESS_DOCUMENT → PROCESSING → OCR → DRIVER_LICENSE extraction → catalog validation → datapoint provenance → PROCESSED
```

Redis carries only `{ documentId }`; it never carries file bytes, OCR text, or conversation content. The worker is idempotent for already-processing/processed documents and records safe processing counters and failure codes.

`OcrProvider` is separate from `DriverLicenseExtractor`. The deterministic mock provider supports offline tests. The PaddleOCR adapter is an isolated configuration boundary and currently reports unavailable because no reliable local Paddle runtime is installed. No driver's-license data is sent to Gemini, OpenAI, or another external AI service.

With `OCR_PROVIDER=paddle`, the adapter posts the private file to the local `PADDLE_OCR_URL` helper and expects `{ "textBlocks": [{ "text": "...", "confidence": 0.9, "page": 1 }] }`. A minimal helper can use `paddleocr`, `paddlepaddle`, and a small FastAPI/Flask multipart endpoint; it must bind to localhost or private networking and must not persist or log uploads. No Paddle runtime/helper was installed or executed in this environment.

**OCR reads document content. It does not decide canonical customer truth.** Extraction emits only evidence-backed existing catalog keys: first name, last name, and ISO date of birth. It deliberately does not infer occupation, claims, relationship, driving history, or unsupported license enums. **Document extraction must prefer missing information over invented information.**

Candidates use `FULL_DOCUMENT` or `TARGETED_DOCUMENT_CAPTURE` source provenance, `EXTRACTED`/targeted collection methods, document ID, page, and confidence. Existing DatapointsService conflict preservation remains in force; a document observation cannot silently destroy a chat observation.

While a document is uploaded or processing, Collection Strategy returns `WAIT_FOR_PROCESSING`. After processing status is terminal, the status endpoint returns completeness and a new strategy action. Failed processing is non-blocking and continues through the normal collection fallback.

This MVP covers `DRIVER_LICENSE` only. Classification, OCR production deployment, antivirus, retention, validation, merge, risk, eligibility, and other document types remain future work.

If a driver-scoped collection action has no entity yet, upload creates one backend UUID scope and stores it on both the `CollectionAttempt` and `Document`. The browser cannot select an arbitrary driver scope.
