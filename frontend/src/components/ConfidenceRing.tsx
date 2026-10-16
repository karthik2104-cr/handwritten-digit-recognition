import { formatPercent } from "../lib/format";

export function ConfidenceRing({ value }: { value: number }) {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div className="relative h-24 w-24" role="img" aria-label={`${formatPercent(clamped)} confidence`}>
      <svg viewBox="0 0 88 88" className="h-24 w-24 -rotate-90">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--ns-border)" strokeWidth="6" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="var(--ns-accent-2)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-sm text-[var(--ns-text)]">{formatPercent(clamped)}</span>
    </div>
  );
}
