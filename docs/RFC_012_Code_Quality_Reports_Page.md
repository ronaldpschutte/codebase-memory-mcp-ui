# RFC 012: `reports_page` — Code Quality & Optimization Reports

- **RFC Number:** 012
- **Title:** `reports_page` — Code Quality & Optimization Reports
- **Status:** Proposed
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `graph-ui/src/components/`, `graph-ui/src/hooks/`, `graph-ui/src/api/`, `src/ui/http_server.c` (allowlist only in Phase 1)
- **Target Version:** v0.13.0
- **Created:** 2026-10-05
- **Related RFCs:** [RFC 001](RFC_001_analyze_blast_radius.md) – [RFC 008](RFC_008_trace_error_flow.md) (the analysis tools), [RFC 011](RFC_011_Prevent_Duplicate_Tool_Calls.md) (request deduplication)

---

## TL;DR — Impact at a glance

| Question | Answer |
|---|---|
| **Does it touch the core C code?** | **Yes, minimally in Phase 1; moderately in Phase 2.** Phase 1 = add tool names to one allowlist function plus its test (~10 lines). Phase 2 = a background job endpoint with its own thread (~200–400 lines). No changes to indexing, extraction, the store, or the tool implementations themselves. |
| **Can it be done frontend-only?** | **No.** The UI's `/rpc` endpoint only allows 3 tools today (see §2.1). Every report tool is currently rejected with HTTP 403. |
| **Does it slow anything down when not used?** | **No.** No background work, no polling, no schema or index changes. Zero cost until someone opens the Reports tab and clicks *Run*. |
| **Does it slow anything down when used?** | **Yes — the Graph UI itself**, if slow tools are exposed naively. The UI HTTP server handles one request at a time, so a 75 s tool call freezes every other UI request for 75 s (§3.2). **AI agent sessions are not queued behind it** (separate tool server instances) but share CPU and the database file. |
| **Mitigation** | Phase 1 only allowlists tools measured as fast. Slow tools wait for Phase 2's background worker. |

---

## 1. Motivation

The eight analysis tools from RFC 001–008 are only usable by AI agents today. A developer opening the Graph UI cannot see dead code, duplication, test gaps, or risk hotspots. A Reports tab would combine these into one view, ranked by what to fix first.

---

## 2. Current State (verified against source, 2026-10-05)

### 2.1 The UI can only call three tools
[`rpc_is_allowed_for_ui`](../src/ui/http_server.c) (`src/ui/http_server.c` ~L1812) hard-codes the allowlist:

```c
(strcmp(name_text, "list_projects") == 0 || strcmp(name_text, "get_graph_schema") == 0 ||
 strcmp(name_text, "get_code_snippet") == 0);
```

Anything else returns `403 "UI RPC method is not allowed"`. The test `ui_server_rpc_allows_only_ui_read_tools` in `tests/test_httpd.c` (~L1172) pins this list and asserts that `delete_project`, `manage_adr`, `ingest_traces`, `index_repository` stay blocked.

### 2.2 The UI HTTP server handles one request at a time
`cbm_http_server_run` (`src/ui/http_server.c` ~L2226) is a single loop: accept → read → `dispatch_request` → close. `handle_rpc` calls `cbm_mcp_server_handle` **synchronously** on that loop. There is no worker pool.

Consequences:
- While a tool call runs, **all** other UI requests wait: `/api/layout`, `/api/repo-info`, project list, Control tab polling.
- A browser `AbortController.abort()` (RFC 011) does **not** stop the C computation. The daemon only notices when it tries to write the reply.

### 2.3 Agents use separate tool server instances
The UI server creates its own instance (`srv->mcp = cbm_mcp_server_new(NULL)`, ~L2147). Daemon sessions create their own (`session->mcp = cbm_mcp_server_new(NULL)`, `src/daemon/application.c` ~L2793). So UI report calls do **not** queue agent calls behind them. They do compete for CPU, memory and the SQLite file.

> [!NOTE]
> Whether SQLite reads from the UI can delay an agent's reads, or a running index write, has **not** been verified (WAL mode / lock behaviour not checked). Listed as an open question (§8).

### 2.4 All candidate tools are annotated read-only
`tests/test_mcp.c` (~L1422–1449) pins the MCP annotations. Every report tool is `readOnly=true, destructive=false`: `get_architecture`, `index_status`, `check_index_coverage`, `audit_test_coverage`, `find_code_clones`, `find_dead_code`, `analyze_blast_radius`, `get_coupled_files`, `get_api_surface`, `get_env_vars`, `trace_error_flow`, `query_graph`, `compare_graphs`, `detect_changes`. `manage_adr` and `delete_project` are **not** read-only and stay blocked.

