import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTick, chartTooltip } from "../lib/chartTheme";
import { formatPercent } from "../lib/format";
import type { Prediction } from "../types/api";

export function ProbabilityChart({ prediction }: { prediction: Prediction }) {
  const data = Array.from({ length: 10 }, (_, digit) => ({
    digit: String(digit),
    confidence: prediction.probabilities[String(digit)] ?? 0,
  }));

  return (
    <div className="h-64" role="img" aria-label="Probability of each digit from 0 to 9">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--ns-border)" vertical={false} />
          <XAxis dataKey="digit" stroke="var(--ns-muted)" tick={chartTick} />
          <YAxis
            domain={[0, 1]}
            stroke="var(--ns-muted)"
            tick={chartTick}
            tickFormatter={(value: number) => `${Math.round(value * 100)}`}
            width={36}
          />
          <Tooltip
            cursor={chartTooltip.cursor}
            contentStyle={chartTooltip.contentStyle}
            formatter={(value) => [formatPercent(Number(value ?? 0)), "Confidence"]}
          />
          <Bar dataKey="confidence" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.digit} fill={entry.digit === String(prediction.digit) ? "#36d9f5" : "#4f8cff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
