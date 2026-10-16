"""Request and response models for the recognition API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class DrawingRequest(BaseModel):
    image_base64: str = Field(min_length=8, max_length=3_000_000)


class ClassProbability(BaseModel):
    digit: int = Field(ge=0, le=9)
    confidence: float = Field(ge=0, le=1)


class PipelineStage(BaseModel):
    key: str
    title: str
    detail: str
    image: str
    width: int = Field(ge=1)
    height: int = Field(ge=1)


class PredictionResponse(BaseModel):
    digit: int = Field(ge=0, le=9)
    confidence: float = Field(ge=0, le=1)
    probabilities: dict[str, float]
    ranked: list[ClassProbability]
    inference_ms: float = Field(ge=0)
    model_name: str
    feature_count: int
    preprocessed_image: str
    pipeline: list[PipelineStage] = Field(default_factory=list)
    pixels: list[float] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_name: str | None = None
    classes: list[int]
    artifacts_loaded: bool
    detail: str | None = None


class PerDigitMetric(BaseModel):
    digit: int = Field(ge=0, le=9)
    precision: float
    recall: float
    f1: float
    support: int


class ModelComparison(BaseModel):
    model: str
    role: Literal["baseline", "primary"]
    accuracy: float
    precision: float
    recall: float
    f1: float
    macro_f1: float
    training_time_s: float
    inference_ms_median: float
    selected: bool


class ClassCount(BaseModel):
    digit: int
    count: int


class MetricsResponse(BaseModel):
    best_model: str
    baseline_model: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    test_samples: int
    train_samples: int
    inference_ms_mean: float
    inference_ms_median: float
    batch_ms_per_image: float
    training_time_s: float
    per_digit: list[PerDigitMetric]
    comparison: list[ModelComparison]
    train_class_counts: list[ClassCount]
    test_class_counts: list[ClassCount]
    generated_at: str
    random_seed: int


class ConfusionResponse(BaseModel):
    labels: list[int]
    matrix: list[list[int]]
    test_samples: int


class SampleItem(BaseModel):
    id: int
    actual: int
    predicted: int
    confidence: float
    correct: bool
    image: str


class SamplePage(BaseModel):
    items: list[SampleItem]
    page: int
    page_size: int
    total: int
    total_pages: int


class ModelInfoResponse(BaseModel):
    model_name: str
    model_type: str
    baseline_model: str
    classes: list[int]
    dataset_name: str
    dataset_source: str
    dataset_url: str
    image_height: int
    image_width: int
    feature_count: int
    normalization: str
    random_seed: int
    train_samples: int
    test_samples: int
    official_split: str
    parameters: dict[str, Any]
    library_versions: dict[str, str]
    python_version: str
    trained_at: str
    notes: list[str]
    metrics: MetricsResponse
