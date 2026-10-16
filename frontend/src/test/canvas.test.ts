import { describe, expect, it } from "vitest";
import { canvasHasInk, pointerToCanvas } from "../lib/canvas";

describe("canvas helpers", () => {
  it("rejects a blank frame and accepts visible ink", () => {
    expect(canvasHasInk(new Uint8ClampedArray(16))).toBe(false);
    const ink = new Uint8ClampedArray(16);
    ink[4] = 255;
    expect(canvasHasInk(ink)).toBe(true);
  });

  it("maps a pointer into canvas pixels", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 420;
    canvas.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 20,
        left: 10,
        top: 20,
        width: 210,
        height: 210,
        right: 220,
        bottom: 230,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    expect(pointerToCanvas(canvas, 115, 125)).toEqual({ x: 210, y: 210 });
  });
});
