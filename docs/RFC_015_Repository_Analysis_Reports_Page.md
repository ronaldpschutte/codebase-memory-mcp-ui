# RFC 015: Repository Analysis Reports Page (`reports_page`) — Run, Visualize & Save

- **RFC Number:** 015
- **Title:** Repository Analysis Reports Page (`reports_page`) — Run, Visualize & Save
- **Status:** Proposed
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `graph-ui/src/components/reports/`, `scripts/`, `.agents/skills/repository-reports/`, `docs/`
- **Target Version:** v0.15.0
- **Created:** 2026-10-07
- **Related RFCs:** [RFC 001](RFC_001_analyze_blast_radius.md) – [RFC 008](RFC_008_trace_error_flow.md) (analysis tools), [RFC 011](RFC_011_Prevent_Duplicate_Tool_Calls.md) (request deduplication), [RFC 012](RFC_012_Code_Quality_Reports_Page.md) (preliminary spike & cost measurements), [RFC 013](RFC_013_Update_Agent_Skills_With_New_Tools.md) (26 tools migration), [RFC 014](RFC_014_AI_Readiness_Audit_Tool.md) (AI readiness audit)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this RFC propose?** | A dedicated **Repository Analysis Reports Page** in `graph-ui` and an accompanying out-of-process runner script that executes the complete suite of deep analysis tools (RFC 001–008 & RFC 014) against any indexed repository, ranks critical issues in a prioritized **"Fix First"** queue, displays an interactive multi-section diagnostic dashboard, and **saves snapshot reports** to disk and IndexedDB for historical trend tracking and Markdown/JSON export. |
| **Does it touch the Core C code?** | **No.** In strict adherence to the project's Core C Preference Rule, the report runner, persistence engine, and UI dashboard are implemented in TypeScript/React and Node.js. It composes the existing 26 C MCP tools via standard MCP/HTTP queries without modifying native C source or altering C HTTP thread loops. |
| **Why not implement in Core C?** | 1. **Avoids UI Event Loop Freezes:** As measured in RFC 012 (§2.2), executing heavy analysis tools synchronously on the C HTTP loop freezes the entire UI. Running the report orchestrator asynchronously via client/runner architecture keeps the UI completely responsive.<br>2. **No C Allowlist Friction:** External runner execution communicates over standard MCP protocol where all 26 tools are already accessible without C allowlist barriers.<br>3. **Flexible Storage:** Report serialization, JSON schema validation, Markdown generation, and diffing between historical runs are vastly more maintainable in TypeScript than in C. |
| **How are reports saved and loaded?** | 1. **On-Disk Snapshots:** Saved to `.codebase-memory/reports/<project>-<timestamp>.json` for persistent repository history and CI tracking.<br>2. **In-Browser Storage:** Cached in IndexedDB/`localStorage` for instant offline review and historical diffing.<br>3. **Export Formats:** One-click export to comprehensive **Markdown** (for GitHub PR comments/issues) and **JSON** (for automated pipelines). |
| **Can it run in headless CI?** | **Yes.** A standalone script `node scripts/run-repo-report.mjs --project <name> --save --format markdown` allows automated CI workflows to generate and save reports on every pull request. |

---

## 1. Motivation & Problem Statement

### 1.1 The Fragmented Insight Problem
Between v0.10.0 and v0.14.0, Codebase Memory introduced powerful analytical capabilities:
- Blast radius & route impact analysis (`analyze_blast_radius` — RFC 001)
- Public API contract inspection (`get_api_surface` — RFC 002)
- Structural test-to-code gap audits (`audit_test_coverage` — RFC 003)
- MinHash AST code clone detection (`find_code_clones` — RFC 004)
- Git co-change coupling analysis (`get_coupled_files` — RFC 005)
- Configuration & environment variable discovery (`get_env_vars` — RFC 006)
- Unreferenced dead code detection (`find_dead_code` — RFC 007)
- Exception and error bubbling traces (`trace_error_flow` — RFC 008)
- AI agent readiness & skill parity auditing (`ai_readiness_audit` — RFC 014)

However, today these tools operate in **complete silos**. To evaluate a repository's health, an engineer or AI agent must manually invoke 9+ different tools with tailored arguments, mentally synthesize hundreds of lines of text output, and manually cross-reference findings.

### 1.2 The Missing Feedback Loop
Furthermore, developers cannot easily answer basic architectural questions:
- *"What are the top 5 highest-risk files I should fix first before deploying?"*
- *"Did this refactoring branch increase or decrease our dead code and duplication?"*
- *"Can I generate a clean, executive Markdown report to share with the team on GitHub?"*

