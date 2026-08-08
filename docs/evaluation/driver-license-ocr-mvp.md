# DRIVER_LICENSE OCR MVP evaluation

## SYNTHETIC DRIVER_LICENSE DATASET RESULTS

This is a synthetic benchmark only. It uses no real licenses, customer data,
addresses, license numbers, or real birthdays.

### Runtime

- Docker CPU container, x86_64, 8 host CPUs, 4 GiB container memory limit
- Python 3.12
- PaddlePaddle 3.3.1
- PaddleOCR 3.7.0
- Models: `PP-OCRv5_mobile_det` and `en_PP-OCRv5_mobile_rec`
- Model initialization is one-time and cached in the Docker volume
  `nova_paddle_cache`.

### Dataset

Two sets were evaluated:

- Original committed 20 fixtures: tiny bitmap font, clean/targeted/rotation/
  blur/reduced-contrast variants.
- Readable 20 fixtures: fictional names Alex Martin, Jamie Example, Taylor
  Sample rendered with a real TrueType font, with the same controlled variants.

The original fixtures processed successfully but produced no OCR blocks. That
is a useful fixture-quality result, not a Paddle failure. The readable set is
the meaningful baseline for field extraction.

### Readable-set field metrics

| Field | Expected | Emitted | Correct | Incorrect | Missing | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|
| `driver.first_name` | 20 | 20 | 20 | 0 | 0 | 100% | 100% |
| `driver.last_name` | 20 | 20 | 20 | 0 | 0 | 100% | 100% |
| `driver.date_of_birth` | 20 | 20 | 20 | 0 | 0 | 100% | 100% |

- Invented fields: 0
- False-positive candidates: 0
- Successful documents: 20/20
- Correct datapoints per successful document: 3
- Questions potentially avoided: 3 per successful document

### Full document versus targeted capture

| Mode | Documents | Success | Correct fields/document | Invented fields | Mean OCR latency |
|---|---:|---:|---:|---:|---:|
| `FULL_DOCUMENT` | 16 | 16/16 | 3.0 | 0 | 6.56 s |
| `TARGETED_CAPTURE` | 4 | 4/4 | 3.0 | 0 | 3.30 s |

Targeted capture was faster on this synthetic set because the image contained
less content. It was not assumed to be more accurate; both modes were perfect
on these readable fixtures.

### Latency

Readable-set warm HTTP OCR latency:

- Mean: 5.91 s
- Median: 6.18 s
- p95: 7.49 s

This includes localhost HTTP and CPU OCR, not Docker image build/download time.
The first model startup/download is measured separately operationally and is
not part of per-document latency.

### Confidence

The smoke test returned real Paddle confidence values around 0.997–0.999 for
the clean readable fixture. The benchmark preserves the confidence values for
each emitted candidate in the machine-readable artifact. This small synthetic
set is insufficient to establish production thresholds; no automatic
confirmation threshold was introduced.

### Document Engine integration

The helper returns OCR blocks through the existing `PaddleOcrProvider`. The
normal path remains BullMQ → `PaddleOcrProvider` → `DriverLicenseExtractor` →
DatapointService → provenance → completeness. No benchmark-only business parser
was introduced.

The existing candidate architecture remains non-canonical: OCR reads evidence;
it does not decide customer truth. Candidate provenance retains document ID,
document type, collection mode, page, confidence, and extraction method.

### Hardening and limitations

- Helper binds to localhost for host development and runs as non-root.
- Root filesystem is read-only; only the Paddle model/cache volume and `/tmp`
  tmpfs are writable.
- Input is capped at 10 MB; images and one-page PDFs are accepted.
- No raw OCR text is written to generic access logs or Redis.
- CPU and memory are limited in Compose.
- Original tiny-font fixtures remain intentionally unchanged and document the
  importance of realistic OCR fixture generation.
- This is synthetic performance, not production accuracy.
- Missing-field, malformed-image, unavailable-helper, timeout, and malformed
  response fallback paths remain safe and map to machine-readable failures.

For NOVA document extraction, false-positive personal information is more
dangerous than a missing datapoint.

## Decision gate

**READY_FOR_OCR_HARDENING_AND_NEXT_DOCUMENT**

Real PaddleOCR executes locally and the readable synthetic baseline has zero
false positives and zero invented fields. This does not authorize starting the
next document type automatically; real-world robustness and confirmation UX
remain necessary before production use.

Machine-readable aggregate output is generated at
`artifacts/ocr/driver-license-evaluation.json` and is intentionally ignored by
Git.
