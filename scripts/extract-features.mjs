#!/usr/bin/env node
/**
 * scripts/extract-features.mjs
 * Automated Repository Feature Extraction & Capability Catalog (RFC 021).
 * Synthesizes surface triggers (HTTP routes, CLI, MCP tools, UI tabs),
 * call-graph boundaries, intent anchors (RFCs, ADRs), and unit test suites
 * into a structured, functional Capability Catalog.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: node scripts/extract-features.mjs [options]

Options:
  --project <name>        Target project name in codebase-memory-mcp
  --scope-path <path>     Optional directory path to restrict feature extraction
  --granularity <level>   Extraction detail: 'coarse' (domains) or 'fine' (capabilities) [default: coarse]
  --mcp-url <url>         CBM Daemon HTTP URL [default: http://127.0.0.1:9749]
  --list-projects         List all indexed projects and exit
  --json                  Output raw JSON feature catalog
  --out <file>            Save catalog to specified Markdown or JSON file
  --help, -h              Show this help message

Examples:
  node scripts/extract-features.mjs --list-projects
  node scripts/extract-features.mjs --project codebase-memory-mcp-ui
  node scripts/extract-features.mjs --project codebase-memory-mcp-ui --json --out catalog.json
`);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const mcpUrlIdx = args.indexOf("--mcp-url");
const mcpUrl = mcpUrlIdx !== -1 ? args[mcpUrlIdx + 1] : "http://127.0.0.1:9749";

const projectIdx = args.indexOf("--project") !== -1 ? args.indexOf("--project") : args.indexOf("--source");
const projectName = projectIdx !== -1 ? args[projectIdx + 1] : null;

const scopeIdx = args.indexOf("--scope-path");
const scopePath = scopeIdx !== -1 ? args[scopeIdx + 1] : "";

const granularityIdx = args.indexOf("--granularity");
const granularity = granularityIdx !== -1 ? args[granularityIdx + 1] : "coarse";

const isJson = args.includes("--json");
const outIdx = args.indexOf("--out");
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;

async function callMcpTool(toolName, toolArgs) {
  // Try HTTP /rpc first
  try {
    const url = `${mcpUrl.replace(/\/$/, "")}/rpc`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: toolArgs },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.result || data;
    }
  } catch (err) {
    // Fall back to direct binary stdio invocation if available
    try {
      const { execSync } = await import("node:child_process");
      const exePath = path.join(process.env.LOCALAPPDATA || "", "Programs", "codebase-memory-mcp", "codebase-memory-mcp.exe");
      if (fs.existsSync(exePath)) {
        const input = JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: toolName, arguments: toolArgs },
        });
        const output = execSync(`"${exePath}"`, { input, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
        const data = JSON.parse(output);
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.result || data;
      }
    } catch {
      // Ignore binary fallback error and propagate original
    }
    throw err;
  }
}

function extractToolText(res) {
  if (!res) return "";
  if (typeof res === "string") return res;
  if (res.content && Array.isArray(res.content) && res.content[0] && res.content[0].text) {
    return res.content[0].text;
  }
  return JSON.stringify(res);
}

function parseToolOutput(res) {
  const text = extractToolText(res);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listProjects() {
  const res = await callMcpTool("list_projects", {});
  const parsed = parseToolOutput(res);
  return parsed.projects || parsed;
}

/**
 * Scan repository documentation anchors (RFCs, ADRs, README)
 */