---

## 3. Measured Tool Cost

Measured 2026-10-05 against project `codebase-memory-mcp-ui` (26,351 nodes / 155,466 edges), via an agent MCP session (not the UI path). **Single samples, 1 s resolution** — indicative only.

| Tool | Arguments | Wall time | Verdict |
|---|---|---|---|
| `list_projects` | default | ~3 s | Already allowed |
| `index_status` | project | ~1 s | Fast |
| `audit_test_coverage` | `mode: summary` | ~4 s | Fast |
| `find_code_clones` | `limit: 20` | ~2 s | Fast (uses precomputed MinHash) |
| `find_dead_code` | `min_confidence: HIGH, limit: 30` | **~75 s** | **Slow** |
| `analyze_blast_radius` | `target: src/ui/http_server.c, format: summary` | **> 180 s (timed out)** | **Very slow** |
| `check_index_coverage` | 4 paths | **> 180 s (timed out)** | Unclear — may have been stuck behind the blast-radius call still running in the daemon. Needs re-measurement. |
| `get_architecture`, `get_api_surface`, `get_env_vars`, `get_coupled_files`, `trace_error_flow`, `audit_test_coverage (gaps)` | — | **not measured** | Spike task (§7, step 0) |

### 3.1 Data quality finding
All 20 top clone clusters returned were in `tests/` (e.g. `tests/test_c_lsp.c`). The report must default to `file_path` filters (e.g. `src/`) or a "hide tests" toggle, or the duplication section is noise.

### 3.2 What "slow" means for the user
Because of §2.2, running `find_dead_code` from the UI today would:
- Freeze the whole Graph UI for ~75 s (no tab switching data, no layout, Control tab stops updating).
- Keep one daemon core busy for ~75 s, even if the user navigates away or cancels.

`analyze_blast_radius` on a large file would freeze it for 3+ minutes. **This is the main performance risk of this RFC.**

---

## 4. Proposal

### 4.1 Report sections

| # | Section | Tools | Phase |
|---|---|---|---|
| 1 | Overview & index trust | `list_projects`, `get_graph_schema`, `index_status`, `get_architecture`* | 1 |
| 2 | Test gaps | `audit_test_coverage` (`summary`, `gaps`*) | 1 |
| 3 | Duplication | `find_code_clones` (filtered to non-test paths) | 1 |
| 4 | Config hygiene | `get_env_vars`* | 1 |
| 5 | API surface | `get_api_surface`* | 1 |
| 6 | Dead code | `find_dead_code` | **2** |
| 7 | Risk hotspots | `analyze_blast_radius` on top-N from §2 | **2** |
| 8 | Hidden coupling | `get_coupled_files` on hotspot files* | 2 |
| 9 | Unhandled errors | `trace_error_flow(unhandled_only)` per route from §5* | 2 |
| 10 | Trends | `compare_graphs`, `detect_changes` | 3 |

\* = not yet measured. Moves to Phase 2 if the spike shows > ~5 s on a large project.

### 4.2 "Fix first" list
Combine signals into one ranked list at the top of the page:

```
risk = callers × (untested ? 1 : 0.2) × co-change frequency × (cloned ? 1.5 : 1)
```

Phase 1 can only use callers + untested + cloned. Co-change needs Phase 2. Label the score as a heuristic.

### 4.3 Phase 1 — Fast tools only

**C changes (`src/ui/http_server.c`, `tests/test_httpd.c`):**
- Replace the `strcmp` chain in `rpc_is_allowed_for_ui` with a static table.
- Add only tools measured fast: `index_status`, `audit_test_coverage`, `find_code_clones`, plus any spike-confirmed fast tools.
- Extend `allowed_tools[]` in the test. Keep the `blocked_tools[]` assertions. Add the Phase 2 tools to `blocked_tools[]` so they can't be enabled by accident.

**Frontend:**
- New lazy-loaded `ReportsTab` (the bundle is already 1.39 MB; must not grow the initial load).
- Report runner: sequential calls, using `deduplicatedCallTool` (RFC 011), per-section progress, results streamed in as each finishes.
- Results cached in `localStorage`/IndexedDB keyed by `project + indexed_at`. Re-running is explicit.
- Export to Markdown and JSON.
- Every finding links to the Graph tab or a `get_code_snippet` view.

### 4.4 Phase 2 — Background job for slow tools

