# RFC 013: Update Agent Skill (`SKILL.md`) and Instructions with All 26 MCP Tools

- **RFC Number:** 013
- **Title:** Update Agent Skill (`SKILL.md`) and Instructions with All 26 MCP Tools
- **Status:** Implemented
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `src/cli/cli.c`, `src/cli/cli.h`, `tests/test_cli.c`, Agent Instruction / Rules Generators
- **Target Version:** v0.13.0
- **Created:** 2026-10-07
- **Related RFCs:** [RFC 001](RFC_001_analyze_blast_radius.md) – [RFC 008](RFC_008_trace_error_flow.md) (the deep analysis tools), [PRD Native Diagram Generation](../PRD_NATIVE_DIAGRAM_GENERATION.md), [RFC 012](RFC_012_Code_Quality_Reports_Page.md) (Code Quality Reports)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this change?** | Updates the embedded agent skill (`skill_content`) and instruction templates (`agent_instructions_content`) compiled into `codebase-memory-mcp` to explicitly guide AI coding agents on using all **26 registered MCP tools** (up from the legacy 15). |
| **Does it touch the core C engine?** | **No.** Changes are strictly limited to the static string definitions in `src/cli/cli.c`, header constants in `src/cli/cli.h`, and accompanying installer verification tests in `tests/test_cli.c`. |
| **Why is this necessary?** | Although tools from RFC 001–008 and diagram generation have been implemented in the binary, the agent skill still says `## 15 MCP Tools` and lacks decision-matrix entries for them. Agents currently underutilize or overlook these tools, instead resorting to expensive multi-hop Cypher queries or falling back to raw grep. |
| **Does it increase context token overhead?** | **Minimally.** The updated `SKILL.md` is aggressively tuned for information density and stays under ~1,100 tokens, well within agent system prompt budgets. |
| **Which agent surfaces are affected?** | **All 45+ supported client surfaces.** When users run `codebase-memory-mcp install` or `--update-agents`, the updated skill and instructions are automatically synced to Claude Code, Cursor, Antigravity, OpenCode, Codex, Qwen, GitHub Copilot CLI, Cline, Kiro, Vibe, Grok, Factory, Hermes, Devin, and others. |

---

## 1. Motivation & Background

Between v0.10.0 and v0.12.0, Codebase Memory expanded its analytical capabilities by adding **9 specialized MCP tools**:
1. `export_diagram` — Native 2D vector/syntax diagram generator (Architecture, Sequence, Dataflow, Dependencies)
2. `analyze_blast_radius` ([RFC 001](RFC_001_analyze_blast_radius.md)) — Downstream caller blast radius, affected routes, test coverage, and temporal co-changes
3. `get_api_surface` ([RFC 002](RFC_002_get_api_surface.md)) — Ingress HTTP/RPC endpoints and egress third-party calls/webhooks
4. `audit_test_coverage` ([RFC 003](RFC_003_audit_test_coverage.md)) — Structural test mapping and ranking of untested entry points
5. `find_code_clones` ([RFC 004](RFC_004_find_code_clones.md)) — MinHash AST and semantic near-clone detection
6. `get_coupled_files` ([RFC 005](RFC_005_get_coupled_files.md)) — Mined Git history co-change companions (`FILE_CHANGES_WITH`)
7. `get_env_vars` ([RFC 006](RFC_006_get_env_vars.md)) — Configuration keys, call-sites, defaults, and `.env.example` generator
8. `find_dead_code` ([RFC 007](RFC_007_find_dead_code.md)) — Zero-caller symbols with public API export filtering
9. `trace_error_flow` ([RFC 008](RFC_008_trace_error_flow.md)) — Exception and error bubbling across call trees

