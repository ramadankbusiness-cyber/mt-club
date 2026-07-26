import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmptyState from "../../../src/components/EmptyState";

describe("EmptyState", () => {
  it("renders with default props", () => {
    render(<EmptyState />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders correct icon for events type", () => {
    const { container } = render(<EmptyState type="events" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders correct icon for gallery type", () => {
    const { container } = render(<EmptyState type="gallery" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders correct icon for search type", () => {
    const { container } = render(<EmptyState type="search" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders custom title and description", () => {
    render(
      <EmptyState
        type="events"
        title="No Events"
        description="Create your first event"
      />
    );
    expect(screen.getByText("No Events")).toBeInTheDocument();
    expect(screen.getByText("Create your first event")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    render(
      <EmptyState
        type="events"
        title="No Events"
        action={() => {}}
        actionLabel="Create Event"
      />
    );
    expect(screen.getByText("Create Event")).toBeInTheDocument();
  });

  it("calls action handler on button click", () => {
    const handler = vi.fn();
    render(
      <EmptyState
        type="events"
        title="No Events"
        action={handler}
        actionLabel="Create Event"
      />
    );
    fireEvent.click(screen.getByText("Create Event"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not render button when no action provided", () => {
    render(
      <EmptyState type="events" title="No Events" actionLabel="Create Event" />
    );
    expect(screen.queryByText("Create Event")).not.toBeInTheDocument();
  });

  it("does not render button when no actionLabel provided", () => {
    render(<EmptyState type="events" title="No Events" action={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
