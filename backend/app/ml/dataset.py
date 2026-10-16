"""Download the MNIST IDX files and build a leakage-free experiment split."""

from __future__ import annotations

import gzip
import shutil
import struct
import urllib.request
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split

from app.config import DATA_DIR
from app.ml.preprocess import normalize_pixels

MNIST_FILES = (
    "train-images-idx3-ubyte.gz",
    "train-labels-idx1-ubyte.gz",
    "t10k-images-idx3-ubyte.gz",
    "t10k-labels-idx1-ubyte.gz",
)
MIRRORS = (
    "https://ossci-datasets.s3.amazonaws.com/mnist/",
    "https://storage.googleapis.com/cvdf-datasets/mnist/",
)
IMAGE_MAGIC = 2051
LABEL_MAGIC = 2049


def load_mnist() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return official train images, train labels, test images, and test labels."""

    train_images = read_idx_images(ensure_file("train-images-idx3-ubyte.gz"))
    train_labels = read_idx_labels(ensure_file("train-labels-idx1-ubyte.gz"))
    test_images = read_idx_images(ensure_file("t10k-images-idx3-ubyte.gz"))
    test_labels = read_idx_labels(ensure_file("t10k-labels-idx1-ubyte.gz"))
    if len(train_images) != len(train_labels) or len(test_images) != len(test_labels):
        raise RuntimeError("MNIST image and label counts do not match.")
    if len(train_labels) != 60_000 or len(test_labels) != 10_000:
        raise RuntimeError(
            "The downloaded MNIST files do not contain the official 60,000 training and 10,000 test images."
        )
    return train_images, train_labels, test_images, test_labels


def load_experiment_split(
    seed: int,
    train_size: int,
    test_size: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Sample train and test rows from the official MNIST split.

    Training rows are drawn only from the official training set. Test rows are
    drawn only from the official test set. Stratification keeps every digit.
    """

    x_train, y_train, x_test, y_test = load_mnist()
    x_train, y_train = stratified_subset(x_train, y_train, train_size, seed)
    x_test, y_test = stratified_subset(x_test, y_test, test_size, seed)
    if len(np.unique(y_train)) != 10 or len(np.unique(y_test)) != 10:
        raise RuntimeError("The stratified sample is missing one or more digits.")
    return normalize_pixels(x_train), y_train, normalize_pixels(x_test), y_test


def stratified_subset(
    features: np.ndarray,
    labels: np.ndarray,
    size: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    if size <= 0:
        raise ValueError("Sample size must be positive.")
    classes = np.unique(labels)
    if size < len(classes):
        raise ValueError(
            f"Sample size {size} is smaller than the number of digit classes ({len(classes)})."
        )
    if size > len(labels):
        raise ValueError(
            f"Requested {size} samples, but only {len(labels)} are available in this split."
        )
    if size == len(labels):
        return features, labels
    subset_x, _, subset_y, _ = train_test_split(
        features,
        labels,
        train_size=size,
        stratify=labels,
        random_state=seed,
    )
    return subset_x, subset_y


def ensure_file(filename: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    destination = DATA_DIR / filename
    if destination.exists():
        try:
            _validate(destination, filename)
            return destination
        except Exception:
            destination.unlink(missing_ok=True)

    failures: list[str] = []
    for mirror in MIRRORS:
        url = f"{mirror}{filename}"
        try:
            _download(url, destination)
            _validate(destination, filename)
            return destination
        except Exception as exc:
            failures.append(f"{url} ({exc.__class__.__name__}: {exc})")
            if destination.exists():
                destination.unlink(missing_ok=True)
    detail = " ".join(failures)
    raise RuntimeError(f"Could not download MNIST file {filename}. {detail}")


def read_idx_images(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as handle:
        header = handle.read(16)
        if len(header) != 16:
            raise ValueError(f"{path.name} does not contain an IDX image header.")
        magic, count, rows, cols = struct.unpack(">IIII", header)
        if magic != IMAGE_MAGIC:
            raise ValueError(f"{path.name} has an unexpected image magic number.")
        payload = handle.read()
    expected = count * rows * cols
    if len(payload) != expected:
        raise ValueError(f"{path.name} is incomplete.")
    return np.frombuffer(payload, dtype=np.uint8).reshape(count, rows * cols).copy()


def read_idx_labels(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as handle:
        header = handle.read(8)
        if len(header) != 8:
            raise ValueError(f"{path.name} does not contain an IDX label header.")
        magic, count = struct.unpack(">II", header)
        if magic != LABEL_MAGIC:
            raise ValueError(f"{path.name} has an unexpected label magic number.")
        payload = handle.read()
    if len(payload) != count:
        raise ValueError(f"{path.name} is incomplete.")
    return np.frombuffer(payload, dtype=np.uint8).astype(np.int64)


def _validate(path: Path, filename: str) -> None:
    with gzip.open(path, "rb") as handle:
        if "images" in filename:
            header = handle.read(16)
            if len(header) != 16:
                raise ValueError(f"{filename} does not contain an IDX image header.")
            magic, count, rows, cols = struct.unpack(">IIII", header)
            if magic != IMAGE_MAGIC or count <= 0 or rows != 28 or cols != 28:
                raise ValueError(f"{filename} is not a 28×28 MNIST image file.")
            return
        header = handle.read(8)
        if len(header) != 8:
            raise ValueError(f"{filename} does not contain an IDX label header.")
        magic, count = struct.unpack(">II", header)
        if magic != LABEL_MAGIC or count <= 0:
            raise ValueError(f"{filename} is not an MNIST label file.")


def _download(url: str, destination: Path) -> None:
    print(f"Downloading {url}", flush=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "handwritten-digit-recognition/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as handle:
            shutil.copyfileobj(response, handle)
        temporary.replace(destination)
    except Exception:
        if temporary.exists():
            temporary.unlink()
        raise
