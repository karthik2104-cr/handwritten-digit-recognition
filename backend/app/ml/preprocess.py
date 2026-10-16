"""Turn raw images and MNIST vectors into model features."""

from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image
from scipy import ndimage

from app.config import CANVAS_SIZE, FEATURE_COUNT
from app.errors import AppError, BlankCanvasError

FIT_BOX = 20
GAUSSIAN_SIGMA = 0.35
MIN_INK_PIXELS = 12
MIN_CONTRAST = 20.0


def normalize_pixels(values: np.ndarray) -> np.ndarray:
    """Scale pixel intensities from 0–255 to 0–1 and require 784 features."""

    array = np.asarray(values, dtype=np.float32)
    single = array.ndim == 1
    if single:
        array = array.reshape(1, -1)
    if array.ndim != 2 or array.shape[1] != FEATURE_COUNT:
        raise AppError(
            "Each image must contain 784 pixel features.",
            "invalid_features",
            400,
        )
    if not np.isfinite(array).all():
        raise AppError(
            "Input contains missing or invalid pixel values.",
            "invalid_features",
            400,
        )
    normalized = np.clip(array, 0.0, 255.0) / 255.0
    return normalized[0] if single else normalized


def preprocess_drawing(gray: np.ndarray) -> tuple[np.ndarray, str]:
    """Crop, center, and normalize a grayscale drawing.

    The returned vector matches the training contract: 784 values in ``[0, 1]``
    with a light digit on a dark background.
    """

    vector, preview, _stages = preprocess_pipeline(gray)
    return vector, preview


def preprocess_pipeline(gray: np.ndarray) -> tuple[np.ndarray, str, list[dict[str, object]]]:
    """Run the same preprocessing as inference and keep each real intermediate image."""

    source = np.asarray(gray, dtype=np.float32)
    if source.ndim != 2 or source.size == 0:
        raise AppError("The image has invalid dimensions.", "invalid_dimensions", 400)
    if not np.isfinite(source).all():
        raise AppError("The image contains invalid pixel values.", "invalid_image", 400)

    source = np.clip(source, 0.0, 255.0)
    image = _ensure_mnist_polarity(source)
    inverted = float(np.max(np.abs(image - source))) > 0.5
    if float(image.max() - image.min()) < MIN_CONTRAST:
        raise BlankCanvasError()

    mask = _ink_mask(image)
    if int(mask.sum()) < MIN_INK_PIXELS:
        raise BlankCanvasError()

    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    if rows.size == 0 or cols.size == 0:
        raise BlankCanvasError()

    top, bottom = int(rows[0]), int(rows[-1])
    left, right = int(cols[0]), int(cols[-1])
    pad = max(1, int(round(0.06 * max(bottom - top + 1, right - left + 1))))
    top = max(0, top - pad)
    left = max(0, left - pad)
    bottom = min(image.shape[0] - 1, bottom + pad)
    right = min(image.shape[1] - 1, right + pad)
    cropped = image[top : bottom + 1, left : right + 1]

    peak = float(cropped.max())
    if peak <= 0:
        raise BlankCanvasError()
    if peak < 255:
        cropped = cropped * (255.0 / peak)
    cropped_view = cropped.copy()

    fitted_height, fitted_width = _fit_size(cropped.shape[0], cropped.shape[1], FIT_BOX)
    resized = _resize(cropped, fitted_width, fitted_height)

    canvas = np.zeros((CANVAS_SIZE, CANVAS_SIZE), dtype=np.float32)
    offset_y = (CANVAS_SIZE - fitted_height) // 2
    offset_x = (CANVAS_SIZE - fitted_width) // 2
    canvas[offset_y : offset_y + fitted_height, offset_x : offset_x + fitted_width] = resized
    placed = canvas.copy()

    peak_before_blur = float(canvas.max())
    canvas = ndimage.gaussian_filter(canvas, sigma=GAUSSIAN_SIGMA)
    peak_after_blur = float(canvas.max())
    if peak_after_blur > 0 and peak_before_blur > 0:
        canvas *= peak_before_blur / peak_after_blur

    center_y, center_x = ndimage.center_of_mass(canvas)
    if not np.isfinite(center_y) or not np.isfinite(center_x):
        raise BlankCanvasError()
    target = (CANVAS_SIZE - 1) / 2
    canvas = ndimage.shift(
        canvas,
        shift=(target - float(center_y), target - float(center_x)),
        order=1,
        mode="constant",
        cval=0.0,
    )
    canvas = np.clip(canvas, 0.0, 255.0)
    if float(canvas.max()) < 8:
        raise BlankCanvasError()

    normalized = (canvas / 255.0).astype(np.float32).reshape(FEATURE_COUNT)
    preview = image_data_url(normalized)
    polarity = (
        "The border is light, so luminance is inverted and the digit becomes bright on black."
        if inverted
        else "The border is already dark, so luminance is left unchanged."
    )
    stages = [
        _stage(
            "grayscale",
            "Grayscale Conversion",
            f"The picture is reduced to one luminance channel. {polarity}",
            image,
        ),
        _stage(
            "cropped",
            "Digit Cropping",
            "Ink is bounded, padded by about 6 percent, and stretched to full brightness when the stroke is faint.",
            cropped_view,
        ),
        _stage(
            "centered",
            "Resizing and Centering",
            "The crop keeps its aspect ratio, fits inside a 20×20 box, and is placed on a blank 28×28 canvas.",
            placed,
        ),
        {
            "key": "final",
            "title": "Final 28×28 Image",
            "detail": "A light blur and a center-of-mass shift produce the 784 values passed to the classifier.",
            "image": preview,
            "width": CANVAS_SIZE,
            "height": CANVAS_SIZE,
        },
    ]
    return normalized, preview, stages