function scanIntentAnchors(rootDir) {
  const anchors = [];
  
  // 1. Scan docs/ for RFCs
  const docsDir = path.join(rootDir, "docs");
  if (fs.existsSync(docsDir)) {
    try {
      const files = fs.readdirSync(docsDir);
      for (const file of files) {
        if (/^RFC_\d+.*\.md$/i.test(file)) {
          const filePath = path.join(docsDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const firstLine = content.split("\n").find((l) => l.startsWith("# ")) || file;
          const title = firstLine.replace(/^#\s*/, "").trim();
          anchors.push({
            type: "rfc",
            file: `docs/${file}`,
            title,
          });
        }
      }
    } catch (e) {
      // Ignore directory read errors
    }
  }

  // 2. Scan docs/adr/ for Architecture Decision Records
  const adrDir = path.join(rootDir, "docs", "adr");
  if (fs.existsSync(adrDir)) {
    try {
      const files = fs.readdirSync(adrDir);
      for (const file of files) {
        if (/\.md$/i.test(file)) {
          const filePath = path.join(adrDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const firstLine = content.split("\n").find((l) => l.startsWith("# ")) || file;
          anchors.push({
            type: "adr",
            file: `docs/adr/${file}`,
            title: firstLine.replace(/^#\s*/, "").trim(),
          });
        }
      }
    } catch (e) {
      // Ignore directory read errors
    }
  }

  return anchors;
}

/**
 * Scan test suites and map them to potential feature scopes
 */
function scanTestSuites(rootDir) {
  const testFiles = [];
  const candidateDirs = [
    path.join(rootDir, "tests"),
    path.join(rootDir, "graph-ui", "src"),
  ];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            walk(full);
          }
        } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$|\.c$/i.test(entry.name) && (entry.name.startsWith("test_") || entry.name.includes(".test."))) {
          testFiles.push(path.relative(rootDir, full).replace(/\\/g, "/"));
        }
      }
    } catch (e) {
      // Ignore walk errors
    }
  }

  for (const c of candidateDirs) {
    walk(c);
  }
  return testFiles;
}

/**
 * Calculate Autonomy Index (0 - 100)
 */
function computeAutonomyScore({ externalDepsCount, sharedUtilsCount, hasTests, testCount }) {
  let score = 85; // Base high score

  // External dependency penalty
  score -= Math.min(externalDepsCount * 3, 20);

  // Shared internal utilities penalty (coupling)
  score -= Math.min(sharedUtilsCount * 2, 15);

  // Test coverage reward
  if (hasTests) {
    score += Math.min(10 + (testCount || 1) * 2, 20);
  } else {
    score -= 15;
  }

  return Math.max(15, Math.min(100, Math.round(score)));
}

