import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingCanvas } from "../components/DrawingCanvas";

const context = {
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 })),
  fillStyle: "#000000",
  strokeStyle: "#ffffff",
  lineWidth: 1,
  lineCap: "round",
  lineJoin: "round",
};

beforeEach(() => {
  context.fillRect.mockClear();
  context.beginPath.mockClear();
  context.arc.mockClear();
  context.fill.mockClear();
  context.moveTo.mockClear();
  context.lineTo.mockClear();
  context.stroke.mockClear();
  context.putImageData.mockClear();
  context.getImageData.mockClear();
  context.getImageData.mockReturnValue({ data: new Uint8ClampedArray(16), width: 2, height: 2 });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,aaa");
});

function renderCanvas(predicting = false, onPredict = vi.fn(), onBlank = vi.fn()) {
  const onBrushChange = vi.fn();
  render(
    <DrawingCanvas
      brush={18}
      onBrushChange={onBrushChange}
      predicting={predicting}
      onPredict={onPredict}
      onBlank={onBlank}
    />,
  );
  return { onPredict, onBlank, onBrushChange };
}

describe("DrawingCanvas", () => {
  it("draws a stroke from pointer movement", () => {
    renderCanvas();
    const canvas = screen.getByTestId("drawing-canvas");
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 55, pointerId: 1 });
    expect(context.arc).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
  });

  it("clears the canvas and restores an undo snapshot", () => {
    renderCanvas();
    const before = context.fillRect.mock.calls.length;
    fireEvent.click(screen.getByTestId("clear-button"));
    expect(context.fillRect.mock.calls.length).toBeGreaterThan(before);

    fireEvent.pointerDown(screen.getByTestId("drawing-canvas"), { clientX: 12, clientY: 12, pointerId: 1 });
    fireEvent.click(screen.getByTestId("undo-button"));
    expect(context.putImageData).toHaveBeenCalled();
  });

  it("rejects a blank canvas and submits one with ink", () => {
    const blank = renderCanvas();
    fireEvent.click(screen.getByTestId("predict-button"));
    expect(blank.onBlank).toHaveBeenCalledTimes(1);
    expect(blank.onPredict).not.toHaveBeenCalled();
    cleanup();

    const ink = new Uint8ClampedArray(16);
    ink.fill(255);
    context.getImageData.mockReturnValue({ data: ink, width: 2, height: 2 });
    const drawn = renderCanvas();
    fireEvent.click(screen.getByTestId("predict-button"));
    expect(drawn.onPredict).toHaveBeenCalledWith("data:image/png;base64,aaa");
  });

  it("updates the brush size and disables prediction while busy", () => {
    const view = renderCanvas(true);
    fireEvent.change(screen.getByTestId("brush-size"), { target: { value: "24" } });
    expect(view.onBrushChange).toHaveBeenCalledWith(24);
    expect((screen.getByTestId("predict-button") as HTMLButtonElement).disabled).toBe(true);
  });
});
