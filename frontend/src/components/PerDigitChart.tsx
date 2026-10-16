import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartLegend, chartTick, chartTooltip } from "../lib/chartTheme";
import type { PerDigitMetric } from "../types/api";

export function PerDigitChart({ rows }: { rows: PerDigitMetric[] }) {
  const data = rows.map((row) => ({
    digit: String(row.digit),
    Precision: row.precision * 100,
    Recall: row.recall * 100,
    F1: row.f1 * 100,
  }));

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="h-80 min-w-[640px]" role="img" aria-label="Precision, recall, and F1 for digits 0 through 9">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--ns-border)" vertical={false} />
            <XAxis dataKey="digit" stroke="var(--ns-muted)" tick={chartTick} />
            <YAxis domain={[0, 100]} stroke="var(--ns-muted)" tick={chartTick} width={40} />
            <Tooltip
              cursor={chartTooltip.cursor}
              contentStyle={chartTooltip.contentStyle}
              formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`]}
            />
            <Legend wrapperStyle={chartLegend} formatter={(value) => <span style={{ color: "var(--ns-text)" }}>{value}</span>} />
            <Bar dataKey="Precision" fill="#4f8cff" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Recall" fill="#36d9f5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="F1" fill="#f5c16c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
