export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="ns-card px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--ns-muted)]">{label}</p>
      <p className="mt-2 font-mono text-2xl">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--ns-muted)]">{detail}</p> : null}
    </article>
  );
}
