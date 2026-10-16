import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAsync } from "../hooks/useAsync";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatPercent } from "../lib/format";
import { quietButtonClass } from "../lib/styles";
import { getSamples } from "../services/api";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function ExplorerPage() {
  usePageTitle("Prediction Explorer");
  const [params, setParams] = useSearchParams();
  const outcome = params.get("outcome") ?? "all";
  const digit = params.get("digit") ?? "";
  const actual = params.get("actual") ?? "";
  const predicted = params.get("predicted") ?? "";
  const parsedPage = Number(params.get("page") ?? "1");
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const samples = useAsync(
    () => getSamples({ page, pageSize: 12, outcome, digit, actual, predicted }),
    [page, outcome, digit, actual, predicted],
  );

  function update(next: Record<string, string | null>) {
    const updated = new URLSearchParams(params);
    updated.set("page", "1");
    for (const [key, value] of Object.entries(next)) {
      if (!value) updated.delete(key);
      else updated.set(key, value);
    }
    setParams(updated);
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-[var(--ns-muted)]">
        These are the test images used to score the deployed model. Actual and predicted labels are shown together, with the model’s confidence.
      </p>
      <section className="ns-card space-y-4 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Outcome">
          {[
            ["all", "All"],
            ["correct", "Correct"],
            ["incorrect", "Misclassified"],
          ].map(([value, label]) => (
            <FilterChip key={value} active={outcome === value} label={label} onClick={() => update({ outcome: value === "all" ? null : value })} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Digit">
          <FilterChip active={digit === "" && actual === "" && predicted === ""} onClick={() => update({ digit: null, actual: null, predicted: null })} label="Any digit" />
          {DIGITS.map((value) => (
            <FilterChip key={value} active={digit === value} label={value} onClick={() => update({ digit: value, actual: null, predicted: null })} />
          ))}
        </div>
        {actual || predicted ? (
          <p className="flex flex-wrap items-center gap-3 text-sm text-[var(--ns-muted)]">
            Showing actual {actual || "any"} predicted as {predicted || "any"}.
            <button type="button" className="text-[var(--ns-accent-2)] underline" onClick={() => update({ actual: null, predicted: null })}>
              Clear cell filter
            </button>
          </p>
        ) : null}
      </section>

      {samples.loading ? <LoadingBlock label="Loading test images" /> : null}
      {samples.error ? <ErrorNotice message={samples.error} onRetry={samples.reload} /> : null}
      {samples.data && samples.data.items.length === 0 ? (
        <EmptyState title="No matching images" body="Try another digit or clear the filters. The saved test subset may not contain this combination." />
      ) : null}
      {samples.data && samples.data.items.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {samples.data.items.map((item) => (
              <article key={item.id} className="ns-card p-3">
                <img
                  src={item.image}
                  alt={`Handwritten ${item.actual}, predicted ${item.predicted}`}
                  className="pixelated mx-auto h-28 w-28 rounded-xl bg-black"
                />
                <p className={`mt-3 text-xs font-medium uppercase tracking-[0.12em] ${item.correct ? "text-[var(--ns-ok)]" : "text-[var(--ns-danger)]"}`}>
                  {item.correct ? "Match" : "Miss"}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-[var(--ns-muted)]">Actual</dt>
                    <dd className="font-mono text-2xl">{item.actual}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--ns-muted)]">Predicted</dt>
                    <dd className="font-mono text-2xl">{item.predicted}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[var(--ns-muted)]">{formatPercent(item.confidence)} confidence</p>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className={quietButtonClass}>
              Previous
            </button>
            <p className="text-sm text-[var(--ns-muted)]">
              Page {samples.data.page} of {Math.max(samples.data.total_pages, 1)} · {samples.data.total} images
            </p>
            <button type="button" disabled={page >= samples.data.total_pages} onClick={() => update({ page: String(page + 1) })} className={quietButtonClass}>
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm ${active ? "bg-[var(--ns-accent)] text-white" : "border border-[var(--ns-border)] text-[var(--ns-text)]"}`}
    >
      {label}
    </button>
  );
}
