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
- `POST /predict` takes the image as a multipart upload in an `image` field. Optional query parameters: `conf` (default `0.5`), `classes`, repeated for each class ID (default cars, motorcycles, buses and trucks), and `camera_id`. With `camera_id`, the response covers that camera's regions and spots (see below).

```bash
curl -F image=@snapshot.jpg "http://127.0.0.1:8001/predict?conf=0.5&classes=2&classes=7"
```

```json
{
  "count": 1, "width": 1280, "height": 720, "inference_ms": 8.3,
  "detections": [
    {"bbox": [412, 230, 804, 537], "center": [608, 383], "confidence": 0.91, "class_id": 2, "class_name": "car"}
  ]
}
```

`bbox` and `center` are pixel coordinates in the uploaded image. Unreadable images return `400`, and images over 20 MB return `413`.

### Cameras, regions, and spots

Each camera has a file at `ml/cameras/<camera_id>.json`. The GUI's Regions tab writes it, and you can also edit it by hand. It holds:

- `image_size`: the `[width, height]` the layout was drawn on. A snapshot of any other size is rejected with `400`.
- `rois`: optional regions. A vehicle counts only when the middle of its bottom edge is inside a region. With no regions, every vehicle counts.
- `spots`: one four-corner polygon per parking stall. Each spot has an `id`, which should match the stall's ID in the database.
- `occupied_overlap`: how much of a stall a vehicle has to cover before the stall counts as occupied. The default is `0.3`.

Corners are pixel coordinates in an image of exactly `image_size`. Every polygon must be convex and inside the frame, and spot IDs must be unique.

With a `camera_id`, the service returns the count and the spot status, and no detection list:

```bash
curl -F image=@snapshot.jpg "http://127.0.0.1:8001/predict?camera_id=tmc-lot"
```

```json
{
  "count": 6, "camera_id": "tmc-lot", "inference_ms": 219.2,
  "occupied": 6, "free": 2, "unknown": 0,
  "spots": [
    {"spot_id": 1, "occupied": true,  "overlap": 0.992},
    {"spot_id": 2, "occupied": false, "overlap": 0.265}
  ]
}
```

- `count` is the number of vehicles inside the camera's regions.
- A spot is occupied when a vehicle covers at least `occupied_overlap` of it.
- `occupied` is `null` for a spot outside every region. That spot is unknown, not free, so it isn't counted in `free`.
- `overlap` is the largest share of the spot covered by one vehicle. Use it to see how close a spot was to the threshold.

Regions and spots are drawn in the Regions tab. Use **Regions** or **Spots** to choose what a drag or click adds. A drag makes a rectangle, and four clicks make an angled shape.

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

- **Predict**: type or browse to a folder in the sidebar, then click an image (or use the arrow keys) to run the model on it. Detections are drawn over the image. Change the model, confidence, and vehicle classes in the toolbar. The confidence slider and class checkboxes filter the results instantly without rerunning the model, and results are remembered when you revisit an image. Click *Run* to force a fresh run. *Save annotated* downloads the image with its boxes.
- **Train**: same options as `train.py`. Output streams into the log, and *Stop* cancels the run.
- **Test**: runs `test.py` against a dataset split and shows the mAP results in the log.
- **Regions**: load a camera by ID, pick an image from the Predict tab, and draw its regions and spots. Save each one separately. The Predict tab has a *Camera* field, and when it's filled in, the result line shows the count and the spot status.

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

#### `get_detections(image_path, min_confidence=0.5, classes=None)`

Get detailed detection results for each vehicle.

```python
detections = detector.get_detections("garage.jpg")
for det in detections:
    print(f"BBox: {det['bbox']}, Confidence: {det['confidence']:.2f}")


```

`image_path` can also be an image already in memory (a NumPy array as returned by `cv2.imread`/`cv2.imdecode`).

Returns list of dicts with keys: `bbox`, `center`, `confidence`, `class_id`, `class_name`

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

## Spot classifier (PKLot)

For elevated camera views, we train a classifier that decides whether each parking space is occupied or empty. The training data is the PKLot dataset (UFPR04 and UFPR05). Two scripts do the work:

```bash
# Cut every space out of the full PKLot images into labelled crops
python prepare_pklot.py --src datasets/pklot/raw

# Train on the crops (one model at a time)
python train_pklot_cls.py --model yolo11l-cls.pt --epochs 10 --imgsz 128

# Train on one lot and test on the other
python train_pklot_cls.py --model yolo11l-cls.pt --train-subset UFPR04 --test-subset UFPR05
```

Crops are split by day, so the same day never appears in both training and testing. Each run writes `metrics.json` (accuracy, F1, and the confusion matrix, overall and per lot and weather) into `runs/cls/`.

Test accuracy at 128-pixel crops and 10 epochs:

| Model | Mixed split (both lots) | Trained on UFPR04, tested on UFPR05 | Trained on UFPR05, tested on UFPR04 |
|---|---|---|---|
| YOLO11l-cls | 99.90% | 99.44% | 98.64% |
| YOLO11m-cls | 99.91% | 99.31% | 94.68% |
| ResNet-18 | 99.87% | 98.46% | 86.28% |

The mixed split is the easiest case, since the test days come from lots the model has already seen. The cross-lot columns are a better guide to how a model will do on a new camera. YOLO11l-cls was the most accurate in both cross-lot directions, so it's the model to use for deployment. The model weights are git-ignored, so they're shared separately (for example, as a release asset).

### Dataset credit and terms

The PKLot dataset is by Paulo Almeida, Luiz S. Oliveira, Eunelson Silva Jr., Alceu Britto Jr., and Alessandro Koerich. The authors allow it to be used for any kind of research, provided the source is acknowledged by citing this paper:

> Almeida, P., Oliveira, L. S., Silva Jr, E., Britto Jr, A., Koerich, A., PKLot – A robust dataset for parking lot classification, Expert Systems with Applications, 42(11):4937-4949, 2015.

The dataset itself is obtained on request from the [UFPR parking-lot database page](http://web.inf.ufpr.br/vri/parking-lot-database). The terms above don't address commercial use, so check with the authors before using the crops or the trained models commercially.

## Troubleshooting

**"Model file not found"** — Run `python updateModel.py` first to get the latest model.

**"ModuleNotFoundError: No module named 'ultralytics'"** — Your Conda environment is not activated. Run `conda activate <your_env_name>`.

**Low detection accuracy** — Try lowering `min_confidence` (e.g., 0.3) or check image quality/lighting.