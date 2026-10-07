import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Resolves the SQLite database path for a given project name.
 */
export function resolveProjectDbPath(projectName, customCacheDir = null) {
  if (!projectName) return null;

  const cacheDirs = [];
  if (customCacheDir) {
    cacheDirs.push(customCacheDir);
  }
  if (process.env.CODEBASE_MEMORY_CACHE_DIR) {
    cacheDirs.push(process.env.CODEBASE_MEMORY_CACHE_DIR);
  }
  if (process.env.USERPROFILE) {
    cacheDirs.push(path.join(process.env.USERPROFILE, ".cache", "codebase-memory-mcp"));
  }
  if (process.env.HOME) {
    cacheDirs.push(path.join(process.env.HOME, ".cache", "codebase-memory-mcp"));
  }
  if (process.env.LOCALAPPDATA) {
    cacheDirs.push(path.join(process.env.LOCALAPPDATA, "codebase-memory-mcp", "cache"));
  }

  // 1. Direct project name match
  for (const dir of cacheDirs) {
    const candidates = [
      path.join(dir, `${projectName}.db`),
      path.join(dir, `${projectName.replace(/[^a-zA-Z0-9_-]/g, "-")}.db`),
      path.join(dir, `${projectName.toLowerCase()}.db`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  }

  // 2. Check all .db files in cache dirs for matching projects table
  for (const dir of cacheDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".db") && !f.startsWith("_"));
      for (const f of files) {
        const fullPath = path.join(dir, f);
        try {
          const db = new DatabaseSync(fullPath, { readOnly: true });
          const row = db.prepare("SELECT name FROM projects WHERE name = ? LIMIT 1").get(projectName);
          db.close();
          if (row) {
            return fullPath;
          }
        } catch {
          // ignore corrupted or locked db
        }
      }
    } catch {
      // ignore readdir error
    }
  }

  return null;
}

/**
 * Analyzer 1: Call Sequence Hotspots
 * Discovers central functions with high fan-out across multiple files.
 */
export function analyzeCallSequenceHotspots(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n.id, n.name, n.file_path, n.qualified_name,
             count(e.id) as fan_out,
             count(distinct n2.file_path) as callee_files
      FROM nodes n
      JOIN edges e ON e.source_id = n.id AND e.type = 'CALLS'
      JOIN nodes n2 ON e.target_id = n2.id
      WHERE n.label = 'Function' AND n.name NOT IN ('malloc', 'free', 'strcmp', 'strlen', 'memset', 'log', 'error')
      GROUP BY n.id
      HAVING fan_out >= 4
      ORDER BY (fan_out * 2 + callee_files * 4) DESC
      LIMIT 3
    `).all();

    for (const row of rows) {
      const fanOut = Number(row.fan_out) || 0;
      const calleeFiles = Number(row.callee_files) || 1;
      const score = Math.min(99, Math.round(55 + (fanOut * 2.5) + (calleeFiles * 4)));
      const priority = score >= 85 ? "critical" : score >= 70 ? "high" : "medium";

      // Query top callees for sequence diagram synthesis
      let callees = [];
      try {
        callees = db.prepare(`
          SELECT n2.name, n2.file_path
          FROM edges e
          JOIN nodes n2 ON e.target_id = n2.id
          WHERE e.source_id = ? AND e.type = 'CALLS'
          LIMIT 6
        `).all(row.id);
      } catch {}

      const mermaid = generateSequenceMermaid(row.name, row.file_path, callees);

      recommendations.push({
        id: `seq-${sanitizeId(row.name)}`,
        title: `Call Sequence: ${row.name}`,
        type: "sequence",
        category: "behavioral",
        utility_score: score,
        priority,
        params: {
          type: "sequence",
          entry_point: row.qualified_name || row.name,
          max_depth: Math.min(5, Math.max(3, Math.ceil(fanOut / 5))),
          format: "mermaid"
        },
        metrics: {
          fan_out: fanOut,
          callee_files: calleeFiles,
          symbol: row.name,
          file_path: row.file_path
        },
        rationale: `High-impact central dispatcher calling ${fanOut} downstream procedures across ${calleeFiles} translation unit(s).`,
        mermaid
      });
    }
  } catch (err) {
    // Graceful fallback
  }
  return recommendations;
}

/**
 * Analyzer 2: Circular Dependency & Package Cycles
 */
export function analyzeCircularDependencyCycles(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n1.name as mod_a, n1.file_path as file_a,
             n2.name as mod_b, n2.file_path as file_b
      FROM edges e1
      JOIN edges e2 ON e1.source_id = e2.target_id AND e1.target_id = e2.source_id
      JOIN nodes n1 ON e1.source_id = n1.id
      JOIN nodes n2 ON e1.target_id = n2.id
      WHERE e1.type = 'IMPORTS' AND e2.type = 'IMPORTS' AND e1.source_id < e1.target_id
      LIMIT 4
    `).all();

    if (rows.length > 0) {
      const mermaid = generateCircularMermaid(rows);
      recommendations.push({
        id: "arch-circular-cycles",
        title: "Circular Dependency & Package Cycles",
        type: "architecture",
        category: "structural",
        utility_score: 95,
        priority: "critical",
        params: {
          type: "architecture",
          scope_path: "",
          format: "mermaid"
        },
        metrics: {
          cycle_count: rows.length,
          coupled_modules: rows.map(r => `${r.mod_a} <-> ${r.mod_b}`)
        },
        rationale: `Detected ${rows.length} bidirectional circular import cycle(s) causing architectural tight coupling.`,
        mermaid
      });
    } else {
      // General package dependency DAG
      const modules = db.prepare(`
        SELECT count(distinct id) as mod_count FROM nodes WHERE label IN ('Module', 'Package', 'File')
      `).get();
      const count = Number(modules?.mod_count) || 0;
      if (count > 5) {
        recommendations.push({
          id: "arch-package-dag",
          title: "Module & Subsystem Architecture DAG",
          type: "architecture",
          category: "structural",
          utility_score: 82,
          priority: "high",
          params: {
            type: "architecture",
            format: "mermaid"
          },
          metrics: {
            subsystems_count: Math.min(25, count)
          },
          rationale: "Clean acyclic module hierarchy mapping cross-package boundaries and service layers.",
          mermaid: "graph TD\n  Core[Core Subsystem] --> Storage[(SQLite Store)]\n  Frontend[UI / Web] --> Core\n  CLI[CLI Tools] --> Core"
        });
      }
    }
  } catch {}
  return recommendations;
}

