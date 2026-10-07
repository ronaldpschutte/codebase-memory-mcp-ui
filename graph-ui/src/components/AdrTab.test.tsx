/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdrTab } from "./AdrTab";
import { messages } from "../lib/i18n";

vi.mock("../lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/i18n")>();
  return { ...actual, useUiMessages: () => messages.en };
});

describe("AdrTab", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders empty state with project selector when selectedProject is null", async () => {
    const onSelectProject = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/rpc") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              text: JSON.stringify({
                projects: [
                  { name: "project-alpha", root_path: "/repos/alpha" },
                  { name: "project-beta", root_path: "/repos/beta" },
                ],
              }),
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(<AdrTab selectedProject={null} onSelectProject={onSelectProject} />);

    expect(await screen.findByText("Architecture Decision Records (ADR)")).toBeInTheDocument();
    expect(await screen.findByText("project-alpha")).toBeInTheDocument();
    expect(await screen.findByText("project-beta")).toBeInTheDocument();

    fireEvent.click(screen.getByText("project-alpha"));
    expect(onSelectProject).toHaveBeenCalledWith("project-alpha");
  });

  it("loads and displays existing ADR content for selected project", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/api/adr")) {
        return new Response(JSON.stringify({
          has_adr: true,
          content: "# ADR for My Project\n\n## Context\nTest context",
          updated_at: "2026-03-30 12:00:00",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(<AdrTab selectedProject="my-repo" />);

    expect(await screen.findByDisplayValue(/# ADR for My Project/)).toBeInTheDocument();
    expect(screen.getByText(/2026-03-30 12:00:00/)).toBeInTheDocument();
  });

  it("allows editing and saving ADR content", async () => {
    let savedPayload: unknown = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/adr")) {
        if (init?.method === "POST") {
          savedPayload = JSON.parse(String(init.body));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify({
          has_adr: true,
          content: "# Initial ADR",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(<AdrTab selectedProject="my-repo" />);

    const textarea = await screen.findByDisplayValue("# Initial ADR");
    fireEvent.change(textarea, { target: { value: "# Updated ADR Content" } });

    const saveBtn = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedPayload).toEqual({
        project: "my-repo",
        content: "# Updated ADR Content",
      });
    });
  });

  it("allows switching between edit and preview tabs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/api/adr")) {
        return new Response(JSON.stringify({
          has_adr: true,
          content: "# Decision Title\n\n## Context\nImportant context",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(<AdrTab selectedProject="my-repo" />);

    await screen.findByDisplayValue(/# Decision Title/);

    const previewBtn = screen.getByRole("button", { name: /Preview/i });
    fireEvent.click(previewBtn);

    // In preview mode, headings are rendered as elements
    expect(await screen.findByText("Decision Title")).toBeInTheDocument();
    expect(await screen.findByText("Context")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Edit/i });
    fireEvent.click(editBtn);

    expect(await screen.findByDisplayValue(/# Decision Title/)).toBeInTheDocument();
  });

  it("allows deleting ADR content after user confirmation", async () => {
    vi.stubGlobal("confirm", () => true);
    let deletedPayload: unknown = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/adr")) {
        if (init?.method === "POST") {
          deletedPayload = JSON.parse(String(init.body));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify({
          has_adr: true,
          content: "# ADR to delete",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(<AdrTab selectedProject="my-repo" />);

    await screen.findByDisplayValue("# ADR to delete");

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deletedPayload).toEqual({
        project: "my-repo",
        content: "",
      });
    });
  });
});
