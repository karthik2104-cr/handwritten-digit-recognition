import asyncio
import base64

import numpy as np
import pytest
from PIL import Image
import io

from app.errors import AppError
from app.utils.images import decode_base64_image, image_bytes_to_gray, looks_like_image, read_limited


class MemoryUpload:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self._offset = 0

    async def read(self, size: int) -> bytes:
        chunk = self._payload[self._offset : self._offset + size]
        self._offset += size
        return chunk


def _png(array: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array.astype(np.uint8), mode="L").save(buffer, format="PNG")
    return buffer.getvalue()


def test_read_limited_rejects_oversized_payload() -> None:
    upload = MemoryUpload(b"abcdefghij")
    with pytest.raises(AppError) as caught:
        asyncio.run(read_limited(upload, max_bytes=4))
    assert caught.value.code == "file_too_large"
    assert caught.value.status_code == 413


def test_decode_base64_data_url() -> None:
    raw = _png(np.zeros((8, 8), dtype=np.uint8))
    encoded = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
    assert decode_base64_image(encoded) == raw


def test_invalid_base64_is_rejected() -> None:
    with pytest.raises(AppError) as caught:
        decode_base64_image("data:image/png;base64,!!!!")
    assert caught.value.code == "invalid_image"


def test_text_bytes_are_not_an_image() -> None:
    assert looks_like_image(b"hello world") is False
    with pytest.raises(AppError) as caught:
        image_bytes_to_gray(b"this is not an image")
    assert caught.value.code == "invalid_file_type"


def test_tiny_and_huge_dimensions_are_rejected() -> None:
    with pytest.raises(AppError) as tiny:
        image_bytes_to_gray(_png(np.zeros((2, 2), dtype=np.uint8)))
    assert tiny.value.code == "invalid_dimensions"

    with pytest.raises(AppError) as huge:
        image_bytes_to_gray(_png(np.zeros((2100, 8), dtype=np.uint8)))
    assert huge.value.code == "invalid_dimensions"


def test_transparent_dark_ink_is_readable() -> None:
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(8, 24):
        for x in range(14, 18):
            image.putpixel((x, y), (0, 0, 0, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    gray = image_bytes_to_gray(buffer.getvalue())
    assert gray.shape == (32, 32)
    assert float(gray.max() - gray.min()) > 20