### The Problem
The embedded skill in `src/cli/cli.c` (`skill_content[]`, ~L1472) was authored prior to these tools. It still documents:
```markdown
## 15 MCP Tools
`index_repository`, `index_status`, `list_projects`, `delete_project`,
`search_graph`, `search_code`, `trace_path`, `detect_changes`,
`query_graph`, `get_graph_schema`, `get_code_snippet`, `get_architecture`,
`check_index_coverage`, `manage_adr`, `ingest_traces`
```

Additionally, its **Quick Decision Matrix** still recommends manual workarounds for tasks that now have first-class tools:
- **Dead code**: Recommends `search_graph(max_degree=0, exclude_entry_points=true)` instead of `find_dead_code`.
- **Impact analysis**: Only recommends `detect_changes()` on local diffs instead of `analyze_blast_radius(target=...)`.
- **Co-changes**: No mention of `get_coupled_files`.
- **API contracts**: No mention of `get_api_surface`.
- **Architecture diagrams**: No mention of `export_diagram`.
- **Error paths**: No mention of `trace_error_flow`.

As a consequence, AI agents are unaware of these tools unless explicitly prompted by a human using exact symbol names.

---

## 2. Current State (Verified against source)

### 2.1 Skill Definition & Constraints in `src/cli/cli.c`
1. **Frontmatter Trigger String** (`~L1480`):
   The frontmatter `description` contains the trigger phrases matched by agent runtimes. It currently includes:
   `"explore the codebase, understand the architecture, what functions exist, show me the structure, who calls this function, what does X call, trace the call chain, find callers of, show dependencies, impact analysis, dead code, unused functions, high fan-out, refactor candidates, code quality audit, graph query syntax, Cypher query examples, edge types, how to use search_graph."`
   *Missing triggers:* `api surface`, `endpoints`, `test coverage`, `code clones`, `duplicates`, `environment variables`, `env vars`, `error flow`, `exceptions`, `co-changed files`, `coupled files`, `generate diagram`, `sequence diagram`, `architecture diagram`.

2. **Single Source of Truth**:
   `cbm_install_skills()` (`src/cli/cli.c` ~L1655) installs `skills[0].content` into `<agent-config>/skills/codebase-memory/SKILL.md`. This is compiled statically into the executable.

3. **Pinned Test Assertions in `tests/test_cli.c`**:
   - `cli_guidance_resolves_project_by_root_path_issue1690` (~L14903): Enforces that `skills[i].content`, `agent_instructions_content`, and Aider instructions contain `"never a repo or folder name"`.
   - `cli_installed_skill_limits_match_server_contract` (~L14979): Enforces that `installed[0].content` includes `"100k row ceiling"` and `"default to 50"`, while rejecting legacy `"200-row cap"` or `"default to 10"`.
   - Issue #1554: YAML frontmatter description must remain quoted to prevent parser crashes on colon characters.

---

## 3. Proposal

Update both `skill_content[]` and `agent_instructions_content[]` in `src/cli/cli.c` to provide full coverage of all 26 MCP tools while maintaining high density and adhering to all existing test contracts.

### 3.1 Updated Trigger Description (Frontmatter)
Expand the triggers to include API discovery, testing, diagrams, error tracing, configuration, and duplicate detection:
```yaml
---
name: codebase-memory
description: "Use the codebase knowledge graph for structural code queries. Triggers on: explore the codebase, understand the architecture, what functions exist, show me the structure, who calls this function, what does X call, trace the call chain, find callers of, show dependencies, impact analysis, blast radius, dead code, unused functions, code clones, duplicate code, test coverage gaps, API endpoints, api surface, environment variables, env vars, error flow, exceptions, co-changed files, generate diagram, sequence diagram, architecture diagram, refactor candidates, code quality audit, graph query syntax, Cypher query examples, edge types, how to use search_graph."
---
```

### 3.2 Enhanced Quick Decision Matrix
Replace the legacy table with a comprehensive decision matrix that maps all common developer inquiries directly to the optimal tool:

