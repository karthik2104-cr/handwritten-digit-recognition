import { describe, expect, it } from "vitest";
import { formatDuration, formatLatency, formatPercent } from "../lib/format";
import { topConfusions } from "../lib/confusion";
import { pushHistory, readHistory, type HistoryEntry } from "../lib/history";

describe("formatting", () => {
  it("formats model scores and timings", () => {
    expect(formatPercent(0.948)).toBe("94.8%");
    expect(formatLatency(12.34)).toBe("12.3 ms");
    expect(formatLatency(1500)).toBe("1.50 s");
    expect(formatDuration(75)).toBe("1m 15s");
  });
});

describe("confusion helpers", () => {
  it("ranks off-diagonal mistakes", () => {
    const matrix = [
      [10, 0],
      [4, 6],
    ];
    expect(topConfusions(matrix, [4, 9], 1)).toEqual([{ actual: 9, predicted: 4, count: 4 }]);
  });
});

describe("prediction history", () => {
  it("keeps the newest prediction first", () => {
    localStorage.clear();
    const older: HistoryEntry = {
      id: "a",
      digit: 1,
      confidence: 0.5,
      createdAt: "2026-01-01T00:00:00.000Z",
      preview: "data:image/png;base64,aa",
    };
    const newer: HistoryEntry = { ...older, id: "b", digit: 8 };
    pushHistory(older);
    const stored = pushHistory(newer);
    expect(stored[0]?.digit).toBe(8);
    expect(readHistory()[1]?.digit).toBe(1);
  });
});
