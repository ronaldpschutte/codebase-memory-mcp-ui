/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { messages } from "./lib/i18n";

vi.mock("./components/GraphTab", () => ({ GraphTab: () => null }));
vi.mock("./components/StatsTab", () => ({ StatsTab: () => <div data-testid="stats-tab">Stats</div> }));
vi.mock("./components/ControlTab", () => ({ ControlTab: () => <div data-testid="control-tab">Control</div> }));
vi.mock("./components/DiagramsTab", () => ({
  DiagramsTab: ({ initialDiagram }: { initialDiagram?: string | null }) => (
    <div data-testid="diagrams-tab">Diagrams View: {initialDiagram || "overview"}</div>
  ),
}));
vi.mock("./components/ToolsTab", () => ({
  ToolsTab: () => <div data-testid="tools-tab">Tools Directory</div>,
}));
vi.mock("./components/ReadinessTab", () => ({
  ReadinessTab: () => <div data-testid="readiness-tab">AI Readiness</div>,
}));
vi.mock("./components/reports/ReportsTab", () => ({
  ReportsTab: () => <div data-testid="reports-tab">Reports Tab</div>,
}));

vi.mock("./lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/i18n")>();
  return { ...actual, useUiMessages: () => messages.en };
});

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("shows the serving binary version", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    render(<App />);

    expect(await screen.findByText("v0.10.8")).toBeVisible();
  });

  it("hides the version when the config has no string version", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: 108 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/ui-config"));
    expect(screen.queryByTitle("Server version")).not.toBeInTheDocument();
  });

  it("hides the version when the config request fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/ui-config"));
    expect(screen.queryByTitle("Server version")).not.toBeInTheDocument();
  });

  it("renders the diagrams navigation tab and switches to diagrams view on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    const diagramsBtn = screen.getByRole("button", { name: "Diagrams" });
    expect(diagramsBtn).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.click(diagramsBtn);
    });

    expect(await screen.findByTestId("diagrams-tab")).toBeInTheDocument();
    expect(window.location.search).toContain("tab=diagrams");
  });

  it("supports deep linking to a specific diagram via query params", async () => {
    window.history.replaceState(null, "", "/?tab=diagrams&diagram=architecture");

    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    expect(await screen.findByTestId("diagrams-tab")).toHaveTextContent("Diagrams View: architecture");
  });

  it("renders the tools navigation tab and switches to tools view on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    const toolsBtn = screen.getByRole("button", { name: "Tools" });
    expect(toolsBtn).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.click(toolsBtn);
    });

    expect(await screen.findByTestId("tools-tab")).toBeInTheDocument();
    expect(window.location.search).toContain("tab=tools");
  });

  it("renders the AI readiness navigation tab and switches to readiness view on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    const readinessBtn = screen.getByRole("button", { name: "AI Readiness" });
    expect(readinessBtn).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.click(readinessBtn);
    });

    expect(await screen.findByTestId("readiness-tab")).toBeInTheDocument();
    expect(window.location.search).toContain("tab=readiness");
  });

  it("renders the Reports navigation tab and switches to reports view on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    const reportsBtn = screen.getByRole("button", { name: "Reports" });
    expect(reportsBtn).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.click(reportsBtn);
    });

    expect(await screen.findByTestId("reports-tab")).toBeInTheDocument();
    expect(window.location.search).toContain("tab=reports");
  });
});