| Question / Task | Recommended Tool Call |
|---|---|
| **Find symbol by name / pattern** | `search_graph(name_pattern="...")` or `query="BM25 query"` |
| **Read source code of symbol** | `get_code_snippet(qualified_name="...", source_mode="auto")` |
| **File declaration outline** | `get_file_outline(file_path="src/...")` |
| **Who calls X? (Inbound callers)** | `trace_path(function_name="X", direction="inbound")` |
| **What does X call? (Outbound callees)**| `trace_path(function_name="X", direction="outbound")` |
| **Comprehensive caller + callee context** | `trace_path(function_name="X", direction="both", depth=3)` |
| **Symbol blast radius & change risk** | `analyze_blast_radius(target="X", max_depth=3)` |
| **Local git diff impact** | `detect_changes(scope="impact")` |
| **Historical companion / co-change files** | `get_coupled_files(file_path="src/...")` |
| **Find dead / unreferenced code** | `find_dead_code(min_confidence="HIGH")` |
| **Find duplicate code & clones** | `find_code_clones(min_similarity=0.80)` |
| **Audit test coverage & find test gaps**| `audit_test_coverage(mode="gaps")` or `mode="symbol_tests"` |
| **Export architecture / sequence diagram**| `export_diagram(type="architecture"|"sequence", format="mermaid")` |
| **Discover API routes & HTTP endpoints** | `get_api_surface(direction="all")` |
| **Discover environment variables & defaults** | `get_env_vars(generate_env_example=true)` |
| **Trace exception / error propagation** | `trace_error_flow(target="X", unhandled_only=true)` |
| **High-level architecture overview** | `get_architecture(aspects=["overview", "dependencies"])` |
| **Inspect graph schema & edge types** | `get_graph_schema(diagnostics="full")` |
| **Compare snapshots across branches** | `compare_graphs(base_project="...", target_project="...")` |
| **Multi-hop / complex graph queries** | `query_graph(query="MATCH ...")` (read-only Cypher) |
| **Exact path / scope coverage verification** | `check_index_coverage(paths=["..."])` |
| **Full-text / regex code search** | `search_code(pattern="...", mode="compact")` |
| **Manage Architectural Decision Records** | `manage_adr(mode="outline"|"get"|"set_sections")` |

---

## 4. Proposed Content for `skill_content[]`

Below is the complete text to be embedded into `src/cli/cli.c`:

