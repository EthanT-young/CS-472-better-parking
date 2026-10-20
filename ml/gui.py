#!/usr/bin/env python3
"""
Web GUI for running, training, and testing the parking detection model.

    python gui.py            # then open http://127.0.0.1:8000

Serves the frontend in web/ and a small JSON API:
  GET  /api/browse         list sub-folders and images in a folder
  GET  /api/image          serve an image file
  GET  /api/models         list available .pt weights
  POST /api/predict        run the detector on an image, returns detections as JSON
  POST /api/jobs/{name}    start train.py / test.py
  GET  /api/jobs/{name}    poll a job's status and log output
  POST /api/jobs/{name}/stop
"""

import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ML_DIR = Path(__file__).resolve().parent
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

app = FastAPI(title="Parking Model GUI")


def resolve(path):
    """Resolve a path relative to the ml/ directory."""
    return (ML_DIR / os.path.expanduser(path)).resolve()


# --- Files ---

@app.get("/api/browse")
def browse(path: str = "."):
    folder = resolve(path)
    if not folder.is_dir():
        raise HTTPException(404, f"Not a folder: {folder}")
    dirs, images = [], []
    try:
        for p in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
            if p.name.startswith("."):
                continue
            if p.is_dir():
                dirs.append(p.name)
            elif p.suffix.lower() in IMAGE_EXTS:
                images.append(p.name)
    except PermissionError:
        raise HTTPException(403, f"Permission denied: {folder}")
    return {"path": str(folder), "parent": str(folder.parent), "dirs": dirs, "images": images}


@app.get("/api/image")
def image(path: str):
    file = resolve(path)
    if file.suffix.lower() not in IMAGE_EXTS or not file.is_file():
        raise HTTPException(404, "Image not found")
    return FileResponse(file)


@app.get("/api/models")
def models():
    found = sorted(ML_DIR.glob("models/*.pt")) + sorted(ML_DIR.glob("runs/**/weights/*.pt"))
    return [str(p.relative_to(ML_DIR)) for p in found]


# --- Inference ---

_detectors = {}
_detector_lock = threading.Lock()


class PredictRequest(BaseModel):
    path: str
    model: str = "models/parking_detector.pt"
    classes: list[int] = [2, 3, 5, 7]
    conf: float = 0.5


@app.post("/api/predict")
def predict(req: PredictRequest):
    from predict import ParkingDetector  # deferred: importing ultralytics is slow

    image_path = resolve(req.path)
    model_path = resolve(req.model)
    if not image_path.is_file():
        raise HTTPException(404, f"Image not found: {image_path}")
    if not model_path.is_file():
        raise HTTPException(404, f"Model not found: {model_path}")

    with _detector_lock:
        key = (str(model_path), tuple(req.classes))
        if key not in _detectors:
            _detectors[key] = ParkingDetector(str(model_path), vehicle_classes=req.classes)
        detector = _detectors[key]
        detections = detector.get_detections(str(image_path), min_confidence=req.conf)

    names = detector.model.names
    for det in detections:
        det["class_name"] = names.get(det["class_id"], str(det["class_id"]))
    return {"detections": detections, "count": len(detections)}


# --- Training / testing jobs ---

class Job:
    def __init__(self, script):
        self.script = script
        self.proc = None
        self.log = ""
        self.command = None

    @property
    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def start(self, args):
        cmd = [sys.executable, "-u", self.script]
        for flag, value in args.items():
            if str(value).strip():
                cmd += [f"--{flag}", str(value).strip()]
        self.command = " ".join(cmd[2:])
        self.log = f"$ {self.command}\n"
        self.proc = subprocess.Popen(cmd, cwd=ML_DIR, env=dict(os.environ, PYTHONUNBUFFERED="1"),
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
        threading.Thread(target=self._read, args=(self.proc,), daemon=True).start()

    def _read(self, proc):
        fd = proc.stdout.fileno()
        while chunk := os.read(fd, 4096):
            self.log += chunk.decode(errors="replace")
        self.log += f"\n[process exited with code {proc.wait()}]\n"

    def stop(self):
        if self.running:
            os.killpg(self.proc.pid, signal.SIGINT)  # lets ultralytics shut down cleanly

    def status(self, since=0):
        code = None if self.proc is None else self.proc.poll()
        return {"running": self.running, "exit_code": code, "log": self.log[since:], "offset": len(self.log)}


JOBS = {"train": Job("train.py"), "test": Job("test.py")}


def get_job(name):
    if name not in JOBS:
        raise HTTPException(404, f"Unknown job: {name}")
    return JOBS[name]


@app.post("/api/jobs/{name}")
def start_job(name: str, args: dict[str, str | int | float]):
    job = get_job(name)
    if job.running:
        raise HTTPException(409, f"{name} is already running")
    job.start(args)
    return job.status()


@app.get("/api/jobs/{name}")
def job_status(name: str, since: int = 0):
    return get_job(name).status(since)


@app.post("/api/jobs/{name}/stop")
def stop_job(name: str):
    job = get_job(name)
    job.stop()
    return job.status()


app.mount("/", StaticFiles(directory=ML_DIR / "web", html=True), name="web")


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Web GUI for the parking model")
    parser.add_argument("--host", default="127.0.0.1", help="Use 0.0.0.0 to allow access from other machines")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    print(f"Open http://{args.host}:{args.port} in your browser")
    try:
        uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    finally:
        for job in JOBS.values():
            job.stop()
