export interface ClassProbability {
  digit: number;
  confidence: number;
}

export interface PipelineStage {
  key: string;
  title: string;
  detail: string;
  image: string;
  width: number;
  height: number;
}

export interface Prediction {
  digit: number;
  confidence: number;
  probabilities: Record<string, number>;
  ranked: ClassProbability[];
  inference_ms: number;
  model_name: string;
  feature_count: number;
  preprocessed_image: string;
  pipeline?: PipelineStage[];
  pixels?: number[];
}

export interface Health {
  status: "ok" | "degraded";
  model_loaded: boolean;
  model_name: string | null;
  classes: number[];
  artifacts_loaded: boolean;
  detail: string | null;
}

export interface PerDigitMetric {
  digit: number;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ModelComparison {
  model: string;
  role: "baseline" | "primary";
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  macro_f1: number;
  training_time_s: number;
  inference_ms_median: number;
  selected: boolean;
}

export interface ClassCount {
  digit: number;
  count: number;
}

export interface Metrics {
  best_model: string;
  baseline_model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  test_samples: number;
  train_samples: number;
  inference_ms_mean: number;
  inference_ms_median: number;
  batch_ms_per_image: number;
  training_time_s: number;
  per_digit: PerDigitMetric[];
  comparison: ModelComparison[];
  train_class_counts: ClassCount[];
  test_class_counts: ClassCount[];
  generated_at: string;
  random_seed: number;
}

export interface ConfusionMatrixData {
  labels: number[];
  matrix: number[][];
  test_samples: number;
}

export interface SampleItem {
  id: number;
  actual: number;
  predicted: number;
  confidence: number;
  correct: boolean;
  image: string;
}

export interface SamplePage {
  items: SampleItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ModelInfo {
  model_name: string;
  model_type: string;
  baseline_model: string;
  classes: number[];
  dataset_name: string;
  dataset_source: string;
  dataset_url: string;
  image_height: number;
  image_width: number;
  feature_count: number;
  normalization: string;
  random_seed: number;
  train_samples: number;
  test_samples: number;
  official_split: string;
  parameters: Record<string, string | number | boolean | null>;
  library_versions: Record<string, string>;
  python_version: string;
  trained_at: string;
  notes: string[];
  metrics: Metrics;
}

export interface SampleQuery {
  page?: number;
  pageSize?: number;
  digit?: string;
  actual?: string;
  predicted?: string;
  outcome?: string;
}