```markdown
---
name: codebase-memory
description: "Use the codebase knowledge graph for structural code queries. Triggers on: explore the codebase, understand the architecture, what functions exist, show me the structure, who calls this function, what does X call, trace the call chain, find callers of, show dependencies, impact analysis, blast radius, dead code, unused functions, code clones, duplicate code, test coverage gaps, API endpoints, api surface, environment variables, env vars, error flow, exceptions, co-changed files, generate diagram, sequence diagram, architecture diagram, refactor candidates, code quality audit, graph query syntax, Cypher query examples, edge types, how to use search_graph."
---

# Codebase Memory — Knowledge Graph Tools

Graph tools return precise structural results in ~500 tokens vs ~80K for grep.
All 26 tools operate locally against the in-memory SQLite knowledge graph.

## Quick Decision Matrix

| Question / Task | Recommended Tool Call |
|---|---|
| **Find symbol by name / pattern** | `search_graph(name_pattern="...")` or `query="BM25 query"` |
| **Read symbol source or container outline** | `get_code_snippet(qualified_name="...", source_mode="auto")` |
| **File declaration outline** | `get_file_outline(file_path="src/...")` |
| **Who calls X? (Inbound callers)** | `trace_path(function_name="X", direction="inbound")` |
| **What does X call? (Outbound callees)**| `trace_path(function_name="X", direction="outbound")` |
| **Full call context** | `trace_path(function_name="X", direction="both", depth=3)` |
| **Symbol blast radius & change risk** | `analyze_blast_radius(target="X", max_depth=3)` |
| **Git diff impact & affected symbols** | `detect_changes(scope="impact")` |
| **Historical companion / co-change files** | `get_coupled_files(file_path="src/...")` |
| **Find dead / unreferenced code** | `find_dead_code(min_confidence="HIGH")` |
| **Find duplicate code & clones** | `find_code_clones(min_similarity=0.80)` |
| **Audit test coverage & find gaps** | `audit_test_coverage(mode="gaps")` or `(mode="symbol_tests", target="X")` |
| **Export architecture / sequence diagram**| `export_diagram(type="architecture"|"sequence", format="mermaid")` |
| **Discover API routes & endpoints** | `get_api_surface(direction="all")` |
| **Discover environment variables & config** | `get_env_vars(generate_env_example=true)` |
| **Trace error & exception propagation**| `trace_error_flow(target="X", unhandled_only=true)` |
| **High-level architecture overview** | `get_architecture(aspects=["overview", "dependencies"])` |
| **Graph schema & relationship types** | `get_graph_schema(diagnostics="full")` |
| **Compare snapshots across branches** | `compare_graphs(base_project="...", target_project="...")` |
| **Multi-hop / complex patterns** | `query_graph(query="MATCH ...")` (read-only Cypher) |
| **Verify indexed paths & coverage** | `check_index_coverage(paths=["..."])` |
| **Graph-ranked text search** | `search_code(pattern="...", mode="compact")` |
| **Architecture Decision Records (ADR)** | `manage_adr(mode="outline"|"get"|"set_sections")` |

## Standard Workflows

### 1. Exploration & Navigation
1. `list_projects` — pick the project whose `root_path` contains your working directory; pass its `name` (or the absolute directory itself) as `project`, never a repo or folder name.
2. `get_architecture(aspects=["overview", "routes"])` — high-level codebase structure, languages, entry points.
3. `search_graph(label="Function", name_pattern=".*Pattern.*")` — find symbols.
4. `get_code_snippet(qualified_name="project.path.FuncName")` — read exact implementation.

### 2. Change Impact & Safety
1. `detect_changes()` — map git diff to affected symbols.
2. `analyze_blast_radius(target="FuncName", max_depth=3)` — evaluate downstream callers, exposed public routes, covering tests, and composite risk.
3. `get_coupled_files(file_path="src/file.c")` — identify companion files historically committed together to avoid broken migrations.

### 3. Code Quality & Refactoring
1. `find_dead_code(min_confidence="HIGH")` — discover unreferenced functions/classes with public API exports filtered out.
2. `find_code_clones(min_similarity=0.80)` — detect duplicate code clusters using pre-computed AST MinHash.
3. `audit_test_coverage(mode="gaps", limit=20)` — identify critical untested entry points ranked by architectural importance score.

### 4. Contracts, APIs & Diagrams
1. `get_api_surface(direction="all")` — list ingress routes/handlers and egress HTTP/RPC client calls.
2. `get_env_vars(generate_env_example=true)` — inspect all configuration variables and generated template.
3. `trace_error_flow(target="route_or_func")` — inspect exception types that bubble up from downstream callees.
4. `export_diagram(type="sequence", entry_point="route_or_func", format="mermaid")` — render visual diagrams.

## Evidence Tiers
- **Scout (Tier 1):** fast positive lookup with few graph calls and targeted source checks. Treat results as provisional; never make absence, exhaustive, dead-code, or complete-impact claims.
- **Verify (Tier 2, default):** task-directed searches, relevant trace directions, exact snippets for material claims, and all relevant result pages.
- **Auditor (Tier 3):** bounded-scope full verification with a current graph generation, complete relevant pagination, both call directions and broader relationships when material, plus explicit unresolved limitations.
- **Every tier:** after candidate paths are known, call `check_index_coverage` once with every evidence path. For negative or exhaustive claims also include the relevant scopes. A clean result means no recorded gap, not proof of completeness. For partial, skipped, excluded, stale, pending, or unknown coverage, read/grep the reported ranges or scope before relying on the graph.

## Sessions and Subagents
- At session start or after compaction, call `list_projects`/`index_status` before structural exploration, then choose Scout, Verify, or Auditor for the task.
- Before delegating, query the graph and coverage in the parent. Pass the tier, exact project, generation/freshness, bounded scope, queries and pagination state, qualified symbols, paths, call-chain findings, coverage ranges/reasons, source fallback already performed, and unresolved questions to the child.
- Runtimes such as Hermes isolate child context: put those graph findings in the `context` argument to `delegate_task`; do not assume the child inherits MCP access or the parent's conversation.
- A child without MCP tools must not call or claim MCP access. It should work from the supplied evidence and use read/grep on exact source, especially every reported missed-coverage range.

## All 26 MCP Tools
- **Indexing & Projects (5):** `index_repository`, `index_status`, `list_projects`, `delete_project`, `check_index_coverage`
- **Discovery & Tracing (6):** `search_graph`, `search_code`, `trace_path`, `get_code_snippet`, `get_file_outline`, `query_graph`
- **Architecture & Diagrams (5):** `get_architecture`, `get_graph_schema`, `compare_graphs`, `export_diagram`, `manage_adr`
- **Quality & Blast Radius (8):** `analyze_blast_radius`, `get_api_surface`, `audit_test_coverage`, `find_code_clones`, `get_coupled_files`, `get_env_vars`, `find_dead_code`, `trace_error_flow`
- **Telemetry (2):** `detect_changes`, `ingest_traces`

## Edge Types
CALLS, HTTP_CALLS, ASYNC_CALLS, DATA_FLOWS, IMPORTS, DEFINES, DEFINES_METHOD,
HANDLES, IMPLEMENTS, OVERRIDE, USAGE, CALL_REFERENCE, CONFIGURES, REFERENCES_FILE,
FILE_CHANGES_WITH, SIMILAR_TO, SEMANTICALLY_RELATED, CONTAINS_FILE, CONTAINS_FOLDER,
CONTAINS_PACKAGE

## Cypher Examples (for query_graph)
```
MATCH (a)-[r:HTTP_CALLS]->(b) RETURN a.name, b.name, r.url_path, r.confidence LIMIT 20
MATCH (f:Function) WHERE f.name =~ '.*Handler.*' RETURN f.name, f.file_path
MATCH (a)-[r:CALLS]->(b) WHERE a.name = 'main' RETURN b.name
```

## Gotchas
1. `search_graph(relationship="HTTP_CALLS")` filters nodes by degree — use `query_graph` with Cypher to see actual edges.
2. `query_graph` has a 100k row ceiling — add a Cypher `LIMIT` for broad queries or use `search_graph` pagination (defaults to 50).
3. `trace_path` needs exact names — use `search_graph(name_pattern=...)` first.
4. For dead code, use `find_dead_code` rather than manual degree filters so exported library symbols are automatically preserved.
5. For refactoring impact, combine `detect_changes` with `analyze_blast_radius` and `get_coupled_files`.
```

