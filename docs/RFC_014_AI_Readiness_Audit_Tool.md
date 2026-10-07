# RFC 014: AI Readiness Audit Tool (`ai_readiness_audit`)

- **RFC Number:** 014
- **Title:** AI Readiness Audit Tool (`ai_readiness_audit`)
- **Status:** Implemented
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `.agents/skills/ai-readiness-audit/`, `scripts/`, `graph-ui/src/components/readiness/`, `graph-ui/src/pages/`
- **Target Version:** v0.14.0
- **Created:** 2026-10-07
- **Related RFCs:** [RFC 001](RFC_001_analyze_blast_radius.md) – [RFC 008](RFC_008_trace_error_flow.md) (analysis tools), [RFC 012](RFC_012_Code_Quality_Reports_Page.md) (Reports Page), [RFC 013](RFC_013_Update_Agent_Skills_With_New_Tools.md) (Agent Skills Update)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this RFC propose?** | A comprehensive **AI Readiness Auditor** that evaluates repositories against a 5-pillar rubric, grades repository readiness for AI coding agents (0–100 score + letter grade), highlights critical shortcomings (such as missing `SKILL.md` runbooks for detected project tools), and provides one-click or automated remediations. |
| **Does it touch the Core C engine?** | **No.** Adhering to the project's Core C Preference Rule, the audit engine is implemented entirely in TypeScript/JavaScript (as an Agent Skill, CLI runner, and Web UI view) by **composing the existing 26 C MCP tools** (`check_index_coverage`, `audit_test_coverage`, `find_dead_code`, `get_coupled_files`, `get_api_surface`, `query_graph`). |
| **Why not implement in Core C?** | 1. **No Performance Advantage:** The heavy graph traversals, AST parsing, and SQLite lookups are *already* executed in microseconds by the existing C tools. An audit tool merely aggregates these results with file-system heuristics.<br>2. **Rapid Evolution:** AI agent conventions (`AGENTS.md`, `CLAUDE.md`, YAML frontmatter schemas, MCP configurations) evolve weekly. Script/UI layers allow rapid updates without recompiling and distributing native binaries across Linux/macOS/Windows. |
| **How does it detect missing skills?** | It inspects dependency manifests (`package.json`, `Cargo.toml`, `go.mod`, `docker-compose.yml`, `mcp_config.json`, CI scripts) for complex tools/frameworks and cross-references them against installed skills in `.agents/skills/`, `skills/`, and `~/.gemini/`. Missing workflows are reported with template scaffolds. |
| **Where can it be run?** | 1. **Directly in Agent Chat:** Via the `.agents/skills/ai-readiness-audit` skill.<br>2. **In the Web UI:** Under a dedicated "AI Readiness" tab in `graph-ui`.<br>3. **In CI / CLI:** Via `node scripts/audit-ai-readiness.mjs --fail-under 80` to enforce AI readiness guardrails on pull requests. |

---

## 1. Motivation & Problem Statement

### 1.1 The Context Gap in AI Pair Programming
Modern AI agents (Claude Code, Antigravity, Cursor, Codex, Copilot CLI) rely heavily on project-level context to produce correct code. When dropped into a repository, agents face three major failure modes:
1. **Blind Operation (Missing Guidance):** Repositories lacking `AGENTS.md`, `CLAUDE.md`, or `llms.txt` force models to guess build, test, and style conventions, causing syntax regressions and hallucinated CLI parameters.
2. **Missing Operational Skills (Tool Execution Failures):** When repositories introduce specialized tools (Docker Compose, Terraform, Prisma migrations, Stripe CLI, or MCP servers) without corresponding `SKILL.md` runbooks, agents fail or hallucinate non-existent flags.
3. **Graph Blindspots & Missing Guardrails:** If large portions of the codebase fail to parse or lack unit tests, agents cannot verify their edits and introduce silent breaks.

