/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadinessTab } from "./ReadinessTab";

// Mock MermaidViewer to avoid JSDOM canvas/SVG measurement errors
vi.mock("./MermaidViewer", () => ({
  MermaidViewer: ({ title, code }: { title: string; code: string }) => (
    <div data-testid="mermaid-viewer" data-title={title}>
      {code}
    </div>
  ),
}));

describe("ReadinessTab (RFC 018)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders header banner, score breakdown, and 5 pillars", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    expect(await screen.findByText("AI Readiness & Skill Auditor")).toBeInTheDocument();
    expect(await screen.findByText("5-Pillar Readiness Breakdown")).toBeInTheDocument();
    expect(screen.getByText("1. Agent Instructions & Anchors")).toBeInTheDocument();
    expect(screen.getByText("2. Tool & Skill Runbook Parity")).toBeInTheDocument();
    expect(screen.getByText("3. Knowledge Graph Integrity")).toBeInTheDocument();
    expect(screen.getByText("4. Test & Verification Guardrails")).toBeInTheDocument();
    expect(screen.getByText("5. Code Graph Hygiene & Boundaries")).toBeInTheDocument();
  });

  it("renders RFC 018 Agent Context & Instruction Architecture hub with token budget", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    expect(await screen.findByText("Agent Context & Instruction Architecture")).toBeInTheDocument();
    expect(screen.getByText("RFC 018")).toBeInTheDocument();
    expect(screen.getByText(/Prompt Token Budget:/)).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("Ecosystem Coverage:")).toBeInTheDocument();
    expect(screen.getByText("Universal (AGENTS.md)")).toBeInTheDocument();
  });

  it("filters documents by category pill", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    await screen.findByText("Agent Context & Instruction Architecture");

    // All documents initially shown (e.g. AGENTS.md, ARCHITECTURE.md, etc.)
    expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
    expect(screen.getByText("ARCHITECTURE.md")).toBeInTheDocument();

    // Click "Missing" category filter
    const missingBtn = screen.getByRole("button", { name: /Missing/i });
    fireEvent.click(missingBtn);

    // Missing documents should be present, others filtered out
    expect(screen.getByText("docs/llms.txt")).toBeInTheDocument();
    expect(screen.queryByText("AGENTS.md")).not.toBeInTheDocument();

    // Click "Primary Rules" filter
    const primaryBtn = screen.getByRole("button", { name: /Primary Rules/i });
    fireEvent.click(primaryBtn);

    expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
    expect(screen.queryByText("ARCHITECTURE.md")).not.toBeInTheDocument();
  });

  it("filters documents by search query input", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    await screen.findByText("Agent Context & Instruction Architecture");

    const searchInput = screen.getByPlaceholderText("Filter context files...");
    fireEvent.change(searchInput, { target: { value: "skill-runbook" } });

    // Should filter to skill documents or match category
    expect(screen.queryByText("ARCHITECTURE.md")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "ARCHITECTURE" } });
    expect(screen.getByText("ARCHITECTURE.md")).toBeInTheDocument();
  });

  it("opens document inspection modal when Inspect button is clicked", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    await screen.findByText("Agent Context & Instruction Architecture");

    // Find inspect button for ARCHITECTURE.md
    const inspectButtons = screen.getAllByRole("button", { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);

    // Modal should open with Document Content
    expect(screen.getByText("Symbol Anchor Integrity")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics & Freshness")).toBeInTheDocument();

    // Switch to Symbol Anchor Integrity tab
    fireEvent.click(screen.getByText("Symbol Anchor Integrity"));
    expect(screen.getByText(/Symbols mentioned in code blocks are cross-referenced/)).toBeInTheDocument();

    // Switch to Diagnostics tab
    fireEvent.click(screen.getByText("Diagnostics & Freshness"));
    expect(screen.getByText("Token Footprint")).toBeInTheDocument();
    expect(screen.getByText("Content Inspections")).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByText("Content Inspections")).not.toBeInTheDocument();
    });
  });

  it("opens scaffold template modal when Scaffold button is clicked on missing doc", async () => {
    render(<ReadinessTab selectedProject="test-project" />);

    await screen.findByText("Agent Context & Instruction Architecture");

    const scaffoldButtons = screen.getAllByRole("button", { name: /Scaffold/i });
    expect(scaffoldButtons.length).toBeGreaterThan(0);
    fireEvent.click(scaffoldButtons[0]);

    expect(screen.getByText("Scaffold Template")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy Markdown/i })).toBeInTheDocument();
  });
});
