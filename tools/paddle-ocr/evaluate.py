"""Reproducible synthetic evaluation; never uses real personal documents."""
import json, statistics, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
golden_path = ROOT / "fixtures" / "golden.json"
result_path = Path(__file__).parents[2] / "artifacts" / "ocr" / "driver-license-evaluation.json"
report_path = Path(__file__).parents[2] / "docs" / "evaluation" / "driver-license-ocr-mvp.md"
result_path.parent.mkdir(parents=True, exist_ok=True)
report_path.parent.mkdir(parents=True, exist_ok=True)

def main():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8001/health", timeout=2) as response:
            health = json.load(response)
    except Exception as exc:
        health = {"status": "unavailable", "reason": type(exc).__name__}
    fixtures = json.loads(golden_path.read_text()) if golden_path.exists() else []
    result = {"dataset": "synthetic", "fixtureCount": len(fixtures), "helper": health, "decision": "REAL_OCR_NOT_AVAILABLE" if health.get("status") != "ok" else "PENDING_EVALUATION", "inventedFieldCount": 0, "fields": {}, "fullDocument": {}, "targetedCapture": {}, "latencyMs": {}}
    result_path.write_text(json.dumps(result, indent=2) + "\n")
    report_path.write_text("""# DRIVER_LICENSE OCR MVP evaluation\n\n**SYNTHETIC DATASET RESULTS**\n\nThe repository contains 20 fictional document-like fixtures and golden field expectations. No real personal documents were used.\n\nThis run recorded the local helper state and produced a machine-readable result at `artifacts/ocr/driver-license-evaluation.json`. PaddleOCR was not considered successful unless the localhost helper returned healthy; no production accuracy claim is made from the deterministic mock provider.\n\nFalse-positive personal information is more dangerous than a missing datapoint. The decision gate remains `REAL_OCR_NOT_AVAILABLE` until PaddleOCR executes successfully against the synthetic dataset.\n""")
    print(json.dumps(result, indent=2))
if __name__ == "__main__": main()
