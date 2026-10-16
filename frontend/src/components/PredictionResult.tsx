import { useState } from "react";
import { formatLatency, formatPercent, modelLabel } from "../lib/format";
import type { Prediction } from "../types/api";
import { ConfidenceRing } from "./ConfidenceRing";
import { PipelineView } from "./PipelineView";
import { PixelGrid } from "./PixelGrid";
import { ProbabilityChart } from "./ProbabilityChart";

export function PredictionResult({ prediction }: { prediction: Prediction }) {
  const [inspect, setInspect] = useState(false);
  const leaders = prediction.ranked.slice(0, 3);
  const pixels = prediction.pixels ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ns-muted)]">Predicted digit</p>
          <p data-testid="predicted-digit" aria-live="polite" className="font-mono text-8xl leading-none">
            {prediction.digit}
          </p>
        </div>
        <ConfidenceRing value={prediction.confidence} />
      </div>
      <p className="text-sm leading-6 text-[var(--ns-muted)]">{resultMessage(prediction)}</p>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ns-muted)]">Top candidates</p>
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {leaders.map((item) => (
            <li key={item.digit} className="rounded-xl border border-[var(--ns-border)] px-3 py-2">
              <p className="font-mono text-xl">{item.digit}</p>
              <p className="text-xs text-[var(--ns-muted)]">{formatPercent(item.confidence)}</p>
            </li>
          ))}
        </ul>
      </div>
      <ProbabilityChart prediction={prediction} />
      <div className="flex items-center gap-4">
        <img
          src={prediction.preprocessed_image}
          alt="Preprocessed 28 by 28 model input"
          className="pixelated h-24 w-24 rounded-xl bg-black"
        />
        <div>
          <p className="text-sm font-medium">28×28 model input</p>
          <p className="mt-1 text-sm leading-6 text-[var(--ns-muted)]">
            {modelLabel(prediction.model_name)}
            {Number.isFinite(prediction.inference_ms) ? ` · ${formatLatency(prediction.inference_ms)} for this request` : " · timing was not stored with this result"}
          </p>
        </div>
      </div>
      <PipelineView prediction={prediction} />
      {pixels.length === 784 ? (
        <div>
          <button type="button" className="text-sm text-[var(--ns-accent-2)] underline" onClick={() => setInspect((value) => !value)}>
            {inspect ? "Hide pixel grid" : "Inspect 784 pixels"}
          </button>
          {inspect ? (
            <div className="mt-3">
              <PixelGrid pixels={pixels} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function resultMessage(prediction: Prediction): string {
  if (prediction.confidence < 0.45) {
    return `The leading class is ${prediction.digit}. Confidence is low, so a thicker centered stroke is more likely to match the training images.`;
  }
  if (prediction.confidence < 0.75) {
    return `The leading class is ${prediction.digit}. The remaining probability is spread across the other digits.`;
  }
  return `The leading class is ${prediction.digit}. Most of the model vote is concentrated on that digit.`;
}
