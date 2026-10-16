"""Read evaluation artifacts produced by the training script."""

from __future__ import annotations

import json
import logging
import math
import threading
from pathlib import Path

from pydantic import ValidationError

from app.config import CONFUSION_PATH, METADATA_PATH, METRICS_PATH, SAMPLES_PATH
from app.errors import AppError
from app.schemas.api import ConfusionResponse, MetricsResponse, ModelInfoResponse, SamplePage

logger = logging.getLogger("digitrec")


class ArtifactStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cache: dict[Path, tuple[float, dict]] = {}

    def available(self) -> bool:
        return all(path.exists() for path in (METRICS_PATH, CONFUSION_PATH, SAMPLES_PATH, METADATA_PATH))

    def metrics(self) -> MetricsResponse:
        return self._validate(MetricsResponse, self._read_json(METRICS_PATH), "metrics")

    def confusion(self) -> ConfusionResponse:
        payload = self._validate(ConfusionResponse, self._read_json(CONFUSION_PATH), "confusion matrix")
        matrix = payload.matrix
        if payload.labels != list(range(10)) or len(matrix) != 10 or any(len(row) != 10 for row in matrix):
            raise AppError(
                "Evaluation artifacts are unreadable. Retrain the model.",
                "artifacts_invalid",
                503,
            )
        return payload

    def model_info(self) -> ModelInfoResponse:
        metadata = dict(self._read_json(METADATA_PATH))
        metadata["metrics"] = self.metrics().model_dump()
        return self._validate(ModelInfoResponse, metadata, "model info")

    def samples(
        self,
        *,
        digit: int | None,
        actual: int | None,
        predicted: int | None,
        outcome: str,
        page: int,
        page_size: int,
    ) -> SamplePage:
        items = self._read_json(SAMPLES_PATH).get("items")
        if not isinstance(items, list):
            raise AppError(
                "Evaluation artifacts are unreadable. Retrain the model.",
                "artifacts_invalid",
                503,
            )
        filtered = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if digit is not None and item.get("actual") != digit:
                continue
            if actual is not None and item.get("actual") != actual:
                continue
            if predicted is not None and item.get("predicted") != predicted:
                continue
            correct = bool(item.get("correct"))
            if outcome == "correct" and not correct:
                continue
            if outcome == "incorrect" and correct:
                continue
            filtered.append(item)

        total = len(filtered)
        total_pages = math.ceil(total / page_size) if total else 0
        if page > max(total_pages, 1) or (total == 0 and page > 1):
            raise AppError("That page is outside the result set.", "invalid_page", 400)
        start = (page - 1) * page_size
        page_items = filtered[start : start + page_size]
        return self._validate(
            SamplePage,
            {
                "items": page_items,
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
            "samples",
        )

    def _validate(self, model: type, payload: dict, label: str):
        try:
            return model.model_validate(payload)
        except ValidationError:
            logger.exception("%s artifact failed validation.", label)
            raise AppError(
                "Evaluation artifacts are unreadable. Retrain the model.",
                "artifacts_invalid",
                503,
            ) from None

    def _read_json(self, path: Path) -> dict:
        if not path.exists():
            raise AppError(
                "Evaluation artifacts are missing. Run python scripts/train.py.",
                "artifacts_missing",
                503,
            )
        mtime = path.stat().st_mtime
        with self._lock:
            cached = self._cache.get(path)
            if cached and cached[0] == mtime:
                return cached[1]
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.exception("Could not parse %s.", path.name)
                raise AppError(
                    "Evaluation artifacts are unreadable. Retrain the model.",
                    "artifacts_invalid",
                    503,
                ) from None
            if not isinstance(payload, dict):
                raise AppError(
                    "Evaluation artifacts are unreadable. Retrain the model.",
                    "artifacts_invalid",
                    503,
                )
            self._cache[path] = (mtime, payload)
            return payload
