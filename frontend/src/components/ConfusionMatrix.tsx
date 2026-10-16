import { Link } from "react-router-dom";

export function ConfusionMatrix({
  labels,
  matrix,
  compact = false,
}: {
  labels: number[];
  matrix: number[][];
  compact?: boolean;
}) {
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const total = flat.reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `auto repeat(${labels.length}, minmax(${compact ? "1.6rem" : "2.4rem"}, 1fr))`, minWidth: compact ? 420 : 640 }}
        >
          <span />
          {labels.map((label) => (
            <span key={`predicted-${label}`} className="pb-1 text-center text-[11px] text-[var(--ns-muted)]">
              {label}
            </span>
          ))}
          {matrix.map((row, rowIndex) => {
            const rowTotal = row.reduce((sum, value) => sum + value, 0);
            return (
              <div key={`row-${labels[rowIndex]}`} className="contents">
                <span className="pr-2 text-right text-[11px] leading-8 text-[var(--ns-muted)]">{labels[rowIndex]}</span>
                {row.map((value, columnIndex) => {
                  const actual = labels[rowIndex] ?? rowIndex;
                  const predicted = labels[columnIndex] ?? columnIndex;
                  const correct = rowIndex === columnIndex;
                  const share = rowTotal === 0 ? 0 : (value / rowTotal) * 100;
                  const overall = total === 0 ? 0 : (value / total) * 100;
                  return (
                    <Link
                      key={`${actual}-${predicted}`}
                      to={`/explorer?actual=${actual}&predicted=${predicted}&page=1`}
                      className="relative grid h-8 place-items-center rounded-md text-[11px] font-medium"
                      style={cellStyle(value, max)}
                      aria-label={`Actual ${actual}, predicted ${predicted}, ${value} images, ${share.toFixed(1)} percent of digit ${actual}, ${overall.toFixed(1)} percent of the test subset. ${correct ? "Correct prediction." : "Misclassification."}`}
                    >
                      {value}
                      <span
                        className={`absolute bottom-0.5 h-1 w-1 rounded-full ${correct ? "bg-[var(--ns-text)]" : value > 0 ? "bg-[var(--ns-danger)]" : "bg-transparent"}`}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ns-muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-8 rounded-sm" style={{ background: "linear-gradient(90deg, rgba(79,140,255,0.15), #4f8cff)" }} />
          Count, light to dark
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ns-text)]" />
          Diagonal, correct
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ns-danger)]" />
          Off-diagonal error
        </span>
        <span>{total.toLocaleString()} evaluated images</span>
      </div>
    </div>
  );
}

function cellStyle(value: number, max: number): { backgroundColor: string; color: string } {
  const intensity = max === 0 ? 0 : value / max;
  const alpha = value === 0 ? 0.08 : 0.16 + intensity * 0.84;
  return {
    backgroundColor: `rgba(79, 140, 255, ${alpha})`,
    color: intensity > 0.62 ? "#06101f" : "var(--ns-text)",
  };
}
