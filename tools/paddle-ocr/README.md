# Local PaddleOCR helper

This is a localhost-only technical adapter. NestJS remains the document
orchestrator and owns private storage, extraction, provenance, and datapoints.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

It binds to `127.0.0.1:8001` by default and exposes only `/health` and `/ocr`.
It accepts JPEG/PNG/WebP and one-page PDF files (rasterized locally), caps input at 10 MB, does not retain files, and
disables access logs so OCR text cannot enter generic logs. Production requires
container isolation, CPU/memory limits, request authentication, and PDF page
limits/rasterization before exposing this beyond local development.
