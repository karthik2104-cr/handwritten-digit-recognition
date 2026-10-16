import json

import joblib
import numpy as np
import pytest
from sklearn.metrics import confusion_matrix

from app.config import CONFUSION_PATH, METADATA_PATH, METRICS_PATH, MODEL_PATH
from app.ml.dataset import load_experiment_split, load_mnist
from app.ml.preprocess import preprocess_drawing


def _require_artifacts() -> dict:
    missing = [
        path.name
        for path in (MODEL_PATH, METADATA_PATH, METRICS_PATH, CONFUSION_PATH)
        if not path.exists()
    ]
    if missing:
        pytest.fail("Trained artifacts are missing. Run python scripts/train.py before the test suite.")
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))


def test_saved_confusion_matrix_matches_model_predictions() -> None:
    metadata = _require_artifacts()
    bundle = joblib.load(MODEL_PATH)
    _, _, x_test, y_test = load_experiment_split(
        int(metadata["random_seed"]),
        int(metadata["train_samples"]),
        int(metadata["test_samples"]),
    )
    predictions = bundle["model"].predict(x_test)
    fresh = confusion_matrix(y_test, predictions, labels=list(range(10)))
    saved = np.array(json.loads(CONFUSION_PATH.read_text(encoding="utf-8"))["matrix"])
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))

    assert fresh.shape == (10, 10)
    assert np.array_equal(fresh, saved)
    assert abs(float(np.trace(fresh) / fresh.sum()) - float(metrics["accuracy"])) < 1e-8
    assert float(metrics["accuracy"]) > 0.75


def test_preprocessed_drawings_stay_recognizable() -> None:
    metadata = _require_artifacts()
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    _train_images, _train_labels, images, labels = load_mnist()
    agreements = 0
    checked = 0
    for index in range(0, 200, 10):
        vector = images[index].astype(np.float32) / 255.0
        direct = int(model.predict(vector.reshape(1, -1))[0])
        enlarged = np.repeat(np.repeat(images[index].reshape(28, 28).astype(np.float32), 8, axis=0), 8, axis=1)
        processed, _preview = preprocess_drawing(enlarged)
        via_canvas = int(model.predict(processed.reshape(1, -1))[0])
        agreements += int(direct == via_canvas == int(labels[index]))
        checked += 1
    assert agreements >= int(checked * 0.7)