**C changes:**
- `POST /api/reports` → starts a job, returns `job_id`. `GET /api/reports/{id}` → status/results. `DELETE /api/reports/{id}` → cancel.
- Job runs on its own thread (same pattern as the existing index job, `handle_index_start` / `cbm_thread_create` ~L1284) with its **own** `cbm_mcp_server_new(NULL)` instance, so the UI loop stays responsive.
- Hard limits: one report job at a time, per-call timeout, cancellation via the existing `cbm_mcp_server_cancel_active` (behaviour for these tools to be verified).
- Then allowlist `find_dead_code`, `analyze_blast_radius`, `get_coupled_files`, `trace_error_flow` **only via the job endpoint**, never via synchronous `/rpc`.

---

## 5. Impact Analysis

### 5.1 Code touched

| Area | Phase 1 | Phase 2 |
|---|---|---|
| `src/ui/http_server.c` | Allowlist function only (~10 lines) | + job endpoints, thread, job state (~200–400 lines) |
| `tests/test_httpd.c` | Update allowlist test | + job lifecycle, cancel, concurrency tests |
| `src/mcp/*` (tool implementations) | **None** | **None** (cancellation hooks may need checking) |
| Indexing / extraction / store / pipeline | **None** | **None** |
| SQLite schema | **None** | **None** |
| `graph-ui/` | New tab, hook, runner, export | Switch slow sections to job API |

### 5.2 Performance

| Who | When Reports is unused | Phase 1 run | Phase 2 run |
|---|---|---|---|
| **Graph UI responsiveness** | No change | Short pauses (~1–5 s per call, sequential) | No freeze — work runs off the UI loop |
| **AI agent tool calls** | No change | Minor CPU competition for a few seconds | CPU competition for minutes during a deep report (one core) |
| **Indexing** | No change | Possible lock contention — **unverified** | Same, longer duration — **unverified** |
| **Daemon memory** | No change | Transient, per call | + one extra tool server instance during a job |
| **Daemon startup / binary size** | No change | Negligible | Negligible |
| **Frontend initial load** | No change if lazy-loaded | — | — |

### 5.3 Security
- Widening the allowlist exposes more read-only data to anything that can reach the UI port. Existing protections stay: loopback-only Host check, same-origin Origin check, JSON content-type requirement (`request_passes_http_security`).
- `get_env_vars` returns env var names and **hard-coded default values found in source**. That's the same trust level as `get_code_snippet` (already allowed), but the UI should not render values for names matching `*KEY*|*SECRET*|*TOKEN*|*PASSWORD*` without a click.
- Write tools (`delete_project`, `manage_adr`, `index_repository`) remain blocked; the test enforces it.

### 5.4 Rollback
- Phase 1: revert the allowlist table and the tab. No data migration.
- Phase 2: endpoints are additive; disable by removing the route.

---

## 6. Alternatives Considered

| Alternative | Why not |
|---|---|
| Frontend-only | Impossible — 403 on every report tool (§2.1). |
| Allowlist all tools on `/rpc` now | Freezes the UI for minutes on slow tools (§3.2). |
| Worker pool for all of `/rpc` | Larger, riskier change to the HTTP core and the shared `srv->mcp` instance's thread-safety. The job endpoint isolates the risk. |
| Run reports from the CLI and load a file in the UI | Viable fallback; loses interactivity. Could be added later as an export target. |

---

## 7. Implementation Plan

0. **Spike (no code merged):** time every tool in §4.1 on the largest indexed project, in an idle daemon. Re-measure `check_index_coverage`. Record output formats (JSON vs text) for parsers. Decide Phase 1 vs 2 per tool.
1. **Prerequisite:** fix the RFC 011 dedup regression on `main` (shared request aborted during React StrictMode remount → empty Projects page).
2. **Phase 1:** allowlist table + test, ReportsTab, runner, cache, export.
3. **Phase 2:** job endpoint, thread, cancellation, slow tools, "Fix first" with co-change.
4. **Phase 3:** trends via stored snapshots + `compare_graphs` / `detect_changes`.

---

## 8. Open Questions

1. Does SQLite use WAL mode here, and do long UI reads block agent reads or index writes?
2. Does `cbm_mcp_server_cancel_active` actually interrupt `find_dead_code` / `analyze_blast_radius` mid-computation?
3. Was the `check_index_coverage` timeout caused by the orphaned blast-radius call, or is it slow on its own?
4. Should the allowlist be configurable (e.g. a config flag to disable report tools for locked-down setups)?

---

## 9. Evidence

- Source read directly: `src/ui/http_server.c` (`rpc_is_allowed_for_ui`, `handle_rpc`, `dispatch_request`, `cbm_http_server_run`, `cbm_http_server_new`), `src/daemon/application.c` (session instance), `tests/test_httpd.c` (allowlist test), `tests/test_mcp.c` (annotations).
- Graph index for `codebase-memory-mcp-ui` was last built 2026-10-03 and line numbers had drifted. All line references above come from the current source files, not the graph. `check_index_coverage` could not be completed (timed out).
