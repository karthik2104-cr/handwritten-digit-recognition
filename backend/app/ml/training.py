"""Train a baseline and a random forest, then keep the stronger model."""

from __future__ import annotations

import platform
import time
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

from app.config import (
    ARTIFACTS_DIR,
    CLASSIFICATION_PATH,
    CONFUSION_PATH,
    EXPERIMENT_PATH,
    METADATA_PATH,
    METRICS_PATH,
    MODEL_PATH,
    MODELS_DIR,
    SAMPLES_PATH,
)
from app.ml.dataset import load_experiment_split
from app.ml.preprocess import preprocess_config
from app.ml.reports import build_samples, utc_now, write_reports
from app.ml.scoring import score_model
from app.utils.jsonio import json_ready, write_json

BASELINE_NAME = "LogisticRegression"
PRIMARY_NAME = "RandomForestClassifier"
TRACKED_PACKAGES = (
    "numpy",
    "pandas",
    "scikit-learn",
    "scipy",
    "matplotlib",
    "seaborn",
    "pillow",
    "joblib",
    "fastapi",
)


@dataclass(frozen=True)
class TrainConfig:
    seed: int = 42
    train_size: int = 10_000
    test_size: int = 2_000
    n_estimators: int = 80
    max_depth: int = 22
    max_features: int = 48
    min_samples_leaf: int = 2


def run_training(config: TrainConfig) -> dict[str, Any]:
    _validate_config(config)
    print("Loading MNIST and building a stratified split...", flush=True)
    x_train, y_train, x_test, y_test = load_experiment_split(
        config.seed,
        config.train_size,
        config.test_size,
    )
    print(
        f"Using {len(y_train):,} training images and {len(y_test):,} test images.",
        flush=True,
    )

    baseline = LogisticRegression(
        C=1.0,
        solver="lbfgs",
        max_iter=250,
        tol=1e-3,
        random_state=config.seed,
    )
    primary = RandomForestClassifier(
        n_estimators=config.n_estimators,
        max_depth=config.max_depth,
        max_features=config.max_features,
        min_samples_leaf=config.min_samples_leaf,
        n_jobs=-1,
        random_state=config.seed,
    )

    print("Training logistic regression baseline...", flush=True)
    baseline_score = _fit_and_score(baseline, x_train, y_train, x_test, y_test)
    _print_score(BASELINE_NAME, baseline_score)

    print("Training random forest...", flush=True)
    primary_score = _fit_and_score(primary, x_train, y_train, x_test, y_test)
    _print_score(PRIMARY_NAME, primary_score)

    candidates = (
        (BASELINE_NAME, "baseline", baseline, baseline_score),
        (PRIMARY_NAME, "primary", primary, primary_score),
    )
    selected_name, _, selected_model, selected_score = max(
        candidates,
        key=lambda item: (item[3]["f1"], item[3]["accuracy"], -item[3]["inference_ms_median"]),
    )
    print(f"Selected {selected_name} for the API.", flush=True)

    generated_at = utc_now()
    comparison = [
        _comparison_row(name, role, scored, name == selected_name) for name, role, _, scored in candidates
    ]
    metrics = {
        "best_model": selected_name,
        "baseline_model": BASELINE_NAME,
        "accuracy": selected_score["accuracy"],
        "precision": selected_score["precision"],
        "recall": selected_score["recall"],
        "f1": selected_score["f1"],
        "macro_precision": selected_score["macro_precision"],
        "macro_recall": selected_score["macro_recall"],
        "macro_f1": selected_score["macro_f1"],
        "test_samples": selected_score["test_samples"],
        "train_samples": int(len(y_train)),
        "inference_ms_mean": selected_score["inference_ms_mean"],
        "inference_ms_median": selected_score["inference_ms_median"],
        "batch_ms_per_image": selected_score["batch_ms_per_image"],
        "training_time_s": selected_score["training_time_s"],
        "per_digit": selected_score["per_digit"],
        "comparison": comparison,
        "train_class_counts": _class_counts(y_train),
        "test_class_counts": _class_counts(y_test),
        "generated_at": generated_at,
        "random_seed": config.seed,
        "confusion_matrix": selected_score["confusion_matrix"],
    }
    confusion = {
        "labels": list(range(10)),
        "matrix": selected_score["confusion_matrix"],
        "test_samples": selected_score["test_samples"],
    }
    metadata = _metadata(config, selected_model, selected_name, generated_at)
    experiment = {
        **metadata,
        "baseline_parameters": json_ready(baseline.get_params()),
        "primary_parameters": json_ready(primary.get_params()),
        "mean_pixel_intensity": _intensity_summary(x_train),
        "metrics": {key: value for key, value in metrics.items() if key != "confusion_matrix"},
    }
    samples = build_samples(
        x_test,
        y_test,
        selected_score["predictions"],
        selected_score["probabilities"],
    )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": selected_model,
        "model_name": selected_name,
        "preprocess": preprocess_config(),
        "classes": list(range(10)),
        "random_seed": config.seed,
    }
    joblib.dump(bundle, MODEL_PATH, compress=3)
    public_metrics = {key: value for key, value in metrics.items() if key != "confusion_matrix"}
    write_json(METADATA_PATH, metadata)
    write_json(METRICS_PATH, public_metrics)
    write_json(CONFUSION_PATH, confusion)
    write_json(CLASSIFICATION_PATH, selected_score["classification_report"])
    write_json(SAMPLES_PATH, samples)
    write_json(EXPERIMENT_PATH, experiment)
    write_reports(
        metrics=metrics,
        x_test=x_test,
        y_test=y_test,
        predictions=selected_score["predictions"],
        probabilities=selected_score["probabilities"],
    )
    print(f"Saved model to {MODEL_PATH.name} and metrics to {METRICS_PATH.name}.", flush=True)
    return public_metrics


