from dataclasses import dataclass
from pathlib import Path
from ultralytics import YOLO
import cv2
# import numpy as np  # only the commented-out mask code below used NumPy

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "models" / "parking_detector.pt"
# Masks are turned off: spots are checked against the bounding boxes directly.
# # The command line saves a mask of every image here (ml/masks), wherever it's run from
# MASKS_DIR = Path(__file__).resolve().parent / "masks"


@dataclass(frozen=True)
class ParkingSpot:
    """A fixed spot number and (x, y) pixel coordinate in the original image."""

    spot_number: int
    coordinate: tuple[int, int]

    def is_occupied(self, detections, image_size):
        """Return whether the point is inside any detection's bounding box.

        image_size is the original image's (width, height); a point outside the image
        returns None (unknown). Box right/bottom edges are exclusive, so a point exactly
        on x2 or y2 is outside that box.
        """
        x, y = self.coordinate
        width, height = image_size
        if not (0 <= x < width and 0 <= y < height):
            return None
        return any(x1 <= x < x2 and y1 <= y < y2 for x1, y1, x2, y2 in (d["bbox"] for d in detections))


# Set these once for your camera view, using original-image pixels (x, y).
# Replace the commented example with your measured spot numbers and coordinates.
# Keep the camera position and image resolution the same when reusing this list.
# This needs to be changed when calling the model
PARKING_SPOTS: list[ParkingSpot] = [
    # ParkingSpot(spot_number=1, coordinate=(1000, 1900)),
    ParkingSpot(spot_number=1, coordinate=(675, 1284)),
    ParkingSpot(spot_number=2, coordinate=(1056, 1252)),
    ParkingSpot(spot_number=3, coordinate=(1458, 1264)),
    ParkingSpot(spot_number=4, coordinate=(1851, 1257)),
    ParkingSpot(spot_number=5, coordinate=(2212, 1264)),
    ParkingSpot(spot_number=6, coordinate=(2707, 1262))
]


# Masks are turned off: a box mask held the same information as the boxes themselves,
# so spots are now checked against the boxes directly (see ParkingSpot.is_occupied).
# def create_mask(image, detections):
#     """Return a uint8 mask: 255 inside vehicle boxes, 0 everywhere else.
#
#     A detection model supplies rectangles, not precise vehicle silhouettes.
#     Box right/bottom edges are exclusive, matching NumPy image slicing.
#     """
#     height, width = image.shape[:2]
#     mask = np.zeros((height, width), dtype=np.uint8)
#     for detection in detections:
#         x1, y1, x2, y2 = map(int, detection["bbox"])
#         x1, x2 = max(0, x1), min(width, x2)
#         y1, y2 = max(0, y1), min(height, y2)
#         if x1 < x2 and y1 < y2:
#             mask[y1:y2, x1:x2] = 255
#     return mask


def check_parking_spots(detections, image_size, spots=None):
    """Check fixed points against one image's detections; occupied is True, False, or None.

    image_size is the original image's (width, height).
    """
    spots = PARKING_SPOTS if spots is None else spots
    return [
        {
            "spot_number": spot.spot_number,
            "coordinate": spot.coordinate,
            "occupied": spot.is_occupied(detections, image_size),
        }
        for spot in spots
    ]


def collect_images(paths):
    """Expand a mix of image files and folders into a sorted list of image paths."""
    images = []
    for path in map(Path, paths):
        if path.is_dir():
            images += sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        elif path.is_file():
            images.append(path)
        else:
            raise FileNotFoundError(f"No such image or folder: {path}")
    return images


