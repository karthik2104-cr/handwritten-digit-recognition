"""Recompute test metrics from the saved model and compare them with the artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import CONFUSION_PATH, METADATA_PATH, METRICS_PATH, MODEL_PATH
from app.ml.dataset import load_experiment_split
from app.ml.scoring import score_model


def main() -> None:
    for path in (MODEL_PATH, METADATA_PATH, METRICS_PATH, CONFUSION_PATH):
        if not path.exists():
            print("Saved model artifacts are missing. Run python scripts/train.py first.", file=sys.stderr)
            sys.exit(1)

    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    saved_metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    saved_confusion = json.loads(CONFUSION_PATH.read_text(encoding="utf-8"))
    import joblib

    bundle = joblib.load(MODEL_PATH)
    _, _, x_test, y_test = load_experiment_split(
        int(metadata["random_seed"]),
        int(metadata["train_samples"]),
        int(metadata["test_samples"]),
    )
    scored = score_model(bundle["model"], x_test, y_test)
    print(f"Model: {bundle['model_name']}")
    print(f"Recomputed accuracy: {scored['accuracy']:.4f}")
    print(f"Saved accuracy:      {saved_metrics['accuracy']:.4f}")
    print(f"Recomputed weighted F1: {scored['f1']:.4f}")
    print(f"Test images: {scored['test_samples']}")

    saved_matrix = np.array(saved_confusion["matrix"], dtype=int)
    fresh_matrix = np.array(scored["confusion_matrix"], dtype=int)
    if saved_matrix.shape != (10, 10) or not np.array_equal(saved_matrix, fresh_matrix):
        print("Recomputed confusion matrix does not match the saved artifact.", file=sys.stderr)
        sys.exit(1)
    if abs(float(saved_metrics["accuracy"]) - scored["accuracy"]) > 1e-8:
        print("Recomputed accuracy does not match the saved metrics.", file=sys.stderr)
        sys.exit(1)
    print("Saved confusion matrix matches predictions from the loaded model.")


if __name__ == "__main__":
    main()