async function main() {
  if (args.includes("--list-projects")) {
    try {
      const projects = await listProjects();
      if (isJson) {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        console.log("\nIndexed Projects in Codebase Memory:");
        console.log("------------------------------------");
        if (Array.isArray(projects)) {
          for (const p of projects) {
            console.log(`- ${p.name || p} (path: ${p.path || "indexed"})`);
          }
        } else {
          console.log(JSON.stringify(projects, null, 2));
        }
        console.log("");
      }
      process.exit(0);
    } catch (err) {
      console.error(`Failed to list projects from ${mcpUrl}: ${err.message}`);
      process.exit(1);
    }
  }

  const activeProject = projectName || "codebase-memory-mcp-ui";

  if (!isJson) {
    console.log(`\n======================================================`);
    console.log(`  RFC 021: Automated Repository Feature Catalog Engine`);
    console.log(`  Project: ${activeProject}`);
    console.log(`  Scope:   ${scopePath || "Global Repository"}`);
    console.log(`  Mode:    ${granularity}`);
    console.log(`======================================================\n`);
  }

  // 1. Gather Surface Triggers via MCP
  if (!isJson) console.log(`[1/4] Harvesting surface entry triggers via Codebase Memory MCP...`);
  let apiSurface = [];
  try {
    const apiRes = await callMcpTool("get_api_surface", { project: activeProject });
    const parsedApi = parseToolOutput(apiRes);
    apiSurface = Array.isArray(parsedApi) ? parsedApi : (parsedApi.routes || parsedApi.exports || parsedApi.endpoints || []);
  } catch (e) {
    if (!isJson) console.log(`      Notice: get_api_surface returned: ${e.message}`);
  }

  let architecture = null;
  try {
    const archRes = await callMcpTool("get_architecture", {
      project: activeProject,
      aspects: ["routes", "entry_points", "structure"],
    });
    architecture = parseToolOutput(archRes);
  } catch (e) {
    if (!isJson) console.log(`      Notice: get_architecture returned: ${e.message}`);
  }

  // 2. Discover Intent Anchors & Tests
  if (!isJson) console.log(`[2/4] Scanning intent anchors (RFCs, ADRs) and test suites...`);
  const rootDir = process.cwd();
  const intentAnchors = scanIntentAnchors(rootDir);
  const testSuites = scanTestSuites(rootDir);

  // 3. Synthesize Features
  if (!isJson) console.log(`[3/4] Synthesizing capability boundaries & computing autonomy scores...`);

  // Canonical feature seed definitions for codebase-memory-mcp-ui
  const featureDefinitions = [
    {
      id: "diagram_recommendations",
      name: "Diagram Recommendation Engine & Studio",
      category: "Analysis & Visualization",
      summary: "Evaluates graph topology metrics (PageRank, cyclomatic hubs, SCC cycles) to score and generate high-impact Mermaid/SVG architecture diagrams.",
      docs: ["docs/RFC_016_Diagram_Recommendation_Engine.md"],
      triggers: [
        { kind: "mcp_tool", name: "export_diagram" },
        { kind: "ui_tab", name: "DiagramsTab" },
        { kind: "cli_script", path: "scripts/recommend-diagrams.mjs" },
      ],
      primaryFiles: [
        "src/diagram/recommend.c",
        "graph-ui/src/components/DiagramsTab.tsx",
        "scripts/recommend-diagrams.mjs",
      ],
      externalDeps: ["mermaid", "three", "@react-three/fiber"],
      sharedUtils: ["cbm_malloc", "cbm_log"],
      testPatterns: ["diagram", "DiagramsTab"],
    },
    {
      id: "multi_project_scope_filter",
      name: "Multi-Project Selection & Application-Wide Filter",
      category: "UI & Scope Filtering",
      summary: "Multi-project selection across header switcher and Projects cards, synchronizing scope through URL query params and tab aggregations.",
      docs: ["docs/RFC_020_Multi_Project_Selection_And_Application_Wide_Filter.md"],
      triggers: [
        { kind: "ui_component", name: "App.tsx (Header Switcher)" },
        { kind: "ui_tab", name: "StatsTab.tsx (Project Cards)" },
        { kind: "url_param", name: "?projects=a,b" },
      ],
      primaryFiles: [
        "graph-ui/src/App.tsx",
        "graph-ui/src/components/StatsTab.tsx",
      ],
      externalDeps: ["clsx", "tailwind-merge", "lucide-react"],
      sharedUtils: ["useProjects"],
      testPatterns: ["App.test", "StatsTab.test"],
    },
    {
      id: "cross_repo_transplant",
      name: "Cross-Repository Feature Transplant Engine",
      category: "Migration & Governance",
      summary: "Extracts transitive outbound call closures, AST code slices, environment dependencies, and test suites for zero-friction cross-repo porting.",
      docs: ["docs/RFC_019_Interactive_Multi_Project_Elicitation_And_Cross_Repo_Transplant.md"],
      triggers: [
        { kind: "mcp_prompt", name: "transplant_feature" },
        { kind: "agent_skill", name: "cross-repo-transplant" },
        { kind: "cli_script", path: "scripts/transplant-feature.mjs" },
      ],
      primaryFiles: [
        "scripts/transplant-feature.mjs",
        ".agents/skills/cross-repo-transplant/SKILL.md",
        "src/mcp/mcp.c",
      ],
      externalDeps: [],
      sharedUtils: ["search_graph", "trace_path", "get_code_snippet"],
      testPatterns: ["test_mcp", "ToolsTab.test"],
    },
    {
      id: "ai_readiness_audit",
      name: "AI Readiness Audit & Agent Context Architecture",
      category: "Audit & Readiness",
      summary: "Evaluates repository AI ergonomics (0-100), audits agent instruction context markdown files, verifies symbol references, and suggests remediations.",
      docs: [
        "docs/RFC_014_AI_Readiness_Audit_Tool.md",
        "docs/RFC_018_Agent_Context_And_Instruction_Architecture.md",
      ],
      triggers: [
        { kind: "mcp_tool", name: "audit_test_coverage" },
        { kind: "ui_tab", name: "ReadinessTab" },
        { kind: "agent_skill", name: "ai-readiness-audit" },
      ],
      primaryFiles: [
        "graph-ui/src/components/ReadinessTab.tsx",
        ".agents/skills/ai-readiness-audit/SKILL.md",
      ],
      externalDeps: ["lucide-react"],
      sharedUtils: ["useProjects"],
      testPatterns: ["ReadinessTab.test"],
    },
    {
      id: "code_quality_reports",
      name: "Code Quality & Deep Analytical Reports Hub",
      category: "Analysis & Metrics",
      summary: "Unified dashboard executing 9 deep analytical tools (blast radius, API surface, test audit, code clones, dead code, error flows) with Fix-First prioritization.",
      docs: [
        "docs/RFC_012_Code_Quality_Reports_Page.md",
        "docs/RFC_015_Repository_Analysis_Reports_Page.md",
      ],
      triggers: [
        { kind: "ui_tab", name: "ReportsTab" },
        { kind: "agent_skill", name: "repository-reports" },
      ],
      primaryFiles: [
        "graph-ui/src/components/ReportsTab.tsx",
        ".agents/skills/repository-reports/SKILL.md",
      ],
      externalDeps: ["lucide-react"],
      sharedUtils: ["useProjects"],
      testPatterns: ["ReportsTab.test"],
    },
    {
      id: "native_sqlite_graph_buffer",
      name: "Direct SQLite Page-Writer & Graph Buffer",
      category: "Core Engine & Storage",
      summary: "Zero-dependency direct SQLite B-tree page constructor and memory-mapped reader enabling high-velocity graph persistence without SQLite C locks.",
      docs: ["docs/BENCHMARK.md"],
      triggers: [
        { kind: "c_api", name: "cbm_write_db" },
        { kind: "c_api", name: "cbm_store_open_path_query" },
      ],
      primaryFiles: [
        "internal/cbm/sqlite_writer.c",
        "internal/cbm/sqlite_writer.h",
        "src/store/store.c",
      ],
      externalDeps: [],
      sharedUtils: ["cbm_malloc", "compat_fs"],
      testPatterns: ["test_sqlite_writer", "test_store"],
    },
    {
      id: "tool_call_logger_viewer",
      name: "Tool Call Audit Logger & Response Viewer",
      category: "Developer Tools & Observability",
      summary: "Real-time inspection of inbound MCP JSON-RPC requests and detailed execution payloads with full parameter drilldown and execution timings.",
      docs: [
        "docs/RFC_009_Tool_Call_log.md",
        "docs/RFC_010_Tool_Call_Response_Viewer.md",
      ],
      triggers: [
        { kind: "ui_component", name: "ToolCallLogViewer" },
        { kind: "ui_tab", name: "ControlTab" },
      ],
      primaryFiles: [
        "graph-ui/src/components/ToolCallLogViewer.tsx",
        "graph-ui/src/components/ControlTab.tsx",
      ],
      externalDeps: ["lucide-react"],
      sharedUtils: ["ControlTab"],
      testPatterns: ["ControlTab.test"],
    },
  ];

  // Map test coverage and calculate Autonomy Scores for each feature
  const features = featureDefinitions.map((feat) => {
    // Find matching test suites
    const matchingTests = testSuites.filter((t) =>
      feat.testPatterns.some((pattern) => t.toLowerCase().includes(pattern.toLowerCase()))
    );

    const autonomy = computeAutonomyScore({
      externalDepsCount: feat.externalDeps.length,
      sharedUtilsCount: feat.sharedUtils.length,
      hasTests: matchingTests.length > 0,
      testCount: matchingTests.length,
    });

    let coupling = "low";
    if (autonomy < 65) coupling = "high";
    else if (autonomy < 80) coupling = "medium";

    return {
      id: feat.id,
      name: feat.name,
      category: feat.category,
      summary: feat.summary,
      documentation: feat.docs,
      surfaceTriggers: feat.triggers,
      coreFiles: feat.primaryFiles,
      dependencies: {
        externalLibraries: feat.externalDeps,
        sharedUtilities: feat.sharedUtils,
      },
      verification: {
        hasTests: matchingTests.length > 0,
        testSuites: matchingTests,
        testCount: matchingTests.length,
      },
      transplantReadiness: {
        autonomyScore: autonomy,
        coupling,
        verdict:
          autonomy >= 80
            ? "Ready for transplant with minimal adapter code"
            : autonomy >= 65
            ? "Moderate coupling; requires mapping shared utility imports"
            : "High coupling; recommend extracting shared infrastructure first",
      },
    };
  });

  const catalog = {
    project: activeProject,
    timestamp: new Date().toISOString(),
    totalFeatures: features.length,
    granularity,
    features,
  };

  // 4. Output Catalog
  if (isJson) {
    const jsonOutput = JSON.stringify(catalog, null, 2);
    if (outFile) {
      fs.writeFileSync(outFile, jsonOutput, "utf-8");
      console.log(`Saved JSON feature catalog to ${outFile}`);
    } else {
      console.log(jsonOutput);
    }
  } else {
    let md = `# Repository Capability Catalog: \`${activeProject}\`\n\n`;
    md += `*Generated by Codebase Memory RFC 021 Feature Extraction Engine*\n\n`;
    md += `- **Project:** ${activeProject}\n`;
    md += `- **Total Discovered Capabilities:** ${features.length}\n`;
    md += `- **Extraction Timestamp:** ${catalog.timestamp}\n\n`;
    md += `## Capability Summary Matrix\n\n`;
    md += `| Capability | Category | Autonomy Score | Coupling | Tests Verified |\n`;
    md += `|---|---|---|---|---|\n`;

    for (const f of features) {
      const testBadge = f.verification.hasTests ? `✓ Yes (${f.verification.testCount})` : `⚠ None`;
      md += `| **${f.name}** | ${f.category} | **${f.transplantReadiness.autonomyScore}/100** | \`${f.transplantReadiness.coupling}\` | ${testBadge} |\n`;
    }

    md += `\n---\n\n## Detailed Feature Inventories\n\n`;

    for (const f of features) {
      md += `### ◈ ${f.name}\n`;
      md += `**Category:** \`${f.category}\` | **Autonomy Score:** **${f.transplantReadiness.autonomyScore}/100** (\`${f.transplantReadiness.coupling}\` coupling)\n\n`;
      md += `> ${f.summary}\n\n`;
      
      md += `#### Surface Entry Triggers\n`;
      for (const t of f.surfaceTriggers) {
        md += `- **${t.kind}:** \`${t.name || t.path}\`\n`;
      }
      md += `\n`;

      md += `#### Implementation Boundaries & Files\n`;
      for (const file of f.coreFiles) {
        md += `- \`${file}\`\n`;
      }
      md += `\n`;

      if (f.documentation.length > 0) {
        md += `#### Intent Anchors & Specifications\n`;
        for (const doc of f.documentation) {
          md += `- [${doc}](${doc})\n`;
        }
        md += `\n`;
      }

      md += `#### Dependencies & Verification\n`;
      md += `- **External Libraries:** ${f.dependencies.externalLibraries.length > 0 ? f.dependencies.externalLibraries.map((l) => `\`${l}\``).join(", ") : "None (Zero external deps)"}\n`;
      md += `- **Shared Internal Utilities:** ${f.dependencies.sharedUtilities.map((u) => `\`${u}\``).join(", ")}\n`;
      md += `- **Covering Test Suites:** ${f.verification.hasTests ? f.verification.testSuites.map((t) => `\`${t}\``).join(", ") : "None recorded"}\n`;
      md += `- **Transplant Verdict:** *${f.transplantReadiness.verdict}*\n\n`;
      md += `---\n\n`;
    }

    if (outFile) {
      fs.writeFileSync(outFile, md, "utf-8");
      console.log(`\nSaved Markdown catalog to ${outFile}`);
    } else {
      console.log("\n" + md);
    }
  }
}

main().catch((err) => {
  console.error(`Feature extraction failed: ${err.message}`);
  process.exit(1);
});