def to_detections(result):
    """Convert one ultralytics result into a list of detections in pixel coordinates.

    Each detection has bbox [x1, y1, x2, y2], bottom_center (x, y), confidence, class_id
    and class_name. bottom_center is the middle of the box's bottom edge, roughly where the
    vehicle meets the ground.
    """
    # Grabs all boxes from GPU now to the CPU, reducing sync time
    boxes = result.boxes.cpu()
    detections = []
    for (x1, y1, x2, y2), conf, cls in zip(boxes.xyxy.int().tolist(), boxes.conf.tolist(), boxes.cls.int().tolist()):
        detections.append({
            "bbox": [x1, y1, x2, y2],
            "bottom_center": ((x1 + x2) // 2, y2),
            "confidence": conf,
            "class_id": cls,
            "class_name": result.names.get(cls, str(cls))
        })
    return detections


# def mask_image(image, detections):
#     """Return a copy of image that keeps only the pixels inside the detection boxes; the rest is black.
#
#     image is a BGR NumPy array (e.g. from cv2.imread), and detections are the ones found in that
#     same image (from get_detections or to_detections).
#     """
#     return cv2.bitwise_and(image, image, mask=create_mask(image, detections))


class ParkingDetector:
    def __init__(self, model_path=DEFAULT_MODEL_PATH, vehicle_classes=None):
        self.model = YOLO(str(model_path))
        # The default COCO model with yolo has these types: Car=2, Motorcycle=3, Bus=5, Truck=7
        # If we want to sort by types of vehicles i added the option
        self.vehicle_classes = vehicle_classes if vehicle_classes else [2, 3, 5, 7]

    def _predict(self, source, min_confidence, classes=None, **kwargs):
        # classes overrides vehicle_classes for a single call
        classes = classes if classes else self.vehicle_classes
        return self.model(source, conf=min_confidence, classes=classes, verbose=False, **kwargs)

    def predict_many(self, image_paths, min_confidence=0.5, batch=8, on_error=None):
        # Model runs in batches, loads once and is focused on large image folders
        # If a corrupted image is detecthed, the batch is re-run with one image at a time.
        paths = [str(p) for p in image_paths]
        for i in range(0, len(paths), batch):
            chunk = paths[i:i + batch]
            errors = {}
            try:
                results = self._predict(chunk, min_confidence, batch=batch)
            except Exception:
                results = []
                for path in chunk:
                    try:
                        results += self._predict(path, min_confidence)
                    except Exception as error:
                        errors[path] = error

            # ultralytics drops most unreadable images with just a warning, so check for missing ones too
            returned = {Path(r.path).resolve() for r in results}
            for path in chunk:
                if path not in errors and Path(path).resolve() not in returned:
                    errors[path] = OSError("could not read image")

            for path, error in errors.items():
                if on_error is None:
                    raise error
                on_error(path, error)
            yield from results

    def count_vehicles(self, image_path, min_confidence=0.5):
        # Pass list of vehicle classes
        results = self._predict(image_path, min_confidence)
        return len(results[0].boxes)

    def get_detections(self, image_path, min_confidence=0.5, classes=None):
        return to_detections(self._predict(image_path, min_confidence, classes)[0])

    def get_bottom_centers(self, image_path, min_confidence=0.5, classes=None):
        # Middle (x, y) of each vehicle box's bottom edge in pixels, e.g. to check which spot it's in
        return [d["bottom_center"] for d in self.get_detections(image_path, min_confidence, classes)]

    # def get_mask(self, image_path, min_confidence=0.5, classes=None):
    #     """Run the model once and return an original-resolution binary mask."""
    #     result = self._predict(image_path, min_confidence, classes)[0]
    #     return create_mask(result.orig_img, to_detections(result))

    def get_spot_statuses(self, image_path, min_confidence=0.5, classes=None, spots=None):
        """Run the model once and check PARKING_SPOTS (or the supplied spots) against its boxes."""
        result = self._predict(image_path, min_confidence, classes)[0]
        height, width = result.orig_img.shape[:2]
        return check_parking_spots(to_detections(result), (width, height), spots)

    def visualize(self, image_path, output_path="output.jpg", min_confidence=0.5):
        results = self._predict(image_path, min_confidence)
        annotated = results[0].plot()
        cv2.imwrite(output_path, annotated)
        print(f"Saved annotated image to {output_path}")

if __name__ == "__main__":
    import argparse
    import sys
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, nargs="+", help="Image paths and/or folders of images")
    parser.add_argument("--model", default=str(DEFAULT_MODEL_PATH))

    # Modify whatever vehicle you want to detect on the fly!!!
    parser.add_argument(
        "--classes",
        type=int,
        nargs='+',
        default=[2, 3, 5, 7],
        help="Class IDs to detect. Default: 2 3 5 7"
    )
    parser.add_argument("--conf", type=float, default=0.5, help="Minimum confidence. Default: 0.5")
    parser.add_argument("--batch", type=int, default=8, help="Images per inference batch. Default: 8")

    # Add bounding boxes for reference/training annotation
    parser.add_argument("--visualize", action="store_true", help="Save an annotated image with bounding boxes")
    parser.add_argument("--output", help="Where to save the visual output: a file for one image "
                                         "(default output.jpg), a folder for several (default output/)")

    args = parser.parse_args()

    images = collect_images(args.image)
    if not images:
        parser.error("no images found")
    single = len(images) == 1 and Path(args.image[0]).is_file()

    if args.visualize:
        output = Path(args.output or ("output.jpg" if single else "output"))
        if not single:
            output.mkdir(parents=True, exist_ok=True)
    # MASKS_DIR.mkdir(parents=True, exist_ok=True)

    detector = ParkingDetector(args.model, vehicle_classes=args.classes)
    if not PARKING_SPOTS:
        print("No parking spots configured. Add spot numbers and coordinates to PARKING_SPOTS in predict.py.")

    # Unreadable images are reported and skipped so one bad file doesn't stop a long run
    skipped = []
    def skip(path, error):
        skipped.append(path)
        print(f"Skipping {path}: {error}", file=sys.stderr)

    total = 0
    for result in detector.predict_many(images, min_confidence=args.conf, batch=args.batch, on_error=skip):
        detections = to_detections(result)
        count = len(detections)
        total += count
        print(f"Vehicles detected: {count}" if single else f"{result.path}: {count}")
        # Middle (x, y) of each box's bottom edge, in pixels of the original image
        for d in detections:
            print(f"  {d['class_name']} {d['confidence']:.2f} bottom center {d['bottom_center']}")

        # A spot is occupied when its point is inside any detected vehicle's bounding box
        height, width = result.orig_img.shape[:2]
        statuses = check_parking_spots(detections, (width, height))
        for spot in statuses:
            state = ("unknown (coordinate outside image)" if spot["occupied"] is None
                     else "occupied" if spot["occupied"] else "empty")
            print(f"  Spot {spot['spot_number']} at {spot['coordinate']}: {state}")

        # # Save a lossless binary mask of the boxes
        # mask = create_mask(result.orig_img, detections)
        # image_path = Path(result.path)
        # mask_path = MASKS_DIR / (image_path.stem + "_mask.png")
        # if not cv2.imwrite(str(mask_path), mask):
        #     raise OSError(f"Could not save mask to {mask_path}")
        # if single:
        #     print(f"Saved mask to {mask_path}")

        if args.visualize:
            out_path = output if single else output / Path(result.path).name
            annotated = result.plot()
            for spot in statuses:
                if spot["occupied"] is None:
                    continue
                x, y = spot["coordinate"]
                color = (0, 0, 255) if spot["occupied"] else (0, 255, 0)
                state = "occupied" if spot["occupied"] else "empty"
                cv2.circle(annotated, (x, y), 8, color, -1)
                cv2.putText(annotated, f"Spot {spot['spot_number']}: {state}",
                            (x + 12, y - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            if not cv2.imwrite(str(out_path), annotated):
                raise OSError(f"Could not save annotated image to {out_path}")
            print(f"Saved annotated image to {out_path}")

    if not single:
        processed = len(images) - len(skipped)
        print(f"Total vehicles detected: {total} across {processed} images"
              + (f" ({len(skipped)} skipped)" if skipped else ""))
        # print(f"Saved {processed} masks to {MASKS_DIR}")
    if skipped:
        sys.exit(1)
