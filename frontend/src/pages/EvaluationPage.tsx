import { ComparisonChart } from "../components/ComparisonChart";
import { ConfusionMatrix } from "../components/ConfusionMatrix";
import { ErrorNotice } from "../components/ErrorNotice";
import { LoadingBlock } from "../components/LoadingBlock";
import { MetricCard } from "../components/MetricCard";
import { PerDigitChart } from "../components/PerDigitChart";
import { useAsync } from "../hooks/useAsync";
import { usePageTitle } from "../hooks/usePageTitle";
import { topConfusions } from "../lib/confusion";
import { formatCount, formatDuration, formatLatency, formatPercent, modelLabel } from "../lib/format";
import { getConfusionMatrix, getMetrics, getModelInfo } from "../services/api";

export function EvaluationPage() {
  usePageTitle("Model Evaluation");
  const metricsState = useAsync(() => getMetrics(), []);
  const matrixState = useAsync(() => getConfusionMatrix(), []);
  const infoState = useAsync(() => getModelInfo(), []);
  const loading = metricsState.loading || matrixState.loading || infoState.loading;
  const error = metricsState.error ?? matrixState.error ?? infoState.error;
  const metrics = metricsState.data;
  const matrix = matrixState.data;
  const info = infoState.data;
  const confusions = matrix ? topConfusions(matrix.matrix, matrix.labels, 5).filter((item) => item.count > 0) : [];
  const baseline = metrics?.comparison.find((item) => item.role === "baseline");

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-[var(--ns-muted)]">
        Scores come from the saved test predictions. The run uses a stratified subset drawn separately from the official MNIST training and test pools. It is not a score for all 60,000 training images.
      </p>
      {loading ? <LoadingBlock label="Loading metrics" /> : null}
      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => {
            metricsState.reload();
            matrixState.reload();
            infoState.reload();
          }}
        />
      ) : null}
      {metrics && matrix && info ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Test accuracy" value={formatPercent(metrics.accuracy, 2)} detail={`${formatCount(metrics.test_samples)} held-out images`} />
            <MetricCard label="Weighted F1" value={formatPercent(metrics.f1, 2)} detail={`Macro F1 ${formatPercent(metrics.macro_f1, 2)}`} />
            <MetricCard label="Median inference" value={formatLatency(metrics.inference_ms_median)} detail="Timed on the evaluation subset, not a production guarantee" />
            <MetricCard label="Training time" value={formatDuration(metrics.training_time_s)} detail={modelLabel(metrics.best_model)} />
          </section>

          <section className="ns-card p-5">
            <h2 className="text-lg font-semibold">Confusion matrix</h2>
            <p className="mt-1 mb-2 text-sm text-[var(--ns-muted)]">
              The vertical axis is the actual digit. The horizontal axis is the predicted digit. A cell shows how many test images landed there. Choose a cell to filter Prediction Explorer.
            </p>
            <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--ns-muted)]">Predicted digit</p>
            <ConfusionMatrix labels={matrix.labels} matrix={matrix.matrix} />
            <ul className="mt-4 space-y-1 text-sm text-[var(--ns-muted)]">
              {confusions.length === 0 ? (
                <li>The saved test subset has no off-diagonal mistakes.</li>
              ) : (
                confusions.map((item) => (
                  <li key={`${item.actual}-${item.predicted}`}>
                    {item.count} image{item.count === 1 ? "" : "s"} with actual {item.actual} predicted as {item.predicted}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="ns-card overflow-x-auto p-5">
            <h2 className="text-lg font-semibold">Classification metrics</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--ns-muted)]">Precision, recall, F1, and support for every digit, plus weighted and macro averages.</p>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--ns-muted)]">
                <tr>
                  <th className="py-2 font-medium">Digit</th>
                  <th className="py-2 text-right font-medium">Precision</th>
                  <th className="py-2 text-right font-medium">Recall</th>
                  <th className="py-2 text-right font-medium">F1</th>
                  <th className="py-2 text-right font-medium">Support</th>
                </tr>
              </thead>
              <tbody>
                {metrics.per_digit.map((row) => (
                  <tr key={row.digit} className="border-t border-[var(--ns-border)]">
                    <td className="py-2 font-mono">{row.digit}</td>
                    <td className="py-2 text-right font-mono">{formatPercent(row.precision, 2)}</td>
                    <td className="py-2 text-right font-mono">{formatPercent(row.recall, 2)}</td>
                    <td className="py-2 text-right font-mono">{formatPercent(row.f1, 2)}</td>
                    <td className="py-2 text-right font-mono">{formatCount(row.support)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--ns-border)]">
                  <td className="py-2">Weighted average</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.precision, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.recall, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.f1, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatCount(metrics.test_samples)}</td>
                </tr>
                <tr>
                  <td className="py-2">Macro average</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.macro_precision, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.macro_recall, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatPercent(metrics.macro_f1, 2)}</td>
                  <td className="py-2 text-right font-mono">{formatCount(metrics.test_samples)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Per-digit precision, recall, and F1</h2>
              <p className="mt-1 mb-3 text-sm text-[var(--ns-muted)]">Lower recall means more of that digit was missed. Lower precision means the model used that label too often.</p>
              <PerDigitChart rows={metrics.per_digit} />
            </article>
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Model comparison</h2>
              <p className="mt-1 text-sm text-[var(--ns-muted)]">
                {modelLabel(baseline?.model)} reached {baseline ? formatPercent(baseline.accuracy, 2) : "its recorded accuracy"}. {modelLabel(metrics.best_model)} is the deployed model.
              </p>
              <div className="mt-4">
                <ComparisonChart comparison={metrics.comparison} />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {metrics.comparison.map((item) => (
                  <li key={item.model} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ns-border)] px-3 py-2">
                    <span>
                      {modelLabel(item.model)}
                      {item.selected ? " · deployed" : " · baseline"}
                    </span>
                    <span className="font-mono text-xs text-[var(--ns-muted)]">
                      train {formatDuration(item.training_time_s)} · {formatLatency(item.inference_ms_median)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
