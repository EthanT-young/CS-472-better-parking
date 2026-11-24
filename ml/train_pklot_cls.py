#!/usr/bin/env python3
"""
Train and compare parking-space classifiers on the PKLot crops from prepare_pklot.py.

Every model gets the same data split and the same test evaluation, so the results compare fairly.

    python train_pklot_cls.py --model yolo11m-cls.pt --epochs 10 --imgsz 128
    python train_pklot_cls.py --model resnet18 --epochs 10 --imgsz 128

Splits (by day, so one day never appears in two splits):
    train  about 90% of the PKLot training days
    val    about 10% of the PKLot training days, used to pick the best epoch
    test   the PKLot test days, used only for the final numbers

Results go to ml/runs/cls/<model>_<imgsz>/: the weights, and metrics.json with overall,
per-lot and per-weather scores.
"""

import argparse
import csv
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
SPOTS = ML_DIR / "datasets" / "pklot" / "spots"
CLS = ML_DIR / "datasets" / "pklot" / "cls"
RUNS = ML_DIR / "runs" / "cls"
LABELS = ["empty", "occupied"]  # index 0 and 1, the same order Ultralytics uses (alphabetical)


def load_manifest():
    with open(SPOTS / "manifest.csv", newline="") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        crop = Path(row["crop"])
        row["path"] = crop if crop.is_absolute() else ML_DIR / crop
    return rows


def select_rows(rows, train_subset=None, test_subset=None):
    """All rows for the usual mixed split, or only the two lots for a cross-lot run."""
    if train_subset is None:
        return rows
    return [r for r in rows
            if (r["split"] == "train" and r["subset"] == train_subset)
            or (r["split"] == "test" and r["subset"] == test_subset)]


def build_layout(rows, cls_dir=CLS, val_fraction=0.1, seed=0):
    """Make <cls_dir>/{train,val,test}/<label>/ with symlinks to the crops. Returns split_of."""
    train_days = sorted({r["day"] for r in rows if r["split"] == "train"})
    random.Random(seed).shuffle(train_days)
    val_days = set(train_days[: max(1, int(len(train_days) * val_fraction))])

    split_of = {}
    for row in rows:
        if row["split"] == "test":
            split = "test"
        elif row["day"] in val_days:
            split = "val"
        else:
            split = "train"
        split_of[row["crop"]] = split
        target_dir = cls_dir / split / row["label"]
        target_dir.mkdir(parents=True, exist_ok=True)
        link = target_dir / row["path"].name
        if not link.exists():
            link.symlink_to(row["path"])
    return split_of


def items_for(rows, split_of, split):
    return [(r, LABELS.index(r["label"])) for r in rows if split_of[r["crop"]] == split]


def score(rows, predictions):
    """predictions: list of predicted label indexes, in the same order as rows."""
    truth = [LABELS.index(r["label"]) for r in rows]
    tp = sum(1 for p, t in zip(predictions, truth) if p == 1 and t == 1)
    fp = sum(1 for p, t in zip(predictions, truth) if p == 1 and t == 0)
    fn = sum(1 for p, t in zip(predictions, truth) if p == 0 and t == 1)
    tn = sum(1 for p, t in zip(predictions, truth) if p == 0 and t == 0)
    total = tp + fp + fn + tn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "n": total,
        "accuracy": (tp + tn) / total if total else 0.0,
        "precision_occupied": precision,
        "recall_occupied": recall,
        "f1_occupied": f1,
        "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }


def breakdown(rows, predictions):
    """Scores overall, per lot and per weather, on the test rows."""
    result = {"overall": score(rows, predictions)}
    for key in ("subset", "weather"):
        groups = defaultdict(list)
        for i, r in enumerate(rows):
            groups[r[key]].append(i)
        result[f"by_{key}"] = {
            name: score([rows[i] for i in idx], [predictions[i] for i in idx])
            for name, idx in sorted(groups.items())
        }
    return result


def predict_ultralytics(weights, paths, imgsz):
    from ultralytics import YOLO

    model = YOLO(weights)
    names = model.names  # {index: label}
    preds = []
    for start in range(0, len(paths), 512):
        batch = [str(p) for p in paths[start:start + 512]]
        for result in model.predict(batch, imgsz=imgsz, verbose=False, device=0):
            preds.append(LABELS.index(names[int(result.probs.top1)]))
    return preds


def train_ultralytics(args, out, cls_dir):
    from ultralytics import YOLO

    model = YOLO(args.model)
    model.train(
        data=str(cls_dir), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        device=0, project=str(RUNS), name=out.name, exist_ok=True, plots=False, workers=4,
    )
    return Path(model.trainer.best)