### 1.2 The Opportunity
`codebase-memory-mcp` already maintains the single most complete knowledge graph of a repository:
- AST structure and full-text search across documentation and code (`nodes_fts`).
- Parse coverage and missed range tracking (`check_index_coverage`).
- Entry-point test coverage mapping (`audit_test_coverage`).
- Dead code (`find_dead_code`) and temporal coupling clusters (`get_coupled_files`).

By synthesizing these existing C graph capabilities with file-system inspection of agent instructions and skills, we can provide a definitive **AI Readiness Score** that tells developers exactly what their repo is missing to make AI agents productive and safe.

---

## 2. Core Architectural Strategy: Why Outside Core C?

### 2.1 The Core C Preference Rule
The project adheres to the rule:
> *"ALWAYS prefer implementations that do NOT touch or modify the Core C codebase... ONLY propose or implement changes in Core C when there is a serious, demonstrable performance difference or a strict technical constraint that cannot be achieved outside C."*

### 2.2 Performance & Complexity Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                       AI Agent / User                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ .agents/skills/ai-readiness/ │        │  graph-ui (Vite / React)     │
│   (Node.js Script / Skill)   │        │     AI Readiness Dashboard   │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               │ HTTP / JSON-RPC                       │ HTTP / JSON-RPC
               ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  codebase-memory-mcp Daemon (Existing 26 C Tools — Unchanged)         │
│  • check_index_coverage    • audit_test_coverage   • find_dead_code  │
│  • get_coupled_files       • get_api_surface       • query_graph     │
└──────────────────────────────────────────────────────────────────────┘
```

1. **Zero Computation Bottleneck:** Querying SQLite tables for test coverage, dead code, and index coverage takes under **15 milliseconds** across the entire daemon. The aggregation and scoring logic consists of evaluating ~25 boolean rules and arithmetic formulas. Running this in Node.js or TypeScript takes <2 ms. A C implementation would yield zero noticeable speedup.
2. **Friction of Native C for Heuristic Metadata:** Parsing YAML frontmatter, checking Git ignore patterns, and reading dependency manifests in C requires extensive boilerplate, manual string manipulation, and re-linking vendored parsers. In contrast, Node.js and TypeScript possess battle-tested JSON and YAML parsers.
3. **Decoupled Release Cadence:** Agent conventions change rapidly (new models prefer specific instruction formats, new tools require new skills). Implementing the auditor outside C allows updating rules and heuristics instantly without releasing a new native binary or rebuilding C tool chains.

---

## 3. The 5 Pillars of AI Readiness (The Rubric)

The audit calculates a weighted score from **0 to 100**, mapped to a letter grade:
- **A+ (95–100):** World-class AI ergonomics. Comprehensive skills, tests, and instructions.
- **A (85–94):** Highly optimized for autonomous agents. Minor edge-case gaps.
- **B (70–84):** Functional but prone to occasional hallucination or unverified edits.
- **C (55–69):** Substantial friction. Missing critical runbooks or test guardrails.
- **D (40–54):** Severely under-documented. High risk of agent hallucination.
- **F (<40):** Hostile to AI agents. No context anchors, low graph coverage, zero verification tests.

```
AI Readiness Score (100 pts)
├── Pillar 1: Agent Instructions & Context Anchors (20 pts)
├── Pillar 2: Tool & Skill Coverage               (25 pts)  <-- Critical Focus
├── Pillar 3: Knowledge Graph & Index Integrity   (20 pts)
├── Pillar 4: Test & Verification Guardrails       (20 pts)
└── Pillar 5: Code Graph Hygiene & Boundaries     (15 pts)
```

---

### Pillar 1: Agent Instructions & Context Anchors (Weight: 20%)

| Criterion | Max Points | Evaluation Method |
| :--- | :---: | :--- |
| **Root Instruction Anchor** | 8 | Checks existence of `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or `.cursorrules`. |
| **Build & Test Runbooks** | 5 | Checks if instruction file documents exact build, test, and run commands. |
| **LLM Summary Index** | 4 | Checks existence of `llms.txt` or `docs/llms.txt` (per llmstxt.org standard). |
| **Instruction Freshness** | 3 | Compares commit timestamp of instruction file vs. latest 20 commits in git history. |

