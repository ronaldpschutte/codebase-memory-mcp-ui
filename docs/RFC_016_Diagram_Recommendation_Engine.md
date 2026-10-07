# RFC 016: Repository Diagram Recommendation Engine (`recommend_diagrams`) — Automated Discovery, Scoring & Generation

- **RFC Number:** 016
- **Title:** Repository Diagram Recommendation Engine (`recommend_diagrams`) — Automated Discovery, Scoring & Generation
- **Status:** Proposed
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `scripts/`, `graph-ui/src/components/DiagramsTab.tsx`, `.agents/skills/diagram-recommendations/`, `docs/`
- **Target Version:** v0.16.0
- **Created:** 2026-10-07
- **Related RFCs:** [RFC 001](RFC_001_analyze_blast_radius.md) (blast radius), [RFC 002](RFC_002_get_api_surface.md) (API surface), [RFC 003](RFC_003_audit_test_coverage.md) (test coverage), [RFC 004](RFC_004_find_code_clones.md) (code clones), [RFC 005](RFC_005_get_coupled_files.md) (coupled files), [RFC 008](RFC_008_trace_error_flow.md) (error flows), [RFC 014](RFC_014_AI_Readiness_Audit_Tool.md) (AI readiness), [RFC 015](RFC_015_Repository_Analysis_Reports_Page.md) (reports page)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this RFC propose?** | An automated **Diagram Recommendation Engine** (`recommend_diagrams`) that inspects the SQLite knowledge graph and topological metrics of any indexed repository, discovers the most informative architectural patterns, scores each candidate diagram on a **Utility Score (0–100)**, and outputs an actionable catalog of recommended diagrams complete with ready-to-render parameters (entry points, scopes, formats, and rationale). |
| **Why is this needed?** | Codebases differ drastically: an API microservice benefits most from Ingress-to-Storage Data Flow and Sequence traces; a monolith with package cycles benefits from SCC Architecture DAGs; a legacy system with frequent regressions benefits from Temporal Co-Change and Error Propagation hazard maps. Today, developers and AI agents must manually guess which diagrams to create and which entry points to trace. |
| **Does it touch Core C?** | **No.** In strict accordance with the **Core C Preference Rule**, the recommendation engine and diagram synthesis are implemented in TypeScript/Node.js and React. It composes the existing native MCP tools (`query_graph`, `export_diagram`, `get_graph_schema`, `get_coupled_files`, `trace_error_flow`, `get_api_surface`) and SQLite queries without altering the native C daemon core. |
| **What diagrams can it recommend?** | 1. **Architecture & Component DAGs** (subsystem hierarchies, circular dependency cycles).<br>2. **Critical Call Sequences** (hotspot handlers with highest fan-in/fan-out or blast radius).<br>3. **Ingress-to-Storage Dataflow** (HTTP Route / CLI $\to$ Handler $\to$ State/Database writes).<br>4. **Temporal Co-Change & Fragility Networks** (files that frequently change together in Git).<br>5. **Exception Propagation & Error Hazard Maps** (unhandled error bubbling paths).<br>6. **Code Duplication & Clone Cluster Maps** (dense AST clone pairs across modules).<br>7. **Test Coverage & Blindspot Topologies** (test suites mapped to implementation modules). |
| **How can developers and agents use it?** | 1. **MCP Tool / Agent Skill:** `recommend_diagrams(project="...")` returns structured JSON and Markdown.<br>2. **Interactive UI (`DiagramsTab`):** A new "Recommended For You" carousel with 1-click **Generate** buttons.<br>3. **Headless CLI:** `node scripts/recommend-diagrams.mjs --project <name> --generate`. |

---

## 1. Motivation & Problem Statement

### 1.1 The Blank Canvas Dilemma in Codebase Visualization
Between v0.10.0 and v0.15.0, Codebase Memory implemented deterministic diagram generation (`export_diagram` and `PRD_NATIVE_DIAGRAM_GENERATION.md`), enabling instant export of Architecture, Sequence, Data Flow, and Package Dependency diagrams.

However, users and AI agents currently face a **discovery bottleneck**:
1. **Unknown High-Value Targets:** In a codebase with 20,000 functions across 800 files, which function is the *right* entry point for a sequence diagram? Tracing a trivial helper yields a useless 2-node diagram; tracing a central dispatcher yields a high-value blueprint.
2. **Hidden Architectural Risks:** Developers do not know that their codebase has 15 files with 100% temporal co-change coupling, or a 4-package circular dependency cycle, until an issue occurs.
3. **One-Size-Fits-All Inefficiency:** Agents waste tokens requesting diagrams that do not fit the project's paradigm (e.g., asking for an API Data Flow diagram in a pure CLI tool or header-only C library).

