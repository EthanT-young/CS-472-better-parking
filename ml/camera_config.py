"""
Per-camera configuration: parking spots and regions of interest (ROIs).

Each camera has a JSON file in ml/cameras/<camera_id>.json:

    {
      "image_size": [width, height],
      "occupied_overlap": 0.3,
      "spots": [
        {"id": 1, "corners": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]},
        ...
      ],
      "rois": [
        {"name": "left lane", "corners": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]},
        ...
      ]
    }

Corners are pixel coordinates in a frame of exactly image_size. Spots and ROIs are convex
four-corner polygons inside the frame. Spot ids must be unique.

ROIs limit which vehicles count. A vehicle is inside an ROI when the bottom-centre of its box
(where its wheels meet the ground) falls inside the ROI. With no ROIs, every vehicle counts.
Spot occupancy only uses vehicles inside an ROI. A spot is occupied when such a vehicle box
covers at least occupied_overlap (0 < value <= 1) of the spot's area.
"""

import json
import os
import re
from pathlib import Path

import cv2
import numpy as np

ML_DIR = Path(__file__).resolve().parent
CAMERA_DIR = ML_DIR / "cameras"
DEFAULT_OVERLAP = 0.3
CAMERA_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]+")


class CameraConfigError(Exception):
    """The server's own camera config is broken. This is a server error, not a bad request."""


def _check_camera_id(camera_id):
    if not CAMERA_ID_PATTERN.fullmatch(camera_id):
        raise ValueError(f"Invalid camera id: {camera_id!r}")


def _polygon(corners, label, width, height):
    polygon = np.array(corners, dtype=np.float32)
    if polygon.shape != (4, 2):
        raise ValueError(f"{label} must have 4 corners")
    if not np.all(np.isfinite(polygon)):
        raise ValueError(f"{label} has non-finite coordinates")
    if np.any(polygon[:, 0] < 0) or np.any(polygon[:, 0] > width) or \
       np.any(polygon[:, 1] < 0) or np.any(polygon[:, 1] > height):
        raise ValueError(f"{label} extends outside the {width}x{height} frame")
    if not cv2.isContourConvex(polygon.reshape(-1, 1, 2)):
        raise ValueError(f"{label} is not a convex polygon")
    return polygon


def _parse(camera_id, config):
    width, height = (int(v) for v in config["image_size"])
    if width <= 0 or height <= 0:
        raise ValueError("image_size must be positive")
    overlap = float(config.get("occupied_overlap", DEFAULT_OVERLAP))
    if not 0 < overlap <= 1:
        raise ValueError("occupied_overlap must be greater than 0 and at most 1")

    spots = []
    seen_ids = set()
    for entry in config.get("spots", []):
        spot_id = int(entry["id"])
        if spot_id in seen_ids:
            raise ValueError(f"Duplicate spot id {spot_id}")
        seen_ids.add(spot_id)
        polygon = _polygon(entry["corners"], f"Spot {spot_id}", width, height)
        spots.append({"spot_id": spot_id, "polygon": polygon})

    rois = []
    for index, entry in enumerate(config.get("rois", []), start=1):
        name = str(entry.get("name") or f"roi-{index}")
        polygon = _polygon(entry["corners"], f"ROI {name!r}", width, height)
        rois.append({"name": name, "polygon": polygon})

    return {
        "camera_id": camera_id,
        "image_size": (width, height),
        "occupied_overlap": overlap,
        "spots": spots,
        "rois": rois,
    }


def read_raw(camera_id):
    """Return the camera's config as stored in its JSON file, or None if it has no file yet."""
    _check_camera_id(camera_id)
    path = CAMERA_DIR / f"{camera_id}.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CameraConfigError(f"Config for camera {camera_id!r} is invalid: {error}") from error


def load_camera(camera_id):
    """
    Load and validate a camera's config.

    Raises ValueError for an invalid camera id, FileNotFoundError for an unknown camera,
    and CameraConfigError if the config file itself is malformed.
    """
    _check_camera_id(camera_id)
    raw = read_raw(camera_id)
    if raw is None:
        raise FileNotFoundError(f"No config for camera {camera_id!r}")
    try:
        return _parse(camera_id, raw)
    except (KeyError, TypeError, ValueError) as error:
        raise CameraConfigError(f"Config for camera {camera_id!r} is invalid: {error}") from error


def save_rois(camera_id, image_size, rois):
    """
    Replace a camera's ROIs and keep its spots. Creates the file if the camera is new.

    rois is a list of {"name": str, "corners": [[x, y] x 4]}. Raises ValueError for bad input
    (including an image_size that differs from the camera's existing config).
    """
    _check_camera_id(camera_id)
    existing = read_raw(camera_id) or {}
    if existing and [int(v) for v in existing["image_size"]] != [int(v) for v in image_size]:
        raise ValueError(
            f"Camera {camera_id!r} is configured for {existing['image_size'][0]}x{existing['image_size'][1]}, "
            f"not {image_size[0]}x{image_size[1]}"
        )
    config = {
        "image_size": [int(v) for v in image_size],
        "occupied_overlap": existing.get("occupied_overlap", DEFAULT_OVERLAP),
        "spots": existing.get("spots", []),
        "rois": rois,
    }
    camera = _parse(camera_id, config)  # validate before anything is written

    CAMERA_DIR.mkdir(exist_ok=True)
    path = CAMERA_DIR / f"{camera_id}.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n")
    os.replace(tmp, path)
    return camera


def check_image_size(camera, width, height):
    """Raise ValueError if a frame's size doesn't match the size the camera's spots were drawn at."""
    if (width, height) != camera["image_size"]:
        raise ValueError(
            f"Image is {width}x{height} but camera {camera['camera_id']} is configured for "
            f"{camera['image_size'][0]}x{camera['image_size'][1]}"
        )


def vehicles_in_rois(camera, detections):
    """Keep only detections whose bottom-centre is inside an ROI. With no ROIs, keep everything."""
    if not camera["rois"]:
        return detections
    kept = []
    for d in detections:
        x1, _, x2, y2 = d["bbox"]
        point = (float((x1 + x2) / 2), float(y2))
        if any(cv2.pointPolygonTest(roi["polygon"].reshape(-1, 1, 2), point, False) >= 0
               for roi in camera["rois"]):
            kept.append(d)
    return kept


def spot_status(camera, detections):
    """Return one status dict per spot: occupied (bool) and the largest overlap with any vehicle."""
    boxes = [
        np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
        for x1, y1, x2, y2 in (d["bbox"] for d in detections)
    ]
    statuses = []
    for spot in camera["spots"]:
        polygon = spot["polygon"]
        spot_area = cv2.contourArea(polygon)
        best = 0.0
        for box in boxes:
            overlap_area, _ = cv2.intersectConvexConvex(polygon, box)
            if spot_area > 0:
                best = max(best, overlap_area / spot_area)
        statuses.append({
            "spot_id": spot["spot_id"],
            "occupied": best >= camera["occupied_overlap"],
            "overlap": round(best, 3),
        })
    return statuses
