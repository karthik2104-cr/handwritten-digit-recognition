import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorNotice } from "../components/ErrorNotice";
import { PredictionResult } from "../components/PredictionResult";
import type { Prediction } from "../types/api";

vi.mock("../components/ProbabilityChart", () => ({
  ProbabilityChart: () => <div>Probability chart</div>,
}));

const prediction: Prediction = {
  digit: 7,
  confidence: 0.92,
  probabilities: Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [String(digit), digit === 7 ? 0.92 : 0.008888])),
  ranked: Array.from({ length: 10 }, (_, digit) => ({ digit, confidence: digit === 7 ? 0.92 : 0.01 })),
  inference_ms: 4.2,
  model_name: "RandomForestClassifier",
  feature_count: 784,
  preprocessed_image: "data:image/png;base64,aaaa",
};

describe("prediction display", () => {
  it("shows the predicted digit and confidence", () => {
    render(<PredictionResult prediction={prediction} />);
    expect(screen.getByTestId("predicted-digit").textContent).toBe("7");
    expect(screen.getByText("92.0%")).toBeTruthy();
    expect(screen.getByAltText("Preprocessed 28 by 28 model input")).toBeTruthy();
  });

  it("shows real pipeline stages and a pixel intensity", () => {
    const pixels = Array.from({ length: 784 }, (_, index) => (index === 29 ? 0.5 : 0));
    render(
      <PredictionResult
        prediction={{
          ...prediction,
          pixels,
          pipeline: [
            { key: "original", title: "Original Input", detail: "Decoded image.", image: "data:image/png;base64,aaaa", width: 96, height: 96 },
            { key: "final", title: "Final 28×28 Image", detail: "Model input.", image: "data:image/png;base64,bbbb", width: 28, height: 28 },
          ],
        }}
      />,
    );
    expect(screen.getAllByText("Original Input").length).toBeGreaterThan(0);
    expect(screen.getByText("96×96")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect 784 pixels" }));
    const cell = document.querySelector('[role="gridcell"][aria-label="Row 2, column 2, intensity 0.50"]');
    expect(cell).toBeInstanceOf(HTMLButtonElement);
    fireEvent.focus(cell as HTMLButtonElement);
    expect(screen.getByText(/Row 2, column 2, intensity 0\.500/)).toBeTruthy();
  });

  it("shows an API error", () => {
    render(<ErrorNotice message="The recognition service is unavailable. Start the backend and try again." />);
    expect(screen.getByRole("alert").textContent).toMatch(/unavailable/i);
  });
});
