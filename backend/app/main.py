"""FastAPI application for handwritten digit recognition."""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import cors_origins
from app.errors import AppError
from app.services.artifacts import ArtifactStore
from app.services.registry import ModelRegistry

logger = logging.getLogger("digitrec")


def configure_logging() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    app.state.registry = ModelRegistry()
    app.state.artifacts = ArtifactStore()
    app.state.registry.load()
    if app.state.registry.ready:
        logger.info("Recognition model is ready (%s).", app.state.registry.model_name)
    else:
        logger.warning("%s", app.state.registry.error)
    yield


app = FastAPI(
    title="Handwritten Digit Recognition",
    summary="Classify handwritten digits with a scikit-learn model trained on MNIST.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info("%s %s -> %s (%.1f ms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "Handwritten Digit Recognition",
        "health": "/api/health",
        "docs": "/docs",
    }


@app.exception_handler(AppError)
async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})


@app.exception_handler(RequestValidationError)
async def handle_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", []) if part != "body"]
        errors.append({"field": ".".join(location), "message": error.get("msg", "Invalid value")})
    return JSONResponse(
        status_code=422,
        content={"detail": "The request is invalid.", "code": "validation_error", "errors": errors},
    )


@app.exception_handler(Exception)
async def handle_unexpected(_request: Request, _exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error.")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred.", "code": "internal_error"},
    )
