import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioPage } from "../pages/StudioPage";
import * as api from "../services/api";
import type { Prediction } from "../types/api";

const context = {
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn(),
  fillStyle: "#000000",
  strokeStyle: "#ffffff",
  lineWidth: 1,
  lineCap: "round",
  lineJoin: "round",
};

const prediction: Prediction = {
  digit: 4,
  confidence: 0.81,
  probabilities: Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [String(digit), digit === 4 ? 0.81 : 0.021])),
  ranked: [{ digit: 4, confidence: 0.81 }, { digit: 9, confidence: 0.1 }, { digit: 1, confidence: 0.05 }],
  inference_ms: 12,
  model_name: "RandomForestClassifier",
  feature_count: 784,
  preprocessed_image: "data:image/png;base64,aaaa",
  pipeline: [],
  pixels: [],
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  localStorage.clear();
  const ink = new Uint8ClampedArray(16);
  ink.fill(255);
  context.getImageData.mockReturnValue({ data: ink, width: 2, height: 2 });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,aaa");
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Recognition Studio results", () => {
  it("clears a finished prediction when the canvas is cleared", async () => {
    vi.spyOn(api, "predictDrawing").mockResolvedValue(prediction);
    render(<StudioPage />);
    fireEvent.click(screen.getByTestId("predict-button"));
    expect(await screen.findByTestId("predicted-digit")).toHaveTextContent("4");
    fireEvent.click(screen.getByTestId("clear-button"));
    expect(screen.queryByTestId("predicted-digit")).toBeNull();
    expect(screen.getByText("Draw a digit from 0 to 9")).toBeTruthy();
  });

  it("ignores a prediction that finishes after the canvas is cleared", async () => {
    let finish: (value: Prediction) => void = () => undefined;
    vi.spyOn(api, "predictDrawing").mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    render(<StudioPage />);
    fireEvent.click(screen.getByTestId("predict-button"));
    expect(await screen.findByText("Classifying the digit")).toBeTruthy();
    fireEvent.click(screen.getByTestId("clear-button"));
    await act(async () => {
      finish(prediction);
    });
    expect(screen.queryByTestId("predicted-digit")).toBeNull();
    expect(localStorage.getItem("digit-prediction-history")).toBeNull();
  });
});
