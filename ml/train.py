#!/usr/bin/env python3
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent
MODEL_PATH = ML_DIR / "models" / "parking_detector.pt"
RUNS_DIR = ML_DIR / "runs" / "train"

def get_best_device():
    if torch.cuda.is_available():
        # return gpu name (make sure youre not using integrated graphics)
        gpu_name = torch.cuda.get_device_name(0)
        print(f"GPU Detected: {gpu_name}")
        return "0"  # '0' should be your primary gpu unless you installed your gpu on a weird spot
    else:
        print("No GPU detected, falling back to CPU.")
        return "cpu"

def train_model(data, epochs, batch, imgsz, name):
    print(f"\n--- Starting Training ({epochs} epochs) from {MODEL_PATH.name} ---")

    device = get_best_device()

    # Using the most recent model
    model = YOLO(MODEL_PATH)

    # Trai
    model.train(
        data=data,
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        plots=True,
        device=device,
        project=str(RUNS_DIR),
        name=name,
        exist_ok=True,
    )

    # MAKE SURE YOU UPLOAD TO GITHUB RELEASES WHEN DONE
    best = Path(model.trainer.save_dir) / "weights" / "best.pt"
    print("\nTraining Complete")
    print(f"Best weights saved to: {best}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune the parking model")
    parser.add_argument("--data", required=True, help="Path to dataset YAML file")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--name", default="parking", help="Run name under runs/train/")

    args = parser.parse_args()

    if not Path(args.data).is_file():
        parser.error(f"Dataset YAML not found: {args.data}")
    if not MODEL_PATH.is_file():
        parser.error(f"Model not found: {MODEL_PATH}")

    train_model(args.data, args.epochs, args.batch, args.imgsz, args.name)
