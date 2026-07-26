import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../src/components/Toast";

function TestConsumer() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast("Hello")}>add</button>
      <button onClick={() => toast.success("Great")}>success</button>
      <button onClick={() => toast.error("Bad")}>error</button>
      <button onClick={() => toast.warning("Careful")}>warning</button>
      <button onClick={() => toast.info("FYI")}>info</button>
    </div>
  );
}

describe("useToast", () => {
  it("throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useToast must be used within ToastProvider");
    spy.mockRestore();
  });

  it("ToastProvider renders children", () => {
    render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});

describe("Toast functionality", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("addToast shows a toast message", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("add"));
    });
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("toast.success creates success type", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("success"));
    });
    expect(screen.getByText("Great")).toBeInTheDocument();
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("toast.error creates error type", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("error"));
    });
    expect(screen.getByText("Bad")).toBeInTheDocument();
  });

  it("toast.warning creates warning type", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("warning"));
    });
    expect(screen.getByText("Careful")).toBeInTheDocument();
  });

  it("toast.info creates info type", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("info"));
    });
    expect(screen.getByText("FYI")).toBeInTheDocument();
  });

  it("toast can be dismissed via close button", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("add"));
    });
    expect(screen.getByText("Hello")).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText("Dismiss notification");
    act(() => {
      fireEvent.click(dismissBtn);
    });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("toast auto-dismisses after duration", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    act(() => {
      fireEvent.click(screen.getByText("add"));
    });
    expect(screen.getByText("Hello")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });
});
