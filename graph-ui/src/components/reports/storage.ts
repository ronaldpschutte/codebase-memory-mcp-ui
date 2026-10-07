import type { RepositoryAnalysisReport, ReportDelta } from "../../lib/types";

const DB_NAME = "cbm_reports_db";
const STORE_NAME = "reports";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "report_id" });
        store.createIndex("project", "project", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

/**
 * Persists a report to IndexedDB (with localStorage backup).
 */
export async function saveReport(report: RepositoryAnalysisReport): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(report);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Backup to localStorage for quick lookup
  try {
    const listKey = `cbm_reports_list:${report.project}`;
    const rawList = localStorage.getItem(listKey);
    const list: string[] = rawList ? JSON.parse(rawList) : [];
    if (!list.includes(report.report_id)) {
      list.unshift(report.report_id);
    }
    localStorage.setItem(listKey, JSON.stringify(list.slice(0, 30)));
    localStorage.setItem(`cbm_report:${report.report_id}`, JSON.stringify(report));
    localStorage.setItem(`cbm_latest_report:${report.project}`, JSON.stringify(report));
  } catch {}
}

/**
 * Loads all saved reports for a given project.
 */
export async function listReports(project: string): Promise<RepositoryAnalysisReport[]> {
  const db = await openDb();
  if (db) {
    try {
      const reports = await new Promise<RepositoryAnalysisReport[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("project");
        const req = index.getAll(project);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      if (reports.length > 0) {
        return reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    } catch {}
  }

  // Fallback to localStorage
  try {
    const listKey = `cbm_reports_list:${project}`;
    const rawList = localStorage.getItem(listKey);
    if (rawList) {
      const ids: string[] = JSON.parse(rawList);
      const reports: RepositoryAnalysisReport[] = [];
      for (const id of ids) {
        const raw = localStorage.getItem(`cbm_report:${id}`);
        if (raw) reports.push(JSON.parse(raw));
      }
      return reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  } catch {}

  return [];
}

/**
 * Computes difference / delta between current report and previous baseline.
 */
export function computeReportDelta(
  current: RepositoryAnalysisReport,
  previous: RepositoryAnalysisReport | null
): ReportDelta | null {
  if (!previous) return null;

  return {
    overall_diff: current.scores.overall - previous.scores.overall,
    grade_from: previous.scores.grade,
    grade_to: current.scores.grade,
    test_coverage_diff: current.scores.test_coverage - previous.scores.test_coverage,
    hygiene_diff: current.scores.hygiene - previous.scores.hygiene,
    ai_readiness_diff: current.scores.ai_readiness - previous.scores.ai_readiness,
    fix_first_diff: current.fix_first.length - previous.fix_first.length,
  };
}

/**
 * Generates Markdown representation of a report.
 */
export function generateMarkdownReport(report: RepositoryAnalysisReport): string {
  const lines: string[] = [];

  lines.push(`# 📊 Repository Health & Analysis Report: \`${report.project}\``);
  lines.push("");
  lines.push(`> Generated on **${report.created_at}** • Git Branch: **\`${report.git_branch}\`** (\`${report.commit_hash}\`) • Preset: **\`${report.preset}\`** • Duration: **${report.execution_time_ms}ms**`);
  lines.push("");

  lines.push("## 🏆 Executive Health Summary");
  lines.push("");
  lines.push("| Overall Score | Health Grade | Test Coverage | Hygiene Score | AI Readiness |");
  lines.push("| :---: | :---: | :---: | :---: | :---: |");
  lines.push(`| **${report.scores.overall} / 100** | **${report.scores.grade}** | ${report.scores.test_coverage}% | ${report.scores.hygiene}/100 | ${report.scores.ai_readiness}/100 |`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## ⚡ Top 10 \"Fix First\" Priority Queue");
  lines.push("");
  lines.push("| Rank | Risk | Target Symbol / File | Primary Risk Factors | Recommended Action |");
  lines.push("| :---: | :---: | :--- | :--- | :--- |");

  for (const item of report.fix_first) {
    const riskBadge = item.risk_score >= 80 ? `🔴 **${item.risk_score}**` : item.risk_score >= 60 ? `🟠 **${item.risk_score}**` : `🟡 **${item.risk_score}**`;
    const reasons = item.reasons.join("<br>• ");
    lines.push(`| **#${item.rank}** | ${riskBadge} | \`${item.symbol}\`<br><sub>\`${item.file_path}\`</sub> | • ${reasons} | ${item.recommended_action} |`);
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## 🔍 Deep Analytical Tool Breakdown");
  lines.push("");

  // Test Coverage
  const tc = report.sections.test_coverage;
  lines.push("### 1. Test Coverage (`audit_test_coverage`)");
  lines.push(`- **Estimated Coverage:** ${report.scores.test_coverage}%`);
  const unt = tc?.critical_untested_symbols || tc?.untested_entry_points || [];
  if (unt.length) {
    lines.push(`- **Critical Untested Symbols:**`);
    for (const ep of unt.slice(0, 5)) {
      lines.push(`  - \`${ep.qualified_name || ep.symbol || ep.name}\` in \`${ep.file_path || ep.file}\` (${ep.inbound_callers_count ?? ep.callers ?? 0} callers)`);
    }
  }
  lines.push("");

  // Code Clones
  const clones = report.sections.code_clones?.clone_clusters || report.sections.code_clones?.clusters || report.sections.code_clones?.clones || [];
  lines.push("### 2. Code Duplication (`find_code_clones`)");
  lines.push(`- **Detected Clones:** ${clones.length} duplicate clusters`);
  for (const cl of clones.slice(0, 3)) {
    lines.push(`  - \`${cl.representative_symbol || cl.symbol || "Clone Cluster"}\` (${cl.instance_count || 2} occurrences)`);
  }
  lines.push("");

  // Dead Code
  if (report.sections.dead_code) {
    const dead = report.sections.dead_code?.dead_symbols || report.sections.dead_code?.unreferenced_symbols || [];
    lines.push("### 3. Dead Code (`find_dead_code`)");
    lines.push(`- **Unreferenced Symbols:** ${dead.length}`);
    for (const d of dead.slice(0, 5)) {
      lines.push(`  - \`${d.name || d.symbol}\` in \`${d.file_path}\``);
    }
    lines.push("");
  }

  // AI Readiness
  if (report.sections.ai_readiness) {
    const ai = report.sections.ai_readiness;
    lines.push("### 4. AI Readiness (`ai_readiness_audit`)");
    lines.push(`- **Readiness Score:** ${ai.score}/100 (Grade: ${ai.grade})`);
    lines.push(`- **Summary:** ${ai.summary}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by [Codebase Memory](https://github.com/ronaldpschutte/codebase-memory-mcp-ui)*");
  return lines.join("\n");
}

/**
 * Returns a rich default report for browser interactive demonstration.
 */
export function getDefaultReport(project: string): RepositoryAnalysisReport {
  return {
    report_id: `cbm-report-${project}-default`,
    project,
    git_branch: "RFC_015",
    commit_hash: "817547b",
    created_at: new Date().toISOString(),
    execution_time_ms: 4120,
    preset: "comprehensive",
    scores: {
      overall: 82,
      grade: "A",
      test_coverage: 78,
      hygiene: 84,
      ai_readiness: 85,
    },
    fix_first: [
      {
        rank: 1,
        symbol: "handle_rpc",
        file_path: "src/ui/http_server.c",
        risk_score: 94,
        reasons: [
          "Untested critical ingress RPC route handler",
          "14 incoming callers depend on JSON dispatch loop",
        ],
        recommended_action: "Add dedicated test suite verifying RPC allowlist and tool invocation.",
      },
      {
        rank: 2,
        symbol: "cbm_mcp_server_handle",
        file_path: "src/mcp/mcp.c",
        risk_score: 89,
        reasons: [
          "Central MCP protocol dispatcher",
          "22 incoming callers across server loop and tests",
        ],
        recommended_action: "Ensure all 27 tools are covered by automated unit assertions.",
      },
      {
        rank: 3,
        symbol: "Missing llms.txt summary index",
        file_path: "llms.txt",
        risk_score: 75,
        reasons: [
          "AI Readiness Defect: instructions pillar",
          "No standardized llms.txt index found for LLM ingestion",
        ],
        recommended_action: "Create docs/llms.txt summarizing project modules and key documents.",
      },
      {
        rank: 4,
        symbol: "colorForLabel",
        file_path: "graph-ui/src/lib/colors.ts",
        risk_score: 58,
        reasons: [
          "Untested entry point in 3D graph visualization",
          "6 incoming callers",
        ],
        recommended_action: "Add unit tests verifying color mapping contracts.",
      },
      {
        rank: 5,
        symbol: "cbm_legacy_hash_compute",
        file_path: "src/core/hash.c",
        risk_score: 42,
        reasons: [
          "0 incoming callers detected in knowledge graph",
          "Not exposed in public API surface",
        ],
        recommended_action: "Safe removal candidate. Deprecate to reduce maintenance footprint.",
      },
    ],
    sections: {
      test_coverage: {
        coverage_percentage: 78,
        critical_untested_symbols: [
          {
            qualified_name: "handle_rpc",
            file_path: "src/ui/http_server.c",
            inbound_callers_count: 14,
            importance: 32.5,
            recommendation: "Critical entry point. Add regression suite.",
          },
          {
            qualified_name: "cbm_mcp_server_handle",
            file_path: "src/mcp/mcp.c",
            inbound_callers_count: 22,
            importance: 38.0,
            recommendation: "Central MCP protocol dispatcher. Ensure complete test coverage.",
          },
        ],
      },
      code_clones: {
        clone_clusters: [
          {
            representative_symbol: "buffer_append_escaped",
            instance_count: 2,
            files_involved: ["src/ui/http_server.c", "src/mcp/mcp.c"],
            average_similarity: 0.88,
            description: "Duplicated string escaping logic in HTTP server and MCP dispatcher.",
          },
        ],
      },
      dead_code: {
        dead_symbols: [
          { name: "cbm_legacy_hash_compute", file_path: "src/core/hash.c", type: "function" },
          { name: "g_debug_profiler_enabled", file_path: "src/cli/cli.c", type: "variable" },
        ],
      },
      blast_radius: {
        high_impact_nodes: [
          { name: "cbm_store_open", file_path: "src/core/store.c", downstream_count: 38 },
          { name: "yyjson_read", file_path: "src/mcp/mcp.c", downstream_count: 24 },
        ],
      },
      coupled_files: {
        coupled_pairs: [
          { file_a: "src/ui/http_server.c", file_b: "graph-ui/src/api/rpc.ts", co_change_pct: 85 },
        ],
      },
      api_surface: {
        ingress_routes: [
          { method: "POST", url_path: "/rpc", handler_symbol: "handle_rpc" },
          { method: "GET", url_path: "/api/browse", handler_symbol: "handle_browse" },
          { method: "GET", url_path: "/api/layout", handler_symbol: "handle_layout" },
        ],
      },
      env_vars: {
        environment_variables: [
          { name: "CBM_REPOS_DIR", documented: true, defaultValue: "" },
          { name: "CBM_CACHE_DIR", documented: true, defaultValue: "" },
        ],
      },
      ai_readiness: {
        project,
        timestamp: new Date().toISOString(),
        score: 85,
        grade: "A",
        summary: "High AI readiness with active graph index, verified agent instructions, and tool parity.",
        pillars: {
          instructions: { score: 18, max: 20, status: "EXCELLENT", findings: ["Found agent instructions"] },
          skills: { score: 22, max: 25, status: "GOOD", findings: ["Tool skills detected"] },
          graph_integrity: { score: 18, max: 20, status: "EXCELLENT", findings: ["Graph index active"] },
          test_guardrails: { score: 15, max: 20, status: "GOOD", findings: ["Test suite present"] },
          hygiene: { score: 12, max: 15, status: "GOOD", findings: ["Clean branch hygiene"] },
        },
        shortcomings: [],
      },
    },
  };
}
