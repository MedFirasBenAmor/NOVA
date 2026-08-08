"""Private localhost-only OCR adapter for NOVA.

Business extraction stays in NestJS. This process returns OCR blocks only.
"""
import io
import os
import time
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
import pypdfium2 as pdfium

MAX_BYTES = int(os.getenv("OCR_MAX_BYTES", str(10 * 1024 * 1024)))
app = FastAPI(docs_url=None, redoc_url=None)


@app.get("/health")
def health():
    try:
        _ocr()
        return {"status": "ok", "provider": "PADDLE_OCR"}
    except Exception:
        return {"status": "unavailable", "provider": "PADDLE_OCR"}


@lru_cache(maxsize=1)
def _ocr():
    from paddleocr import PaddleOCR

    return PaddleOCR(lang="en", use_doc_orientation_classify=False,
                     use_doc_unwarping=False, use_textline_orientation=False)


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    started = time.perf_counter()
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "OCR input exceeds size limit")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp", "application/pdf"}:
        raise HTTPException(415, "OCR helper accepts images only")
    try:
        if file.content_type == "application/pdf":
            pdf = pdfium.PdfDocument(data)
            if len(pdf) > 1:
                raise HTTPException(422, "UNSUPPORTED_DOCUMENT_CONTENT")
            image = pdf[0].render(scale=2).to_pil().convert("RGB")
        else:
            image = Image.open(io.BytesIO(data)).convert("RGB")
        result = _ocr().predict(image)
        blocks = []
        for page in result:
            texts = page.get("rec_texts", [])
            scores = page.get("rec_scores", [])
            for text, confidence in zip(texts, scores):
                if text and float(confidence) >= 0:
                    blocks.append({"text": text, "confidence": float(confidence), "page": 1})
        return {"blocks": blocks, "provider": "PADDLE_OCR",
                "processingMs": round((time.perf_counter() - started) * 1000)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "OCR_UNREADABLE") from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("OCR_HOST", "127.0.0.1"),
                port=int(os.getenv("OCR_PORT", "8001")), access_log=False)
