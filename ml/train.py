#!/usr/bin/env python3
import argparse
import torch
from ultralytics import YOLO

def get_best_device():
    if torch.cuda.is_available():
        # return gpu name (make sure youre not using integrated graphics)
        gpu_name = torch.cuda.get_device_name(0)
        print(f"GPU Detected: {gpu_name}")
        return "0"  # '0' should be your primary gpu unless you installed your gpu on a weird spot
    else:
        print("No GPU detected, falling back to CPU.")
        return "cpu"

def train_model(data, epochs, batch, imgsz, base):
    print(f"\n--- Starting Training ({epochs} epochs) ---")
    
    # Automatically determine the best hardware
    device = get_best_device()
    
    # Load the base model
    model = YOLO(base) 
    
    # Start training
    model.train(
        data=data,
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        plots=True,
        device=device
    )
    
    print("\nTraining Complete")
    print("Weights saved to: runs/detect/train/weights/best.pt")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the parking model")
    parser.add_argument("--data", default="data.yaml", help="Path to dataset YAML file")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--base", default="yolov8n.pt", help="Base model (e.g., yolov8m.pt, parking_detector.pt)")
        
    args = parser.parse_args()
    
    train_model(args.data, args.epochs, args.batch, args.imgsz, args.base)