---

## 5. Proposed Content for `agent_instructions_content[]`

In addition to `SKILL.md`, `agent_instructions_content[]` in `src/cli/cli.c` (~L3303) is written to rule files such as `.cursorrules`, `.windsurfrules`, `.agent/rules`, and instruction files for 30+ tools.

We will update its Priority Order and Examples to reference the new tools:

```markdown
# Codebase Memory

## Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

### Priority Order
1. `search_graph` / `get_code_snippet` — find symbols and read implementations
2. `trace_path` / `trace_error_flow` — trace callers, callees, and exception bubbling
3. `analyze_blast_radius` / `detect_changes` — impact analysis, route exposure, and risk
4. `find_dead_code` / `find_code_clones` / `audit_test_coverage` — code quality, test gaps, and duplication
5. `get_api_surface` / `get_env_vars` / `export_diagram` — API contracts, configuration, and diagrams
6. `check_index_coverage` — validate candidate paths and missed ranges before claims
7. `query_graph` — run Cypher queries for complex multi-hop patterns
8. `get_architecture` — high-level project summary

### Evidence tiers
- **Scout (Tier 1):** quick positive lookup with few calls and targeted source checks. Mark it provisional; do not make negative or exhaustive claims.
- **Verify (Tier 2, default):** task-directed graph evidence, relevant trace directions, exact snippets for material claims, and relevant pagination.
- **Auditor (Tier 3):** bounded-scope full verification with current generation, complete relevant pagination, both call directions and broader relationships when material, and every limitation disclosed.
- After candidate paths are known in any tier, call `check_index_coverage` once with every evidence path. Add relevant scopes for negative or exhaustive claims. A clean result means no recorded gap, not proof of completeness. For partial, skipped, excluded, stale, pending, or unknown coverage, read/grep the reported ranges or scope before relying on graph results.

### When to fall back to grep/glob
- Searching for string literals, error messages, config values
- Searching non-code files (Dockerfiles, shell scripts, configs)
- When MCP tools return insufficient results

### Examples
- Find a handler: `search_graph(name_pattern=".*OrderHandler.*")`
- Trace callers: `trace_path(function_name="OrderHandler", direction="inbound")`
- Symbol impact: `analyze_blast_radius(target="OrderHandler", max_depth=3)`
- Unused code: `find_dead_code(min_confidence="HIGH")`
- API contracts: `get_api_surface(direction="all")`
- Read source: `get_code_snippet(qualified_name="pkg/orders.OrderHandler")`

### Session resets and subagents
- At session start or after compaction, confirm the nearest graph project and generation with `list_projects` or `index_status`, then choose Scout, Verify, or Auditor.
- The graph project is the `list_projects` entry whose `root_path` contains your working directory; pass its `name` (or the absolute directory itself) as `project`, never a repo or folder name.
- Before spawning a subagent, query the graph and coverage in the parent. Pass the tier, project, generation/freshness, bounded scope, queries and pagination state, qualified symbols, paths, call-chain findings, coverage evidence with ranges/reasons, source fallback already performed, and unresolved questions in the delegated task context.
- Do not assume subagents inherit MCP access or the parent conversation. If a child lacks MCP tools, it must not call or claim MCP access. It should use the supplied evidence and read/grep exact source, especially every reported missed-coverage range.
```

