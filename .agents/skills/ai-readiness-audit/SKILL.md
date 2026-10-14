---
name: ai-readiness-audit
description: "Audit repository AI readiness, score ergonomics for AI coding agents (0-100), identify missing skill runbooks for project tools, audit agent context markdown files and symbol integrity (RFC 018), and generate actionable remediations."
---

# AI Readiness Audit Skill

Use this skill when the user asks to:
- Rate, score, or audit the repository's AI readiness or agent ergonomics.
- Check if any project tools, frameworks, or environments lack matching `SKILL.md` runbooks.
- Audit agent-influencing context documents (`AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `GEMINI.md`, `llms.txt`, `.cursorrules`).
- Measure static prompt token budget load and detect prompt bloat.
- Cross-reference markdown documentation symbols against the active knowledge graph to detect symbol drift.
- Scaffold starter skills or missing architectural documentation (`ARCHITECTURE.md`, `docs/llms.txt`, `AGENTS.md`).

---

## 1. Quick Audit Command

Run the audit engine using Node.js:
```bash
node scripts/audit-ai-readiness.mjs
```

To display the detailed **Agent Context & Instruction Architecture** document inventory table (RFC 018):
```bash
node scripts/audit-ai-readiness.mjs --context-inventory
```

To output raw JSON for automated analysis:
```bash
node scripts/audit-ai-readiness.mjs --json
```

To enforce CI thresholds and prevent documentation drift:
```bash
# Fail if overall score is under 80
node scripts/audit-ai-readiness.mjs --fail-under 80

# Fail if unindexed or drifted symbols exist in documentation
node scripts/audit-ai-readiness.mjs --fail-on-symbol-drift
```

---

## 2. The 5 Pillars of AI Readiness

The audit evaluates 5 distinct dimensions:

| Pillar | Max Points | Key Focus |
| :--- | :---: | :--- |
| **1. Agent Instructions & Context Anchors** | 20 | Presence of `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `llms.txt`; prompt token budget discipline (<3,500 tokens). |
| **2. Tool & Skill Coverage** | 25 | Parity between detected tools/services in the repo (Docker, Vite, Migrations, etc.) and matching `SKILL.md` runbooks. |
| **3. Knowledge Graph & Index Integrity** | 20 | Graph index status (`check_index_coverage`), `ARCHITECTURE.md`, and symbol anchor integrity across docs. |
| **4. Test & Verification Guardrails** | 20 | Test suite discoverability (`audit_test_coverage`), linters, and CI pipelines. |
| **5. Graph Hygiene & Boundaries** | 15 | Dead code ratio (`find_dead_code`), temporal coupling clusters, and clean lockfiles. |

---

## 3. Agent Context & Instruction Architecture (RFC 018)

RFC 018 introduces deep inspection of all repository markdown files and configuration anchors that influence AI agents:

1. **Context Document Taxonomy:**
   - **Primary Instructions:** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`.
   - **Architecture & Domain:** `ARCHITECTURE.md`, `docs/architecture.md`, `docs/RFC_*.md`, `PRD_*.md`.
   - **Skill Runbooks:** `.agents/skills/*/SKILL.md`, `skills/*/SKILL.md`.
   - **LLM Discovery Indexes:** `llms.txt`, `docs/llms.txt`.
   - **Standards & Governance:** `README.md`, `CONTRIBUTING.md`, `docs/adr/*.md`.

2. **Prompt Token Budget Meter:**
   - Evaluates initial static instruction tokens injected into agent working memory.
   - Categorized as **HEALTHY** (<2,500 tok), **MODERATE** (2,500–4,500 tok), or **BLOATED** (>4,500 tok).

3. **Symbol Anchor Integrity:**
   - Validates inline backticked symbols against `codebase-memory-mcp` knowledge graph nodes to flag dead or renamed functions before models hallucinate.

---

## 4. One-Click & Automated Scaffolding

When the audit reports missing skills or documentation, scaffold them directly:

```bash
# Scaffold missing root agent instructions
node scripts/audit-ai-readiness.mjs --scaffold-agents

# Scaffold missing system ARCHITECTURE.md (with embedded Mermaid diagram)
node scripts/audit-ai-readiness.mjs --scaffold-arch

# Scaffold missing docs/llms.txt summary index
node scripts/audit-ai-readiness.mjs --scaffold-llms

# Scaffold a single missing skill (e.g. for docker, vite-frontend)
node scripts/audit-ai-readiness.mjs --scaffold <tool-id>

# Scaffold all detected missing skills in one command
node scripts/audit-ai-readiness.mjs --scaffold-all
```

After scaffolding:
1. Review generated files.
2. Tailor verification commands and specific project constraints.
3. Re-run `node scripts/audit-ai-readiness.mjs` to verify score improvement.