### 1.2 The Untapped Intelligence in the SQLite Knowledge Graph
When Codebase Memory indexes a project, the local SQLite database (`~/.cache/codebase-memory-mcp/<project>.db`) captures over 20 distinct edge types and rich node properties:
- `edges` table: `CALLS` (72k+), `USAGE` (29k+), `SIMILAR_TO` (17k+), `WRITES` (3.7k+), `IMPORTS` (2.2k+), `FILE_CHANGES_WITH` (465), `CONFIGURES` (394), `TESTS` (110), `HTTP_CALLS` (93), `THROWS`/`RAISES` (22).
- Node centrality metrics: fan-in (in-degree callers), fan-out (out-degree callees), line spans, and language classifications.

The data required to automatically calculate which diagrams will yield the highest cognitive insight is **already present** in the database. What is missing is an **evaluator engine** that mines this graph, scores diagram opportunities, and presents them ready for immediate rendering.

---

## 2. Design Goals & Non-Goals

### 2.1 Goals
- **G-1: Heuristic Utility Scoring (0–100):** Every recommended diagram is assigned a transparent score based on complexity, risk, fan-in/fan-out density, and information gain.
- **G-2: Zero-Guessing Generation Parameters:** Every recommendation must provide the exact parameters required to generate it (`type`, `entry_point`, `scope_path`, `format`, `max_depth`), plus a human-readable `rationale`.
- **G-3: Outside Core C Architecture:** Implemented in TypeScript/JavaScript without modifying the Core C binary, in strict accordance with the Core C Preference Rule.
- **G-4: Seamless Integration:** Accessible via MCP tool interface, command-line runner (`scripts/recommend-diagrams.mjs`), and the visual `DiagramsTab` in `graph-ui`.
- **G-5: Sub-Second Recommendation Execution:** Computing recommendations across repositories with >25,000 nodes must complete in under **800 milliseconds** via indexed SQLite queries.

### 2.2 Non-Goals
- **NG-1: Replacing `export_diagram`:** This tool does not replace the diagram renderer; it is an intelligent selector and orchestrator that determines *what* to render and with *which parameters*.
- **NG-2: LLM Token Consumption:** The recommendation logic uses deterministic graph heuristics, not generative LLM prompts, ensuring 100% reproducible and instantaneous recommendations.

---

## 3. Diagram Recommendation Heuristics & Pattern Analyzers

The engine executes **7 distinct pattern analyzers** against the SQLite graph:

```mermaid
graph TD
    subgraph SQLite Graph Tables
        N[(nodes Table)]
        E[(edges Table)]
        L[(lsp_surface Table)]
    end

    subgraph Recommendation Engine (scripts/recommend_diagrams.mjs)
        A1[1. Entry Point Hotspot Analyzer]
        A2[2. Circular Dependency Cycle Analyzer]
        A3[3. Temporal Co-Change Fragility Analyzer]
        A4[4. Ingress-to-Storage Pipeline Analyzer]
        A5[5. Error Hazard & Exception Flow Analyzer]
        A6[6. Code Duplication & Clone Cluster Analyzer]
        A7[7. Test Coverage Blindspot Analyzer]
    end

    subgraph Scoring & Ranking
        Score[Utility Score Evaluator: 0 - 100]
        Catalog[Prioritized Diagram Catalog]
    end

    N & E & L --> A1 & A2 & A3 & A4 & A5 & A6 & A7
    A1 & A2 & A3 & A4 & A5 & A6 & A7 --> Score
    Score --> Catalog
```

---

### 3.1 Analyzer 1: Critical Call Sequence Hotspots
- **Target Diagram**: `type: "sequence"`
- **Detection Heuristic**:
  - Identifies top functions with high downstream fan-out ($\ge 4$ distinct callees) and multi-file call branches, or high blast radius.
  - Queries `edges WHERE type = 'CALLS'`.
  - Excludes boilerplate utility functions (e.g., `malloc`, `strcmp`, `log_info`).
- **Scoring Formula**:
  $$\text{Score} = \min(100, 50 + (\text{fan\_out} \times 4) + (\text{distinct\_callee\_files} \times 8))$$
- **Example Recommendation**:
  ```json
  {
    "id": "seq-cbm-layout-compute",
    "title": "Call Sequence: 3D Layout Pipeline Dispatcher",
    "type": "sequence",
    "entry_point": "cbm_layout_compute",
    "max_depth": 4,
    "utility_score": 94,
    "category": "Behavioral",
    "rationale": "High-impact central dispatcher calling 12 sub-procedures across 4 separate translation units."
  }
  ```

---

### 3.2 Analyzer 2: Package & Module Circular Dependency Cycles
- **Target Diagram**: `type: "architecture"` / `type: "dependencies"`
- **Detection Heuristic**:
  - Identifies Strongly Connected Components (SCC) in `edges WHERE type = 'IMPORTS'` or cross-folder `CALLS`.
  - Highlights cycles where `Package A -> Package B -> Package A`.
