import { useState } from "react";

export function PixelGrid({ pixels }: { pixels: number[] }) {
  const [selected, setSelected] = useState(0);
  const value = pixels[selected] ?? 0;
  const row = Math.floor(selected / 28);
  const column = selected % 28;

  return (
    <div className="space-y-3">
      <div
        className="grid w-full max-w-[336px] grid-cols-[repeat(28,minmax(0,1fr))] gap-px rounded-xl bg-black p-1"
        role="grid"
        aria-label="Final 28 by 28 pixel intensities"
      >
        {pixels.slice(0, 784).map((pixel, index) => {
          const shade = Math.round(Math.min(1, Math.max(0, pixel)) * 255);
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={`Row ${Math.floor(index / 28) + 1}, column ${(index % 28) + 1}, intensity ${pixel.toFixed(2)}`}
              className={`aspect-square min-h-0 min-w-0 ${index === selected ? "ring-1 ring-[var(--ns-accent-2)]" : ""}`}
              style={{ background: `rgb(${shade} ${shade} ${shade})` }}
              onMouseEnter={() => setSelected(index)}
              onFocus={() => setSelected(index)}
            />
          );
        })}
      </div>
      <p className="font-mono text-xs text-[var(--ns-muted)]">
        Row {row + 1}, column {column + 1}, intensity {value.toFixed(3)} ({Math.round(value * 255)} / 255)
      </p>
    </div>
  );
}
