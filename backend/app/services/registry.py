"""Load the saved classifier once and serve predictions."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import joblib
import numpy as np

from app.config import FEATURE_COUNT, MODEL_PATH
from app.errors import AppError, ModelUnavailableError

logger = logging.getLogger("digitrec")


class ModelRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._mtime: float | None = None
        self._bundle: dict[str, Any] | None = None
        self._error: str | None = "Trained model not found. Run python scripts/train.py."

    @property
    def ready(self) -> bool:
        self.load()
        return self._bundle is not None

    @property
    def model_name(self) -> str | None:
        self.load()
        if self._bundle is None:
            return None
        return str(self._bundle.get("model_name"))

    @property
    def error(self) -> str | None:
        self.load()
        return self._error

    def load(self) -> None:
        with self._lock:
            self._load_unlocked()

    def predict_vector(self, features: np.ndarray) -> dict[str, Any]:
        with self._lock:
            self._load_unlocked()
            if self._bundle is None:
                raise ModelUnavailableError(self._error or "Train the model before predicting.")
            model = self._bundle["model"]
            model_name = str(self._bundle["model_name"])

        vector = np.asarray(features, dtype=np.float32).reshape(1, -1)
        if vector.shape != (1, FEATURE_COUNT):
            raise AppError("Each image must contain 784 pixel features.", "invalid_features", 400)
        if not np.isfinite(vector).all():
            raise AppError("Features contain invalid pixel values.", "invalid_features", 400)

        started = time.perf_counter()
        probabilities = np.clip(np.asarray(model.predict_proba(vector)[0], dtype=float), 0.0, 1.0)
        elapsed_ms = (time.perf_counter() - started) * 1000
        classes = [int(value) for value in model.classes_]
        if len(classes) != len(probabilities):
            raise AppError("The model returned an invalid probability distribution.", "prediction_failed", 500)

        ranked = sorted(
            (
                {"digit": digit, "confidence": float(probability)}
                for digit, probability in zip(classes, probabilities)
            ),
            key=lambda item: item["confidence"],
            reverse=True,
        )
        return {
            "digit": ranked[0]["digit"],
            "confidence": ranked[0]["confidence"],
            "probabilities": {str(digit): float(probability) for digit, probability in zip(classes, probabilities)},
            "ranked": ranked,
            "inference_ms": float(elapsed_ms),
            "model_name": model_name,
            "feature_count": FEATURE_COUNT,
        }

    def _load_unlocked(self) -> None:
        if not MODEL_PATH.exists():
            self._bundle = None
            self._mtime = None
            self._error = "Trained model not found. Run python scripts/train.py."
            return
        mtime = MODEL_PATH.stat().st_mtime
        if self._bundle is not None and self._mtime == mtime:
            return
        try:
            bundle = joblib.load(MODEL_PATH)
            self._validate(bundle)
        except Exception:
            logger.exception("The saved model could not be loaded.")
            self._bundle = None
            self._mtime = None
            self._error = "The saved model could not be loaded. Retrain the model."
            return
        self._bundle = bundle
        self._mtime = mtime
        self._error = None
        logger.info("Loaded %s.", bundle.get("model_name", "model"))

    @staticmethod
    def _validate(bundle: dict[str, Any]) -> None:
        model = bundle.get("model")
        preprocess = bundle.get("preprocess") or {}
        if model is None or not hasattr(model, "predict") or not hasattr(model, "predict_proba"):
            raise ValueError("The model bundle is missing a classifier with probabilities.")
        if int(preprocess.get("canvas_size", 0)) != 28 or int(preprocess.get("feature_count", 0)) != FEATURE_COUNT:
            raise ValueError("The saved preprocessing config is incompatible with this server.")
        classes = [int(value) for value in model.classes_]
        if classes != list(range(10)):
            raise ValueError("The saved model does not expose digits 0 through 9.")
