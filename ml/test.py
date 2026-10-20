#!/usr/bin/env python3
import argparse
import torch
from ultralytics import YOLO

def get_best_device():
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"GPU Detected: {gpu_name}")
        return "0"
    else:
        print("No GPU detected, falling back to CPU.")
        return "cpu"

def test_model(model_path, data, split):
    print(f"\n--- Testing Model: {model_path} ---")
    
    # Automatically determine the best hardware
    device = get_best_device()
    
    # Load the trained model
    model = YOLO(model_path)
    
    # Run validation
    metrics = model.val(data=data, split=split, device=device)
    
    print("\nTesting Complete")
    print(f"mAP50:     {metrics.box.map50:.4f}")
    print(f"mAP50-95:  {metrics.box.map:.4f}")
    print("Check the 'runs/detect/val/' folder for detailed charts and confusion matrices.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test/Validate the YOLO parking model")
    parser.add_argument("--model", default="runs/detect/train/weights/best.pt", help="Path to trained .pt file")
    parser.add_argument("--data", default="data.yaml", help="Path to dataset YAML file")
    parser.add_argument("--split", default="val", choices=["val", "test"], help="Dataset split to evaluate against")
    
    args = parser.parse_args()
    
    test_model(args.model, args.data, args.split)