- **Scoring Formula**:
  $$\text{Score} = \begin{cases} 95, & \text{if circular cycle detected} \\ 60 + (\text{distinct\_modules} \times 2), & \text{standard module DAG} \end{cases}$$
- **Rationale**: Circular dependencies cause tight coupling, fragile refactorings, and compilation order issues.

---

### 3.3 Analyzer 3: Temporal Co-Change & Fragility Network
- **Target Diagram**: `type: "fragility_network"` (or custom Mermaid network)
- **Detection Heuristic**:
  - Queries `edges WHERE type = 'FILE_CHANGES_WITH'`.
  - Filters pairs where `coupling_score >= 0.60` and `co_changes >= 4`.
  - Flags pairs that do **not** have a direct `IMPORTS` edge (hidden coupling).
- **Scoring Formula**:
  $$\text{Score} = \min(100, 40 + (\text{hidden\_coupled\_pairs} \times 12))$$
- **Rationale**: Reveals files that silently break together during pull requests despite lack of direct code dependencies.

---

### 3.4 Analyzer 4: Ingress-to-Storage Data Flow
- **Target Diagram**: `type: "dataflow"`
- **Detection Heuristic**:
  - Identifies paths starting at `Route` nodes (or CLI argument handlers), traversing `CALLS`, and reaching `WRITES` edges or database persistence functions (`cbm_store_*`, `sqlite3_step`).
- **Scoring Formula**:
  $$\text{Score} = \min(100, 60 + (\text{persistence\_depth} \times 8) + (\text{routes\_count} \times 2))$$
- **Rationale**: Invaluable for understanding how incoming user data is validated, transformed, and saved.

---

### 3.5 Analyzer 5: Error Propagation & Exception Hazard Map
- **Target Diagram**: `type: "error_flow"`
- **Detection Heuristic**:
  - Queries `edges WHERE type IN ('THROWS', 'RAISES')`.
  - Analyzes whether thrown exceptions cross API/module boundaries.
- **Scoring Formula**:
  $$\text{Score} = \min(100, 45 + (\text{exception\_types} \times 10) + (\text{unhandled\_paths} \times 15))$$
- **Rationale**: Pinpoints error escape routes and missing catch boundaries before production deployment.

---

### 3.6 Analyzer 6: Code Duplication & Clone Clusters
- **Target Diagram**: `type: "clone_clusters"`
- **Detection Heuristic**:
  - Queries `edges WHERE type = 'SIMILAR_TO'` with `jaccard >= 0.85` and `file_path_a != file_path_b`.
  - Groups clusters of duplicated logic across multiple subsystems.
- **Scoring Formula**:
  $$\text{Score} = \min(100, 30 + (\text{cross\_file\_clone\_clusters} \times 15))$$
- **Rationale**: Direct roadmap for deduplication and shared library extraction.

---

### 3.7 Analyzer 7: Test Coverage & Impact Topology
- **Target Diagram**: `type: "test_coverage_topology"`
- **Detection Heuristic**:
  - Measures ratio of `TESTS` edges to total `Function` nodes.
  - Identifies high-centrality functions that have 0 incoming `TESTS` edges (high-risk blindspots).
- **Scoring Formula**:
  $$\text{Score} = \min(100, 50 + (\text{untested\_hub\_functions} \times 10))$$
- **Rationale**: Shows developers where automated tests are urgently required.

---

## 4. MCP Tool Specification: `recommend_diagrams`

### 4.1 Tool Registration Schema
```json
{
  "name": "recommend_diagrams",
  "description": "Analyze repository graph topology and SQLite metrics to recommend the most informative, high-impact diagrams with ready-to-render parameters and utility scores.",
  "parameters": {
    "type": "object",
    "properties": {
      "project": {
        "type": "string",
        "description": "Target indexed project name."
      },
      "limit": {
        "type": "integer",
        "default": 6,
        "description": "Maximum number of recommended diagrams to return (default: 6, max: 20)."
      },
      "category": {
        "type": "string",
        "enum": ["all", "structural", "behavioral", "quality", "dataflow"],
        "default": "all",
        "description": "Filter recommendations by architectural perspective."
      },
      "min_score": {
        "type": "integer",
        "default": 50,
        "description": "Minimum utility score threshold (0-100)."
      }
    },
    "required": ["project"]
  }
}
```

