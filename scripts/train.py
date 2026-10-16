"""Train the baseline and random-forest digit classifiers."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ml.training import TrainConfig, run_training


def main() -> None:
    parser = argparse.ArgumentParser(description="Train handwritten digit classifiers on MNIST.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--train-size", type=int, default=10_000)
    parser.add_argument("--test-size", type=int, default=2_000)
    parser.add_argument("--trees", type=int, default=80)
    parser.add_argument("--max-depth", type=int, default=22)
    parser.add_argument("--max-features", type=int, default=48)
    args = parser.parse_args()
    metrics = run_training(
        TrainConfig(
            seed=args.seed,
            train_size=args.train_size,
            test_size=args.test_size,
            n_estimators=args.trees,
            max_depth=args.max_depth,
            max_features=args.max_features,
        )
    )
    print(
        f"Selected {metrics['best_model']} with accuracy {metrics['accuracy']:.4f} "
        f"and weighted F1 {metrics['f1']:.4f}."
    )


if __name__ == "__main__":
    main()
