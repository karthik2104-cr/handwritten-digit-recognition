import type { ConfusionMatrixData, Health, Metrics, ModelInfo, Prediction, SamplePage, SampleQuery } from "../types/api";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "The recognition service is unavailable. Start the backend and try again.";
  }
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "The recognition service is unavailable. Start the backend and try again.",
        0,
        "network_error",
      );
    }
    throw error;
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || "Request failed.";
  let code: string | undefined;
  try {
    const body = (await response.json()) as { detail?: unknown; code?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) message = body.detail;
    if (typeof body.code === "string") code = body.code;
  } catch {
    // The response body was not JSON.
  }
  return new ApiError(message, response.status, code);
}

export function getHealth(): Promise<Health> {
  return request<Health>("/api/health");
}

export function getMetrics(): Promise<Metrics> {
  return request<Metrics>("/api/metrics");
}

export function getModelInfo(): Promise<ModelInfo> {
  return request<ModelInfo>("/api/model-info");
}

export function getConfusionMatrix(): Promise<ConfusionMatrixData> {
  return request<ConfusionMatrixData>("/api/confusion-matrix");
}

export function getSamples(query: SampleQuery = {}): Promise<SamplePage> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 12));
  if (query.outcome && query.outcome !== "all") params.set("outcome", query.outcome);
  if (query.digit) params.set("digit", query.digit);
  if (query.actual) params.set("actual", query.actual);
  if (query.predicted) params.set("predicted", query.predicted);
  return request<SamplePage>(`/api/samples?${params.toString()}`);
}

export function predictDrawing(imageBase64: string): Promise<Prediction> {
  return request<Prediction>("/api/predict/drawing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
}

export function predictUpload(file: File): Promise<Prediction> {
  const body = new FormData();
  body.append("file", file);
  return request<Prediction>("/api/predict", { method: "POST", body });
}
