# RFC 018: Agent Context & Instruction Architecture (`agent_context_inventory`) — Auditing, Tracking, and Visualizing Repository Markdown Anchors in AI Readiness

- **RFC Number:** 018
- **Title:** Agent Context & Instruction Architecture (`agent_context_inventory`) — Auditing, Tracking, and Visualizing Repository Markdown Anchors in AI Readiness
- **Status:** Proposed
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `scripts/audit_engine.mjs`, `scripts/audit-ai-readiness.mjs`, `graph-ui/src/components/ReadinessTab.tsx`, `graph-ui/src/lib/types.ts`, `.agents/skills/ai-readiness-audit/`, `docs/`
- **Target Version:** v0.18.0
- **Created:** 2026-10-14
- **Related RFCs:** [RFC 014](RFC_014_AI_Readiness_Audit_Tool.md) (AI Readiness Audit Tool), [RFC 012](RFC_012_Code_Quality_Reports_Page.md) (Code Quality Reports Page), [RFC 016](RFC_016_Diagram_Recommendation_Engine.md) (Diagram Recommendation Engine), [RFC 017](RFC_017_Standardized_Documentation_And_Artifact_Storage.md) (Standardized Documentation & Artifact Storage)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this RFC propose?** | An **Agent Context & Instruction Architecture** integrated into the AI Readiness dashboard (`ReadinessTab.tsx`) and audit engine (`audit_engine.mjs`). It provides a comprehensive inventory, deep health analysis, token footprint measurement, and graph-validated symbol checks for all repository markdown files and configuration anchors that influence AI coding agents (such as `AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `llms.txt`, and `.agents/skills/*/SKILL.md`). |
| **Why is this needed?** | While RFC 014 introduced a 5-pillar score, it treats agent context as an opaque aggregate number (e.g. `16/20 pts`). Developers and AI agents have no visibility into *which* instruction files exist, which are missing, whether instructions are bloated with tokens (crowding out agent reasoning space), or if architecture files suffer from "Documentation Drift" (referencing renamed or deleted functions). |
| **Does it touch Core C?** | **No.** Adhering strictly to the **Core C Preference Rule**, the discovery, tokenization, drift detection, and UI visualization are implemented in TypeScript/Node.js and React. It leverages the existing, high-speed C MCP tools (`search_graph`, `nodes_fts`, `query_graph`, `export_diagram`) for symbol validation without modifying native C source files. |
| **What files are scanned?** | 1. **Primary Instruction Anchors:** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.windsurfrules`, `.github/copilot-instructions.md`.<br>2. **Architecture & Domain Models:** `ARCHITECTURE.md`, `docs/architecture.md`, `docs/RFC_*.md`, `PRD_*.md`.<br>3. **Procedural Skill Runbooks:** `.agents/skills/*/SKILL.md`, `skills/*/SKILL.md`.<br>4. **LLM Ingestion Indexes:** `llms.txt`, `docs/llms.txt` (llmstxt.org standard).<br>5. **Project Standards:** `CONTRIBUTING.md`, `README.md`, `docs/adr/*.md`. |
| **What key capabilities are introduced?** | 1. **Interactive Document Inventory Table:** Status, role, target agent, token footprint, freshness, and quick preview drawer.<br>2. **Knowledge Graph Symbol Anchor Integrity:** Validates whether symbols mentioned in docs actually exist in the knowledge graph.<br>3. **Token Budget & Bloat Warning:** Measures initial static context load and warns on bloat (>2,500 tokens).<br>4. **1-Click Smart Scaffolding:** Generates starter `ARCHITECTURE.md` (embedding RFC 016 Mermaid diagrams), `llms.txt`, and `AGENTS.md`.<br>5. **Multi-Agent Compatibility Matrix:** Visual check across Claude, Antigravity/Gemini, Cursor, Copilot, and Universal agents. |
| **Where can it be run?** | 1. **Web UI:** Directly in the AI Readiness tab on `graph-ui`.<br>2. **CLI / CI:** Via `node scripts/audit-ai-readiness.mjs --context-inventory --fail-under 80`.<br>3. **Agent Skill:** In pair-programming sessions via `.agents/skills/ai-readiness-audit/`. |

---

## 1. Motivation & Problem Statement

### 1.1 The Context Blindspot in AI Pair Programming
AI coding agents (Antigravity, Claude Code, Cursor, GitHub Copilot, Windsurf, Aider) do not possess clairvoyance; their quality, safety, and adherence to project rules depend entirely on **context injection**.

Modern repositories typically scatter instructions across multiple files:
- Some developers create `.cursorrules` for Cursor.
- Others add `CLAUDE.md` for Claude Code or `GEMINI.md` for Antigravity.
- Architectural models are buried in `README.md` or forgotten in `docs/architecture.md`.

When developers run an AI readiness audit today (under RFC 014), the UI presents a high-level score:
```
1. Agent Instructions & Anchors: 16 / 20 pts [EXCELLENT]
```
However, the user cannot answer fundamental questions:
1. *Which instruction files were actually detected?*
2. *Does this repo provide an `ARCHITECTURE.md` that explains system boundaries and data flows, or are agents guessing the architecture?*
3. *How many tokens are these files injecting into every agent turn? Are they crowding out the prompt context window?*
4. *Are the code references inside `ARCHITECTURE.md` accurate, or are they referencing dead code, deprecated methods, or hallucinated types?*

### 1.2 Documentation Drift and Hallucination Feedback Loops
When documentation drifts out of sync with code:
1. `ARCHITECTURE.md` tells the agent to use `DataStore.saveRecord()`.
2. The method was renamed three weeks ago to `DataStore.persistEntry()`.
3. The agent trusts the documentation, writes obsolete code, fails verification, and enters a frustrating hallucination-debugging loop.

By linking documentation files directly to the `codebase-memory-mcp` knowledge graph, we can detect documentation drift deterministically and alert developers before agents make errors.

### 1.3 Synergy with RFC 014, RFC 016, and RFC 017
- **RFC 014 (AI Readiness Audit):** Defined the 5-pillar scoring framework. RFC 018 enriches Pillar 1 (*Agent Instructions & Context Anchors*) and Pillar 3 (*Knowledge Graph & Index Integrity*) with deep document-level transparency.
- **RFC 016 (Diagram Recommendations):** Automatically discovers and scores the most informative architecture diagrams. RFC 018 connects these diagrams into `ARCHITECTURE.md` scaffolding.
- **RFC 017 (Standardized Documentation Storage):** Standardized repository documentation under `docs/`, `docs/diagrams/`, `docs/reports/`, and `docs/adr/`. RFC 018 ensures that agents are aware of and link to these standardized locations.

---

## 2. Core Architectural Strategy: Adherence to the Core C Preference Rule

### 2.1 The Core C Preference Rule
The project strictly enforces:
> *"ALWAYS prefer implementations that do NOT touch or modify the Core C codebase... ONLY propose or implement changes in Core C when there is a serious, demonstrable performance difference or a strict technical constraint that cannot be achieved outside C."*

### 2.2 Performance & Complexity Justification
1. **Lightweight File-System Operations:** Discovering files, parsing YAML frontmatter, estimating token counts, and checking git commit ages take less than **8 milliseconds** in Node.js.
2. **Reusing Existing C MCP Graph Queries:** Validating symbols mentioned in markdown (e.g. `export_diagram`, `ReadinessTab`) is accomplished by sending batch queries to the existing C SQLite search engine (`search_graph` or direct `SELECT name FROM nodes WHERE name IN (...)`). The C core already provides microsecond full-text AST search; rewriting markdown parsers in C would add maintenance overhead with zero performance benefit.
3. **Frontend Presentation:** Rendering interactive tables, token budget meters, and markdown slide-over drawers is a native React/TypeScript concern in `graph-ui`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Readiness Dashboard                          │
│                   graph-ui/src/components/ReadinessTab.tsx             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON-RPC
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Audit Engine (scripts/audit_engine.mjs)                     │
│  • Discovers context markdown files                                    │
│  • Tokenizes & measures context weight                                 │
│  • Extracts backticked code symbols                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Batch JSON-RPC
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│      codebase-memory-mcp Daemon (Existing 26 C Tools — Unchanged)      │
│  • search_graph / nodes_fts: Validates symbol existence                │
│  • check_index_coverage: Confirms file paths are tracked               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Agent Context Document Model & Taxonomy

### 3.1 Taxonomy of Context-Influencing Files

The auditor categorizes repository context documents into five distinct functional classes:

```
Agent Context Documents
├── 1. Primary Instruction Anchors (Loaded on every turn)
│   ├── AGENTS.md / .agents/AGENTS.md
│   ├── CLAUDE.md / .claude/CLAUDE.md
│   ├── GEMINI.md / .agents/GEMINI.md
│   ├── .cursorrules / .cursor/rules/*.mdc
│   ├── .windsurfrules
│   └── .github/copilot-instructions.md
├── 2. Architecture & Domain Anchors (Loaded during planning & design)
│   ├── ARCHITECTURE.md / docs/architecture.md
│   ├── docs/RFC_*.md (Design specifications)
│   └── PRD_*.md (Product requirement documents)
├── 3. Operational Skill Runbooks (Loaded on-demand for specific tools)
│   ├── .agents/skills/*/SKILL.md
│   ├── skills/*/SKILL.md
│   └── .agents/rules/*.md
├── 4. LLM Ingestion Indexes (First-stop discovery index)
│   ├── llms.txt (Root or docs/llms.txt per llmstxt.org)
│   └── llms-full.txt
└── 5. Project Standards & Governance (Referenced for contribution conventions)
    ├── README.md
    ├── CONTRIBUTING.md / DEVELOPMENT.md
    └── docs/adr/*.md (Architecture Decision Records)
```

### 3.2 Data Contracts (TypeScript Interfaces)

The following interfaces extend `graph-ui/src/lib/types.ts` and `scripts/audit_engine.mjs`:

```typescript
export type ContextDocCategory =
  | "primary_instruction"
  | "architecture"
  | "skill_runbook"
  | "llm_index"
  | "project_standard";

export type TargetAgentEcosystem =
  | "universal"
  | "claude"
  | "antigravity"
  | "cursor"
  | "copilot"
  | "windsurf";

export interface SymbolAnchorValidation {
  symbol: string;
  foundInGraph: boolean;
  nodeType?: string;       // e.g. "function", "class", "struct", "file"
  qualifiedName?: string;
  suggestedReplacement?: string; // If renamed or close match found
}

export interface AgentContextDocument {
  id: string;
  path: string;                    // Relative path from repo root
  category: ContextDocCategory;
  targetAgents: TargetAgentEcosystem[];
  status: "PRESENT" | "STALE" | "MISSING" | "EMPTY";
  fileSizeBytes: number;
  tokenCount: number;             // Estimated BPE token count (~charCount / 3.8)
  lastModifiedCommit?: string;
  lastModifiedDaysAgo?: number;
  commitsBehindHead?: number;     // Number of commits to repo since this file was touched
  
  // Health & Validation
  hasBuildCommands: boolean;
  hasTestCommands: boolean;
  hasForbiddenPatterns: boolean;  // e.g. strict safety rules
  hasValidFrontmatter: boolean;   // For SKILL.md / rule files
  symbolIntegrity?: {
    totalReferencedSymbols: number;
    validSymbolsCount: number;
    driftedSymbols: SymbolAnchorValidation[];
  };
  
  // Quick Actions
  scaffoldTemplateAvailable: boolean;
}

export interface AgentContextInventory {
  totalDocumentsFound: number;
  totalTokenFootprint: number;
  budgetStatus: "HEALTHY" | "MODERATE" | "BLOATED";
  ecosystemCoverage: {
    universal: boolean;
    claude: boolean;
    antigravity: boolean;
    cursor: boolean;
    copilot: boolean;
  };
  documents: AgentContextDocument[];
  driftWarningsCount: number;
}
```

---

## 4. Feature Capabilities & Heuristics

### 4.1 Token Budget & Prompt Bloat Analysis
- **Problem:** AI instructions injected into system prompts reduce the effective context window available for working memory, retrieval chunks, and code diffs.
- **Heuristic:**
  - Standard tokenization estimate: `Math.ceil(rawContent.length / 3.85)`.
  - **Thresholds:**
    - `Total Instruction Tokens < 2,000`: **HEALTHY** (Green).
    - `Total Instruction Tokens 2,000–4,000`: **MODERATE** (Yellow).
    - `Total Instruction Tokens > 4,000`: **BLOATED** (Red Alert). Recommends offloading lengthy command guides into on-demand `.agents/skills/`.

### 4.2 Knowledge Graph Symbol Anchor Integrity
- **Algorithm:**
  1. Parse markdown text using a lightweight regex scanner targeting inline code blocks: `` `([a-zA-Z_][a-zA-Z0-9_]{2,64})` ``.
  2. Filter out language keywords (`if`, `function`, `const`, `return`, `npm`, `git`, `bash`).
  3. Query `codebase-memory-mcp` using `search_graph` or direct SQLite lookup for candidate nodes.
  4. Any code token formatted as a symbol that does not match an indexed function, class, struct, type, or file is flagged as a potential **Drifted / Hallucinated Symbol**.
  5. Provide a suggestion if an edit distance $\le 2$ or case mismatch exists (e.g. `ReadinessTab` vs `readiness_tab`).

### 4.3 Documentation Freshness & Git Drift Heuristic
- **Freshness Score:**
  - Files are evaluated against git commit distance:
  - If a repository has seen >50 commits since `ARCHITECTURE.md` was last touched, it is tagged with `STALE (52 commits behind HEAD)`.
  - Highlights a notification recommending an architecture review.

### 4.4 One-Click Smart Scaffolding Engine
When documents are marked `MISSING`, the UI presents a **Scaffold** button:

1. **Missing `ARCHITECTURE.md`:**
   - Queries `get_architecture()` and top recommendations from RFC 016 (`recommend_diagrams`).
   - Synthesizes a structured starter document containing:
     - Component Hierarchy.
     - Top entry points.
     - Embedded Mermaid Architecture and Call Sequence diagrams.
2. **Missing `llms.txt`:**
   - Synthesizes a standard [llmstxt.org](https://llmstxt.org) file listing:
     - Repository summary.
     - Links to all RFCs and ADRs.
     - Key module entry points.
3. **Missing `AGENTS.md` / `GEMINI.md`:**
   - Scans `package.json`, `Makefile`, `CMakeLists.txt`, `Cargo.toml`.
   - Pre-fills verified build, test, and lint commands.
   - Embeds Core C Preference rules and project conventions.

---

## 5. User Interface Design (`ReadinessTab.tsx`)

The AI Readiness dashboard will be restructured into three coherent sections:

### 5.1 Top Section: Score & 5-Pillar Breakdown (Preserved)
- Top Grade Gauge (`86 / 100`, Grade A).
- 5-Pillar breakdown progress bars with status badges.

### 5.2 Middle Section: Agent Context & Instruction Documents Hub (New)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  📄 AGENT CONTEXT & INSTRUCTION DOCUMENTS                       Token Budget: 2,450 tok│
│  Inspects repository documents and rules that govern AI agent cognition   [Moderate ⚠️]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [All (8)]  [Primary Rules (3)]  [Architecture (2)]  [Skills (3)]  [Missing Only (2)]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  FILE PATH            ROLE               TARGET AGENT     STATUS     TOKENS   ACTIONS  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  AGENTS.md            Root Instructions  Universal        Synced ✅   1,420 tk [Preview]│
│  ARCHITECTURE.md      System Model       All Agents       Stale ⚠️    2,850 tk [Inspect]│
│  docs/llms.txt        LLM Index          All Models       Missing ❌      -    [+Create]│
│  .cursorrules         IDE Rules          Cursor           Missing ❌      -    [+Create]│
│  .agents/skills/      4 Skill Runbooks   Antigravity/All  Valid ✅    3,200 tk [ViewAll]│
│  docs/adr/            6 Decision Records Architecture     Valid ✅    4,100 tk [Browse] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Interactive Slide-Over Preview Drawer
Clicking **[Preview]** or **[Inspect]** on any document opens a slide-over drawer:
- **Rendered Markdown View:** With syntax highlighting and live Mermaid diagram rendering.
- **Token Count & Character Breakdown:** Visual indicator of context weight.
- **Symbol Integrity Tab:** Shows all verified codebase symbols and flags drifted or missing identifiers.
- **Copy / Edit in IDE Action:** Deep-links directly to open the file in the editor.

---

## 6. CLI & Automated CI Integration

The `scripts/audit-ai-readiness.mjs` script is updated with new flags:

```bash
# Output full readiness audit including context document inventory
node scripts/audit-ai-readiness.mjs --context-inventory

# Output JSON report for CI pipelines
node scripts/audit-ai-readiness.mjs --json > readiness_report.json

# Auto-scaffold missing ARCHITECTURE.md or llms.txt
node scripts/audit-ai-readiness.mjs --scaffold-arch
node scripts/audit-ai-readiness.mjs --scaffold-llms

# Fail CI if agent context is bloated or documentation has broken symbols
node scripts/audit-ai-readiness.mjs --fail-on-symbol-drift --fail-under 80
```

---

## 7. Rubric Scoring Adjustments (Pillars 1 & 3)

The new document inventory enriches the scoring logic in `scripts/audit_engine.mjs`:

### Pillar 1: Agent Instructions & Context Anchors (20 pts)
- **Root Instructions Present (`AGENTS.md` / `GEMINI.md` / `CLAUDE.md`):** 6 pts.
- **Multi-Agent Compatibility (Covering $\ge 2$ ecosystems or universal):** 3 pts.
- **Explicit Build & Test Runbooks:** 5 pts.
- **Token Budget Discipline (<3,500 tokens, not bloated):** 3 pts.
- **LLM Summary Index (`llms.txt`):** 3 pts.

### Pillar 3: Knowledge Graph & Index Integrity (20 pts)
- **Graph Index Active & Fresh:** 8 pts.
- **System Architecture Document (`ARCHITECTURE.md` present & fresh):** 5 pts.
- **Architecture Diagram Parity (RFC 016 diagrams present):** 4 pts.
- **Symbol Anchor Integrity (No drifted or hallucinated symbols in docs):** 3 pts.

---

## 8. Implementation Plan & Milestones

| Phase | Milestone | Primary Files Involved | Core C Impact |
|:---|:---|:---|:---:|
| **Phase 1** | **Document Scanner & Tokenizer**<br>Implement candidate document detection, token estimation, and git commit distance calculation in audit engine. | `scripts/audit_engine.mjs`<br>`graph-ui/src/lib/types.ts` | None (0%) |
| **Phase 2** | **Symbol Anchor Validator**<br>Extract backticked tokens from docs and validate against `codebase-memory-mcp` SQLite nodes table via JSON-RPC. | `scripts/audit_engine.mjs`<br>Existing MCP tools | None (0%) |
| **Phase 3** | **Interactive UI Dashboard**<br>Build the Context Documents Inventory table, token budget gauge, and slide-over markdown preview drawer in `ReadinessTab.tsx`. | `graph-ui/src/components/ReadinessTab.tsx`<br>`graph-ui/src/components/ui/` | None (0%) |
| **Phase 4** | **1-Click Smart Scaffolding**<br>Add auto-generators for `ARCHITECTURE.md` (with RFC 016 diagrams) and `llms.txt`. | `scripts/audit-ai-readiness.mjs`<br>`ReadinessTab.tsx` | None (0%) |
| **Phase 5** | **Agent Skill & Runbook Update**<br>Update `.agents/skills/ai-readiness-audit/SKILL.md` to guide agents on auditing and remediating context documents. | `.agents/skills/ai-readiness-audit/SKILL.md` | None (0%) |

---

## 9. Backwards Compatibility & Security Considerations

1. **Backwards Compatibility:**
   - Existing JSON reports generated by `scripts/audit-ai-readiness.mjs` remain valid. The new `context_inventory` field is additive.
   - If the MCP daemon is not running, symbol validation gracefully skips without crashing, scoring symbol integrity provisionally.
2. **Security & Sandbox Isolation:**
   - All document scanning is restricted strictly to the workspace directory tree.
   - File paths outside the workspace root are rejected to prevent path traversal attacks.
3. **Core C Preference Rule:**
   - Strictly 0 lines of C code are altered or added. All functionality executes in Node.js and React.
