# Project status

Verified on 17 October 2026. This note records what is implemented and what was actually run. The README is the user-facing guide.

## Implemented

- Random forest deployed from `backend/models/digit_model.joblib`, with a logistic-regression baseline stored in the evaluation artifacts.
- FastAPI routes for health, drawing prediction, upload prediction, metrics, confusion matrix, model info, and paged samples.
- Preprocessing pipeline returned with each prediction. The final stage is the 28×28 input. `pixels` contains the 784 normalized values.
- Neural Studio pages: Overview, Recognition Studio, Model Evaluation, Prediction Explorer, and About the Model.
- Canvas drawing, brush size, undo, clear, upload, confidence, top candidates, probability chart, and pixel inspector.
- Clearing the canvas or starting a new prediction discards an in-flight result.
- Health polling every 5 seconds, including offline and recovery.
- Dark and light themes, collapsible sidebar, and a mobile navigation drawer.

## Verified metrics

Source: `backend/artifacts/metrics.json` and `backend/artifacts/confusion_matrix.json`. Stratified MNIST subset, 10,000 train / 2,000 test, seed 42.

- Random forest accuracy: 94.65% (1,893 / 2,000)
- Random forest weighted F1: 94.64%
- Logistic regression accuracy: 90.75%
- Random forest median single-image evaluation time: 64.06 ms
- Incorrect predictions: 107
- These are subset scores. Confidence is the share of trees, not a calibrated probability.

## Commands and outcomes

| Command | Outcome |
| --- | --- |
| `.venv\Scripts\python.exe -m pytest -q` | 29 passed. Starlette `httpx` / `TestClient` deprecation warning. |
| `npm test` in `frontend` | 18 passed, 6 files. |
| `npm run build` in `frontend` | `tsc --noEmit` and Vite build succeeded. |
| `GET http://127.0.0.1:8010/api/health` | `status: ok`, `RandomForestClassifier` loaded. |

## Not performed

- Docker Compose was not built or started.
- No hosted CI workflow exists.
- No ESLint script is configured.
- A physical touchscreen was not used. Drawing uses pointer events and was checked with mouse pointer input.
- No public deployment. GitHub Pages cannot run the model. Render, Railway, Fly, and Vercel were not authenticated, and the local Docker engine was not running.

## Screenshots

Captured on 17 October 2026 from http://127.0.0.1:5174 with the API on port 8010. A drawn stroke was predicted as 1 at 100.0%.

- `docs/screenshots/overview.png`
- `docs/screenshots/recognition-studio.png`
- `docs/screenshots/prediction-details.png`
- `docs/screenshots/model-evaluation.png`
- `docs/screenshots/prediction-explorer.png`
- `docs/screenshots/mobile-overview.png`

## How to start

Default ports are API 8000 and UI 5173. If those ports are occupied, use API 8010 and UI 5174 with `DEV_PORT` and `VITE_API_URL`. See the README for the exact commands. Do not stop unrelated programs to free a port.

The last live check used http://127.0.0.1:5174 and http://127.0.0.1:8010 because 5173 was already taken.
