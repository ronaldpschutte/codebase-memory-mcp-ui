import { useCallback, useEffect, useState } from "react";
import { deduplicatedCallTool } from "../api/dedup";
import type { Project, SchemaInfo } from "../lib/types";

interface ProjectInfo {
  project: Project;
  schema: SchemaInfo | null;
}

interface ProjectPage {
  projects?: Project[];
  has_more?: boolean;
  next_offset?: number;
}

interface SchemaPage extends SchemaInfo {
  has_more?: boolean;
  next_offset?: number;
}

const PAGE_LIMIT = 500;

function nextPageOffset(page: { has_more?: boolean; next_offset?: number }, offset: number) {
  if (typeof page.has_more !== "boolean") {
    throw new Error("Invalid pagination response");
  }
  if (!page.has_more) return null;
  if (!Number.isInteger(page.next_offset) || page.next_offset! <= offset) {
    throw new Error("Invalid pagination response");
  }
  return page.next_offset!;
}

async function fetchAllProjects(signal?: AbortSignal): Promise<Project[]> {
  const projects: Project[] = [];
  let offset = 0;
  for (;;) {
    if (signal?.aborted) return projects;
    const page = await deduplicatedCallTool<ProjectPage>(
      "list_projects",
      {
        format: "json",
        detail: "stats",
        limit: PAGE_LIMIT,
        offset,
      },
      { signal },
    );
    projects.push(...(page.projects ?? []));
    const next = nextPageOffset(page, offset);
    if (next === null) return projects;
    offset = next;
  }
}

async function fetchFullSchema(project: string, signal?: AbortSignal): Promise<SchemaInfo | null> {
  const nodeLabels: SchemaInfo["node_labels"] = [];
  const edgeTypes: SchemaInfo["edge_types"] = [];
  let firstPage: SchemaPage | null = null;
  let offset = 0;
  for (;;) {
    if (signal?.aborted) return null;
    const page = await deduplicatedCallTool<SchemaPage>(
      "get_graph_schema",
      {
        project,
        format: "json",
        limit: PAGE_LIMIT,
        offset,
      },
      { signal },
    );
    firstPage ??= page;
    nodeLabels.push(...(page.node_labels ?? []));
    edgeTypes.push(...(page.edge_types ?? []));
    const next = nextPageOffset(page, offset);
    if (next === null) {
      return { ...firstPage, node_labels: nodeLabels, edge_types: edgeTypes };
    }
    offset = next;
  }
}

interface UseProjectsResult {
  projects: ProjectInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAllProjects(signal);
      if (signal?.aborted) return;

      /* Fetch schema for each project with signal propagation */
      const infos: ProjectInfo[] = await Promise.all(
        list.map(async (p) => {
          if (signal?.aborted) {
            return { project: p, schema: null };
          }
          try {
            const schema = await fetchFullSchema(p.name, signal);
            return { project: p, schema };
          } catch {
            return { project: p, schema: null };
          }
        }),
      );

      if (!signal?.aborted) {
        setProjects(infos);
      }
    } catch (e) {
      if (
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError")
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to fetch projects");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchProjects(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchProjects]);

  const refresh = useCallback(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refresh };
}
