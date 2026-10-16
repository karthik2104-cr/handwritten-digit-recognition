"""Write charts, tables, and the evaluation summary from real predictions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from PIL import Image

from app.config import REPORTS_DIR
from app.ml.preprocess import image_data_url
from app.utils.jsonio import write_json


def write_reports(
    *,
    metrics: dict[str, Any],
    x_test: np.ndarray,
    y_test: np.ndarray,
    predictions: np.ndarray,
    probabilities: np.ndarray,
) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")
    _write_confusion_chart(metrics)
    _write_comparison_chart(metrics)
    _write_per_digit_chart(metrics)
    _write_gallery(x_test, y_test, predictions, probabilities)
    _write_upload_example(x_test, y_test, predictions)
    frame = pd.DataFrame(metrics["per_digit"])
    frame.to_csv(REPORTS_DIR / "per_digit_metrics.csv", index=False)
    _write_summary(metrics)


def build_samples(
    vectors: np.ndarray,
    actual: np.ndarray,
    predicted: np.ndarray,
    probabilities: np.ndarray,
) -> dict[str, Any]:
    items = []
    for index, (truth, guess, row) in enumerate(zip(actual, predicted, probabilities)):
        items.append(
            {
                "id": int(index),
                "actual": int(truth),
                "predicted": int(guess),
                "confidence": float(np.max(row)),
                "correct": int(truth) == int(guess),
                "image": image_data_url(vectors[index]),
            }
        )
    return {"items": items}


def _write_confusion_chart(metrics: dict[str, Any]) -> None:
    matrix = np.array(metrics["confusion_matrix"], dtype=int)
    figure, axis = plt.subplots(figsize=(8.2, 6.8))
    sns.heatmap(
        matrix,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=list(range(10)),
        yticklabels=list(range(10)),
        ax=axis,
        cbar_kws={"label": "Test images"},
    )
    axis.set_xlabel("Predicted digit")
    axis.set_ylabel("Actual digit")
    axis.set_title("Confusion matrix from held-out test predictions")
    figure.tight_layout()
    figure.savefig(REPORTS_DIR / "confusion_matrix.png", dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(figure)


def _write_comparison_chart(metrics: dict[str, Any]) -> None:
    comparison = metrics["comparison"]
    names = [item["model"] for item in comparison]
    positions = np.arange(len(names))
    width = 0.18
    figure, axis = plt.subplots(figsize=(8.4, 4.6))
    series = (
        ("accuracy", "Accuracy"),
        ("precision", "Weighted precision"),
        ("recall", "Weighted recall"),
        ("f1", "Weighted F1"),
    )
    for offset, (key, label) in enumerate(series):
        values = [item[key] * 100 for item in comparison]
        axis.bar(positions + (offset - 1.5) * width, values, width, label=label)
    axis.set_ylabel("Score (%)")
    axis.set_ylim(0, 100)
    axis.set_xticks(positions)
    axis.set_xticklabels(names)
    axis.set_title("Both models were scored on the same test subset")
    axis.legend(frameon=False, ncol=2)
    figure.tight_layout()
    figure.savefig(REPORTS_DIR / "model_comparison.png", dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(figure)


def _write_per_digit_chart(metrics: dict[str, Any]) -> None:
    digits = [row["digit"] for row in metrics["per_digit"]]
    scores = [row["f1"] * 100 for row in metrics["per_digit"]]
    figure, axis = plt.subplots(figsize=(8.2, 4.2))
    axis.bar(digits, scores, color="#0f766e")
    axis.set_xticks(digits)
    axis.set_ylim(0, 100)
    axis.set_xlabel("Digit")
    axis.set_ylabel("F1 score (%)")
    axis.set_title(f"Per-digit F1 for {metrics['best_model']}")
    figure.tight_layout()
    figure.savefig(REPORTS_DIR / "per_digit_f1.png", dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(figure)


def _write_gallery(
    vectors: np.ndarray,
    actual: np.ndarray,
    predicted: np.ndarray,
    probabilities: np.ndarray,
) -> None:
    correct = _pick(actual, predicted, probabilities, correct=True)
    incorrect = _pick(actual, predicted, probabilities, correct=False)
    figure, axes = plt.subplots(2, 8, figsize=(12.5, 3.8))
    _fill_gallery_row(axes[0], vectors, actual, predicted, correct, "Correct")
    _fill_gallery_row(axes[1], vectors, actual, predicted, incorrect, "Misclassified")
    figure.suptitle("Actual → predicted on held-out test images", y=1.02)
    figure.tight_layout()
    figure.savefig(REPORTS_DIR / "sample_gallery.png", dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(figure)


def _fill_gallery_row(
    axes: np.ndarray,
    vectors: np.ndarray,
    actual: np.ndarray,
    predicted: np.ndarray,
    indexes: list[int],
    label: str,
) -> None:
    for column, axis in enumerate(axes):
        if column >= len(indexes):
            axis.axis("off")
            if column == 0:
                axis.text(0.5, 0.5, f"No {label.lower()} examples", ha="center", va="center")
            continue
        index = indexes[column]
        axis.imshow(vectors[index].reshape(28, 28), cmap="gray", vmin=0, vmax=1)
        axis.set_title(f"{int(actual[index])}→{int(predicted[index])}", fontsize=9)
        axis.set_xticks([])
        axis.set_yticks([])
        if column == 0:
            axis.set_ylabel(label, fontsize=9)


def _pick(
    actual: np.ndarray,
    predicted: np.ndarray,
    probabilities: np.ndarray,
    *,
    correct: bool,
    limit: int = 8,
) -> list[int]:
    chosen: list[int] = []
    for digit in range(10):
        if correct:
            mask = (actual == digit) & (predicted == actual)
        else:
            mask = (actual == digit) & (predicted != actual)
        candidates = np.flatnonzero(mask)
        if candidates.size == 0:
            continue
        confidence = probabilities[candidates].max(axis=1)
        chosen.append(int(candidates[int(np.argmax(confidence))]))
        if len(chosen) >= limit:
            break
    return chosen


def _write_upload_example(vectors: np.ndarray, actual: np.ndarray, predicted: np.ndarray) -> None:
    image = np.clip(vectors[0].reshape(28, 28) * 255.0, 0, 255).astype(np.uint8)
    picture = Image.fromarray(image, mode="L").resize((280, 280), Image.Resampling.NEAREST)
    picture.save(REPORTS_DIR / "upload_example.png")
    write_json(
        REPORTS_DIR / "upload_example.json",
        {
            "actual": int(actual[0]),
            "predicted_during_evaluation": int(predicted[0]),
            "description": "Nearest-neighbor upscale of one MNIST test image for the upload control.",
        },
    )


def _write_summary(metrics: dict[str, Any]) -> None:
    lines = [
        "# Evaluation summary",
        "",
        f"Generated at {metrics['generated_at']}.",
        "",
        "These figures come from `scripts/train.py`. They are calculated on a stratified subset of the official MNIST test set after both models were trained only on a stratified subset of the official training set.",
        "",
        "## Selected model",
        "",
        f"- Model: {metrics['best_model']}",
        f"- Baseline compared against: {metrics['baseline_model']}",
        f"- Random seed: {metrics['random_seed']}",
        f"- Training images: {metrics['train_samples']}",
        f"- Test images: {metrics['test_samples']}",
        f"- Accuracy: {metrics['accuracy'] * 100:.2f}%",
        f"- Weighted precision: {metrics['precision'] * 100:.2f}%",
        f"- Weighted recall: {metrics['recall'] * 100:.2f}%",
        f"- Weighted F1: {metrics['f1'] * 100:.2f}%",
        f"- Macro F1: {metrics['macro_f1'] * 100:.2f}%",
        f"- Training time: {metrics['training_time_s']:.2f} s",
        f"- Median single-image inference: {metrics['inference_ms_median']:.2f} ms",
        f"- Batch evaluation per image: {metrics['batch_ms_per_image']:.3f} ms",
        "- Single-image latency is the median of warmed-up predictions using one worker, which matches API requests.",
        "",
        "## Comparison",
        "",
        "| Model | Role | Accuracy | Weighted F1 | Macro F1 | Train time (s) | Median inference (ms) | Selected |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for item in metrics["comparison"]:
        lines.append(
            "| {model} | {role} | {accuracy:.2f}% | {f1:.2f}% | {macro_f1:.2f}% | {training_time_s:.2f} | {inference_ms_median:.2f} | {selected} |".format(
                model=item["model"],
                role=item["role"],
                accuracy=item["accuracy"] * 100,
                f1=item["f1"] * 100,
                macro_f1=item["macro_f1"] * 100,
                training_time_s=item["training_time_s"],
                inference_ms_median=item["inference_ms_median"],
                selected="yes" if item["selected"] else "no",
            )
        )
    lines.extend(
        [
            "",
            "## Per-digit scores for the selected model",
            "",
            "| Digit | Precision | Recall | F1 | Support |",
            "| ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for row in metrics["per_digit"]:
        lines.append(
            f"| {row['digit']} | {row['precision'] * 100:.2f}% | {row['recall'] * 100:.2f}% | {row['f1'] * 100:.2f}% | {row['support']} |"
        )
    lines.extend(
        [
            "",
            "## Artifacts",
            "",
            "- `backend/models/digit_model.joblib`",
            "- `backend/artifacts/metrics.json`",
            "- `backend/artifacts/confusion_matrix.json`",
            "- `backend/artifacts/samples.json`",
            "- `reports/confusion_matrix.png`",
            "- `reports/model_comparison.png`",
            "- `reports/per_digit_f1.png`",
            "- `reports/sample_gallery.png`",
            "",
        ]
    )
    (REPORTS_DIR / "evaluation_summary.md").write_text("\n".join(lines), encoding="utf-8")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
