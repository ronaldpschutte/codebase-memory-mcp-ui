---
name: ai-readiness-audit
description: "Audit repository AI readiness, score ergonomics for AI coding agents (0-100), identify missing skill runbooks for project tools, and generate actionable remediations."
---

# AI Readiness Audit Skill

Use this skill when the user asks to:
- Rate, score, or audit the repository's AI readiness or agent ergonomics.
- Check if any project tools, frameworks, or environments lack matching `SKILL.md` runbooks.
- Identify missing agent instructions (`AGENTS.md`, `CLAUDE.md`, `llms.txt`) or verification guardrails.
- Scaffold starter skills for detected tools.

---

## 1. Quick Audit Command

Run the audit engine using Node.js:
```bash
node scripts/audit-ai-readiness.mjs
```

To output raw JSON for automated analysis:
```bash
node scripts/audit-ai-readiness.mjs --json
```

To enforce CI thresholds (fails if score < 80):
```bash
node scripts/audit-ai-readiness.mjs --fail-under 80
```

---

## 2. The 5 Pillars of AI Readiness

The audit evaluates 5 distinct dimensions:

| Pillar | Max Points | Key Focus |
| :--- | :---: | :--- |
| **1. Agent Instructions** | 20 | Presence of `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `llms.txt` with clear build and test commands. |
| **2. Tool & Skill Coverage** | 25 | Parity between detected tools/services in the repo (Docker, Vite, Migrations, etc.) and matching `SKILL.md` runbooks. |
| **3. Knowledge Graph Integrity** | 20 | Graph index status (`check_index_coverage`), `ARCHITECTURE.md`, and doclink validity. |
| **4. Test & Verification Guardrails** | 20 | Test suite discoverability (`audit_test_coverage`), linters, and CI pipelines. |
| **5. Graph Hygiene & Boundaries** | 15 | Dead code ratio (`find_dead_code`), temporal coupling clusters, and clean lockfiles. |

---

## 3. Remediating Missing Skills

When the audit reports missing skills for detected tools, automatically scaffold them using:
```bash
# Scaffold a single missing skill (e.g. for docker, vite-frontend, database-migrations)
node scripts/audit-ai-readiness.mjs --scaffold <tool-id>

# Or scaffold all detected missing skills in one command
node scripts/audit-ai-readiness.mjs --scaffold-all
```

After scaffolding:
1. Review generated `.agents/skills/<skill-name>/SKILL.md`.
2. Tailor verification commands and specific project constraints.
3. Re-run `node scripts/audit-ai-readiness.mjs` to verify the score increase.
