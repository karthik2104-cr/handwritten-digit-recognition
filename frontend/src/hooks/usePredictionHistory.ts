import { useState } from "react";
import { pushHistory, readHistory, type HistoryEntry } from "../lib/history";

export function usePredictionHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => readHistory());

  function add(entry: HistoryEntry) {
    setEntries(pushHistory(entry));
  }

  return { entries, add };
}
