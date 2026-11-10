#!/usr/bin/env python3
"""
Inference service for the backend. Loads the model once at startup and keeps it in
memory, so each snapshot only pays for inference instead of Python and model startup.

    python serve.py                      # http://127.0.0.1:8001
    python serve.py --model models/parking_detector.pt --host 0.0.0.0 --port 8001

API:
  GET  /health    model path, device and class names; use as a readiness check
  POST /predict   multipart upload with the image in an "image" field, e.g.
                    curl -F image=@snapshot.jpg "http://127.0.0.1:8001/predict?conf=0.5&classes=2&classes=7"
                  returns {"count", "width", "height", "detections": [...]}
                  each detection has bbox [x1, y1, x2, y2], center, confidence, class_id, class_name
                  (pixel coordinates in the uploaded image)

"""

import os
import threading
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile

from predict import ParkingDetector

MODEL_PATH = os.environ.get("PARKING_MODEL", "models/parking_detector.pt")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024

detector = None
# The model is NOT(!!!) safe to call from multiple threads at once.
_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app):
    global detector
    detector = ParkingDetector(MODEL_PATH)
    # First inference is slow, do one initial inference before snapshots arrive
    # Fake image for first run
    detector.get_detections(np.zeros((720, 1280, 3), dtype=np.uint8))
    print(f"Model loaded from {MODEL_PATH} on {device()}")
    yield


app = FastAPI(title="Parking Inference", lifespan=lifespan)


def device():
    return str(detector.model.predictor.device)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_PATH,
        "device": device(),
        "classes": detector.model.names,
    }


@app.post("/predict")
def predict(
    image: UploadFile = File(...),
    conf: float = Query(0.5, ge=0, le=1),
    classes: list[int] | None = Query(None, description="Class IDs to detect. Default: 2 3 5 7"),
):
    data = image.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is larger than 20 MB")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image")

    start = time.perf_counter()
    with _lock:
        detections = detector.get_detections(img, min_confidence=conf, classes=classes)
    height, width = img.shape[:2]
    return {
        "count": len(detections),
        "width": width,
        "height": height,
        "inference_ms": round((time.perf_counter() - start) * 1000, 1),
        "detections": detections,
    }


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Inference service for the parking model")
    parser.add_argument("--model", default=MODEL_PATH, help="Path to model weights (or set PARKING_MODEL)")
    parser.add_argument("--host", default="127.0.0.1", help="Use 0.0.0.0 if the backend runs on another machine")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    MODEL_PATH = args.model
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
