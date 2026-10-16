# Evaluation summary

Generated at 2026-10-16T18:35:52+00:00.

These figures come from `scripts/train.py`. They are calculated on a stratified subset of the official MNIST test set after both models were trained only on a stratified subset of the official training set.

## Selected model

- Model: RandomForestClassifier
- Baseline compared against: LogisticRegression
- Random seed: 42
- Training images: 10000
- Test images: 2000
- Accuracy: 94.65%
- Weighted precision: 94.67%
- Weighted recall: 94.65%
- Weighted F1: 94.64%
- Macro F1: 94.58%
- Training time: 16.27 s
- Median single-image inference: 64.06 ms
- Batch evaluation per image: 0.662 ms
- Single-image latency is the median of warmed-up predictions using one worker, which matches API requests.

## Comparison

| Model | Role | Accuracy | Weighted F1 | Macro F1 | Train time (s) | Median inference (ms) | Selected |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| LogisticRegression | baseline | 90.75% | 90.72% | 90.59% | 69.25 | 0.84 | no |
| RandomForestClassifier | primary | 94.65% | 94.64% | 94.58% | 16.27 | 64.06 | yes |

## Per-digit scores for the selected model

| Digit | Precision | Recall | F1 | Support |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 94.15% | 98.47% | 96.26% | 196 |
| 1 | 96.94% | 97.80% | 97.37% | 227 |
| 2 | 96.14% | 96.60% | 96.37% | 206 |
| 3 | 92.57% | 92.57% | 92.57% | 202 |
| 4 | 95.34% | 93.88% | 94.60% | 196 |
| 5 | 94.61% | 88.76% | 91.59% | 178 |
| 6 | 93.37% | 95.31% | 94.33% | 192 |
| 7 | 95.07% | 93.69% | 94.38% | 206 |
| 8 | 97.35% | 94.36% | 95.83% | 195 |
| 9 | 90.91% | 94.06% | 92.46% | 202 |

## Artifacts

- `backend/models/digit_model.joblib`
- `backend/artifacts/metrics.json`
- `backend/artifacts/confusion_matrix.json`
- `backend/artifacts/samples.json`
- `reports/confusion_matrix.png`
- `reports/model_comparison.png`
- `reports/per_digit_f1.png`
- `reports/sample_gallery.png`
