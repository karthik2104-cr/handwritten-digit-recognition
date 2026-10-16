import { useState } from "react";
import { modelLabel } from "../lib/format";
import type { PipelineStage, Prediction } from "../types/api";

export function PipelineView({ prediction }: { prediction: Prediction }) {
  const stages = prediction.pipeline ?? [];
  const [open, setOpen] = useState<string | null>(stages[0]?.key ?? null);
  if (stages.length === 0) return null;
  const active = stages.find((stage) => stage.key === open) ?? stages[0];

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Image processing pipeline</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--ns-muted)]">These previews are the images produced while preparing this prediction.</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <li key={stage.key} className="min-w-0">
            <StageButton stage={stage} index={index} active={active.key === stage.key} onSelect={() => setOpen(stage.key)} />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setOpen("prediction")}
            className={`h-full w-full rounded-xl border p-2 text-left ${open === "prediction" ? "border-[var(--ns-accent-2)]" : "border-[var(--ns-border)]"}`}
          >
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ns-muted)]">06</p>
            <p className="mt-1 text-xs font-medium">Model Prediction</p>
            <p className="mt-2 font-mono text-2xl">{prediction.digit}</p>
          </button>
        </li>
      </ol>
      {open === "prediction" ? (
        <p className="text-sm leading-6 text-[var(--ns-muted)]">
          {modelLabel(prediction.model_name)} votes across ten classes. The largest share is the predicted digit.
        </p>
      ) : (
        <div className="flex gap-4">
          <img src={active.image} alt={active.title} className="pixelated h-28 w-28 rounded-xl bg-black" />
          <div>
            <p className="text-sm font-medium">{active.title}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--ns-muted)]">{active.detail}</p>
            <p className="mt-2 font-mono text-xs text-[var(--ns-muted)]">
              {active.width}×{active.height}
              {active.key === "final" ? " model input" : ""}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StageButton({
  stage,
  index,
  active,
  onSelect,
}: {
  stage: PipelineStage;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-xl border p-2 text-left ${active ? "border-[var(--ns-accent-2)]" : "border-[var(--ns-border)]"}`}
    >
      <img src={stage.image} alt="" className="pixelated mx-auto h-14 w-14 rounded-lg bg-black" />
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ns-muted)]">0{index + 1}</p>
      <p className="text-xs font-medium leading-4">{stage.title}</p>
    </button>
  );
}
