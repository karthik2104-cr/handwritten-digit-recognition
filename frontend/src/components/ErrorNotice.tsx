import { AlertTriangle } from "lucide-react";

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--ns-danger)]/40 bg-[color-mix(in_srgb,var(--ns-danger)_12%,transparent)] px-4 py-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium">
          Try again
        </button>
      ) : null}
    </div>
  );
}
