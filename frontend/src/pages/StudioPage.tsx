import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { LoadingBlock } from "../components/LoadingBlock";
import { PredictionResult } from "../components/PredictionResult";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePredictionHistory } from "../hooks/usePredictionHistory";
import { formatPercent, formatWhen } from "../lib/format";
import type { HistoryEntry } from "../lib/history";
import { quietButtonClass } from "../lib/styles";
import { predictDrawing, predictUpload, toErrorMessage } from "../services/api";
import type { Prediction } from "../types/api";

export function StudioPage() {
  usePageTitle("Recognition Studio");
  const history = usePredictionHistory();
  const [brush, setBrush] = useState(32);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const busy = useRef(false);
  const flight = useRef(0);

  const selected = history.entries.find((entry) => entry.id === selectedId) ?? null;
  const viewed = selected ? fromHistory(selected) : prediction;

  function resetView() {
    flight.current += 1;
    busy.current = false;
    setPredicting(false);
    setPrediction(null);
    setSelectedId(null);
    setError(null);
  }

  async function execute(task: () => Promise<{ prediction: Prediction; source?: string }>) {
    if (busy.current) return;
    const id = ++flight.current;
    busy.current = true;
    setPredicting(true);
    setPrediction(null);
    setSelectedId(null);
    setError(null);
    try {
      const next = await task();
      if (id !== flight.current) return;
      setPrediction(next.prediction);
      history.add({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        digit: next.prediction.digit,
        confidence: next.prediction.confidence,
        createdAt: new Date().toISOString(),
        preview: next.prediction.preprocessed_image,
        source: next.source,
        probabilities: next.prediction.probabilities,
        ranked: next.prediction.ranked,
        inferenceMs: next.prediction.inference_ms,
        modelName: next.prediction.model_name,
      });
    } catch (caught) {
      if (id !== flight.current) return;
      setPrediction(null);
      setError(toErrorMessage(caught));
    } finally {
      if (id === flight.current) {
        busy.current = false;
        setPredicting(false);
      }
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file || busy.current) return;
    const type = file.type.toLowerCase();
    if (type && type !== "application/octet-stream" && !type.startsWith("image/")) {
      resetView();
      setError("Choose a PNG, JPEG, WebP, or BMP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      resetView();
      setError("Image exceeds the 2 MB upload limit.");
      return;
    }
    await execute(async () => ({ prediction: await predictUpload(file), source: await fileToDataUrl(file) }));
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-[var(--ns-muted)]">
        Draw one digit or upload a picture. The same preprocessing used in training prepares a 28×28 image, then the saved random forest scores digits 0 through 9.
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <section className="ns-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Drawing workspace</h2>
            <label className={`${quietButtonClass} cursor-pointer`}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp"
                className="sr-only"
                disabled={predicting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void onUpload(file);
                }}
              />
            </label>
          </div>
          <DrawingCanvas
            brush={brush}
            onBrushChange={setBrush}
            predicting={predicting}
            onClear={resetView}
            onBlank={() => {
              resetView();
              setError("No digit was detected. Draw a digit before predicting.");
            }}
            onPredict={(dataUrl) => void execute(async () => ({ prediction: await predictDrawing(dataUrl), source: dataUrl }))}
          />
        </section>
        <section className="ns-card p-4 sm:p-5" aria-busy={predicting}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Prediction</h2>
            {selected ? (
              <button type="button" className="text-xs text-[var(--ns-accent-2)] underline" onClick={() => setSelectedId(null)}>
                Back to latest
              </button>
            ) : null}
          </div>
          {selected ? <p className="mb-3 text-xs text-[var(--ns-muted)]">Saved in this browser · {formatWhen(selected.createdAt)}</p> : null}
          {error && !selected ? <ErrorNotice message={error} /> : null}
          {predicting && !selected ? <LoadingBlock label="Classifying the digit" /> : null}
          {viewed ? (
            <PredictionResult prediction={viewed} />
          ) : selected ? (
            <div className="space-y-3">
              <p className="font-mono text-7xl">{selected.digit}</p>
              <p className="text-sm text-[var(--ns-muted)]">{formatPercent(selected.confidence)} confidence</p>
              <img src={selected.preview} alt="Preprocessed 28 by 28 model input" className="pixelated h-24 w-24 rounded-xl bg-black" />
              <p className="text-sm text-[var(--ns-muted)]">Class scores were not stored for this earlier result.</p>
            </div>
          ) : !predicting && !error ? (
            <EmptyState
              title="Draw a digit from 0 to 9"
              body="The canvas is dark and the ink is light, matching MNIST. Predict Digit sends the drawing to the trained model."
            />
          ) : null}
        </section>
      </div>
      <section className="ns-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Recent predictions</h2>
        <p className="mt-1 text-sm text-[var(--ns-muted)]">Stored in this browser. Select one to compare it with the current result.</p>
        {history.entries.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No saved predictions" body="Each successful recognition is kept locally, with the image, digit, confidence, and time." />
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {history.entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${selectedId === entry.id ? "border-[var(--ns-accent-2)]" : "border-[var(--ns-border)]"}`}
                >
                  <img src={entry.source || entry.preview} alt="" className="pixelated h-14 w-14 rounded-lg bg-black" />
                  <span>
                    <span className="block font-mono text-2xl">{entry.digit}</span>
                    <span className="block text-xs text-[var(--ns-muted)]">
                      {formatPercent(entry.confidence)} · {formatWhen(entry.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function fromHistory(entry: HistoryEntry): Prediction | null {
  if (!entry.probabilities || !entry.ranked) return null;
  return {
    digit: entry.digit,
    confidence: entry.confidence,
    probabilities: entry.probabilities,
    ranked: entry.ranked,
    inference_ms: entry.inferenceMs ?? Number.NaN,
    model_name: entry.modelName ?? "RandomForestClassifier",
    feature_count: 784,
    preprocessed_image: entry.preview,
  };
}

function fileToDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}