### 1.3 The Goal
Deliver a unified, visually stunning **Reports Page** where developers can:
1. Click **"Run Full Analysis"** against any indexed repository.
2. Watch real-time progress as each analytical tool completes.
3. Review a unified **"Fix First"** queue ranked by composite risk.
4. Drill down into specific categories with syntax-highlighted code snippet previews.
5. **Save report snapshots** and track quality improvements across Git branches and time.

---

## 2. Architecture & Strategy: Outside Core C

### 2.1 Lessons Learned from RFC 012
RFC 012 previously explored a Reports tab, but ran into architectural constraints:
1. **The Single-Threaded UI HTTP Server Constraint:** As documented in RFC 012 (§2.2), `cbm_http_server_run` handles one request at a time. Running slow tools like `find_dead_code` (~75s) or `analyze_blast_radius` synchronously on `/rpc` freezes all other UI tabs.
2. **The Hardcoded Allowlist Barrier:** `rpc_is_allowed_for_ui` in `src/ui/http_server.c` blocked most analysis tools, requiring ongoing C patches.

### 2.2 The Solution: Asynchronous Composed Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Web UI (graph-ui / React)                       │
│  ReportsTab ─── Progress Stepper ─── Fix-First Queue ─── Snapshot History
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           │ HTTP Streaming / Fetch                          │ IndexedDB / LocalStorage
           ▼                                                 ▼
┌──────────────────────────────────────┐          ┌──────────────────────┐
│  Report Orchestrator (TypeScript)    │          │ Saved Report Cache   │
│  • Sequential / Batched Tool Calls   │          │ • Snapshots List     │
│  • Progress Event Streaming          │          │ • Trend & Delta Diff │
│  • Risk Score Aggregation            │          │ • Export Markdown/JSON│
└──────────────────┬───────────────────┘          └──────────────────────┘
                   │
                   │ Standard MCP Protocol (stdio / HTTP)
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│  codebase-memory-mcp Daemon (Existing 26 C Tools — 100% Unchanged)     │
│  • analyze_blast_radius   • audit_test_coverage   • find_dead_code     │
│  • find_code_clones       • get_coupled_files     • get_api_surface    │
│  • get_env_vars           • trace_error_flow      • export_diagram     │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Zero C Code Changes:** Adheres strictly to the Core C Preference Rule. The core C engine remains completely untouched.
2. **Asynchronous Batched Execution:** Tools are invoked sequentially or in bounded batches with progress callbacks. The UI never freezes, and the user sees progress bars for each section.
3. **Dual Execution Modalities:**
   - **Interactive Browser Mode:** Runs directly within the React web application, querying the daemon and caching results in IndexedDB.
   - **Headless CLI Mode (`node scripts/run-repo-report.mjs`):** Runs out-of-process in terminal or CI pipelines, saving snapshots directly to `.codebase-memory/reports/`.

---

## 3. The 9 Analytical Sections & The "Fix First" Queue

### 3.1 The "Fix First" Prioritization Algorithm
Rather than overwhelming the user with disconnected lists of issues, the Reports page calculates a composite **Risk Score** for every flagged symbol or file:

$$\text{Risk Score} = \text{Callers} \times \text{UntestedMultiplier} \times \text{CoChangeMultiplier} \times \text{CloneMultiplier} \times \text{DeadCodeWeight}$$

Where:
- **Callers:** Number of incoming call edges (`in_degree`). High fan-in symbols carry higher blast radius.
- **UntestedMultiplier:** `2.5` if the entry point has 0 test coverage; `1.0` if tested.
- **CoChangeMultiplier:** `1.0 + (CoupledFilesCount \times 0.2)` (frequently coupled files create cascading bugs).
- **CloneMultiplier:** `1.5` if identical or near-clone duplicates exist; `1.0` otherwise.
- **DeadCodeWeight:** Ranked for safe removal if zero callers and unexported.

The top 10 items form the prominent **"Fix First" Action Items** list at the top of the report.

---

### 3.2 The 9 Analytical Sections

```
Repository Analysis Report
├── 0. Executive Summary & Health Grade (A+ to F, Overall Score 0-100)
├── 1. "Fix First" Action Queue (Top 10 highest-impact items)
├── 2. Test Coverage & Untested Entry Points (audit_test_coverage)
├── 3. Code Duplication & Clones (find_code_clones — filtered non-test)
├── 4. Dead Code & Unreferenced Symbols (find_dead_code)
├── 5. High Blast-Radius Hotspots (analyze_blast_radius)
├── 6. Hidden Co-Change Coupling (get_coupled_files)
├── 7. Public API Surface & Routes (get_api_surface)
├── 8. Error Handling & Unhandled Flows (trace_error_flow)
├── 9. Configuration & Environment Variables (get_env_vars)
└── 10. AI Readiness & Skill Parity (ai_readiness_audit)
```

