import gzip
import struct
from pathlib import Path

import numpy as np
import pytest

from app.ml.dataset import read_idx_images, read_idx_labels, stratified_subset


def test_idx_images_and_labels_roundtrip(tmp_path: Path) -> None:
    images = np.arange(2 * 3 * 4, dtype=np.uint8).reshape(2, 3 * 4)
    image_path = tmp_path / "images.gz"
    with gzip.open(image_path, "wb") as handle:
        handle.write(struct.pack(">IIII", 2051, 2, 3, 4))
        handle.write(images.tobytes())

    labels = np.array([4, 9], dtype=np.uint8)
    label_path = tmp_path / "labels.gz"
    with gzip.open(label_path, "wb") as handle:
        handle.write(struct.pack(">II", 2049, 2))
        handle.write(labels.tobytes())

    loaded_images = read_idx_images(image_path)
    loaded_labels = read_idx_labels(label_path)
    assert loaded_images.shape == (2, 12)
    np.testing.assert_array_equal(loaded_images, images)
    np.testing.assert_array_equal(loaded_labels, labels)


def test_stratified_subset_keeps_every_class() -> None:
    labels = np.array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2])
    features = np.arange(len(labels) * 4, dtype=np.uint8).reshape(len(labels), 4)
    subset_x, subset_y = stratified_subset(features, labels, 6, seed=7)

    assert len(subset_y) == 6
    assert set(subset_y.tolist()) == {0, 1, 2}
    assert subset_x.shape == (6, 4)


def test_stratified_subset_rejects_impossible_sizes() -> None:
    labels = np.array([0, 1, 2, 3])
    features = np.zeros((4, 2))
    with pytest.raises(ValueError):
        stratified_subset(features, labels, 2, seed=1)
    with pytest.raises(ValueError):
        stratified_subset(features, labels, 8, seed=1)