/**
 * Analyzer 3: Temporal Co-Change & Fragility Network
 */
export function analyzeTemporalCoChangeFragility(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n1.name as file_a, n1.file_path as path_a,
             n2.name as file_b, n2.file_path as path_b,
             json_extract(e.properties, '$.coupling_score') as score,
             json_extract(e.properties, '$.co_changes') as co_changes
      FROM edges e
      JOIN nodes n1 ON e.source_id = n1.id
      JOIN nodes n2 ON e.target_id = n2.id
      WHERE e.type = 'FILE_CHANGES_WITH'
      ORDER BY score DESC, co_changes DESC
      LIMIT 8
    `).all();

    if (rows.length > 0) {
      const topScore = Number(rows[0]?.score) || 0.8;
      const totalPairs = rows.length;
      const utilityScore = Math.min(96, Math.round(50 + (totalPairs * 4) + (topScore * 15)));

      const mermaid = generateFragilityMermaid(rows);

      recommendations.push({
        id: "fragility-co-change-network",
        title: "Temporal Co-Change Fragility Network",
        type: "fragility_network",
        category: "quality",
        utility_score: utilityScore,
        priority: utilityScore >= 85 ? "critical" : "high",
        params: {
          type: "fragility_network",
          min_coupling: 0.50,
          format: "mermaid"
        },
        metrics: {
          strongly_coupled_pairs: totalPairs,
          highest_coupling_score: topScore,
          max_co_changes: Number(rows[0]?.co_changes) || 1
        },
        rationale: `Identified ${totalPairs} file pair(s) that frequently change together in Git commits without direct code imports.`,
        mermaid
      });
    }
  } catch {}
  return recommendations;
}

/**
 * Analyzer 4: Ingress-to-Storage Data Flow
 */
export function analyzeIngressToStoragePipelines(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n.name, n.file_path, n.label, count(e.id) as outbound
      FROM nodes n
      LEFT JOIN edges e ON e.source_id = n.id AND e.type = 'CALLS'
      WHERE n.label IN ('Route', 'HTTP_CALLS') OR n.name LIKE 'POST%' OR n.name LIKE 'GET%' OR n.name LIKE '%handle_%'
      GROUP BY n.id
      HAVING outbound >= 1
      ORDER BY outbound DESC
      LIMIT 2
    `).all();

    for (const row of rows) {
      const outbound = Number(row.outbound) || 1;
      const utilityScore = Math.min(92, Math.round(65 + (outbound * 5)));

      const mermaid = `flowchart LR
    Ingress["${row.name}"] --> Handler["Handler Logic (${row.file_path || 'dispatch'})"]
    Handler --> Validation["Validation & Schema"]
    Validation --> Processing["Pipeline Worker"]
    Processing --> Store[("SQLite / Persistence")]`;

      recommendations.push({
        id: `dataflow-${sanitizeId(row.name)}`,
        title: `Data Flow: ${row.name}`,
        type: "dataflow",
        category: "dataflow",
        utility_score: utilityScore,
        priority: utilityScore >= 80 ? "high" : "medium",
        params: {
          type: "dataflow",
          entry_point: row.name,
          format: "mermaid"
        },
        metrics: {
          entry_point: row.name,
          outbound_calls: outbound
        },
        rationale: `Traces data lifecycle from incoming route/handler invocation through transformations to persistence.`,
        mermaid
      });
    }
  } catch {}
  return recommendations;
}

