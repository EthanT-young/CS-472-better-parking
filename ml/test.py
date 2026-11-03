#!/usr/bin/env python3
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent
MODEL_PATH = ML_DIR / "models" / "parking_detector.pt"
RUNS_DIR = ML_DIR / "runs" / "val"

def get_best_device():
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"GPU Detected: {gpu_name}")
        return "0"
    else:
        print("No GPU detected, falling back to CPU.")
        return "cpu"

def test_model(model_path, data, split, imgsz, conf):
    print(f"\n--- Testing Model: {model_path} ---")

    device = get_best_device()

    # Load the model to test
    model = YOLO(model_path)

    # Run validation. Training runs all save best.pt, so name the output after the run instead
    run_name = model_path.parent.parent.name if model_path.stem == "best" else model_path.stem
    name = f"{run_name}_{split}"
    metrics = model.val(
        data=data,
        split=split,
        imgsz=imgsz,
        conf=conf,
        device=device,
        project=str(RUNS_DIR),
        name=name,
        exist_ok=True,
        plots=True,
    )

    print("\nTesting Complete")
    print(f"Precision: {metrics.box.mp:.4f}")
    print(f"Recall:    {metrics.box.mr:.4f}")
    print(f"mAP50:     {metrics.box.map50:.4f}")
    print(f"mAP50-95:  {metrics.box.map:.4f}")
    print(f"Charts and confusion matrix saved to: {RUNS_DIR / name}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test/Validate the parking model")
    parser.add_argument("--model", default=str(MODEL_PATH), help="Path to .pt file (e.g. runs/train/<name>/weights/best.pt)")
    parser.add_argument("--data", required=True, help="Path to dataset YAML file")
    parser.add_argument("--split", default="val", choices=["train", "val", "test"], help="Dataset split to evaluate against")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (predict.py uses 0.5)")

    args = parser.parse_args()

    model_path = Path(args.model)
    if not Path(args.data).is_file():
        parser.error(f"Dataset YAML not found: {args.data}")
    if not model_path.is_file():
        parser.error(f"Model not found: {model_path}")

    test_model(model_path, args.data, args.split, args.imgsz, args.conf)
