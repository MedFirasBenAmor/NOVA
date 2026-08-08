FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OCR_HOST=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 libgl1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --timeout 300 --retries 5 -r requirements.txt
COPY app.py .

RUN useradd --create-home --uid 10001 ocr \
  && mkdir -p /tmp/ocr /home/ocr/.paddlex \
  && chown -R ocr:ocr /app /tmp/ocr /home/ocr/.paddlex
USER ocr

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD python -c "import json, urllib.request; x=json.load(urllib.request.urlopen('http://127.0.0.1:8001/health')); raise SystemExit(0 if x.get('ready') else 1)"

CMD ["python", "app.py"]
