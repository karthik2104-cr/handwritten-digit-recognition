import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getHealth, predictDrawing, toErrorMessage } from "../services/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API client", () => {
  it("returns health data from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok", model_loaded: true }),
      }),
    );
    await expect(getHealth()).resolves.toMatchObject({ status: "ok", model_loaded: true });
  });

  it("uses the server message when a drawing is blank", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          detail: "No digit was detected. Draw a digit before predicting.",
          code: "blank_canvas",
        }),
      }),
    );
    await expect(predictDrawing("data:image/png;base64,aaaa")).rejects.toMatchObject({
      message: "No digit was detected. Draw a digit before predicting.",
      status: 400,
      code: "blank_canvas",
    });
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
    await expect(getHealth()).rejects.toMatchObject({ code: "network_error" });
    expect(toErrorMessage(new TypeError("Failed to fetch"))).toMatch(/unavailable/i);
  });

  it("falls back when an error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => {
          throw new Error("not json");
        },
      }),
    );
    await expect(getHealth()).rejects.toMatchObject({ message: "Server Error", status: 500 });
  });
});
