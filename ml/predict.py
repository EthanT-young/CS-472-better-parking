from pathlib import Path
from ultralytics import YOLO
import cv2

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


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


class ParkingDetector:
    def __init__(self, model_path="models/parking_detector.pt", vehicle_classes=None):
        self.model = YOLO(model_path)
        # The default COCO model with yolo has these types: Car=2, Motorcycle=3, Bus=5, Truck=7
        # If we want to sort by types of vehicles i added the option
        self.vehicle_classes = vehicle_classes if vehicle_classes else [2, 3, 5, 7]

    def _predict(self, source, min_confidence, **kwargs):
        return self.model(source, conf=min_confidence, classes=self.vehicle_classes, verbose=False, **kwargs)

    def predict_many(self, image_paths, min_confidence=0.5, batch=8):
        # Runs the images through the model in batches and yields results one at a time,
        # so the model is loaded once and memory stays flat for large folders
        return self._predict([str(p) for p in image_paths], min_confidence, stream=True, batch=batch)

    def count_vehicles(self, image_path, min_confidence=0.5):
        # Pass list of vehicle classes
        results = self._predict(image_path, min_confidence)
        return len(results[0].boxes)

    def get_detections(self, image_path, min_confidence=0.5):
        results = self._predict(image_path, min_confidence)
        detections = []

        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0][:4])
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "center": ((x1 + x2) // 2, (y1 + y2) // 2),
                "confidence": float(box.conf[0]),
                "class_id": int(box.cls[0])
            })

        return detections

    def visualize(self, image_path, output_path="output.jpg", min_confidence=0.5):
        results = self._predict(image_path, min_confidence)
        annotated = results[0].plot()
        cv2.imwrite(output_path, annotated)
        print(f"Saved annotated image to {output_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, nargs="+", help="Image paths and/or folders of images")
    parser.add_argument("--model", default="models/parking_detector.pt")

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

    detector = ParkingDetector(args.model, vehicle_classes=args.classes)

    total = 0
    for result in detector.predict_many(images, min_confidence=args.conf, batch=args.batch):
        count = len(result.boxes)
        total += count
        print(f"Vehicles detected: {count}" if single else f"{result.path}: {count}")

        if args.visualize:
            out_path = output if single else output / Path(result.path).name
            cv2.imwrite(str(out_path), result.plot())
            print(f"Saved annotated image to {out_path}")

    if not single:
        print(f"Total vehicles detected: {total} across {len(images)} images")
