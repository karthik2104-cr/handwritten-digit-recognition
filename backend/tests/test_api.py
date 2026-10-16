import base64
import io

import numpy as np
from PIL import Image

from app.main import app


def _png(array: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array.astype(np.uint8), mode="L").save(buffer, format="PNG")
    return buffer.getvalue()


def _digit_image() -> np.ndarray:
    image = np.zeros((96, 96), dtype=np.uint8)
    image[24:72, 40:56] = 255
    return image


def test_health_reports_a_loaded_model(client) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["model_loaded"] is True, body.get("detail")
    assert body["artifacts_loaded"] is True, body.get("detail")
    assert body["status"] == "ok"
    assert body["model_name"]
    assert body["classes"] == list(range(10))


def test_root_points_to_health(client) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["health"] == "/api/health"


def test_metrics_and_confusion_matrix_agree(client) -> None:
    metrics = client.get("/api/metrics")
    confusion = client.get("/api/confusion-matrix")
    assert metrics.status_code == 200
    assert confusion.status_code == 200
    matrix = np.array(confusion.json()["matrix"])
    assert confusion.json()["labels"] == list(range(10))
    assert matrix.shape == (10, 10)
    assert int(matrix.sum()) == confusion.json()["test_samples"]
    assert int(matrix.sum()) == metrics.json()["test_samples"]
    accuracy = float(np.trace(matrix) / matrix.sum())
    assert abs(accuracy - metrics.json()["accuracy"]) < 1e-6
    assert len(metrics.json()["per_digit"]) == 10
    assert len(metrics.json()["comparison"]) == 2
    assert {item["role"] for item in metrics.json()["comparison"]} == {"baseline", "primary"}


def test_model_info_describes_mnist_features(client) -> None:
    response = client.get("/api/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["feature_count"] == 784
    assert body["image_height"] == 28
    assert body["image_width"] == 28
    assert body["dataset_name"] == "MNIST"
    assert len(body["classes"]) == 10
    assert body["metrics"]["test_samples"] == client.get("/api/metrics").json()["test_samples"]


def test_samples_can_be_filtered_and_paged(client) -> None:
    response = client.get("/api/samples?outcome=correct&page=1&page_size=4")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] > 0
    assert len(body["items"]) <= 4
    assert all(item["correct"] is True for item in body["items"])
    assert body["items"][0]["image"].startswith("data:image/png;base64,")

    incorrect = client.get("/api/samples?outcome=incorrect&page_size=6")
    assert incorrect.status_code == 200
    assert all(item["correct"] is False for item in incorrect.json()["items"])
    assert client.get("/api/samples?digit=15").status_code == 422
    assert client.get("/api/samples?page_size=500").status_code == 422


def test_upload_validation_and_prediction(client) -> None:
    text = client.post("/api/predict", files={"file": ("note.txt", b"hello", "text/plain")})
    assert text.status_code == 400
    assert text.json()["code"] == "invalid_file_type"

    fake = client.post("/api/predict", files={"file": ("digit.png", b"not really a png", "image/png")})
    assert fake.status_code == 400

    tiny = client.post(
        "/api/predict",
        files={"file": ("tiny.png", _png(np.zeros((2, 2), dtype=np.uint8)), "image/png")},
    )
    assert tiny.status_code == 400
    assert tiny.json()["code"] == "invalid_dimensions"

    blank = client.post(
        "/api/predict",
        files={"file": ("blank.png", _png(np.zeros((32, 32), dtype=np.uint8)), "image/png")},
    )
    assert blank.status_code == 400
    assert blank.json()["code"] == "blank_canvas"

    valid = client.post(
        "/api/predict",
        files={"file": ("digit.png", _png(_digit_image()), "image/png")},
    )
    assert valid.status_code == 200
    _assert_prediction(valid.json())


def test_drawing_endpoint_rejects_blank_and_accepts_ink(client) -> None:
    blank_png = _png(np.zeros((48, 48), dtype=np.uint8))
    blank = client.post(
        "/api/predict/drawing",
        json={"image_base64": "data:image/png;base64," + base64.b64encode(blank_png).decode("ascii")},
    )
    assert blank.status_code == 400
    assert blank.json()["code"] == "blank_canvas"

    malformed = client.post("/api/predict/drawing", json={"image_base64": "not-valid-base64"})
    assert malformed.status_code == 400
    assert client.post("/api/predict/drawing", json={}).status_code == 422

    drawing = _png(_digit_image())
    response = client.post(
        "/api/predict/drawing",
        json={"image_base64": base64.b64encode(drawing).decode("ascii")},
    )
    assert response.status_code == 200
    _assert_prediction(response.json())


def test_app_exposes_routes() -> None:
    paths = set(app.openapi()["paths"])
    assert {
        "/api/health",
        "/api/predict",
        "/api/predict/drawing",
        "/api/metrics",
        "/api/confusion-matrix",
        "/api/model-info",
        "/api/samples",
    } <= paths


def _assert_prediction(body: dict) -> None:
    assert body["feature_count"] == 784
    assert 0 <= body["digit"] <= 9
    assert set(body["probabilities"]) == {str(digit) for digit in range(10)}
    assert abs(sum(body["probabilities"].values()) - 1) < 0.02
    assert body["ranked"][0]["digit"] == body["digit"]
    assert len(body["ranked"]) == 10
    assert body["preprocessed_image"].startswith("data:image/png;base64,")
    assert [stage["key"] for stage in body["pipeline"]] == [
        "original",
        "grayscale",
        "cropped",
        "centered",
        "final",
    ]
    final = body["pipeline"][-1]
    assert final["width"] == 28
    assert final["height"] == 28
    assert final["image"] == body["preprocessed_image"]
    assert len(body["pixels"]) == 784
    assert all(0 <= value <= 1 for value in body["pixels"])