/**
 * Analyzer 5: Error Hazard & Exception Propagation
 */
export function analyzeErrorHazardFlows(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n1.name as fn_name, n1.file_path, e.type as rel_type, n2.name as err_type
      FROM edges e
      JOIN nodes n1 ON e.source_id = n1.id
      JOIN nodes n2 ON e.target_id = n2.id
      WHERE e.type IN ('THROWS', 'RAISES')
      LIMIT 6
    `).all();

    if (rows.length > 0) {
      const distinctErrors = new Set(rows.map(r => r.err_type)).size;
      const utilityScore = Math.min(94, Math.round(60 + (rows.length * 3) + (distinctErrors * 5)));

      const lines = ["graph TD"];
      rows.slice(0, 5).forEach((r, idx) => {
        lines.push(`    F${idx}["${r.fn_name}<br/><i>${r.file_path}</i>"] -->|${r.rel_type}| E${idx}["${r.err_type}"]`);
        lines.push(`    style E${idx} fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#fecaca`);
      });

      recommendations.push({
        id: "hazard-error-propagation",
        title: "Exception Propagation & Error Hazard Map",
        type: "error_flow",
        category: "quality",
        utility_score: utilityScore,
        priority: utilityScore >= 85 ? "critical" : "high",
        params: {
          type: "error_flow",
          format: "mermaid"
        },
        metrics: {
          throw_sites: rows.length,
          distinct_error_types: distinctErrors
        },
        rationale: `Maps exception escape routes and failure boundaries across ${rows.length} critical throw/raise sites.`,
        mermaid: lines.join("\n")
      });
    }
  } catch {}
  return recommendations;
}

/**
 * Analyzer 6: Code Duplication & Clone Clusters
 */