---

## 6. Multi-Agent Distribution Strategy

When this change is merged and built into the binary:
1. Running `./install.sh`, `.\install.ps1`, or `codebase-memory-mcp install` will overwrite existing managed `SKILL.md` files where ownership markers are verified (`cbm_text_write_owned_document`).
2. Users running `codebase-memory-mcp update` will automatically have their agent skills and rules refreshed to the 26-tool specification.
3. No breaking changes occur for existing clients; all 15 legacy tool interfaces remain byte-for-byte identical.

---

## 7. Implementation & Verification Plan

### Step 1: Update C String Constants
- Modify `skill_content[]` in `src/cli/cli.c`.
- Modify `agent_instructions_content[]` in `src/cli/cli.c`.

### Step 2: Validate String Assertions in Test Suite
- Run `make test` / `tests/test_cli.c`.
- Ensure `cli_guidance_resolves_project_by_root_path_issue1690` passes (`"never a repo or folder name"` retained).
- Ensure `cli_installed_skill_limits_match_server_contract` passes (`"100k row ceiling"`, `"defaults to 50"` retained).
- Add test `cli_installed_skill_documents_all_26_tools` in `tests/test_cli.c` to assert presence of all 26 tool identifiers in `skills[0].content`.

### Step 3: Verify Token Footprint
- Measure UTF-8 byte count of `skill_content[]` (target: < 4,500 bytes / ~1,100 tokens).
