/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MermaidViewer } from "./MermaidViewer";

describe("MermaidViewer", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const sampleMermaid = `graph TD
    Client["Client Interface"] --> Server["MCP Server"]
    Server --> Store[("SQLite DB")]`;

  it("renders with title, line count, and view mode toggles", async () => {
    render(
      <MermaidViewer
        diagramId="test-diagram"
        title="Test Architecture Diagram"
        code={sampleMermaid}
      />
    );

    expect(screen.getByTestId("mermaid-viewer")).toBeInTheDocument();
    expect(screen.getByTitle("Test Architecture Diagram")).toBeInTheDocument();
    expect(screen.getByText("Visual Diagram")).toBeInTheDocument();
    expect(screen.getByText("Mermaid AST Code")).toBeInTheDocument();
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("switches to Mermaid AST Code view and renders line numbers", async () => {
    render(
      <MermaidViewer
        diagramId="test-diagram"
        title="Test Architecture Diagram"
        code={sampleMermaid}
      />
    );

    const codeBtn = screen.getByRole("button", { name: /Mermaid AST Code/i });
    fireEvent.click(codeBtn);

    expect(screen.getByText("test-diagram.mermaid")).toBeInTheDocument();
    expect(screen.getByText("AST Source")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/graph TD/i)).toBeInTheDocument();
  });

  it("copies AST to clipboard when Copy AST button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MermaidViewer
        diagramId="test-diagram"
        title="Test Architecture Diagram"
        code={sampleMermaid}
      />
    );

    const copyBtn = screen.getByRole("button", { name: /Copy AST/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(sampleMermaid);
    });
  });

  it("triggers .mermaid file download", async () => {
    const clickMock = vi.fn();
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    // Mock HTMLAnchorElement click
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickMock);

    render(
      <MermaidViewer
        diagramId="test-diagram"
        title="Test Architecture Diagram"
        code={sampleMermaid}
      />
    );

    const downloadBtn = screen.getByTitle("Download .mermaid file");
    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalled();
  });

  it("handles empty code gracefully by displaying warning notice", async () => {
    render(
      <MermaidViewer
        diagramId="empty-diagram"
        title="Empty Diagram"
        code=""
      />
    );

    expect(
      await screen.findByText(/No Mermaid AST code provided for this diagram/i)
    ).toBeInTheDocument();
  });
});