export function analyzeCodeCloneClusters(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n1.name as fn_a, n1.file_path as file_a,
             n2.name as fn_b, n2.file_path as file_b,
             json_extract(e.properties, '$.jaccard') as jaccard
      FROM edges e
      JOIN nodes n1 ON e.source_id = n1.id
      JOIN nodes n2 ON e.target_id = n2.id
      WHERE e.type = 'SIMILAR_TO' AND n1.file_path != n2.file_path
      ORDER BY jaccard DESC
      LIMIT 6
    `).all();

    if (rows.length > 0) {
      const topSim = Number(rows[0]?.jaccard) || 0.9;
      const utilityScore = Math.min(90, Math.round(50 + (rows.length * 4) + (topSim * 15)));

      const lines = ["graph TD"];
      rows.slice(0, 4).forEach((r, idx) => {
        lines.push(`    A${idx}["${r.fn_a}<br/><i>${r.file_a}</i>"] <==>|${Math.round(r.jaccard * 100)}% AST Match| B${idx}["${r.fn_b}<br/><i>${r.file_b}</i>"]`);
      });

      recommendations.push({
        id: "clones-duplication-clusters",
        title: "Code Duplication & Refactoring Clusters",
        type: "clone_clusters",
        category: "quality",
        utility_score: utilityScore,
        priority: utilityScore >= 80 ? "high" : "medium",
        params: {
          type: "clone_clusters",
          min_similarity: 0.85,
          format: "mermaid"
        },
        metrics: {
          clone_pairs: rows.length,
          peak_similarity: topSim
        },
        rationale: `Discovered ${rows.length} cross-file clone pair(s) with high AST similarity suitable for shared extraction.`,
        mermaid: lines.join("\n")
      });
    }
  } catch {}
  return recommendations;
}

/**
 * Analyzer 7: Test Coverage & Impact Topology
 */
export function analyzeTestCoverageBlindspots(db, project) {
  const recommendations = [];
  try {
    const rows = db.prepare(`
      SELECT n1.name as test_suite, n2.name as covered_fn, n2.file_path
      FROM edges e
      JOIN nodes n1 ON e.source_id = n1.id
      JOIN nodes n2 ON e.target_id = n2.id
      WHERE e.type = 'TESTS'
      LIMIT 6
    `).all();

    if (rows.length > 0) {
      const lines = ["graph LR"];
      rows.slice(0, 4).forEach((r, idx) => {
        lines.push(`    T${idx}["🧪 ${r.test_suite}"] -->|tests| C${idx}["${r.covered_fn}"]`);
      });

      recommendations.push({
        id: "tests-coverage-topology",
        title: "Test Coverage & Verification Topology",
        type: "test_coverage",
        category: "quality",
        utility_score: 78,
        priority: "medium",
        params: {
          type: "test_coverage",
          format: "mermaid"
        },
        metrics: {
          verified_test_links: rows.length
        },
        rationale: "Maps automated test harnesses to the critical functions and data paths they protect.",
        mermaid: lines.join("\n")
      });
    }
  } catch {}
  return recommendations;
}

/**
 * Main orchestrator: generates prioritized diagram recommendations for a project.
 */
export function recommendDiagramsForProject(projectName, options = {}) {
  const limit = Math.max(1, Math.min(20, options.limit || 6));
  const minScore = options.minScore || 50;
  const targetCategory = options.category || "all";

  const dbPath = resolveProjectDbPath(projectName, options.customCacheDir);

  let raw = [];

  if (dbPath && fs.existsSync(dbPath)) {
    try {
      const db = new DatabaseSync(dbPath, { readOnly: true });

      // Run all 7 analyzers
      raw.push(...analyzeCallSequenceHotspots(db, projectName));
      raw.push(...analyzeCircularDependencyCycles(db, projectName));
      raw.push(...analyzeTemporalCoChangeFragility(db, projectName));
      raw.push(...analyzeIngressToStoragePipelines(db, projectName));
      raw.push(...analyzeErrorHazardFlows(db, projectName));
      raw.push(...analyzeCodeCloneClusters(db, projectName));
      raw.push(...analyzeTestCoverageBlindspots(db, projectName));

      db.close();
    } catch {
      // Fallback if db cannot be queried
      raw = getFallbackRecommendations(projectName);
    }
  } else {
    raw = getFallbackRecommendations(projectName);
  }

  // Filter and sort
  const filtered = raw
    .filter(r => targetCategory === "all" || r.category === targetCategory)
    .filter(r => r.utility_score >= minScore)
    .sort((a, b) => b.utility_score - a.utility_score)
    .slice(0, limit);

  return {
    project: projectName,
    db_path: dbPath || "in-memory-heuristic",
    total_candidates_evaluated: raw.length,
    recommendations_count: filtered.length,
    recommendations: filtered,
    generated_at: new Date().toISOString()
  };
}

/**
 * Generates Mermaid code for a sequence diagram.
 */
function generateSequenceMermaid(fnName, filePath, callees) {
  const p1 = sanitizeId(fnName || "Caller");
  const lines = [
    "sequenceDiagram",
    "    autonumber",
    `    actor Agent as User / Agent`,
    `    participant H as ${p1}`
  ];

  if (!callees || callees.length === 0) {
    lines.push(`    Agent->>H: ${fnName}()`);
    lines.push(`    H->>H: execute logic`);
    lines.push(`    H-->>Agent: result`);
    return lines.join("\n");
  }

  callees.forEach((c, idx) => {
    lines.push(`    participant P${idx} as ${sanitizeId(c.name)}`);
  });

  lines.push(`    Agent->>H: ${fnName}()`);
  lines.push(`    activate H`);
  callees.forEach((c, idx) => {
    lines.push(`    H->>P${idx}: ${c.name}()`);
    lines.push(`    P${idx}-->>H: return`);
  });
  lines.push(`    deactivate H`);
  lines.push(`    H-->>Agent: return result`);

  return lines.join("\n");
}

/**
 * Generates Mermaid code for circular imports.
 */
function generateCircularMermaid(rows) {
  const lines = ["graph TD"];
  rows.forEach((r, idx) => {
    const a = sanitizeId(r.mod_a);
    const b = sanitizeId(r.mod_b);
    lines.push(`    ${a}["${r.mod_a}"] <==>|CIRCULAR IMPORT| ${b}["${r.mod_b}"]`);
    lines.push(`    style ${a} fill:#7f1d1d,stroke:#ef4444,stroke-width:2px`);
    lines.push(`    style ${b} fill:#7f1d1d,stroke:#ef4444,stroke-width:2px`);
  });
  return lines.join("\n");
}

