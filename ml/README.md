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
python updateModel.py


```

## Quick Start

### Inference Service

The backend should call this service for each camera snapshot. The service loads the model once and keeps it in memory, so each snapshot takes milliseconds instead of the seconds needed to start Python and load the model.

```bash
cd ml/
python serve.py        # http://127.0.0.1:8001
python serve.py --host 0.0.0.0 --port 8001 --model models/parking_detector.pt   # reachable from other machines
```

- `GET /health` returns the loaded model, the device it runs on (`cuda:0`, `mps` or `cpu`) and the class names. Use it to check the service is up.
- `POST /predict` takes the image as a multipart upload in an `image` field. Optional query parameters: `conf` (default `0.5`) and `classes`, repeated for each class ID (default cars, motorcycles, buses and trucks).

```bash
curl -F image=@snapshot.jpg "http://127.0.0.1:8001/predict?conf=0.5&classes=2&classes=7"
```

```json
{
  "count": 1, "width": 1280, "height": 720, "inference_ms": 8.3,
  "detections": [
    {"bbox": [412, 230, 804, 537], "bottom_center": [608, 537], "confidence": 0.91, "class_id": 2, "class_name": "car"}
  ]
}
```

`bbox` and `bottom_center` are pixel coordinates in the uploaded image. `bottom_center` is the middle of the box's bottom edge, roughly where the vehicle meets the ground. Unreadable images return `400`, and images over 20 MB return `413`.

From the backend, send the snapshot bytes directly; there's no need to save them to a file first:

```python
import httpx

async with httpx.AsyncClient(base_url="http://127.0.0.1:8001") as client:
    response = await client.post("/predict", files={"image": ("snapshot.jpg", jpeg_bytes, "image/jpeg")})
    response.raise_for_status()
    result = response.json()   # result["count"], result["detections"]
```

Requests are handled one at a time, since the model can't run several at once. The first request after startup is a little slower than the rest.

### Web GUI (internal testing and training)

```bash
cd ml/
python gui.py          # then open http://127.0.0.1:8000
```

- **Predict**: type or browse to a folder in the sidebar, then click an image (or use the arrow keys) to run the model on it. Detections are drawn over the image, with a dot at the middle of each box's bottom edge labeled with its pixel coordinates in the original image. *Boxes* and *Bottom centers* show or hide each. Change the model, confidence, and vehicle classes in the toolbar. The confidence slider and class checkboxes filter the results instantly without rerunning the model, and results are remembered when you revisit an image. Click *Run* to force a fresh run. *Save annotated* downloads the image with its boxes.
- **Parking spots**: a spot is occupied when its point is inside one of the detected vehicle boxes shown on screen. Spot statuses follow the selected confidence and classes, using the same `check_parking_spots()` function as `predict.py` without running YOLO again. *Spot points* shows or hides the points.
- **Choose coordinates**: the GUI loads `PARKING_SPOTS` from `predict.py`. Set a spot number and enable point placement, then click the image to add or move that spot. Points use the original image's `(x, y)` coordinates, even when the image is scaled to fit the screen. The spot list shows occupied, empty, or unknown (outside the image); points await detection results before receiving a status. These edits are temporary. Copy the displayed `PARKING_SPOTS` snippet into `predict.py` when you have chosen your fixed coordinates, then restart the GUI to load them. Reuse coordinates only with the same camera view and resolution.
- **Train**: same options as `train.py`, which fine-tunes `models/parking_detector.pt` and saves weights to `runs/train/<run name>/weights/best.pt`. Output streams into the log, and *Stop* cancels the run.
- **Test**: runs `test.py` against a dataset split and shows the mAP results in the log. Pick trained weights from the *Model weights* suggestions after a training run.

Use `--port` to change the port. On WSL, open the URL in your Windows browser as usual. Use `--host 0.0.0.0` only on a trusted network, because the GUI can browse folders on this machine.

### Command Line

```bash
cd ml/
python predict.py --image path/to/garage_image.jpg


```

Prints the vehicle count, then each vehicle's class, confidence, and the bottom center `(x, y)` of its bounding box in pixels (the middle of the box's bottom edge, roughly where the vehicle meets the ground):

```
Vehicles detected: 2
  car 0.91 bottom center (608, 537)
  truck 0.78 bottom center (1520, 1180)