### 4.2 Example Output Format (JSON)
```json
{
  "project": "codebase-memory-mcp-ui",
  "total_candidates_analyzed": 142,
  "recommendations_count": 5,
  "recommendations": [
    {
      "id": "rec-seq-cbm-layout-compute",
      "title": "Call Sequence: 3D Layout Graph Resolution",
      "type": "sequence",
      "category": "behavioral",
      "utility_score": 96,
      "priority": "critical",
      "params": {
        "type": "sequence",
        "entry_point": "cbm_layout_compute",
        "max_depth": 4,
        "format": "mermaid"
      },
      "metrics": {
        "fan_out": 12,
        "distinct_files": 4,
        "call_depth": 4
      },
      "rationale": "Central calculation engine for 3D graph layout with highest multi-module execution branching."
    },
    {
      "id": "rec-fragility-network",
      "title": "Temporal Co-Change Fragility Network",
      "type": "fragility_network",
      "category": "quality",
      "utility_score": 88,
      "priority": "high",
      "params": {
        "type": "fragility_network",
        "min_coupling": 0.60,
        "format": "mermaid"
      },
      "metrics": {
        "coupled_file_pairs": 8,
        "max_co_changes": 22
      },
      "rationale": "Detected 8 strongly coupled file pairs that frequently change in unison without direct import dependencies."
    },
    {
      "id": "rec-dataflow-indexing",
      "title": "Data Flow: Pipeline Ingress to SQLite WAL",
      "type": "dataflow",
      "category": "dataflow",
      "utility_score": 85,
      "priority": "high",
      "params": {
        "type": "dataflow",
        "entry_point": "POST /api/index",
        "format": "mermaid"
      },
      "metrics": {
        "stages": 4,
        "storage_writes": 7
      },
      "rationale": "Traces repository scanning from HTTP payload through AST workers to SQLite persistence tables."
    }
  ]
}
```

---

## 5. UI Integration in `graph-ui` (`DiagramsTab.tsx`)

In [graph-ui/src/components/DiagramsTab.tsx](file:///c:/AI/Source/codebase-memory-mcp-ui/graph-ui/src/components/DiagramsTab.tsx), the user experience will be upgraded from a static list of 6 pre-baked diagrams to a dynamic, project-aware diagram studio:

1. **"Recommended for this Project" Banner**:
   - Appears prominently at the top of the Diagrams Tab when a project is selected.
   - Shows badge pills: `Score 96 • Behavioral`, `Score 88 • Fragility`, etc.
2. **Instant "Generate & View" Button**:
   - Clicking a recommendation immediately passes its parameters into `export_diagram` or the dynamic Mermaid renderer and mounts the interactive viewer.
3. **Save to Project Diagrams**:
   - Users can pin generated diagrams directly into the project's documentation catalog.

---

## 6. Implementation Architecture (Outside Core C)

In strict adherence to the **Core C Preference Rule**:

```
┌────────────────────────────────────────────────────────┐
│               Diagram Recommendation Engine             │
│            scripts/recommend_diagrams.mjs              │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            │ Read-only SQL                  │ Standard MCP / JSON-RPC
            ▼                                ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Local SQLite Cache Instance │ │ codebase-memory-mcp Daemon   │
│  (~/.cache/codebase-memory-  │ │ (Existing 26 Native C Tools  │
│   mcp/<project>.db)          │ │  — 100% Unchanged)           │
│  • nodes, edges, lsp_surface │ │ • export_diagram             │
│  • Fast indexed analytical   │ │ • query_graph                │
│    queries (< 50ms)          │ │ • get_coupled_files          │
└──────────────────────────────┘ └──────────────────────────────┘
```

1. **Analytical Queries**: The script directly queries the project's local SQLite database using read-only SQL, or queries the daemon via `query_graph`.
2. **Deterministic Computation**: All 7 heuristic analyzers evaluate in parallel.
3. **Diagram Generation**: Once a recommendation is selected, it leverages the existing `export_diagram` MCP tool or renders custom Mermaid graphs directly in the browser via Mermaid.js.

---

## 7. Deliverables & Work Plan

| Phase | Milestone | Deliverable Files |
|---|---|---|
| **Phase 1** | Recommendation Engine Core | `scripts/recommend_diagrams.mjs`, `scripts/recommend-diagrams.test.mjs` |
| **Phase 2** | Agent Skill Integration | `.agents/skills/diagram-recommendations/SKILL.md` |
| **Phase 3** | Frontend UI Integration | `graph-ui/src/components/DiagramsTab.tsx`, `graph-ui/src/components/DiagramRecommendations.tsx` |
| **Phase 4** | Verification & Test Suite | Vitest UI tests, CLI integration tests, documentation updates |

---

## 8. Summary of Benefits

1. **Eliminates Blank-Page Syndrome**: Neither developers nor AI agents need to wonder what to diagram; the system reveals the most meaningful architectural hotspots immediately.
2. **Direct Actionability**: Every recommendation contains verified parameters that feed directly into deterministic diagram generation.
3. **100% Core C Safety**: Zero native C compiler changes or risk of memory corruption. Clean TypeScript and Node.js composition.
