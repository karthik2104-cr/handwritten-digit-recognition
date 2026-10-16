export interface HistoryEntry {
  id: string;
  digit: number;
  confidence: number;
  createdAt: string;
  preview: string;
  source?: string;
  probabilities?: Record<string, number>;
  ranked?: { digit: number; confidence: number }[];
  inferenceMs?: number;
  modelName?: string;
}

const STORAGE_KEY = "digit-prediction-history";
const LIMIT = 8;

export function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...readHistory().filter((item) => item.id !== entry.id)].slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.digit === "number" &&
    typeof entry.confidence === "number" &&
    typeof entry.createdAt === "string" &&
    typeof entry.preview === "string"
  );
}
