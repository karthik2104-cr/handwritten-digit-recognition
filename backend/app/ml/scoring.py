"""Score a fitted classifier on a held-out feature matrix."""

from __future__ import annotations

import time
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

LABELS = list(range(10))


def score_model(model: Any, features: np.ndarray, labels: np.ndarray) -> dict[str, Any]:
    """Predict the test matrix and calculate the published evaluation metrics.

    Single-image latency is measured the way the API serves a drawing: one row
    at a time, after a short warmup, with ``n_jobs`` set to 1 when the estimator
    has that setting. Parallel job startup would otherwise dominate a single
    request.
    """

    if hasattr(model, "n_jobs"):
        model.n_jobs = 1

    batch_started = time.perf_counter()
    predictions = np.asarray(model.predict(features), dtype=int)
    probabilities = np.asarray(model.predict_proba(features), dtype=float)
    batch_seconds = time.perf_counter() - batch_started

    warmup = min(8, len(features))
    for index in range(warmup):
        model.predict_proba(features[index : index + 1])

    timings: list[float] = []
    sample_count = min(30, len(features))
    for index in range(sample_count):
        started = time.perf_counter()
        model.predict_proba(features[index : index + 1])
        timings.append((time.perf_counter() - started) * 1000)
    measured = timings

    precision, recall, f1, support = precision_recall_fscore_support(
        labels,
        predictions,
        labels=LABELS,
        average=None,
        zero_division=0,
    )
    weighted = precision_recall_fscore_support(
        labels,
        predictions,
        average="weighted",
        zero_division=0,
    )
    macro = precision_recall_fscore_support(
        labels,
        predictions,
        average="macro",
        zero_division=0,
    )
    matrix = confusion_matrix(labels, predictions, labels=LABELS)
    report = classification_report(
        labels,
        predictions,
        labels=LABELS,
        output_dict=True,
        zero_division=0,
    )
    per_digit = [
        {
            "digit": digit,
            "precision": float(precision[digit]),
            "recall": float(recall[digit]),
            "f1": float(f1[digit]),
            "support": int(support[digit]),
        }
        for digit in LABELS
    ]
    return {
        "predictions": predictions,
        "probabilities": probabilities,
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision": float(weighted[0]),
        "recall": float(weighted[1]),
        "f1": float(weighted[2]),
        "macro_precision": float(macro[0]),
        "macro_recall": float(macro[1]),
        "macro_f1": float(macro[2]),
        "per_digit": per_digit,
        "confusion_matrix": matrix.astype(int).tolist(),
        "classification_report": report,
        "inference_ms_median": float(np.median(measured)),
        "inference_ms_mean": float(np.mean(measured)),
        "batch_ms_per_image": float(batch_seconds * 1000 / max(len(features), 1)),
        "test_samples": int(len(labels)),
    }
