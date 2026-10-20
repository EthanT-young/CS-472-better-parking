# Parking Detection Inference Guide

This guide explains how to use the `ParkingDetector` class for vehicle detection in parking garage images.

## Setup

Before running the inference script, ensure your Conda environment is activated and dependencies are installed:

```bash
# Activate your project's conda environment
conda activate <your_env_name>

# Install required ML libraries (only needed once)
pip install -r requirements.txt

# Ensure you have the latest model weights
python update.py


```

## Quick Start

### Command Line

```bash
cd ml/
python predict.py --image path/to/garage_image.jpg


```

### Python Code

```python
from predict import ParkingDetector

detector = ParkingDetector("models/parking_detector.pt")
count = detector.count_vehicles("garage_image.jpg")
print(f"Vehicles detected: {count}")


```

## Command-Line Options

| Option | Description | Default |
| --- | --- | --- |
| `--image` | Path to image file (required) | - |
| `--model` | Path to model weights file | `models/parking_detector.pt` |
| `--classes` | COCO class IDs to detect (space-separated) | `2 3 5 7` (car, motorcycle, bus, truck) |
| `--visualize` | Save an annotated image with bounding boxes | False |
| `--output` | Where to save the visual output (used with `--visualize`) | `output.jpg` |

### Examples

```bash
# Count all vehicles
python predict.py --image garage.jpg

# Detect only cars
python predict.py --image garage.jpg --classes 2

# Detect cars and motorcycles
python predict.py --image garage.jpg --classes 2 3

# Visualize detections and save to output.jpg
python predict.py --image garage.jpg --visualize

# Visualize and save to a custom file
python predict.py --image garage.jpg --visualize --output my_results.jpg


```

## Python API Reference

### ParkingDetector Class

```python
detector = ParkingDetector(
    model_path="models/parking_detector.pt",  # Path to .pt weights file
    vehicle_classes=[2, 3, 5, 7]              # COCO class IDs to detect
)


```

### Methods

#### `count_vehicles(image_path, min_confidence=0.5)`

Count total vehicles in an image.

```python
count = detector.count_vehicles("garage.jpg")
print(f"Vehicles: {count}")  # e.g., "Vehicles: 7"


```

#### `get_detections(image_path, min_confidence=0.5)`

Get detailed detection results for each vehicle.

```python
detections = detector.get_detections("garage.jpg")
for det in detections:
    print(f"BBox: {det['bbox']}, Confidence: {det['confidence']:.2f}")


```

Returns list of dicts with keys: `bbox`, `center`, `confidence`, `class_id`

#### `visualize(image_path, output_path="output.jpg", min_confidence=0.5)`

Run detection and save annotated image with bounding boxes.

```python
detector.visualize("garage.jpg", "annotated_output.jpg")


```

## Vehicle Classes (COCO IDs)

| Class ID | Vehicle Type |
| --- | --- |
| 2 | Car |
| 3 | Motorcycle |
| 5 | Bus |
| 7 | Truck |

To detect only specific types, pass custom classes:

```python
# Cars only
detector = ParkingDetector("models/parking_detector.pt", vehicle_classes=[2])

# Cars and motorcycles
detector = ParkingDetector("models/parking_detector.pt", vehicle_classes=[2, 3])


```

## Calculating Parking Availability

```python
def get_parking_status(image_path, total_spots):
    detector = ParkingDetector()
    occupied = detector.count_vehicles(image_path)
    available = max(0, total_spots - occupied)
    
    return {
        "total": total_spots,
        "occupied": occupied,
        "available": available,
        "occupancy_rate": (occupied / total_spots) * 100
    }

status = get_parking_status("section_a.jpg", 20)
print(f"{status['available']} of {status['total']} spots available")


```

## Troubleshooting

**"Model file not found"** — Run `python update.py` first to get the latest model.

**"ModuleNotFoundError: No module named 'ultralytics'"** — Your Conda environment is not activated. Run `conda activate <your_env_name>`.

**Low detection accuracy** — Try lowering `min_confidence` (e.g., 0.3) or check image quality/lighting.