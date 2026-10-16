"""Prediction and evaluation endpoints."""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, File, Query, Request, UploadFile

from app.errors import AppError
from app.ml.preprocess import preprocess_pipeline
from app.schemas.api import (
    ConfusionResponse,
    DrawingRequest,
    HealthResponse,
    MetricsResponse,
    ModelInfoResponse,
    PredictionResponse,
    SamplePage,
)
from app.services.artifacts import ArtifactStore
from app.services.registry import ModelRegistry
from app.utils.images import ALLOWED_CONTENT_TYPES, decode_base64_image, describe_source, read_limited

logger = logging.getLogger("digitrec")
router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    registry = _registry(request)
    artifacts = _artifacts(request)
    loaded = registry.ready
    artifacts_loaded = artifacts.available()
    healthy = loaded and artifacts_loaded
    detail = None
    if not loaded:
        detail = registry.error
    elif not artifacts_loaded:
        detail = "Evaluation artifacts are missing. Run python scripts/train.py."
    return HealthResponse(
        status="ok" if healthy else "degraded",
        model_loaded=loaded,
        model_name=registry.model_name,
        classes=list(range(10)) if loaded else [],
        artifacts_loaded=artifacts_loaded,
        detail=detail,
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict_upload(request: Request, file: UploadFile = File(...)) -> PredictionResponse:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise AppError("Upload a PNG, JPEG, WebP, or BMP image.", "invalid_file_type", 400)
    raw = await read_limited(file)
    return await asyncio.to_thread(_predict_bytes, request, raw)


@router.post("/predict/drawing", response_model=PredictionResponse)
async def predict_drawing(payload: DrawingRequest, request: Request) -> PredictionResponse:
    raw = decode_base64_image(payload.image_base64)
    return await asyncio.to_thread(_predict_bytes, request, raw)


@router.get("/metrics", response_model=MetricsResponse)
def metrics(request: Request) -> MetricsResponse:
    return _artifacts(request).metrics()


@router.get("/confusion-matrix", response_model=ConfusionResponse)
def confusion_matrix(request: Request) -> ConfusionResponse:
    return _artifacts(request).confusion()


@router.get("/model-info", response_model=ModelInfoResponse)
def model_info(request: Request) -> ModelInfoResponse:
    return _artifacts(request).model_info()


@router.get("/samples", response_model=SamplePage)
def samples(
    request: Request,
    digit: int | None = Query(default=None, ge=0, le=9),
    actual: int | None = Query(default=None, ge=0, le=9),
    predicted: int | None = Query(default=None, ge=0, le=9),
    outcome: Literal["all", "correct", "incorrect"] = "all",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=60),
) -> SamplePage:
    return _artifacts(request).samples(
        digit=digit,
        actual=actual,
        predicted=predicted,
        outcome=outcome,
        page=page,
        page_size=page_size,
    )


def _predict_bytes(request: Request, raw: bytes) -> PredictionResponse:
    original, width, height, gray = describe_source(raw)
    features, preview, stages = preprocess_pipeline(gray)
    prediction = _registry(request).predict_vector(features)
    pipeline = [
        {
            "key": "original",
            "title": "Original Input",
            "detail": "The drawing or upload after it is decoded, before grayscale conversion.",
            "image": original,
            "width": width,
            "height": height,
        },
        *stages,
    ]
    logger.info(
        "Predicted %s with confidence %.3f in %.1f ms.",
        prediction["digit"],
        prediction["confidence"],
        prediction["inference_ms"],
    )
    return PredictionResponse(
        **prediction,
        preprocessed_image=preview,
        pipeline=pipeline,
        pixels=[float(value) for value in features.tolist()],
    )


def _registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


def _artifacts(request: Request) -> ArtifactStore:
    return request.app.state.artifacts
