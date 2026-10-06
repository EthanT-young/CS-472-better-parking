from ultralytics import YOLO
import cv2

class ParkingDetector:
    def __init__(self, model_path="models/parking_detector.pt", vehicle_classes=None):
        self.model = YOLO(model_path)
        # The default COCO model with yolo has these types: Car=2, Motorcycle=3, Bus=5, Truck=7
        # If we want to sort by types of vehicles i added the option
        self.vehicle_classes = vehicle_classes if vehicle_classes else [2, 3, 5, 7]
        
    def count_vehicles(self, image_path, min_confidence=0.5):
        # Pass list of vehicle classes
        results = self.model(image_path, conf=min_confidence, classes=self.vehicle_classes, verbose=False)
        return len(results[0].boxes)
    
    def get_detections(self, image_path, min_confidence=0.5):
        results = self.model(image_path, conf=min_confidence, classes=self.vehicle_classes, verbose=False)
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
        results = self.model(image_path, conf=min_confidence, classes=self.vehicle_classes, verbose=False)
        annotated = results[0].plot()
        cv2.imwrite(output_path, annotated)
        print(f"Saved annotated image to {output_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to image")
    parser.add_argument("--model", default="models/parking_detector.pt")
    
    # Modify whatever vehicle you want to detect on the fly!!!
    parser.add_argument(
        "--classes", 
        type=int, 
        nargs='+', 
        default=[2, 3, 5, 7], 
        help="Class IDs to detect. Default: 2 3 5 7"
    )
    args = parser.parse_args()
    
    detector = ParkingDetector(args.model, vehicle_classes=args.classes)
    count = detector.count_vehicles(args.image)
    print(f"Vehicles detected: {count}")