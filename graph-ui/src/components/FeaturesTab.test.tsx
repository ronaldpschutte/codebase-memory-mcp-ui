/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturesTab } from "./FeaturesTab";

describe("FeaturesTab", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the single repository feature catalog when one project is selected", () => {
    render(<FeaturesTab selectedProjects={["codebase-memory-mcp-ui"]} />);

    expect(screen.getByText("Features & Capabilities Catalog")).toBeInTheDocument();
    expect(screen.getByText("codebase-memory-mcp-ui")).toBeInTheDocument();

    // Verify key features for codebase-memory-mcp-ui are rendered
    expect(
      screen.getByText("Diagram Recommendation Engine & Studio")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Multi-Project Selection & Application-Wide Filter")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cross-Repository Feature Transplant Engine")
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI Readiness Audit & Agent Context Architecture")
    ).toBeInTheDocument();
  });

  it("renders multiple side-by-side columns with the repository name at the top when multiple projects are selected", () => {
    render(
      <FeaturesTab selectedProjects={["codebase-memory-mcp-ui", "docling"]} />
    );

    expect(
      screen.getByText(/Comparing 2 repositories side-by-side/i)
    ).toBeInTheDocument();

    // Verify both repository names appear as column headers at the top of their respective lists
    const repoHeadings = screen.getAllByRole("heading", { level: 3 });
    const repoTitles = repoHeadings.map((h) => h.textContent);
    expect(repoTitles).toContain("codebase-memory-mcp-ui");
    expect(repoTitles).toContain("docling");

    // Verify features from both repositories are listed in their respective columns
    expect(
      screen.getByText("Diagram Recommendation Engine & Studio")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Document Layout OCR & Parsing Engine")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Table Structure Recognition & HTML Generator")
    ).toBeInTheDocument();
  });

  it("filters features dynamically by search input", () => {
    render(<FeaturesTab selectedProjects={["codebase-memory-mcp-ui"]} />);

    const searchInput = screen.getByPlaceholderText(/Search features/i);
    fireEvent.change(searchInput, { target: { value: "Diagram" } });

    expect(
      screen.getByText("Diagram Recommendation Engine & Studio")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Direct SQLite Page-Writer & Graph Buffer")
    ).not.toBeInTheDocument();
  });

  it("filters features by category pill", () => {
    render(<FeaturesTab selectedProjects={["codebase-memory-mcp-ui"]} />);

    // Click on "Analysis & Visualization"
    const catBtn = screen.getByRole("button", { name: "Analysis & Visualization" });
    fireEvent.click(catBtn);

    expect(
      screen.getByText("Diagram Recommendation Engine & Studio")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Direct SQLite Page-Writer & Graph Buffer")
    ).not.toBeInTheDocument();
  });

  it("opens transplant modal with pre-filled CLI command when Transplant is clicked", () => {
    render(<FeaturesTab selectedProjects={["codebase-memory-mcp-ui"]} />);

    const transplantBtns = screen.getAllByRole("button", { name: /Transplant/i });
    fireEvent.click(transplantBtns[0]);

    expect(screen.getByText(/Transplant Feature:/i)).toBeInTheDocument();
    expect(screen.getByText(/CLI Execution Command/i)).toBeInTheDocument();
    expect(screen.getByText(/node scripts\/transplant-feature\.mjs/i)).toBeInTheDocument();
  });

  it("opens documentation specification modal when Docs is clicked", () => {
    render(<FeaturesTab selectedProjects={["codebase-memory-mcp-ui"]} />);

    const docBtns = screen.getAllByRole("button", { name: /Docs/i });
    fireEvent.click(docBtns[0]);

    expect(
      screen.getByText("Architecture Specifications & RFCs")
    ).toBeInTheDocument();
    expect(
      screen.getByText("docs/RFC_016_Diagram_Recommendation_Engine.md")
    ).toBeInTheDocument();
  });
});
