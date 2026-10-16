"""Filesystem locations and runtime limits."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = Path(os.environ.get("REPO_DIR", BACKEND_DIR.parent)).resolve()
DATA_DIR = Path(os.environ.get("MNIST_DATA_DIR", REPO_DIR / "data" / "mnist")).resolve()
MODELS_DIR = Path(os.environ.get("MODELS_DIR", BACKEND_DIR / "models")).resolve()
ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", BACKEND_DIR / "artifacts")).resolve()
REPORTS_DIR = Path(os.environ.get("REPORTS_DIR", REPO_DIR / "reports")).resolve()

MODEL_PATH = MODELS_DIR / "digit_model.joblib"
METADATA_PATH = MODELS_DIR / "metadata.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"
CONFUSION_PATH = ARTIFACTS_DIR / "confusion_matrix.json"
CLASSIFICATION_PATH = ARTIFACTS_DIR / "classification_report.json"
SAMPLES_PATH = ARTIFACTS_DIR / "samples.json"
EXPERIMENT_PATH = ARTIFACTS_DIR / "experiment.json"

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_IMAGE_SIDE = 2048
MIN_IMAGE_SIDE = 8
CANVAS_SIZE = 28
FEATURE_COUNT = 784


def cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