---

### Pillar 2: Tool & Skill Coverage (Weight: 25%)

Agents need explicit procedural runbooks when repositories employ specialized frameworks or CLI tools.

| Criterion | Max Points | Evaluation Method |
| :--- | :---: | :--- |
| **Tool-to-Skill Parity** | 12 | Detects third-party tools/services and checks if matching `SKILL.md` runbooks exist in `.agents/skills/` or `skills/` (see §4). |
| **Skill Schema Validity** | 5 | Validates all `SKILL.md` files: must include valid YAML frontmatter with `name` and quoted `description` (preventing Issue #1554 colon parse bugs). |
| **Trigger Descriptions** | 4 | Ensures skill descriptions describe explicit activation criteria (e.g., "Use when...", "Activate to..."). |
| **Workflow Completeness** | 4 | Checks whether skills include concrete step-by-step commands rather than placeholder text. |

---

### Pillar 3: Knowledge Graph & Index Integrity (Weight: 20%)

| Criterion | Max Points | Evaluation Method |
| :--- | :---: | :--- |
| **Index Coverage Ratio** | 8 | Calls `check_index_coverage()`. Penalizes skipped files, parse timeouts, and oversized exclusions. |
| **Freshness & Generation** | 4 | Calls `index_status()`. Confirms index generation is current with working tree head. |
| **Architecture Documentation** | 5 | Checks presence of `ARCHITECTURE.md` or native vector diagrams (`export_diagram`). |
| **Doclink Integrity** | 3 | Checks whether markdown doclinks point to valid repository files without broken references. |

---

### Pillar 4: Test & Verification Guardrails (Weight: 20%)

| Criterion | Max Points | Evaluation Method |
| :--- | :---: | :--- |
| **Entry Point Test Ratio** | 8 | Calls `audit_test_coverage(mode="gaps")`. Measures percentage of entry points covered by structural tests. |
| **Test Command Determinism** | 4 | Confirms presence of standard test harnesses (`npm test`, `cargo test`, `pytest`, `make test`). |
| **Linter / Formatter Config** | 4 | Checks presence of formatting configs (`.clang-format`, `eslint.config.js`, `prettierrc`, `ruff.toml`, etc.). |
| **CI Automation Guardrails** | 4 | Checks presence of `.github/workflows/` or equivalent CI verification pipeline. |

---

### Pillar 5: Code Graph Hygiene & Boundaries (Weight: 15%)

| Criterion | Max Points | Evaluation Method |
| :--- | :---: | :--- |
| **Dead Code Ratio** | 5 | Calls `find_dead_code()`. Penalizes high ratios of unreferenced symbols (dead code dilutes context). |
| **Temporal Coupling Clusters**| 5 | Calls `get_coupled_files()`. Flags files with high hidden co-change coupling lacking co-test coverage. |
| **API Boundary Clarity** | 5 | Calls `get_api_surface()`. Verifies whether public ingress and egress boundaries are well-defined. |

---

## 4. Deep Dive: Tool & Skill Gap Detection

### 4.1 Detection Catalog
The auditor maintains a lightweight catalog mapping detected files and dependencies to recommended skills:

```typescript
interface ToolSignature {
  id: string;
  name: string;
  detectedBy: {
    files?: string[];
    packageDeps?: string[];
    mcpServers?: string[];
  };
  recommendedSkill: {
    skillName: string;
    description: string;
    scaffoldTemplate: string;
  };
}

const TOOL_CATALOG: ToolSignature[] = [
  {
    id: "docker",
    name: "Docker / Containerization",
    detectedBy: { files: ["Dockerfile", "docker-compose.yml", "compose.yaml"] },
    recommendedSkill: {
      skillName: "docker-workflow",
      description: "Commands and safety checks for building, running, and debugging containers.",
      scaffoldTemplate: "templates/skills/docker.md"
    }
  },
  {
    id: "vite-frontend",
    name: "Vite / Modern Frontend",
    detectedBy: { files: ["vite.config.ts", "vite.config.js"], packageDeps: ["vite"] },
    recommendedSkill: {
      skillName: "frontend-workflow",
      description: "Dev server commands, build rules, styling tokens, and component guidelines.",
      scaffoldTemplate: "templates/skills/vite.md"
    }
  },
  {
    id: "database-migrations",
    name: "Database Migrations",
    detectedBy: { files: ["prisma/schema.prisma", "alembic.ini", "knexfile.js", "drizzle.config.ts"] },
    recommendedSkill: {
      skillName: "db-migrations",
      description: "Rules for safe schema migrations, rollback procedures, and test seeding.",
      scaffoldTemplate: "templates/skills/migrations.md"
    }
  },
  {
    id: "chrome-devtools-mcp",
    name: "Chrome DevTools Automation",
    detectedBy: { mcpServers: ["chrome-devtools-mcp"] },
    recommendedSkill: {
      skillName: "browser-automation",
      description: "Procedures for driving headless browser audits and capturing console logs.",
      scaffoldTemplate: "templates/skills/devtools.md"
    }
  }
];
```

### 4.2 Cross-Referencing Algorithm
1. **Manifest Scan:** Inspects root files, `package.json`, `Cargo.toml`, `go.mod`, and `mcp_config.json`.
2. **Catalog Matching:** Collects all detected tool IDs (`detectedTools`).
3. **Skill Discovery:** Scans `.agents/skills/*/SKILL.md` and `skills/*/SKILL.md`.
4. **Gap Identification:** For every detected tool without a matching skill, emits a `MISSING_SKILL` shortcoming with a severity of **HIGH**.

---

## 5. Technical Design & Architecture

### 5.1 Component Overview

```
codebase-memory-mcp-ui/
├── .agents/skills/ai-readiness-audit/
│   ├── SKILL.md                          # Agent instructions for invoking the audit
│   └── scripts/
│       ├── audit_engine.mjs              # Main Node.js evaluation engine
│       ├── tool_catalog.json             # Signatures for detected tools vs skills
│       └── report_formatter.mjs          # Markdown & terminal tables
├── graph-ui/
│   └── src/
│       ├── components/readiness/
│       │   ├── ReadinessGauge.tsx        # SVG Radial score gauge & grade
│       │   ├── PillarBreakdown.tsx       # 5-pillar progress bars & details
│       │   ├── ShortcomingsTable.tsx     # Filterable list of gaps with fix buttons
│       │   └── SkillScaffolderModal.tsx  # One-click generator for missing skills
│       └── pages/ReadinessPage.tsx       # Dedicated route in the Web UI
└── docs/RFC_014_AI_Readiness_Audit_Tool.md
```

### 5.2 Interfacing with the Existing C Daemon
The audit script and UI component query the existing C daemon over HTTP / SSE:

```javascript
// Querying existing MCP tools via the daemon's HTTP JSON-RPC endpoint
async function queryDaemonTool(toolName, args) {
  const res = await fetch("http://127.0.0.1:9749/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args }
    })
  });
  return await res.json();
}
```

If the audit script is run standalone in an offline CI environment where the daemon is not running, it can optionally read the repository's `.codebase-memory/<project>.db` SQLite file directly using `better-sqlite3` or python's built-in `sqlite3`.

---

## 6. Data Contracts & JSON Schema

The tool produces a structured JSON output conforming to this schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AIReadinessReport",
  "type": "object",
  "properties": {
    "project": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "grade": { "type": "string", "enum": ["A+", "A", "B+", "B", "C", "D", "F"] },
    "summary": { "type": "string" },
    "pillars": {
      "type": "object",
      "properties": {
        "instructions": { "$ref": "#/definitions/PillarScore" },
        "skills": { "$ref": "#/definitions/PillarScore" },
        "graph_integrity": { "$ref": "#/definitions/PillarScore" },
        "test_guardrails": { "$ref": "#/definitions/PillarScore" },
        "hygiene": { "$ref": "#/definitions/PillarScore" }
      },
      "required": ["instructions", "skills", "graph_integrity", "test_guardrails", "hygiene"]
    },
    "shortcomings": {
      "type": "array",
      "items": { "$ref": "#/definitions/Shortcoming" }
    }
  },
  "required": ["project", "score", "grade", "pillars", "shortcomings"],
  "definitions": {
    "PillarScore": {
      "type": "object",
      "properties": {
        "score": { "type": "integer" },
        "max": { "type": "integer" },
        "status": { "type": "string", "enum": ["EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT", "CRITICAL"] },
        "findings": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["score", "max", "status"]
    },
    "Shortcoming": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "severity": { "type": "string", "enum": ["BLOCKER", "HIGH", "MEDIUM", "LOW"] },
        "pillar": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "remediation": { "type": "string" },
        "autoFixAvailable": { "type": "boolean" }
      },
      "required": ["id", "severity", "pillar", "title", "remediation"]
    }
  }
}
```

---

## 7. CLI & CI Integration

### 7.1 Running from the Command Line
```bash
# Run local audit and print terminal report
node scripts/audit-ai-readiness.mjs