```

### Fixed parking spot coordinates

Edit `PARKING_SPOTS` near the top of `predict.py` to set your measured spot numbers and coordinates. The list starts empty; the values below only demonstrate the format:

```python
PARKING_SPOTS: list[ParkingSpot] = [
    ParkingSpot(spot_number=1, coordinate=(1000, 1900)),
    ParkingSpot(spot_number=2, coordinate=(1800, 1900)),
]
```

Coordinates are `(x, y)` pixels in the original image, measured from its top-left corner. Reuse them only for the same camera view and resolution. A spot is occupied when its point is inside any detected vehicle's bounding box (`x1 <= x < x2` and `y1 <= y < y2`), empty when it isn't, and unknown when the coordinate is outside the image. Missed detections or a neighboring vehicle's box can affect occupancy. The detections follow `--conf` and `--classes`, so `--classes 2` only counts cars.

The command line prints each configured spot's status. Add `--visualize` to draw the spot points and numbers over the detection image (red for occupied, green for empty).

```python
import cv2
from predict import ParkingDetector, ParkingSpot, check_parking_spots

detector = ParkingDetector()  # defaults to models/parking_detector.pt beside predict.py
detections = detector.get_detections("garage.jpg")
height, width = cv2.imread("garage.jpg").shape[:2]
image_size = (width, height)  # so points outside the image come back as None
spot = ParkingSpot(spot_number=1, coordinate=(1000, 1900))
print(spot.is_occupied(detections, image_size))  # True, False, or None for an out-of-image point
print(check_parking_spots(detections, image_size))  # checks PARKING_SPOTS without rerunning YOLO

# Alternatively, run inference and check all configured spots in one call:
statuses = detector.get_spot_statuses("garage.jpg")
# [{"spot_number": 1, "coordinate": (1000, 1900), "occupied": True}, ...]
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
# Count all vehicles and print their bottom centers
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

#### `get_detections(image_path, min_confidence=0.5, classes=None)`

Get detailed detection results for each vehicle.

```python
detections = detector.get_detections("garage.jpg")
for det in detections:
    print(f"BBox: {det['bbox']}, Bottom center: {det['bottom_center']}, Confidence: {det['confidence']:.2f}")


```

`image_path` can also be an image already in memory (a NumPy array as returned by `cv2.imread`/`cv2.imdecode`).

Returns list of dicts with keys: `bbox` (`[x1, y1, x2, y2]`), `bottom_center` (`(x, y)`, the middle of the bottom edge of `bbox`: `((x1 + x2) // 2, y2)`), `confidence`, `class_id`, `class_name`. All coordinates are pixels in the original image.

#### `get_bottom_centers(image_path, min_confidence=0.5, classes=None)`

Get just the bottom center `(x, y)` of each vehicle's bounding box, in pixels. This is roughly where the vehicle meets the ground, which is useful for checking which parking spot each vehicle is in.

```python
points = detector.get_bottom_centers("garage.jpg")
print(points)  # e.g., [(608, 537), (1520, 1180)]


```

#### `visualize(image_path, output_path="output.jpg", min_confidence=0.5)`

Run detection and save annotated image with bounding boxes.

```python
detector.visualize("garage.jpg", "annotated_output.jpg")


```

#### `predict_many(image_paths, min_confidence=0.5, batch=8, on_error=None)`

Run detection on multiple images at once instead of calling predict for multiple images in a loop. Each result is an ultralytics Results object.

```python
from predict import ParkingDetector, collect_images

# expands folders into image paths
images = collect_images(["garage_images/"])  
for result in detector.predict_many(images):
    print(f"{result.path}: {len(result.boxes)} vehicles")


```

To get the same detection dicts as `get_detections` (with `bottom_center`), pass each result to `to_detections`:

```python
from predict import to_detections

for result in detector.predict_many(images):
    points = [det["bottom_center"] for det in to_detections(result)]


```

Unreadable or corrupted images raise an error by default. Pass `on_error` to skip them and keep going instead:

```python
def skip(path, error):
    print(f"Skipping {path}: {error}")

for result in detector.predict_many(images, on_error=skip):
    ...


```

The command line skips unreadable images automatically, lists them, and exits with code 1 if any were skipped.

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

Create the detector once and reuse it. Loading the model is the slow part, so creating a new `ParkingDetector` for every image reloads it each time.

```python
detector = ParkingDetector("models/parking_detector.pt")  # load once

def get_parking_status(detector, image_path, total_spots):
    occupied = detector.count_vehicles(image_path)
    available = max(0, total_spots - occupied)
    
    return {
        "total": total_spots,
        "occupied": occupied,
        "available": available,
        "occupancy_rate": (occupied / total_spots) * 100
    }

for section, spots in [("section_a.jpg", 20), ("section_b.jpg", 35)]:
    status = get_parking_status(detector, section, spots)
    print(f"{section}: {status['available']} of {status['total']} spots available")


```

## Troubleshooting

**"Model file not found"** — Run `python updateModel.py` first to get the latest model.

**"ModuleNotFoundError: No module named 'ultralytics'"** — Your Conda environment is not activated. Run `conda activate <your_env_name>`.

**Low detection accuracy** — Try lowering `min_confidence` (e.g., 0.3) or check image quality/lighting.
