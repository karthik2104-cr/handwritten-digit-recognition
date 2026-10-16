export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="ns-card flex items-center gap-3 px-4 py-5 text-sm text-[var(--ns-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ns-border)] border-t-[var(--ns-accent-2)]" />
      <span className="h-2 flex-1 animate-pulse rounded bg-[var(--ns-border)]" />
      <span>{label}</span>
    </div>
  );
}