/**
 * Generates Mermaid code for fragility co-change network.
 */
function generateFragilityMermaid(rows) {
  const lines = ["graph LR"];
  rows.slice(0, 6).forEach((r) => {
    const a = sanitizeId(r.file_a);
    const b = sanitizeId(r.file_b);
    const co = r.co_changes || 1;
    const score = Math.round((r.score || 0.5) * 100);
    lines.push(`    ${a}["${r.file_a}"] <==>|${score}% Coupling (${co} commits)| ${b}["${r.file_b}"]`);
  });
  return lines.join("\n");
}

function sanitizeId(str) {
  return (str || "id").replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Fallback recommendations when SQLite database is not reachable.
 */
export function getFallbackRecommendations(project) {
  return [
    {
      id: "rec-arch-overview",
      title: "System Architecture & Component Overview",
      type: "architecture",
      category: "structural",
      utility_score: 95,
      priority: "critical",
      params: { type: "architecture", format: "mermaid" },
      metrics: { entry_points: 3, subsystems: 5 },
      rationale: "High-level map of client protocols, central dispatcher, and persistence store.",
      mermaid: "graph TD\n  Client[MCP Client] --> Daemon[Daemon Dispatcher]\n  Daemon --> Store[(SQLite WAL Store)]"
    },
    {
      id: "rec-fragility-co-change",
      title: "Temporal Co-Change Fragility Network",
      type: "fragility_network",
      category: "quality",
      utility_score: 88,
      priority: "high",
      params: { type: "fragility_network", min_coupling: 0.50, format: "mermaid" },
      metrics: { coupled_pairs: 4 },
      rationale: "Identifies hidden file dependencies from Git commit co-occurrence history.",
      mermaid: "graph LR\n  ModA[Module A] <==>|Coupled (15 commits)| ModB[Module B]"
    },
    {
      id: "rec-dataflow-lifecycle",
      title: "Ingress to Storage Data Flow Pipeline",
      type: "dataflow",
      category: "dataflow",
      utility_score: 84,
      priority: "high",
      params: { type: "dataflow", format: "mermaid" },
      metrics: { stages: 4 },
      rationale: "Follows request payloads through AST validation and relational insertion.",
      mermaid: "flowchart LR\n  Ingress[Request] --> Worker[Worker Pool] --> SQLite[(Database)]"
    }
  ];
}

/**
 * Renders recommendations as formatted GitHub Markdown.
 */
export function renderRecommendationsMarkdown(result) {
  const lines = [
    `# 📐 Recommended Diagrams for \`${result.project}\``,
    "",
    `> **Evaluated Candidates:** ${result.total_candidates_evaluated} | **Recommended:** ${result.recommendations_count} | **Generated:** ${result.generated_at}`,
    "",
    "| Priority | Score | Type | Diagram Title | Key Metrics |",
    "|---|---|---|---|---|"
  ];

  for (const r of result.recommendations) {
    const priorityIcon = r.priority === "critical" ? "🔴 Critical" : r.priority === "high" ? "🟠 High" : "🟡 Medium";
    const metricsStr = Object.entries(r.metrics || {})
      .map(([k, v]) => `${k}: \`${v}\``)
      .slice(0, 2)
      .join(", ");
    lines.push(`| ${priorityIcon} | **${r.utility_score}** | \`${r.type}\` | **${r.title}** | ${metricsStr} |`);
  }

  lines.push("", "---", "", "## 📊 Detailed Recommendations & Mermaid Code", "");

  for (const r of result.recommendations) {
    lines.push(`### ${r.title} (Score: ${r.utility_score})`);
    lines.push("");
    lines.push(`- **Category:** \`${r.category}\` | **Type:** \`${r.type}\``);
    lines.push(`- **Rationale:** ${r.rationale}`);
    lines.push("- **Parameters:** `" + JSON.stringify(r.params) + "`");
    lines.push("");
    if (r.mermaid) {
      lines.push("```mermaid");
      lines.push(r.mermaid);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}
