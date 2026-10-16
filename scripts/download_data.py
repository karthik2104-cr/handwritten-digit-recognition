"""Download the official MNIST IDX files."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ml.dataset import load_mnist


def main() -> None:
    train_images, train_labels, test_images, test_labels = load_mnist()
    print(
        f"MNIST is ready: {len(train_labels):,} training images and {len(test_labels):,} test images, "
        f"{train_images.shape[1]} features, {test_images.shape[1]} test features."
    )


if __name__ == "__main__":
    main()