| Section | Tool | Key Insights Displayed |
| :--- | :--- | :--- |
| **1. Test Gaps** | `audit_test_coverage` | Untested critical functions, entry-point coverage percentage, missing test files. |
| **2. Duplication** | `find_code_clones` | Duplicate code blocks, clone clusters (filtered to ignore test fixtures by default). |
| **3. Dead Code** | `find_dead_code` | Functions, classes, and variables with 0 incoming calls that are not exported in the public API. |
| **4. Risk Hotspots** | `analyze_blast_radius` | Symbols with massive downstream caller cascades and route impacts. |
| **5. Hidden Coupling**| `get_coupled_files` | Files frequently modified together in Git history lacking co-test suites. |
| **6. API Surface** | `get_api_surface` | Ingress HTTP/RPC route endpoints and external egress network calls. |
| **7. Error Bubbling**| `trace_error_flow` | Unhandled exceptions and error propagation paths across call trees. |
| **8. Config & Env** | `get_env_vars` | Discovered environment variables, fallback defaults, and missing `.env.example` keys. |
| **9. AI Readiness** | `ai_readiness_audit` | Score on instructions, missing tool skills, graph integrity, and test guardrails. |

---

## 4. Report Persistence, Snapshots & History

### 4.1 On-Disk Snapshot Storage
When a report is generated (either in the UI or CLI), it is serialized to:
```
<repo-root>/.codebase-memory/reports/<project>-<timestamp>.json
```

Example directory layout:
```
.codebase-memory/
└── reports/
    ├── codebase-memory-mcp-ui-2026-10-07T08-30-00Z.json
    ├── codebase-memory-mcp-ui-2026-10-06T14-15-00Z.json
    └── latest.json  -> symlink to most recent snapshot
```

### 4.2 Browser Storage (IndexedDB)
In the browser, reports are persisted in IndexedDB under the store `cbm_reports`:
- Key: `${projectName}:${timestamp}`
- Indexed by: `projectName`, `timestamp`, `grade`, `score`
- Survives browser refreshes and allows instant offline review.

### 4.3 Snapshot Comparison & Delta Tracking
The Reports page provides a **"Compare with Previous"** selector:
- **Dead Code Delta:** e.g., `-12 dead functions (Removed)`
- **Test Coverage Delta:** e.g., `+4.5% entry point coverage`
- **Duplication Delta:** e.g., `-2 clone clusters`
- **Overall Score Trend:** e.g., `78 (B) -> 86 (A)`

### 4.4 Multi-Format Export
Users can export any generated report with a single click:
1. **Export as Markdown (`.md`):** Clean, GitHub-Flavored Markdown report formatted with tables and callout alerts, ideal for pasting into PR descriptions or commit summaries.
2. **Export as JSON (`.json`):** Full machine-readable payload for external dashboard ingestion.
3. **Copy Summary to Clipboard:** Executive 5-line summary for chat/Slack.

---

## 5. Web UI Design: The Reports Dashboard

### 5.1 Route & Navigation Integration
- Route URL: `/?tab=reports&project=<project-name>&report=<snapshot-id>`
- Added to header navigation in `App.tsx`: `["control", "stats", "diagrams", "tools", "readiness", "reports", "graph"]`

### 5.2 Visual Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Report Icon] Repository Health & Analysis Reports                     │
│ Project: [codebase-memory-mcp-ui ▼]   [Run Analysis ▼]  [History (4) ▼] │
├────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌──────────────────────────────────────┐ │
│ │     Overall Health        │ │ Executive Diagnostic                 │ │
│ │        86 / 100           │ │ Repository has strong test coverage  │ │
│ │        Grade: A           │ │ but contains 14 unreferenced symbols │ │
│ └───────────────────────────┘ └──────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ ⚡ Top 10 "Fix First" Action Items                                     │
│  [1] handle_rpc_post (Risk: 94) - High blast radius, untested entry   │
│  [2] cbm_store_open (Risk: 88) - Untested root function, 42 callers   │
├────────────────────────────────────────────────────────────────────────┤
│ Section Tabs: [All] [Test Gaps] [Dead Code] [Clones] [Coupling] [API]  │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Detailed findings with code preview and graph deep-links           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Execution Modes: Presets
When clicking **"Run Analysis"**, the user can choose from three presets:
1. **Quick Health Check (~5–10s):** Runs `audit_test_coverage (summary)`, `find_code_clones`, `get_env_vars`, `get_api_surface`, `ai_readiness_audit`.
2. **Comprehensive Audit (~30–60s):** Runs all 9 tools including `find_dead_code`, `analyze_blast_radius`, and `get_coupled_files`.
3. **Custom Run:** User checks/unchecks individual tools to run.

