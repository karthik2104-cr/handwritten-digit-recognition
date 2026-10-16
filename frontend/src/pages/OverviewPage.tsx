import { Link, useOutletContext } from "react-router-dom";
import { ComparisonChart } from "../components/ComparisonChart";
import { ConfusionMatrix } from "../components/ConfusionMatrix";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { LoadingBlock } from "../components/LoadingBlock";
import { MetricCard } from "../components/MetricCard";
import type { ShellHealth } from "../components/Layout";
import { useAsync } from "../hooks/useAsync";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePredictionHistory } from "../hooks/usePredictionHistory";
import { formatCount, formatLatency, formatPercent, formatWhen, modelLabel } from "../lib/format";
import { primaryButtonClass } from "../lib/styles";
import { getConfusionMatrix, getMetrics, getModelInfo, getSamples } from "../services/api";

export function OverviewPage() {
  usePageTitle("Overview");
  const health = useOutletContext<ShellHealth>();
  const metrics = useAsync(() => getMetrics(), []);
  const info = useAsync(() => getModelInfo(), []);
  const matrix = useAsync(() => getConfusionMatrix(), []);
  const sample = useAsync(() => getSamples({ page: 1, pageSize: 1, outcome: "correct" }), []);
  const history = usePredictionHistory();
  const loading = metrics.loading || info.loading;
  const error = metrics.error ?? info.error;

  return (
    <div className="space-y-5">
      <section className="ns-card flex flex-wrap items-end justify-between gap-4 p-5">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ns-accent-2)]">Welcome</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">Draw a digit and recognize it.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ns-muted)]">
            Neural Studio turns a 28×28 grayscale digit into 784 features and asks the saved random forest which class from 0 to 9 it is. The status pill follows the live API health check.
          </p>
        </div>
        <Link to="/studio" className={primaryButtonClass}>
          Open Recognition Studio
        </Link>
      </section>

      {loading ? <LoadingBlock label="Loading evaluation results" /> : null}
      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => {
            metrics.reload();
            info.reload();
            matrix.reload();
          }}
        />
      ) : null}

      {metrics.data && info.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Test accuracy" value={formatPercent(metrics.data.accuracy, 2)} detail="Held-out images predicted correctly" />
            <MetricCard label="Weighted F1" value={formatPercent(metrics.data.f1, 2)} detail="Precision and recall, weighted by support" />
            <MetricCard label="Median inference" value={formatLatency(metrics.data.inference_ms_median)} detail="Single-image timing on the test subset, not a production guarantee" />
            <MetricCard label="Test images" value={formatCount(metrics.data.test_samples)} detail={`${formatCount(metrics.data.train_samples)} training images · seed ${metrics.data.random_seed}`} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Baseline versus {modelLabel(metrics.data.best_model)}</h2>
              <p className="mt-1 text-sm text-[var(--ns-muted)]">
                Both models were scored on the same stratified subset: {formatCount(metrics.data.train_samples)} training images and {formatCount(metrics.data.test_samples)} test images, seed {info.data.random_seed}.
              </p>
              <div className="mt-4">
                <ComparisonChart comparison={metrics.data.comparison} />
              </div>
            </article>
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Connection and dataset</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Backend" value={health.status} />
                <Row label="Model" value={modelLabel(health.data?.model_name ?? info.data.model_name)} />
                <Row label="Source" value={info.data.dataset_name} />
                <Row label="Image" value={`${info.data.image_width}×${info.data.image_height}`} />
                <Row label="Features" value={String(info.data.feature_count)} />
              </dl>
              <p className="mt-4 text-sm leading-6 text-[var(--ns-muted)]">{info.data.official_split}</p>
            </article>
          </section>
          <section className="grid min-w-0 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Confusion matrix preview</h2>
              <p className="mt-1 mb-4 text-sm text-[var(--ns-muted)]">Rows are actual digits. Columns are predictions. Choose a cell to open those test images.</p>
              {matrix.data ? <ConfusionMatrix labels={matrix.data.labels} matrix={matrix.data.matrix} compact /> : matrix.error ? <ErrorNotice message={matrix.error} onRetry={matrix.reload} /> : <LoadingBlock label="Loading the matrix" />}
            </article>
            <article className="ns-card p-5">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <p className="mt-1 text-xs text-[var(--ns-muted)]">From this browser</p>
              {history.entries.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="No predictions yet" body="Recognitions you make in the studio appear here." />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {history.entries.slice(0, 4).map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3">
                      <img src={entry.source || entry.preview} alt="" className="pixelated h-12 w-12 rounded-lg bg-black" />
                      <div>
                        <p className="font-mono text-lg">{entry.digit}</p>
                        <p className="text-xs text-[var(--ns-muted)]">
                          {formatPercent(entry.confidence)} · {formatWhen(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {sample.data?.items[0] ? (
                <p className="mt-4 text-sm leading-6 text-[var(--ns-muted)]">
                  A held-out test image of digit {sample.data.items[0].actual} is flattened left to right into {info.data.feature_count} features. Brighter pixels are closer to 1 after dividing by 255.
                </p>
              ) : null}
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--ns-border)] pb-2">
      <dt className="text-[var(--ns-muted)]">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