def _stage(key: str, title: str, detail: str, image: np.ndarray) -> dict[str, object]:
    return {
        "key": key,
        "title": title,
        "detail": detail,
        "image": _preview_url(image),
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
    }


def _preview_url(image: np.ndarray, max_side: int = 420) -> str:
    """Encode a grayscale array. Large stages are thumbnailed for transport only."""

    array = np.clip(np.asarray(image, dtype=np.float32), 0, 255).astype(np.uint8)
    picture = Image.fromarray(array, mode="L")
    if max(picture.size) > max_side:
        picture.thumbnail((max_side, max_side), Image.Resampling.BOX)
    buffer = io.BytesIO()
    picture.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def image_data_url(vector: np.ndarray) -> str:
    """Encode a normalized 784-vector as a 28×28 PNG data URL."""

    pixels = np.clip(np.asarray(vector, dtype=np.float32).reshape(CANVAS_SIZE, CANVAS_SIZE) * 255.0, 0, 255)
    buffer = io.BytesIO()
    Image.fromarray(pixels.astype(np.uint8), mode="L").save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def preprocess_config() -> dict[str, object]:
    return {
        "normalization": "divide_by_255",
        "canvas_size": CANVAS_SIZE,
        "feature_count": FEATURE_COUNT,
        "fit_size": FIT_BOX,
        "center_of_mass": True,
        "invert_light_background": True,
        "polarity": "light_digit_on_dark_background",
        "gaussian_sigma": GAUSSIAN_SIGMA,
    }


def _ensure_mnist_polarity(gray: np.ndarray) -> np.ndarray:
    height, width = gray.shape
    samples = np.array(
        [
            gray[0, 0],
            gray[0, -1],
            gray[-1, 0],
            gray[-1, -1],
            gray[0, width // 2],
            gray[-1, width // 2],
            gray[height // 2, 0],
            gray[height // 2, -1],
        ],
        dtype=np.float32,
    )
    if float(np.median(samples)) > 127:
        return 255.0 - gray
    return gray


def _ink_mask(gray: np.ndarray) -> np.ndarray:
    bright = float(np.percentile(gray, 99))
    threshold = max(25.0, bright * 0.30)
    return gray >= threshold


def _fit_size(height: int, width: int, box: int) -> tuple[int, int]:
    scale = box / max(height, width)
    fitted_height = max(1, min(box, int(round(height * scale))))
    fitted_width = max(1, min(box, int(round(width * scale))))
    return fitted_height, fitted_width


def _resize(image: np.ndarray, width: int, height: int) -> np.ndarray:
    array = np.clip(image, 0, 255).astype(np.uint8)
    resized = Image.fromarray(array, mode="L").resize((width, height), Image.Resampling.LANCZOS)
    return np.asarray(resized, dtype=np.float32)