def train_resnet(args, out, split_of, rows):
    import torch
    import torch.nn as nn
    from PIL import Image
    from torch.utils.data import DataLoader, Dataset
    from torchvision import models, transforms

    mean, std = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
    train_tf = transforms.Compose([
        transforms.Resize((args.imgsz, args.imgsz)),
        transforms.RandomAffine(degrees=0, translate=(0.05, 0.05), scale=(0.95, 1.05)),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        transforms.ToTensor(), transforms.Normalize(mean, std),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((args.imgsz, args.imgsz)),
        transforms.ToTensor(), transforms.Normalize(mean, std),
    ])

    class CropSet(Dataset):
        def __init__(self, items, tf):
            self.items, self.tf = items, tf

        def __len__(self):
            return len(self.items)

        def __getitem__(self, i):
            row, label = self.items[i]
            return self.tf(Image.open(row["path"]).convert("RGB")), label

    train_items = items_for(rows, split_of, "train")
    val_items = items_for(rows, split_of, "val")
    loader = DataLoader(CropSet(train_items, train_tf), batch_size=args.batch, shuffle=True,
                        num_workers=4, pin_memory=True, persistent_workers=True)
    val_loader = DataLoader(CropSet(val_items, eval_tf), batch_size=args.batch, num_workers=4)

    net = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    net.fc = nn.Linear(net.fc.in_features, 2)
    net = net.cuda()
    optimiser = torch.optim.AdamW(net.parameters(), lr=3e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=args.epochs)
    loss_fn = nn.CrossEntropyLoss()

    best_acc, best_path = -1.0, out / "best.pt"
    out.mkdir(parents=True, exist_ok=True)
    for epoch in range(args.epochs):
        net.train()
        for images, labels in loader:
            optimiser.zero_grad()
            loss = loss_fn(net(images.cuda(non_blocking=True)), labels.cuda(non_blocking=True))
            loss.backward()
            optimiser.step()
        scheduler.step()

        net.eval()
        correct = total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                preds = net(images.cuda()).argmax(1).cpu()
                correct += (preds == labels).sum().item()
                total += labels.numel()
        val_acc = correct / total
        print(f"resnet18 epoch {epoch + 1}/{args.epochs} val accuracy {val_acc:.4f}", flush=True)
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(net.state_dict(), best_path)
    return best_path


def predict_resnet(weights, paths, imgsz):
    import torch
    import torch.nn as nn
    from PIL import Image
    from torchvision import models, transforms

    net = models.resnet18()
    net.fc = nn.Linear(net.fc.in_features, 2)
    net.load_state_dict(torch.load(weights, map_location="cpu"))
    net = net.cuda().eval()
    tf = transforms.Compose([
        transforms.Resize((imgsz, imgsz)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    preds = []
    with torch.no_grad():
        for start in range(0, len(paths), 512):
            batch = torch.stack([tf(Image.open(p).convert("RGB")) for p in paths[start:start + 512]])
            preds.extend(net(batch.cuda()).argmax(1).cpu().tolist())
    return preds


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", required=True, help="yolo11m-cls.pt, yolo11l-cls.pt, or resnet18")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--imgsz", type=int, default=128)
    parser.add_argument("--batch", type=int, default=256)
    parser.add_argument("--train-subset", choices=["UFPR04", "UFPR05", "PUCPR"],
                        help="Cross-lot: train only on this lot's training days")
    parser.add_argument("--test-subset", choices=["UFPR04", "UFPR05", "PUCPR"],
                        help="Cross-lot: test only on this lot's test days (use with --train-subset)")
    args = parser.parse_args()
    if bool(args.train_subset) != bool(args.test_subset):
        parser.error("--train-subset and --test-subset must be used together")

    cross = args.train_subset is not None
    name = f"{Path(args.model).stem}_{args.imgsz}"
    if cross:
        name = f"{name}_train-{args.train_subset}_test-{args.test_subset}"
    cls_dir = CLS.parent / f"cls_{args.train_subset}_to_{args.test_subset}" if cross else CLS

    rows = select_rows(load_manifest(), args.train_subset, args.test_subset)
    split_of = build_layout(rows, cls_dir)
    out = RUNS / name
    print(f"Splits: {Counter(split_of.values())}", flush=True)

    if args.model == "resnet18":
        weights = train_resnet(args, out, split_of, rows)
        predict = predict_resnet
    else:
        weights = train_ultralytics(args, out, cls_dir)
        predict = predict_ultralytics

    test_rows = [r for r in rows if split_of[r["crop"]] == "test"]
    predictions = predict(weights, [r["path"] for r in test_rows], args.imgsz)
    metrics = breakdown(test_rows, predictions)
    metrics.update({"model": args.model, "imgsz": args.imgsz, "epochs": args.epochs, "weights": str(weights),
                    "train_subset": args.train_subset or "UFPR04+UFPR05", "test_subset": args.test_subset or "UFPR04+UFPR05"})
    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    overall = metrics["overall"]
    print(f"{args.model} test: accuracy {overall['accuracy']:.4f}, F1 {overall['f1_occupied']:.4f}, "
          f"n={overall['n']}", flush=True)


if __name__ == "__main__":
    main()
