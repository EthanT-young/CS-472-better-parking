#!/usr/bin/env python3
"""
Turn the PKLot dataset (UFPR04 and UFPR05) into labelled parking-space crops.

Each PKLot image has an XML file with one rotated rectangle per parking space and an
occupied flag. This script cuts every space out of its image, scales it to a fixed square,
and saves it as occupied or empty. Images from the same day go to the same split (train or
test), as the PKLot protocol requires, so the same parked car never appears in both.

    python prepare_pklot.py --src datasets/pklot/raw --out datasets/pklot/spots

Output (git-ignored under ml/datasets/):
    <out>/train/{occupied,empty}/*.jpg
    <out>/test/{occupied,empty}/*.jpg
    <out>/manifest.csv   subset, weather, day, image, space, split, label, crop path
"""

import argparse
import csv
import random
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np

ML_DIR = Path(__file__).resolve().parent
SUBSETS = ("UFPR04", "UFPR05")
DATE_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2})")


def parse_spaces(xml_path):
    """Return [(space_id, occupied, corners)] from one PKLot XML file. corners is 4x2 float32."""
    spaces = []
    for space in ET.parse(xml_path).getroot().iter("space"):
        rect = space.find("rotatedRect")
        center = rect.find("center")
        size = rect.find("size")
        angle = rect.find("angle")
        box = cv2.boxPoints((
            (float(center.get("x")), float(center.get("y"))),
            (float(size.get("w")), float(size.get("h"))),
            float(angle.get("d")),
        ))
        spaces.append((space.get("id"), space.get("occupied") == "1", box.astype(np.float32)))
    return spaces


def crop_space(image, corners, size):
    """Warp one parking space to a size x size square."""
    target = np.array([[0, 0], [size, 0], [size, size], [0, size]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(order_corners(corners), target)
    return cv2.warpPerspective(image, matrix, (size, size))


def order_corners(corners):
    """Order four corners top-left, top-right, bottom-right, bottom-left so the warp is upright."""
    by_y = corners[np.argsort(corners[:, 1])]
    top = by_y[:2][np.argsort(by_y[:2, 0])]
    bottom = by_y[2:][np.argsort(by_y[2:, 0])[::-1]]
    return np.vstack([top, bottom]).astype(np.float32)


def day_of(image_path):
    """The day is in the file name (YYYY-MM-DD...), or the folder name if the file has none."""
    match = DATE_PATTERN.search(image_path.name)
    return match.group(1) if match else image_path.parent.name


def weather_of(image_path):
    for part in image_path.parts:
        if part.lower() in ("sunny", "cloudy", "overcast", "rainy"):
            return part.lower()
    return "unknown"


def collect_images(src):
    """Yield (subset, image_path, xml_path) for every image with a matching XML under the subsets."""
    for subset in SUBSETS:
        for xml_path in sorted(src.rglob("*.xml")):
            if subset not in xml_path.parts:
                continue
            for suffix in (".jpg", ".JPG", ".jpeg"):
                image_path = xml_path.with_suffix(suffix)
                if image_path.is_file():
                    yield subset, image_path, xml_path
                    break


def split_days(days, seed):
    """Put half of the days in train and half in test, so no day is in both."""
    days = sorted(days)
    random.Random(seed).shuffle(days)
    half = len(days) // 2
    return {d: "train" for d in days[:half]} | {d: "test" for d in days[half:]}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", required=True, help="Folder with the extracted PKLot UFPR04 and UFPR05 data")
    parser.add_argument("--out", default=str(ML_DIR / "datasets" / "pklot" / "spots"))
    parser.add_argument("--size", type=int, default=96, help="Crop size in pixels")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    src, out = Path(args.src), Path(args.out)
    items = list(collect_images(src))
    if not items:
        parser.error(f"No PKLot images with XML files found under {src}")

    days = {day_of(image) for _, image, _ in items}
    split_of = split_days(days, args.seed)

    rows = []
    for subset, image_path, xml_path in items:
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"Skipped unreadable image {image_path}")
            continue
        day = day_of(image_path)
        split = split_of[day]
        for space_id, occupied, corners in parse_spaces(xml_path):
            label = "occupied" if occupied else "empty"
            crop_dir = out / split / label
            crop_dir.mkdir(parents=True, exist_ok=True)
            name = f"{subset}_{image_path.stem}_{space_id}.jpg"
            crop_path = crop_dir / name
            cv2.imwrite(str(crop_path), crop_space(image, corners, args.size))
            rows.append({
                "subset": subset, "weather": weather_of(image_path), "day": day,
                "image": str(image_path), "space": space_id, "split": split,
                "label": label, "crop": str(crop_path),
            })

    out.mkdir(parents=True, exist_ok=True)
    with open(out / "manifest.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    counts = {}
    for row in rows:
        counts[(row["split"], row["label"])] = counts.get((row["split"], row["label"]), 0) + 1
    print(f"Wrote {len(rows)} space crops to {out}")
    for key in sorted(counts):
        print(f"  {key[0]} {key[1]}: {counts[key]}")


if __name__ == "__main__":
    main()
