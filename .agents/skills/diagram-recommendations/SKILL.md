---
name: diagram-recommendations
description: "Discover, score, and generate the most informative and high-impact architectural diagrams for any indexed repository using graph topology analysis (RFC 016)."
---

# Repository Diagram Recommendations (`diagram-recommendations`)

Use this skill to automatically evaluate an indexed repository's SQLite knowledge graph, score candidate diagrams on a **Utility Score (0–100)**, and generate actionable Mermaid or vector architecture diagrams without guesswork.

## 1. Quick Start

### Recommend Top Diagrams for Current Project
```bash
# Output prioritized recommendations in Markdown format
node scripts/recommend-diagrams.mjs --project codebase-memory-mcp-ui --format markdown
```

### Fast Summary (< 100ms)
```bash
# Output one-line summary per recommendation
node scripts/recommend-diagrams.mjs --project codebase-memory-mcp-ui --format summary
```

### Auto-Generate Mermaid Diagram Files
```bash
# Automatically write .mermaid files to .codebase-memory/diagrams/<project>/
node scripts/recommend-diagrams.mjs --project codebase-memory-mcp-ui --generate
```

### Filter by Perspective / Category
```bash
# Filter for behavioral call sequence traces
node scripts/recommend-diagrams.mjs --category behavioral --limit 5

# Filter for quality, fragility, and error flow diagrams
node scripts/recommend-diagrams.mjs --category quality --min-score 70
```

---

## 2. Supported Diagram Categories & Heuristics

The recommendation engine executes 7 pattern analyzers:

| Category | Diagram Type | Detection Heuristic | Value to Developers & Agents |
|---|---|---|---|
| **Behavioral** | `sequence` | Identifies functions with high downstream fan-out across multiple files | Chronological call sequence from high-blast-radius entry points |
| **Structural** | `architecture` | Identifies package hierarchies & circular import cycles (SCC) | High-level subsystem boundaries and architectural smell cycles |
| **Quality** | `fragility_network` | Queries `FILE_CHANGES_WITH` for Git co-change coupling without direct imports | Highlights hidden file coupling and fragility risk before PRs |
| **Data Flow** | `dataflow` | Traces `Route` / CLI handlers down to persistence and `WRITES` | Ingress-to-storage transformation pipelines |
| **Quality** | `error_flow` | Maps `THROWS` / `RAISES` exception paths | Unhandled exception bubbling and error hazard maps |
| **Quality** | `clone_clusters` | Evaluates cross-file AST duplicates (`SIMILAR_TO`, Jaccard $\ge 0.85$) | Shared library extraction and deduplication roadmap |
| **Quality** | `test_coverage` | Maps `TESTS` edges to core engine functions | Visualizes test gaps and high-centrality untested blindspots |

---

## 3. Web UI Workflow (`/?tab=diagrams`)

In the Codebase Memory Web UI (`localhost:5173` or `127.0.0.1:9749`):
1. Navigate to the **Diagrams** tab (`/?tab=diagrams`).
2. Switch between **Verified Architecture Diagrams** and **Recommended for this Project**.
3. Review recommended cards with **Utility Scores**, **Priority Badges**, and **Metrics**.
4. Click **[Generate & View Diagram]** to inspect live rendered Mermaid diagrams, copy syntax, or download vector assets.

---

## 4. Programmatic Node.js Usage

```javascript
import { recommendDiagramsForProject, renderRecommendationsMarkdown } from "./scripts/recommend_engine.mjs";

const result = recommendDiagramsForProject("my-repo", {
  limit: 6,
  minScore: 60,
  category: "all"
});

console.log(`Evaluated ${result.total_candidates_evaluated} candidates.`);
for (const rec of result.recommendations) {
  console.log(`- [${rec.utility_score}] ${rec.title} (${rec.type})`);
  // rec.mermaid contains the ready-to-render Mermaid syntax!
}
```
