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
vi.mock("./components/AdrTab", () => ({
  AdrTab: () => <div data-testid="adr-tab">ADR Tab</div>,
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

  it("renders the ADR navigation tab and switches to ADR view on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 }),
    ));

    render(<App />);

    const adrBtn = screen.getByRole("button", { name: "ADR" });
    expect(adrBtn).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.click(adrBtn);
    });

    expect(await screen.findByTestId("adr-tab")).toBeInTheDocument();
    expect(window.location.search).toContain("tab=adr");
  });

  it("renders the persistent header project switcher button", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/rpc") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                projects: [{ name: "my-project", root_path: "/my-project" }],
                has_more: false,
              }),
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 });
    }));

    render(<App />);

    const switcher = await screen.findByRole("button", { name: /Project All Projects/i });
    expect(switcher).toBeInTheDocument();
    expect(switcher).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("initializes multiple projects from ?projects= URL query param", async () => {
    window.history.replaceState(null, "", "/?projects=proj-alpha,proj-beta");

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/rpc") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                projects: [
                  { name: "proj-alpha", root_path: "/alpha" },
                  { name: "proj-beta", root_path: "/beta" },
                  { name: "proj-gamma", root_path: "/gamma" },
                ],
                has_more: false,
              }),
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 });
    }));

    render(<App />);

    // The switcher should display "2 Projects"
    const switcher = await screen.findByRole("button", { name: /Project 2 Projects/i });
    expect(switcher).toBeInTheDocument();
  });

  it("allows selecting, deselecting, and focusing projects in the multi-project dropdown", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/rpc") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                projects: [
                  { name: "proj-alpha", root_path: "/alpha" },
                  { name: "proj-beta", root_path: "/beta" },
                ],
                has_more: false,
              }),
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ lang: "en", version: "0.10.8" }), { status: 200 });
    }));

    render(<App />);

    const switcher = await screen.findByRole("button", { name: /Project All Projects/i });
    fireEvent.click(switcher);

    // Wait for the project items to be loaded into the dropdown menu
    expect(await screen.findByText("proj-alpha")).toBeInTheDocument();
    expect(screen.getByText("proj-beta")).toBeInTheDocument();

    // Dropdown menu should be visible with Select All and Clear buttons
    const selectAllBtn = screen.getByRole("button", { name: /Select All/i });
    const clearBtn = screen.getByRole("button", { name: /Clear/i });
    expect(selectAllBtn).toBeInTheDocument();
    expect(clearBtn).toBeInTheDocument();

    // Click "Select All"
    fireEvent.click(selectAllBtn);
    expect(window.location.search).toContain("projects=proj-alpha%2Cproj-beta");

    // Click "Focus Only" for proj-alpha
    const focusAlphaBtn = screen.getByTitle("Focus exclusively on proj-alpha");
    fireEvent.click(focusAlphaBtn);
    expect(window.location.search).toContain("projects=proj-alpha");

    // Click quick-clear button in the header
    const quickClearBtn = screen.getByTitle("Clear project filter (switch to global view)");
    fireEvent.click(quickClearBtn);
    expect(window.location.search).not.toContain("projects=");
  });
});