# Run in CI and fail if readiness score falls below threshold
node scripts/audit-ai-readiness.mjs --fail-under 80 --json > readiness.json
```

### 7.2 GitHub Actions Workflow Example
```yaml
name: AI Readiness Guardrail
on: [pull_request]

jobs:
  audit-readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run AI Readiness Audit
        run: node scripts/audit-ai-readiness.mjs --fail-under 75 --comment-pr
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 8. Web UI Design: The Readiness Dashboard

In `graph-ui/`, the Readiness view renders:

1. **Header Hero:** Radial gauge with the letter grade (e.g. `88% — A`) and a one-line executive diagnostic.
2. **Pillar Radar / Progress Bars:** Real-time breakdown of the 5 pillars with color-coded status badges.
3. **Detected Tooling vs Skills Matrix:** Shows a grid of detected project tools with green checkmarks for covered skills and red alert badges for missing runbooks.
4. **Interactive "Fix with AI" Button:** For any detected gap (e.g. missing `SKILL.md` for Vite or Docker), clicking **"Scaffold Skill"** generates a verified starter `SKILL.md` template directly into `.agents/skills/`.

---

## 9. Implementation Plan & Phases

### Phase 1: Engine & Agent Skill (Week 1)
- Author `scripts/audit_engine.mjs` and `tool_catalog.json`.
- Implement heuristics for Pillar 1 (Instructions) and Pillar 2 (Tool & Skill Gap Detection).
- Interface with running C MCP server (`audit_test_coverage`, `check_index_coverage`, `find_dead_code`).
- Create `.agents/skills/ai-readiness-audit/SKILL.md` so agents can run the audit on demand.

### Phase 2: Web UI Dashboard in `graph-ui` (Week 2)
- Build `ReadinessPage.tsx` and components in `graph-ui/src/components/readiness/`.
- Add navigation item in the Graph UI header/sidebar.
- Implement one-click scaffold generator for missing `SKILL.md` files.

### Phase 3: CI Integration & Action (Week 3)
- Add GitHub Actions workflow template.
- Support `--comment-pr` markdown generation.

---

## 10. Summary & Recommendation

By adopting this strategy:
1. **Core C remains 100% untouched**, adhering strictly to the user's architectural rule.
2. The solution **composes the 26 existing C tools**, maximizing reuse of existing high-performance graph algorithms.
3. The audit directly addresses the user's focus on **missing skills for detected tools**, bridging the operational gap between developers, tooling, and AI agents.
4. It provides immediate value across three surfaces: **Agent Skill (Chat)**, **CLI / CI Guardrails**, and the **Web UI Dashboard**.
