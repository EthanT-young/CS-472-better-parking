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

### Web GUI

```bash
cd ml/
python gui.py          # then open http://127.0.0.1:8000
```

- **Predict**: type or browse to a folder in the sidebar, then click an image (or use the arrow keys) to run the model on it. Detections are drawn over the image. Change the model, confidence, and vehicle classes in the toolbar. *Save annotated* downloads the image with its boxes.
- **Train**: same options as `train.py`. Output streams into the log, and *Stop* cancels the run.
- **Test**: runs `test.py` against a dataset split and shows the mAP results in the log.

Use `--port` to change the port. On WSL, open the URL in your Windows browser as usual. Use `--host 0.0.0.0` only on a trusted network, because the GUI can browse folders on this machine.

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
| `--image` | One or more image files and/or folders of images (required) | - |
| `--model` | Path to model weights file | `models/parking_detector.pt` |
| `--classes` | COCO class IDs to detect (space-separated) | `2 3 5 7` (car, motorcycle, bus, truck) |
| `--conf` | Minimum detection confidence | `0.5` |
| `--batch` | Images per inference batch | `8` |
| `--visualize` | Save an annotated image with bounding boxes | False |
| `--output` | Where to save the visual output (used with `--visualize`): a file for one image, a folder for several | `output.jpg` / `output/` |

Pass all your images in one command rather than running the script once per image. The model loads once and the images run in batches, which is much faster than starting a new process for each image.

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

# Count vehicles in several images, or every image in a folder
python predict.py --image a.jpg b.jpg c.jpg
python predict.py --image path/to/garage_images/

# Annotate a whole folder, saving the results into annotated/
python predict.py --image path/to/garage_images/ --visualize --output annotated/


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

#### `predict_many(image_paths, min_confidence=0.5, batch=8)`

Run detection on multiple images at once instead of calling predict for multiple images in a loop. Each result is an ultralytics Results object.

```python
from predict import ParkingDetector, collect_images

# expands folders into image paths
images = collect_images(["garage_images/"])  
for result in detector.predict_many(images):
    print(f"{result.path}: {len(result.boxes)} vehicles")


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

**"Model file not found"** — Run `python updateModel.py` first to get the latest model.

**"ModuleNotFoundError: No module named 'ultralytics'"** — Your Conda environment is not activated. Run `conda activate <your_env_name>`.

**Low detection accuracy** — Try lowering `min_confidence` (e.g., 0.3) or check image quality/lighting.