---

## 6. Data Contracts & JSON Schema

The saved report conforms to the following JSON schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RepositoryAnalysisReport",
  "type": "object",
  "properties": {
    "report_id": { "type": "string" },
    "project": { "type": "string" },
    "git_branch": { "type": "string" },
    "commit_hash": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "execution_time_ms": { "type": "integer" },
    "preset": { "type": "string", "enum": ["quick", "comprehensive", "custom"] },
    "scores": {
      "overall": { "type": "integer", "minimum": 0, "maximum": 100 },
      "grade": { "type": "string", "enum": ["A+", "A", "B+", "B", "C", "D", "F"] },
      "test_coverage": { "type": "integer" },
      "hygiene": { "type": "integer" },
      "ai_readiness": { "type": "integer" }
    },
    "fix_first": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rank": { "type": "integer" },
          "symbol": { "type": "string" },
          "file_path": { "type": "string" },
          "risk_score": { "type": "number" },
          "reasons": { "type": "array", "items": { "type": "string" } },
          "recommended_action": { "type": "string" }
        },
        "required": ["rank", "symbol", "file_path", "risk_score", "recommended_action"]
      }
    },
    "sections": {
      "type": "object",
      "properties": {
        "test_coverage": { "type": "object" },
        "code_clones": { "type": "object" },
        "dead_code": { "type": "object" },
        "blast_radius": { "type": "object" },
        "coupled_files": { "type": "object" },
        "api_surface": { "type": "object" },
        "error_flow": { "type": "object" },
        "env_vars": { "type": "object" },
        "ai_readiness": { "type": "object" }
      }
    }
  },
  "required": ["report_id", "project", "created_at", "scores", "fix_first", "sections"]
}
```

---

## 7. Headless CLI Runner & CI Integration

### 7.1 Standalone CLI Runner (`scripts/run-repo-report.mjs`)
Developers can generate reports without opening the browser:

```bash
# Run comprehensive audit and display in terminal
node scripts/run-repo-report.mjs --project codebase-memory-mcp-ui

# Run quick audit, save snapshot, and output Markdown
node scripts/run-repo-report.mjs --preset quick --save --format markdown > report.md

# CI Quality Gate: Fail if score drops below 80 or if high-risk items > 5
node scripts/run-repo-report.mjs --fail-under 80 --max-high-risk 5
```

### 7.2 GitHub Actions PR Workflow
```yaml
name: Codebase Health Report
on: [pull_request]

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Generate Health Report
        run: node scripts/run-repo-report.mjs --save --format markdown > pr_report.md
      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('pr_report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

---

## 8. Implementation Plan & Phases

### Phase 1: Core Report Runner & Persistence (Week 1)
- Author `scripts/report_runner.mjs`: Orchestrates execution across tools, computes the Fix-First risk queue, and outputs JSON/Markdown.
- Author `scripts/run-repo-report.mjs`: CLI runner supporting presets (`quick`, `comprehensive`), `--save`, and `--format`.
- Implement snapshot filesystem persistence in `.codebase-memory/reports/`.

### Phase 2: Web UI Dashboard in `graph-ui` (Week 2)
- Create `graph-ui/src/components/reports/`:
  - `ReportsTab.tsx`: Main dashboard container.
  - `FixFirstQueue.tsx`: Ranked priority list with risk score badges.
  - `ReportSectionCard.tsx`: Collapsible cards for each of the 9 analytical tools.
  - `ReportHistoryDrawer.tsx`: Snapshot selector and comparison list.
  - `ExportModal.tsx`: One-click copy/download for Markdown and JSON.
- Add `"reports"` to `TabId` in `types.ts` and header navigation in `App.tsx`.

### Phase 3: Trend Tracking & Snapshot Diffing (Week 3)
- Implement delta computation comparing Report A with Report B.
- Display trend indicators (`+` / `-`) for test coverage, dead code count, clone clusters, and overall grade.

### Phase 4: Agent Skill Integration (Week 4)
- Create `.agents/skills/repository-reports/SKILL.md` to allow conversational invocation by AI agents:
  *"Run a comprehensive report on this project and show me what to fix first."*

---

## 9. Summary & Recommendation

This RFC solves the fragmentation problem by uniting the 9 deep analysis tools from RFC 001–008 and RFC 014 into a **single, actionable, persistent report**:
1. **100% Non-C Implementation:** Completely avoids touching Core C code, preventing UI event loop freezes and allowlist friction.
2. **Action-Oriented:** Replaces raw data dumps with a prioritized **"Fix First"** queue ranked by algorithmic risk.
3. **Durable & Shareable:** Reports are saved to disk and browser storage, enabling historical trend tracking, team sharing, and automated PR review gates.
