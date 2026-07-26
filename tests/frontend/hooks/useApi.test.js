import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRetry, getErrorMessage } from "../../../src/hooks/useApi";

describe("getErrorMessage", () => {
  it("returns unknown error for null", () => {
    expect(getErrorMessage(null)).toBe("An unknown error occurred");
  });

  it("returns unknown error for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unknown error occurred");
  });

  it("returns session expired for 401", () => {
    expect(
      getErrorMessage({ response: { status: 401, data: {} } })
    ).toBe("Session expired. Please sign in again.");
  });

  it("returns permission error for 403", () => {
    expect(
      getErrorMessage({ response: { status: 403, data: {} } })
    ).toBe("You don't have permission for this action.");
  });

  it("returns not found for 404", () => {
    expect(
      getErrorMessage({ response: { status: 404, data: {} } })
    ).toBe("The requested resource was not found.");
  });

  it("returns rate limit for 429", () => {
    expect(
      getErrorMessage({ response: { status: 429, data: {} } })
    ).toBe("Too many requests. Please try again later.");
  });

  it("returns server error for 500", () => {
    expect(
      getErrorMessage({ response: { status: 500, data: {} } })
    ).toBe("Server error. Please try again later.");
  });

  it("returns response data message when available", () => {
    expect(
      getErrorMessage({ response: { status: 400, data: { message: "Bad input" } } })
    ).toBe("Bad input");
  });

  it("returns 'Request failed' when no data message on non-specific status", () => {
    expect(
      getErrorMessage({ response: { status: 422, data: {} } })
    ).toBe("Request failed");
  });

  it("returns network error message", () => {
    expect(getErrorMessage({ message: "Network Error" })).toBe(
      "No internet connection. Check your network."
    );
  });

  it("returns timeout message for AbortError", () => {
    expect(getErrorMessage({ name: "AbortError" })).toBe(
      "Request timed out. Please try again."
    );
  });

  it("returns timeout message for ECONNABORTED code", () => {
    expect(getErrorMessage({ code: "ECONNABORTED" })).toBe(
      "Request timed out. Please try again."
    );
  });

  it("returns error.message fallback", () => {
    expect(getErrorMessage({ message: "Something broke" })).toBe(
      "Something broke"
    );
  });

  it("returns generic fallback when no message property", () => {
    expect(getErrorMessage({ name: "Unknown" })).toBe("Something went wrong");
  });
});

describe("useRetry", () => {
  it("returns result on first success", async () => {
    const { result } = renderHook(() => useRetry());
    const fn = vi.fn().mockResolvedValue("ok");

    let res;
    await act(async () => {
      res = await result.current.withRetry(fn);
    });

    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after all retries exhausted", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRetry());
    const error = new Error("permanent failure");
    const fn = vi.fn().mockRejectedValue(error);

    let caughtErr = null;
    await act(async () => {
      const p = result.current.withRetry(fn, 1).catch(e => { caughtErr = e; });
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });

    expect(caughtErr).toBe(error);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("initially reports retrying as false", async () => {
    const { result } = renderHook(() => useRetry());
    expect(result.current.retrying).toBe(false);
  });
});
