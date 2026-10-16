"""Decode uploaded images and drawing payloads."""

from __future__ import annotations

import base64
import binascii
import io
import logging
from typing import Protocol

import numpy as np
from PIL import Image, UnidentifiedImageError

from app.config import MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, MIN_IMAGE_SIDE
from app.errors import AppError

logger = logging.getLogger("digitrec")

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
    "application/octet-stream",
}


class AsyncReader(Protocol):
    async def read(self, size: int) -> bytes: ...


def decode_base64_image(value: str) -> bytes:
    payload = value.strip()
    if payload.startswith("data:"):
        try:
            header, payload = payload.split(",", 1)
        except ValueError as exc:
            raise AppError("Image data is not valid base64.", "invalid_image", 400) from exc
        if "image/" not in header:
            raise AppError("Drawing data must be an image.", "invalid_file_type", 400)
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("Image data is not valid base64.", "invalid_image", 400) from exc
    if not raw:
        raise AppError("The image payload is empty.", "invalid_image", 400)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise AppError("Image exceeds the 2 MB upload limit.", "file_too_large", 413)
    return raw


async def read_limited(upload: AsyncReader, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(65_536)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise AppError("Image exceeds the 2 MB upload limit.", "file_too_large", 413)
        chunks.append(chunk)
    if total == 0:
        raise AppError("The uploaded file is empty.", "invalid_image", 400)
    return b"".join(chunks)


def image_bytes_to_gray(data: bytes) -> np.ndarray:
    _preview, _width, _height, gray = describe_source(data)
    return gray


def describe_source(data: bytes) -> tuple[str, int, int, np.ndarray]:
    """Return a preview of the decoded image, its real size, and the grayscale array."""

    image = _open_image(data)
    try:
        width, height = image.size
        preview = image.convert("RGB")
        preview.thumbnail((420, 420), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        preview.save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        gray = np.asarray(_to_grayscale(image), dtype=np.float32)
        return f"data:image/png;base64,{encoded}", width, height, gray
    finally:
        image.close()


def _open_image(data: bytes) -> Image.Image:
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError("Image exceeds the 2 MB upload limit.", "file_too_large", 413)
    if not looks_like_image(data):
        raise AppError("Upload a PNG, JPEG, WebP, or BMP image.", "invalid_file_type", 400)
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.info("Rejected unreadable image (%s).", exc.__class__.__name__)
        raise AppError("The file is not a readable image.", "invalid_image", 400) from exc
    if width < MIN_IMAGE_SIDE or height < MIN_IMAGE_SIDE:
        image.close()
        raise AppError(
            "Image is too small. Use at least 8×8 pixels.",
            "invalid_dimensions",
            400,
        )
    if width > MAX_IMAGE_SIDE or height > MAX_IMAGE_SIDE:
        image.close()
        raise AppError(
            "Image is too large. Maximum size is 2048×2048 pixels.",
            "invalid_dimensions",
            400,
        )
    return image


def looks_like_image(data: bytes) -> bool:
    return (
        data.startswith(b"\x89PNG\r\n\x1a\n")
        or data.startswith(b"\xff\xd8\xff")
        or data.startswith(b"GIF87a")
        or data.startswith(b"GIF89a")
        or data.startswith(b"BM")
        or (data.startswith(b"RIFF") and data[8:12] == b"WEBP")
    )


def _to_grayscale(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"), dtype=np.float32)
    visible = alpha > 10
    if not bool(visible.any()):
        return Image.new("L", image.size, 0)
    if bool((alpha < 255).any()):
        rgb = np.asarray(rgba.convert("RGB"), dtype=np.float32)
        luminance = rgb.mean(axis=2)
        ink_level = float(np.median(luminance[visible]))
        background = (0, 0, 0, 255) if ink_level >= 127 else (255, 255, 255, 255)
        base = Image.new("RGBA", image.size, background)
        return Image.alpha_composite(base, rgba).convert("L")
    return rgba.convert("L")
