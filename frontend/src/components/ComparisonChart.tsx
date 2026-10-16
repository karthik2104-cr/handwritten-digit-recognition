import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartLegend, chartTick, chartTooltip } from "../lib/chartTheme";
import { modelLabel } from "../lib/format";
import type { ModelComparison } from "../types/api";

export function ComparisonChart({ comparison }: { comparison: ModelComparison[] }) {
  const data = comparison.map((item) => ({
    model: modelLabel(item.model),
    Accuracy: item.accuracy * 100,
    Precision: item.precision * 100,
    Recall: item.recall * 100,
    F1: item.f1 * 100,
  }));

  return (
    <div className="h-72 min-w-0" role="img" aria-label="Accuracy, precision, recall, and F1 for each model">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--ns-border)" vertical={false} />
          <XAxis dataKey="model" interval={0} stroke="var(--ns-muted)" tick={chartTick} />
          <YAxis domain={[0, 100]} stroke="var(--ns-muted)" tick={chartTick} width={40} />
          <Tooltip
            cursor={chartTooltip.cursor}
            contentStyle={chartTooltip.contentStyle}
            formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`]}
          />
          <Legend wrapperStyle={chartLegend} formatter={(value) => <span style={{ color: "var(--ns-text)" }}>{value}</span>} />
          <Bar dataKey="Accuracy" fill="#4f8cff" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Precision" fill="#36d9f5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Recall" fill="#8ba4ff" radius={[4, 4, 0, 0]} />
          <Bar dataKey="F1" fill="#f5c16c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