def _fit_and_score(
    model: Any,
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_test: np.ndarray,
    y_test: np.ndarray,
) -> dict[str, Any]:
    started = time.perf_counter()
    model.fit(x_train, y_train)
    training_time = time.perf_counter() - started
    scored = score_model(model, x_test, y_test)
    scored["training_time_s"] = training_time
    return scored


def _comparison_row(name: str, role: str, scored: dict[str, Any], selected: bool) -> dict[str, Any]:
    return {
        "model": name,
        "role": role,
        "accuracy": scored["accuracy"],
        "precision": scored["precision"],
        "recall": scored["recall"],
        "f1": scored["f1"],
        "macro_f1": scored["macro_f1"],
        "training_time_s": scored["training_time_s"],
        "inference_ms_median": scored["inference_ms_median"],
        "selected": selected,
    }


def _class_counts(labels: np.ndarray) -> list[dict[str, int]]:
    frame = pd.DataFrame({"digit": labels})
    counts = frame["digit"].value_counts().sort_index()
    return [{"digit": int(digit), "count": int(count)} for digit, count in counts.items()]


def _intensity_summary(features: np.ndarray) -> dict[str, float]:
    intensity = pd.Series(features.mean(axis=1), name="mean_pixel")
    return {str(key): float(value) for key, value in intensity.describe().items()}


def _metadata(config: TrainConfig, model: Any, model_name: str, generated_at: str) -> dict[str, Any]:
    return {
        "model_name": model_name,
        "model_type": type(model).__name__,
        "baseline_model": BASELINE_NAME,
        "classes": list(range(10)),
        "dataset_name": "MNIST",
        "dataset_source": "Yann LeCun, Corinna Cortes, and Christopher J.C. Burges",
        "dataset_url": "http://yann.lecun.com/exdb/mnist/",
        "image_height": 28,
        "image_width": 28,
        "feature_count": 784,
        "normalization": "Pixel intensities are divided by 255 so every feature is in the range 0 to 1.",
        "random_seed": config.seed,
        "train_samples": config.train_size,
        "test_samples": config.test_size,
        "official_split": (
            "Training rows are sampled only from the official 60,000-image training set. "
            "Test rows are sampled only from the official 10,000-image test set."
        ),
        "parameters": json_ready(model.get_params()),
        "library_versions": {name: _package_version(name) for name in TRACKED_PACKAGES},
        "python_version": platform.python_version(),
        "trained_at": generated_at,
        "notes": [
            "The deployed model is the candidate with the higher weighted F1-score on the held-out test subset.",
            "Accuracy breaks an F1 tie, and a faster median inference time breaks a remaining tie.",
            "The subset keeps every digit through stratified sampling so the run fits a local machine.",
            "Drawings are cropped, resized with the aspect ratio preserved, and centered by center of mass before prediction.",
        ],
    }


def _package_version(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return "not installed"


def _print_score(name: str, scored: dict[str, Any]) -> None:
    print(
        (
            f"{name}: accuracy {scored['accuracy']:.4f}, "
            f"weighted F1 {scored['f1']:.4f}, "
            f"train {scored['training_time_s']:.1f}s, "
            f"median inference {scored['inference_ms_median']:.2f} ms"
        ),
        flush=True,
    )


def _validate_config(config: TrainConfig) -> None:
    if config.train_size < 10 or config.test_size < 10:
        raise ValueError("Train and test sizes must include at least one sample of each digit.")
    if config.n_estimators < 1 or config.max_depth < 1 or config.max_features < 1:
        raise ValueError("Random forest settings must be positive.")
    if config.min_samples_leaf < 1:
        raise ValueError("min_samples_leaf must be at least 1.")
