---
name: repository-reports
description: "Run comprehensive repository health reports across 9 deep analytical tools (RFC 001-008, RFC 014), view prioritized Fix-First risk queues, compare historical snapshot trends, and export reports in Markdown or JSON."
---

# Repository Analysis Reports (`repository-reports`)

Use this skill to run full-codebase architectural diagnostics, view prioritized **Fix First** action items, and track codebase quality trends over time.

## 1. Quick Start

### Run Comprehensive Audit & Save Snapshot
```bash
# Runs all 9 analytical tools, saves to .codebase-memory/reports/, outputs Markdown
node scripts/run-repo-report.mjs --preset comprehensive --save --format markdown
```

### Fast Health Check (< 5s)
```bash
# Runs test gaps, clone detection, API surface, env vars, and AI readiness
node scripts/run-repo-report.mjs --preset quick --format summary
```

### CI / PR Quality Gate
```bash
# Fails CI pipeline if overall score < 80 or if high-risk items (risk >= 80) exceed 5
node scripts/run-repo-report.mjs --fail-under 80 --max-high-risk 5 --save --format markdown > report.md
```

## 2. The 9 Analytical Tools Run in Reports

| Section | Tool | Key Insights |
| :--- | :--- | :--- |
| **1. Test Gaps** | `audit_test_coverage` | Untested critical functions, entry-point coverage percentage |
| **2. Duplication** | `find_code_clones` | Duplicate code blocks and clone clusters |
| **3. Dead Code** | `find_dead_code` | Functions, variables with 0 callers and unexported in API |
| **4. Risk Hotspots**| `analyze_blast_radius` | High fan-out nodes where edits trigger cascading breakage |
| **5. Hidden Coupling**| `get_coupled_files` | Files frequently modified together in Git without co-tests |
| **6. API Surface** | `get_api_surface` | Ingress HTTP/RPC routes and egress external network calls |
| **7. Error Bubbling**| `trace_error_flow` | Unhandled exceptions and error propagation paths |
| **8. Config & Env** | `get_env_vars` | Discovered environment variables and missing defaults |
| **9. AI Readiness** | `ai_readiness_audit` | Score on agent instructions, skill parity, and guardrails |

## 3. Interpreting the "Fix First" Queue

The **Fix First** queue ranks issues by composite risk score (0–100):
- 🔴 **Risk 80–100 (Blocker / High):** Untested public entry points with high caller counts, or missing core agent runbooks. Fix or test immediately before merging.
- 🟠 **Risk 60–79 (Medium-High):** Large blast-radius nexus symbols, duplicate code clusters across multiple modules, or tight hidden file coupling.
- 🟡 **Risk 40–59 (Moderate / Cleanup):** Dead unreferenced symbols safe for deprecation or deletion.

## 4. Reports Web Dashboard

Open the Codebase Memory Web UI and navigate to the **Reports** tab (`/?tab=reports`):
- **Real-Time Progress Stepper:** Watch each analytical tool complete with progress bars.
- **Interactive Fix-First Queue:** Inspect caller cascades, affected files, and recommended fixes.
- **Snapshot History:** Compare current runs with previous snapshots to see deltas in test coverage, dead code reduction, and overall grade.
- **Export Options:** One-click copy/download for GitHub-Flavored Markdown and machine-readable JSON.
