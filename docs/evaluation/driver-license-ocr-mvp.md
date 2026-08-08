# DRIVER_LICENSE OCR MVP evaluation

## SYNTHETIC DATASET RESULTS

Environment: Ubuntu x86_64, Python 3.12.3. Package indexes exposed compatible
`paddlepaddle==3.3.1` and `paddleocr==3.7.0` releases. The PaddlePaddle CPython
3.12 wheel is 194.8 MB; repeated installation attempts reached that download
but did not complete, so neither package was installed and PaddleOCR was not
executed.

The dataset contains 20 fictional document-like PNG fixtures with separate
golden expectations. It covers clean, targeted, 3-degree rotation, blur, and
reduced-contrast variants using only Alex Martin, Jamie Example, and Taylor
Sample. No real personal documents were used.

Because the real helper was unavailable, field accuracy, precision, recall,
latency, confidence calibration, preprocessing impact, and targeted-versus-full
performance are **not measured**. `inventedFieldCount = 0` in the artifact
means no real extractor run emitted candidates; it is not an accuracy result.

The localhost helper boundary is implemented with 10 MB input limits,
JPEG/PNG/WebP support, one-page PDF rasterization, disabled access logs, no
retention, and no cloud forwarding. NestJS now applies a configurable request
timeout and safe failure codes.

Machine-readable status is generated at
`artifacts/ocr/driver-license-evaluation.json` and intentionally ignored by
Git because it is a generated run artifact.

> For NOVA document extraction, false-positive personal information is more
> dangerous than a missing datapoint.

Decision gate: **REAL_OCR_NOT_AVAILABLE**.
