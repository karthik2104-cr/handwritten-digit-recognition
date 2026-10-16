import numpy as np
import pytest
from scipy import ndimage

from app.errors import AppError, BlankCanvasError
from app.ml.preprocess import image_data_url, normalize_pixels, preprocess_drawing, preprocess_pipeline


def test_blank_canvas_is_rejected() -> None:
    with pytest.raises(BlankCanvasError):
        preprocess_drawing(np.zeros((48, 48), dtype=np.float32))


def test_blank_white_canvas_is_rejected() -> None:
    with pytest.raises(BlankCanvasError):
        preprocess_drawing(np.full((48, 48), 255, dtype=np.float32))


def test_feature_vector_has_784_normalized_values() -> None:
    image = np.zeros((72, 72), dtype=np.float32)
    image[18:54, 30:42] = 255
    vector, preview = preprocess_drawing(image)

    assert vector.shape == (784,)
    assert vector.dtype == np.float32
    assert float(vector.min()) >= 0
    assert float(vector.max()) <= 1
    assert preview.startswith("data:image/png;base64,")


def test_light_background_is_inverted_to_mnist_polarity() -> None:
    image = np.full((80, 80), 255, dtype=np.float32)
    image[18:62, 34:46] = 0
    vector, _preview = preprocess_drawing(image)
    canvas = vector.reshape(28, 28)

    assert float(canvas[0, 0]) < 0.15
    assert float(canvas.max()) > 0.5


def test_horizontal_stroke_keeps_its_aspect_ratio() -> None:
    image = np.zeros((90, 90), dtype=np.float32)
    image[40:48, 12:78] = 255
    canvas = preprocess_drawing(image)[0].reshape(28, 28)
    rows, cols = np.where(canvas > 0.2)

    assert cols.max() - cols.min() > rows.max() - rows.min()


def test_offcenter_digit_is_moved_near_the_middle() -> None:
    image = np.zeros((96, 96), dtype=np.float32)
    image[4:28, 6:30] = 255
    canvas = preprocess_drawing(image)[0].reshape(28, 28)
    center_y, center_x = ndimage.center_of_mass(canvas)

    assert abs(float(center_y) - 13.5) < 3
    assert abs(float(center_x) - 13.5) < 3


def test_missing_and_wrong_sized_vectors_are_rejected() -> None:
    broken = np.zeros(784, dtype=np.float32)
    broken[0] = np.nan
    with pytest.raises(AppError) as missing:
        normalize_pixels(broken)
    assert missing.value.code == "invalid_features"

    with pytest.raises(AppError) as short:
        normalize_pixels(np.zeros((3, 10), dtype=np.float32))
    assert short.value.code == "invalid_features"


def test_batch_normalization_scales_uint8_pixels() -> None:
    raw = np.array([[0, 255] + [0] * 782], dtype=np.uint8)
    normalized = normalize_pixels(raw)
    assert normalized.shape == (1, 784)
    assert normalized[0, 1] == pytest.approx(1)
    assert normalized[0, 0] == pytest.approx(0)


def test_pipeline_stages_match_the_feature_vector() -> None:
    image = np.zeros((90, 90), dtype=np.float32)
    image[20:70, 34:50] = 220
    vector, preview = preprocess_drawing(image)
    piped, piped_preview, stages = preprocess_pipeline(image)

    assert np.allclose(vector, piped)
    assert preview == piped_preview
    assert [stage["key"] for stage in stages] == ["grayscale", "cropped", "centered", "final"]
    final = stages[-1]
    assert final["width"] == 28
    assert final["height"] == 28
    assert final["image"] == preview
    assert stages[1]["height"] < image.shape[0]
    assert stages[2]["width"] == 28


def test_image_data_url_uses_png() -> None:
    preview = image_data_url(np.linspace(0, 1, 784, dtype=np.float32))
    assert preview.startswith("data:image/png;base64,")
