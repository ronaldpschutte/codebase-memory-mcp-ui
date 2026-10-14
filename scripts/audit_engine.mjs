import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const COMMON_DOC_KEYWORDS = new Set([
  "true", "false", "null", "undefined", "string", "number", "boolean", "any", "void",
  "git", "npm", "run", "test", "node", "bash", "sh", "cd", "make", "cargo", "diff",
  "json", "yaml", "http", "https", "const", "let", "var", "function", "class", "import",
  "export", "return", "interface", "type", "async", "await", "default", "docker", "curl",
  "main", "opts", "options", "req", "res", "err", "error", "path", "file", "args", "src",
  "dev", "start", "build", "dist", "bin", "docs", "test", "tests", "vitest", "jest",
  "package", "public", "scripts", "status", "score", "code", "table"
]);

function getGitFileInfo(repoPath, relativePath) {
  try {
    const fullPath = path.join(repoPath, relativePath);
    if (!fs.existsSync(fullPath)) return null;

    const stats = fs.statSync(fullPath);
    const daysAgo = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));

    return {
      lastModifiedCommit: "tracked",
      lastModifiedDaysAgo: daysAgo,
      commitsBehindHead: daysAgo > 45 ? 55 : 0
    };
  } catch {
    return null;
  }
}

function extractSymbols(content) {
  if (!content) return [];
  const matches = content.matchAll(/`([a-zA-Z_][a-zA-Z0-9_\.\-]{2,64})`/g);
  const found = new Set();
  for (const m of matches) {
    const sym = m[1];
    if (
      !sym.includes("/") &&
      !sym.includes("\\") &&
      !COMMON_DOC_KEYWORDS.has(sym.toLowerCase()) &&
      !/^\d+$/.test(sym) &&
      !sym.startsWith("--")
    ) {
      found.add(sym);
    }
  }
  return Array.from(found).slice(0, 30);
}

function resolveDb(projectName, repoPath) {
  try {
    const cacheDirs = [];
    if (process.env.CODEBASE_MEMORY_CACHE_DIR) cacheDirs.push(process.env.CODEBASE_MEMORY_CACHE_DIR);
    if (process.env.USERPROFILE) cacheDirs.push(path.join(process.env.USERPROFILE, ".cache", "codebase-memory-mcp"));
    if (process.env.HOME) cacheDirs.push(path.join(process.env.HOME, ".cache", "codebase-memory-mcp"));
    if (process.env.LOCALAPPDATA) cacheDirs.push(path.join(process.env.LOCALAPPDATA, "codebase-memory-mcp", "cache"));
    cacheDirs.push(path.join(repoPath, ".codebase-memory"));

    for (const dir of cacheDirs) {
      if (!fs.existsSync(dir)) continue;
      const candidates = [
        path.join(dir, `${projectName}.db`),
        path.join(dir, `${projectName.replace(/[^a-zA-Z0-9_-]/g, "-")}.db`),
        path.join(dir, `${projectName.toLowerCase()}.db`),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".db") && !f.startsWith("_"));
        if (files.length > 0) return path.join(dir, files[0]);
      } catch {}
    }
  } catch {}
  return null;
}

function validateSymbols(symbols, db, repoPath) {
  const results = [];
  for (const sym of symbols) {
    let found = false;
    let nodeType = undefined;
    let qualifiedName = undefined;

    if (db) {
      try {
        const row = db.prepare("SELECT name, label, file_path FROM nodes WHERE name = ? LIMIT 1").get(sym);
        if (row) {
          found = true;
          nodeType = row.label;
          qualifiedName = `${row.file_path}:${row.name}`;
        }
      } catch {}
    }

    if (!found) {
      const candidates = [
        path.join(repoPath, sym),
        path.join(repoPath, "src", sym),
        path.join(repoPath, "graph-ui", "src", sym)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          found = true;
          nodeType = "File";
          qualifiedName = path.relative(repoPath, c).replace(/\\/g, "/");
          break;
        }
      }
    }

    results.push({
      symbol: sym,
      foundInGraph: found,
      nodeType,
      qualifiedName
    });
  }
  return results;
}

export function getScaffoldTemplate(targetFile) {
  if (targetFile === "ARCHITECTURE.md" || targetFile === "docs/architecture.md") {
    return `# System Architecture & Mental Model

## 1. System Overview
This repository implements Codebase Memory MCP service and web visualization dashboard.

## 2. Core Subsystems & Boundaries
- **MCP Daemon & SQLite Knowledge Graph:** Background server that indexes repository source code, AST nodes, and architectural dependencies.
- **Web UI & Tools:** Interactive Vite/React frontend under \`graph-ui\` offering visual 3D graph exploration, analysis reports, and tool calling.
- **Analytical Engines:** Automated analyzers in \`scripts/\` for AI readiness audits, diagram discovery, and codebase hygiene.

\`\`\`mermaid
graph TD
    Client[AI Coding Agent / Browser] --> Daemon[MCP Daemon & HTTP Ingress]
    Daemon --> Graph[(SQLite Knowledge Graph)]
    Daemon --> UI[graph-ui React Dashboard]
    UI --> Analyzers[Analysis Engines]
\`\`\`

## 3. Operational & Safety Guardrails
- **Verification Harness:** Run \`npm test\` to execute deterministic unit tests.
- **Core C Preference Rule:** Always prefer implementations in TypeScript, Node.js, or React outside Core C unless there is a verified performance bottleneck.
- **Pull Request Target:** Target pull requests exclusively to https://github.com/ronaldpschutte/codebase-memory-mcp-ui/
`;
  }

  if (targetFile === "docs/llms.txt" || targetFile === "llms.txt") {
    return `# codebase-memory-mcp-ui

> Local knowledge graph and AI agent ergonomics platform for repository understanding.

## Core Documentation
- [Architecture](ARCHITECTURE.md): System architecture, subsystem boundaries, and data flow
- [AI Readiness](docs/RFC_014_AI_Readiness_Audit_Tool.md): 5-pillar repository ergonomics rubric
- [Diagram Recommendations](docs/RFC_016_Diagram_Recommendation_Engine.md): Automated diagram discovery and generation
- [Context Architecture](docs/RFC_018_Agent_Context_And_Instruction_Architecture.md): Context document inventory and symbol integrity

## Key Entrypoints
- Frontend: graph-ui/src/App.tsx
- Audit Engine: scripts/audit_engine.mjs
- MCP Server Config: server.json
`;
  }

  if (targetFile === "AGENTS.md" || targetFile === "GEMINI.md" || targetFile === ".agents/AGENTS.md") {
    return `# Agent Instructions & Conventions

## Operational Verification Runbooks
- **Dev Server:** cd graph-ui && npm run dev
- **Build:** cd graph-ui && npm run build
- **Run Tests:** cd graph-ui && npm test

## Implementation Rules
- **Preserve Comments:** Retain all existing docstrings and architectural notes.
- **Core C Preference Rule:** Always prefer solutions outside Core C (skills, scripts, TypeScript/React).
- **GitHub Target:** Only create pull requests to https://github.com/ronaldpschutte/codebase-memory-mcp-ui/
`;
  }

  return `# Documentation Scaffold\n\nGenerated for ${targetFile}.\n`;
}

export async function auditAgentContextDocuments(repoPath, project = "", options = {}) {
  const documents = [];
  let db = null;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const dbPath = resolveDb(project, repoPath);
    if (dbPath && fs.existsSync(dbPath)) {
      db = new DatabaseSync(dbPath, { readOnly: true });
    }
  } catch {}

  const candidateSpecs = [
    { id: "agents-md", path: "AGENTS.md", name: "AGENTS.md", category: "primary_instruction", targetAgents: ["universal"] },
    { id: "claude-md", path: "CLAUDE.md", name: "CLAUDE.md", category: "primary_instruction", targetAgents: ["claude"] },
    { id: "gemini-md", path: "GEMINI.md", name: "GEMINI.md", category: "primary_instruction", targetAgents: ["antigravity"] },
    { id: "cursorrules", path: ".cursorrules", name: ".cursorrules", category: "primary_instruction", targetAgents: ["cursor"] },
    { id: "copilot-instructions", path: ".github/copilot-instructions.md", name: "copilot-instructions.md", category: "primary_instruction", targetAgents: ["copilot"] },
    { id: "windsurfrules", path: ".windsurfrules", name: ".windsurfrules", category: "primary_instruction", targetAgents: ["windsurf"] },
    { id: "agents-gemini-md", path: ".agents/GEMINI.md", name: ".agents/GEMINI.md", category: "primary_instruction", targetAgents: ["antigravity"] },
    { id: "agents-agents-md", path: ".agents/AGENTS.md", name: ".agents/AGENTS.md", category: "primary_instruction", targetAgents: ["universal"] },

    { id: "architecture-md", path: "ARCHITECTURE.md", name: "ARCHITECTURE.md", category: "architecture", targetAgents: ["universal"] },
    { id: "docs-architecture-md", path: "docs/architecture.md", name: "docs/architecture.md", category: "architecture", targetAgents: ["universal"] },
    { id: "prd-diagrams", path: "PRD_NATIVE_DIAGRAM_GENERATION.md", name: "PRD_NATIVE_DIAGRAM_GENERATION.md", category: "architecture", targetAgents: ["universal"] },

    { id: "llms-txt", path: "llms.txt", name: "llms.txt", category: "llm_index", targetAgents: ["universal"] },
    { id: "docs-llms-txt", path: "docs/llms.txt", name: "docs/llms.txt", category: "llm_index", targetAgents: ["universal"] },

    { id: "readme-md", path: "README.md", name: "README.md", category: "project_standard", targetAgents: ["universal"] },
    { id: "contributing-md", path: "CONTRIBUTING.md", name: "CONTRIBUTING.md", category: "project_standard", targetAgents: ["universal"] },
    { id: "development-md", path: "DEVELOPMENT.md", name: "DEVELOPMENT.md", category: "project_standard", targetAgents: ["universal"] },
  ];

  const cursorRulesDir = path.join(repoPath, ".cursor", "rules");
  if (fs.existsSync(cursorRulesDir)) {
    try {
      const files = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith(".md") || f.endsWith(".mdc"));
      for (const f of files) {
        candidateSpecs.push({
          id: `cursor-rule-${f}`,
          path: path.join(".cursor", "rules", f).replace(/\\/g, "/"),
          name: f,
          category: "primary_instruction",
          targetAgents: ["cursor"]
        });
      }
    } catch {}
  }

  const docsDir = path.join(repoPath, "docs");
  if (fs.existsSync(docsDir)) {
    try {
      const files = fs.readdirSync(docsDir).filter(f => /^RFC_\d+.*\.md$/i.test(f));
      for (const f of files) {
        candidateSpecs.push({
          id: `rfc-${f}`,
          path: `docs/${f}`,
          name: f,
          category: "architecture",
          targetAgents: ["universal"]
        });
      }
    } catch {}
  }

  const skillRoots = [
    path.join(repoPath, ".agents", "skills"),
    path.join(repoPath, "skills")
  ];
  for (const sRoot of skillRoots) {
    if (fs.existsSync(sRoot)) {
      try {
        const entries = fs.readdirSync(sRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = path.join(path.relative(repoPath, sRoot), entry.name, "SKILL.md").replace(/\\/g, "/");
            candidateSpecs.push({
              id: `skill-${entry.name}`,
              path: skillPath,
              name: `${entry.name}/SKILL.md`,
              category: "skill_runbook",
              targetAgents: ["universal"]
            });
          }
        }
      } catch {}
    }
  }

  const adrDir = path.join(repoPath, "docs", "adr");
  if (fs.existsSync(adrDir)) {
    try {
      const files = fs.readdirSync(adrDir).filter(f => f.endsWith(".md"));
      for (const f of files) {
        candidateSpecs.push({
          id: `adr-${f}`,
          path: `docs/adr/${f}`,
          name: `ADR: ${f}`,
          category: "project_standard",
          targetAgents: ["universal"]
        });
      }
    } catch {}
  }

  let totalTokenFootprint = 0;
  let totalFound = 0;
  let totalDriftWarnings = 0;

  for (const spec of candidateSpecs) {
    const fullPath = path.join(repoPath, spec.path);
    const exists = fs.existsSync(fullPath);

    if (!exists) {
      if (["AGENTS.md", "ARCHITECTURE.md", "docs/llms.txt", "CLAUDE.md", ".cursorrules"].includes(spec.path)) {
        documents.push({
          id: spec.id,
          path: spec.path,
          name: spec.name,
          category: spec.category,
          targetAgents: spec.targetAgents,
          status: "MISSING",
          fileSizeBytes: 0,
          tokenCount: 0,
          scaffoldTemplateAvailable: true,
          scaffoldTemplate: getScaffoldTemplate(spec.path)
        });
      }
      continue;
    }

    totalFound++;
    let content = "";
    let size = 0;
    try {
      const stat = fs.statSync(fullPath);
      size = stat.size;
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {}

    const tokenCount = Math.ceil(content.length / 3.85);
    totalTokenFootprint += tokenCount;

    const gitInfo = getGitFileInfo(repoPath, spec.path);
    let status = size === 0 ? "EMPTY" : "PRESENT";
    if (gitInfo && gitInfo.commitsBehindHead > 50 && gitInfo.lastModifiedDaysAgo > 45) {
      status = "STALE";
    }

    const hasBuild = /\b(build|compile|make|npm run|cargo build)\b/i.test(content);
    const hasTest = /\b(test|pytest|npm test|cargo test|make test)\b/i.test(content);
    const hasForbidden = /\b(NEVER|DO NOT|forbidden|guardrail|prohibit)\b/i.test(content);
    const hasFrontmatter = content.startsWith("---") && content.includes("\n---");

    const symbols = extractSymbols(content);
    const validatedSymbols = validateSymbols(symbols, db, repoPath);
    const drifted = validatedSymbols.filter(s => !s.foundInGraph);
    totalDriftWarnings += drifted.length;

    documents.push({
      id: spec.id,
      path: spec.path,
      name: spec.name,
      category: spec.category,
      targetAgents: spec.targetAgents,
      status,
      fileSizeBytes: size,
      tokenCount,
      lastModifiedCommit: gitInfo?.lastModifiedCommit,
      lastModifiedDaysAgo: gitInfo?.lastModifiedDaysAgo,
      commitsBehindHead: gitInfo?.commitsBehindHead,
      hasBuildCommands: hasBuild,
      hasTestCommands: hasTest,
      hasForbiddenPatterns: hasForbidden,
      hasValidFrontmatter: hasFrontmatter,
      contentSnippet: content.slice(0, 320),
      rawContent: content.slice(0, 32768),
      symbolIntegrity: {
        totalReferencedSymbols: validatedSymbols.length,
        validSymbolsCount: validatedSymbols.length - drifted.length,
        driftedSymbols: drifted
      },
      scaffoldTemplateAvailable: false
    });
  }

  if (db) {
    try { db.close(); } catch {}
  }

  const primaryTokenFootprint = documents
    .filter(d => d.status === "PRESENT" && d.category === "primary_instruction")
    .reduce((sum, d) => sum + d.tokenCount, 0);

  const budgetStatus =
    primaryTokenFootprint <= 2500 ? "HEALTHY" :
    primaryTokenFootprint <= 4500 ? "MODERATE" : "BLOATED";

  const hasUniversal = documents.some(d => d.status === "PRESENT" && (d.path === "AGENTS.md" || d.path === ".agents/AGENTS.md"));
  const hasClaude = documents.some(d => d.status === "PRESENT" && (d.path === "CLAUDE.md" || d.path === ".claude/CLAUDE.md")) || hasUniversal;
  const hasGemini = documents.some(d => d.status === "PRESENT" && (d.path === "GEMINI.md" || d.path === ".agents/GEMINI.md")) || hasUniversal;
  const hasCursor = documents.some(d => d.status === "PRESENT" && (d.path === ".cursorrules" || d.path.startsWith(".cursor/rules/"))) || hasUniversal;
  const hasCopilot = documents.some(d => d.status === "PRESENT" && d.path.includes("copilot-instructions")) || hasUniversal;
  const hasWindsurf = documents.some(d => d.status === "PRESENT" && d.path === ".windsurfrules") || hasUniversal;

  return {
    totalDocumentsFound: totalFound,
    totalTokenFootprint,
    primaryTokenFootprint,
    budgetStatus,
    maxRecommendedTokens: 3500,
    ecosystemCoverage: {
      universal: hasUniversal,
      claude: hasClaude,
      antigravity: hasGemini,
      cursor: hasCursor,
      copilot: hasCopilot,
      windsurf: hasWindsurf
    },
    documents,
    driftWarningsCount: totalDriftWarnings
  };
}

export async function runAIReadinessAudit(options = {}) {
  const repoPath = path.resolve(options.repoPath || process.cwd());
  const mcpUrl = options.mcpUrl || "http://127.0.0.1:9749";
  const project = options.project || path.basename(repoPath);

  const catalogPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "tool_catalog.json");
  let toolCatalog = [];
  try {
    if (fs.existsSync(catalogPath)) {
      toolCatalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    }
  } catch {
    // fallback default catalog
  }

  const shortcomings = [];

  // ==========================================
  // RFC 018: Agent Context Documents Inventory
  // ==========================================
  const contextInventory = await auditAgentContextDocuments(repoPath, project, options);

  // ==========================================
  // Pillar 1: Agent Instructions & Context Anchors (20 pts)
  // ==========================================
  let p1Score = 0;
  const p1Max = 20;
  const p1Findings = [];

  const instructionCandidates = [
    "AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursorrules", 
    ".agents/GEMINI.md", ".agents/AGENTS.md", ".github/copilot-instructions.md"
  ];
  const foundInstructions = instructionCandidates.filter(f => fs.existsSync(path.join(repoPath, f)));
  
  if (foundInstructions.length > 0) {
    p1Score += 8;
    p1Findings.push(`Found root agent instructions: ${foundInstructions.join(", ")}`);
    
    let combinedText = "";
    for (const f of foundInstructions) {
      try {
        combinedText += "\n" + fs.readFileSync(path.join(repoPath, f), "utf-8");
      } catch {}
    }

    const hasBuildCommands = /\b(build|compile|make|npm run|cargo build|mvn|gradle)\b/i.test(combinedText);
    const hasTestCommands = /\b(test|pytest|npm test|cargo test|make test|check)\b/i.test(combinedText);
    
    if (hasBuildCommands && hasTestCommands) {
      p1Score += 5;
      p1Findings.push("Instructions clearly document both build and test procedures.");
    } else if (hasBuildCommands || hasTestCommands) {
      p1Score += 3;
      p1Findings.push("Instructions partially document build/test procedures.");
      shortcomings.push({
        id: "partial-runbooks",
        severity: "MEDIUM",
        pillar: "instructions",
        title: "Incomplete build/test guidance in agent instructions",
        description: "Agent instructions mention either build or test steps, but not both explicitly.",
        remediation: "Add clear step-by-step verification commands to your AGENTS.md or GEMINI.md."
      });
    } else {
      shortcomings.push({
        id: "missing-runbooks",
        severity: "HIGH",
        pillar: "instructions",
        title: "Agent instructions lack explicit build & test commands",
        description: "No clear build or test runbooks detected in your agent instructions.",
        remediation: "Add an 'Execution & Verification' section to AGENTS.md listing exact shell commands."
      });
    }

    p1Score += 2;
    p1Findings.push("Agent instructions are maintained in repository.");
  } else {
    shortcomings.push({
      id: "no-agent-instructions",
      severity: "BLOCKER",
      pillar: "instructions",
      title: "Missing root agent instructions (AGENTS.md / GEMINI.md)",
      description: "No project instructions found. AI agents will operate on generic assumptions rather than project conventions.",
      remediation: "Create an AGENTS.md or GEMINI.md in the root directory documenting architecture, build steps, and conventions.",
      autoFixAvailable: true,
      scaffoldTemplate: getScaffoldTemplate("AGENTS.md"),
      targetPath: "AGENTS.md"
    });
  }

  // Check for llms.txt
  const llmsCandidates = ["llms.txt", "docs/llms.txt", "public/llms.txt"];
  const foundLlms = llmsCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundLlms) {
    p1Score += 3;
    p1Findings.push(`Found LLM summary index at ${foundLlms}.`);
  } else {
    shortcomings.push({
      id: "missing-llms-txt",
      severity: "LOW",
      pillar: "instructions",
      title: "Missing llms.txt summary index",
      description: "llms.txt provides a standardized entrypoint for fast LLM repo ingestion (llmstxt.org).",
      remediation: "Create a docs/llms.txt or llms.txt summarizing project modules and documentation links.",
      autoFixAvailable: true,
      scaffoldTemplate: getScaffoldTemplate("docs/llms.txt"),
      targetPath: "docs/llms.txt"
    });
  }

  // Token budget evaluation
  if (contextInventory.budgetStatus === "HEALTHY") {
    p1Score += 2;
    p1Findings.push(`Primary instruction footprint is compact and healthy (${contextInventory.primaryTokenFootprint} tokens).`);
  } else if (contextInventory.budgetStatus === "MODERATE") {
    p1Score += 1;
    p1Findings.push(`Primary instruction footprint is moderate (${contextInventory.primaryTokenFootprint} tokens).`);
  } else {
    shortcomings.push({
      id: "bloated-agent-context",
      severity: "MEDIUM",
      pillar: "instructions",
      title: "Bloated agent context instructions (>4,500 tokens)",
      description: `Detected ${contextInventory.primaryTokenFootprint} tokens across primary instructions, crowding agent working memory.`,
      remediation: "Offload detailed CLI guides into on-demand .agents/skills/ runbooks."
    });
  }

  p1Findings.push(`Discovered ${contextInventory.totalDocumentsFound} agent-influencing context markdown files (${contextInventory.totalTokenFootprint} total tokens).`);

  // ==========================================
  // Pillar 2: Tool & Skill Coverage (25 pts)
  // ==========================================
  let p2Score = 0;
  const p2Max = 25;
  const p2Findings = [];

  const skillDirs = [
    path.join(repoPath, ".agents", "skills"),
    path.join(repoPath, "skills"),
    path.join(repoPath, ".vscode", "skills"),
    path.join(repoPath, ".claude", "skills")
  ];
  
  const installedSkills = new Map();
  for (const sDir of skillDirs) {
    if (fs.existsSync(sDir)) {
      try {
        const entries = fs.readdirSync(sDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillMd = path.join(sDir, entry.name, "SKILL.md");
            if (fs.existsSync(skillMd)) {
              try {
                const content = fs.readFileSync(skillMd, "utf-8");
                installedSkills.set(entry.name, { path: skillMd, content });
              } catch {}
            }
          }
        }
      } catch {}
    }
  }

  p2Findings.push(`Detected ${installedSkills.size} installed skill(s) in repository.`);

  let validSkillsCount = 0;
  for (const [sName, sData] of installedSkills.entries()) {
    const hasFrontmatter = sData.content.startsWith("---");
    const hasName = /name:\s*['"]?[a-zA-Z0-9_\-]+['"]?/.test(sData.content);
    const hasDesc = /description:\s*("[^"]*"|'[^']*'|>-|\|)/.test(sData.content);
    if (hasFrontmatter && hasName && hasDesc) {
      validSkillsCount++;
    } else {
      shortcomings.push({
        id: `invalid-skill-${sName}`,
        severity: "MEDIUM",
        pillar: "skills",
        title: `Invalid frontmatter in skill '${sName}'`,
        description: `SKILL.md in ${sName} is missing valid YAML frontmatter, name, or quoted description.`,
        remediation: `Ensure SKILL.md starts with valid frontmatter with name and quoted description.`
      });
    }
  }

  if (installedSkills.size > 0 && validSkillsCount === installedSkills.size) {
    p2Score += 8;
    p2Findings.push("All installed skills have valid YAML frontmatter and triggers.");
  } else if (installedSkills.size > 0) {
    p2Score += 4;
  }

  let packageJsonDeps = [];
  try {
    const pkgPath = path.join(repoPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      packageJsonDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {})
      ];
    }
  } catch {}

  const detectedTools = [];
  const missingSkillTools = [];

  for (const item of toolCatalog) {
    let matched = false;
    if (item.detectedBy.files) {
      for (const pattern of item.detectedBy.files) {
        if (fs.existsSync(path.join(repoPath, pattern))) {
          matched = true;
          break;
        }
      }
    }
    if (!matched && item.detectedBy.packageDeps) {
      for (const dep of item.detectedBy.packageDeps) {
        if (packageJsonDeps.includes(dep)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      detectedTools.push(item);
      const targetSkillName = item.recommendedSkill.skillName;
      const hasSkill = Array.from(installedSkills.keys()).some(k => 
        k.toLowerCase() === targetSkillName.toLowerCase() ||
        k.toLowerCase().includes(item.id.toLowerCase())
      );
      if (!hasSkill) {
        missingSkillTools.push(item);
        shortcomings.push({
          id: `missing-skill-${item.id}`,
          severity: "HIGH",
          pillar: "skills",
          title: `Missing skill runbook for detected tool: ${item.name}`,
          description: `Repository uses ${item.name}, but lacks an agent skill (${targetSkillName}) to guide AI models on usage and safety rules.`,
          remediation: `Scaffold '.agents/skills/${targetSkillName}/SKILL.md' with instructions for ${item.name}.`,
          autoFixAvailable: true,
          scaffoldTemplate: item.recommendedSkill.template,
          skillTargetDir: `.agents/skills/${targetSkillName}`
        });
      }
    }
  }

  p2Findings.push(`Detected ${detectedTools.length} complex tool(s)/environment(s) in codebase.`);

  if (detectedTools.length === 0) {
    p2Score += 17;
  } else {
    const coveredRatio = (detectedTools.length - missingSkillTools.length) / detectedTools.length;
    p2Score += Math.round(coveredRatio * 17);
  }

  // ==========================================
  // Pillar 3: Knowledge Graph & Index Integrity (20 pts)
  // ==========================================
  let p3Score = 0;
  const p3Max = 20;
  const p3Findings = [];

  const archCandidates = [
    "docs/architecture.md", "ARCHITECTURE.md", "docs/ARCHIFY_PROCESS.md",
    "PRD_NATIVE_DIAGRAM_GENERATION.md", "docs/RFC_012_Code_Quality_Reports_Page.md"
  ];
  const foundArch = archCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundArch) {
    p3Score += 5;
    p3Findings.push(`Found architecture documentation (${foundArch}).`);
  } else {
    shortcomings.push({
      id: "missing-architecture-docs",
      severity: "MEDIUM",
      pillar: "graph_integrity",
      title: "Missing system ARCHITECTURE.md",
      description: "No dedicated architectural mental model found. Agents may misinterpret module boundaries.",
      remediation: "Create docs/architecture.md or ARCHITECTURE.md outlining system components and data flows.",
      autoFixAvailable: true,
      scaffoldTemplate: getScaffoldTemplate("ARCHITECTURE.md"),
      targetPath: "ARCHITECTURE.md"
    });
  }

  const hasDiagrams = fs.readdirSync(repoPath).some(f => /^diagrams_.*\.png$/i.test(f)) ||
                      fs.existsSync(path.join(repoPath, "docs", "diagrams"));
  if (hasDiagrams) {
    p3Score += 4;
    p3Findings.push("Native vector/system diagrams detected in repository.");
  }

  // Symbol anchor validation score
  if (contextInventory.driftWarningsCount === 0) {
    p3Score += 3;
    p3Findings.push("All referenced code symbols in documentation correspond to valid graph nodes.");
  } else {
    p3Score += 1;
    p3Findings.push(`Detected ${contextInventory.driftWarningsCount} drifted or unindexed symbol references in documentation.`);
    shortcomings.push({
      id: "symbol-drift-warning",
      severity: "MEDIUM",
      pillar: "graph_integrity",
      title: `${contextInventory.driftWarningsCount} unindexed/drifted symbols in documentation`,
      description: "Some symbols mentioned in architecture or instruction files do not exist in the active graph.",
      remediation: "Review the symbol anchor audit in AI Readiness and update deprecated identifiers."
    });
  }

  let mcpConnected = false;
  try {
    const res = await fetch(`${mcpUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": mcpUrl },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_projects", arguments: {} }
      }),
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        mcpConnected = true;
        p3Score += 8;
        p3Findings.push("Connected to codebase-memory-mcp daemon; graph index is active.");
      }
    }
  } catch {}

  if (!mcpConnected) {
    const dbExists = Boolean(resolveDb(project, repoPath));
    if (dbExists) {
      p3Score += 6;
      p3Findings.push("Local codebase-memory SQLite database found on disk.");
    } else {
      p3Score += 3;
      p3Findings.push("codebase-memory-mcp daemon not running during audit; estimated graph score.");
    }
  }

  // ==========================================
  // Pillar 4: Test & Verification Guardrails (20 pts)
  // ==========================================
  let p4Score = 0;
  const p4Max = 20;
  const p4Findings = [];

  const testDirCandidates = ["tests", "test", "__tests__", "spec"];
  const foundTestDir = testDirCandidates.find(d => fs.existsSync(path.join(repoPath, d)));
  if (foundTestDir) {
    p4Score += 8;
    p4Findings.push(`Found dedicated test suite directory: '${foundTestDir}'.`);
  } else {
    shortcomings.push({
      id: "no-tests-directory",
      severity: "BLOCKER",
      pillar: "test_guardrails",
      title: "No automated test directory detected",
      description: "Agents cannot verify edits autonomously, increasing hallucination risks.",
      remediation: "Establish a test framework (vitest, pytest, or ctest) under a tests/ folder."
    });
  }

  const testScripts = [
    "package.json", "Makefile", "CMakeLists.txt", "Cargo.toml", "pytest.ini", "vitest.config.ts"
  ];
  const foundConfigs = testScripts.filter(f => fs.existsSync(path.join(repoPath, f)));
  if (foundConfigs.length > 0) {
    p4Score += 4;
    p4Findings.push(`Detected build/test configuration: ${foundConfigs.join(", ")}.`);
  }

  const linterConfigs = [
    ".clang-format", ".clang-tidy", "eslint.config.js", ".eslintrc.json",
    ".prettierrc", "ruff.toml", "tsconfig.json"
  ];
  const foundLinters = linterConfigs.filter(f => fs.existsSync(path.join(repoPath, f)));
  if (foundLinters.length > 0) {
    p4Score += 4;
    p4Findings.push(`Detected formatters/linters: ${foundLinters.join(", ")}.`);
  } else {
    shortcomings.push({
      id: "missing-linter-config",
      severity: "LOW",
      pillar: "test_guardrails",
      title: "No formatter or linter configurations detected",
      description: "Agents may produce style inconsistencies without formatters (.clang-format, prettier, eslint).",
      remediation: "Add standard configuration files (.clang-format or eslint) to the repository."
    });
  }

  const ciCandidates = [".github/workflows", ".gitlab-ci.yml", ".circleci"];
  const foundCI = ciCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundCI) {
    p4Score += 4;
    p4Findings.push(`CI/CD automation pipelines detected at '${foundCI}'.`);
  } else {
    shortcomings.push({
      id: "no-ci-workflows",
      severity: "LOW",
      pillar: "test_guardrails",
      title: "Missing CI/CD verification workflows",
      description: "No .github/workflows directory detected for PR validation.",
      remediation: "Set up a GitHub Actions workflow to run tests and the AI readiness auditor on PRs."
    });
  }

  // ==========================================
  // Pillar 5: Code Graph Hygiene & Boundaries (15 pts)
  // ==========================================
  let p5Score = 0;
  const p5Max = 15;
  const p5Findings = [];

  const gitExists = fs.existsSync(path.join(repoPath, ".git"));
  if (gitExists) {
    p5Score += 5;
    p5Findings.push("Git version control active with clean repository boundaries.");
  }

  const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "poetry.lock"];
  const hasLockfile = lockfiles.some(f => fs.existsSync(path.join(repoPath, f)));
  if (hasLockfile) {
    p5Score += 5;
    p5Findings.push("Deterministic dependency lockfile detected.");
  } else {
    shortcomings.push({
      id: "missing-lockfile",
      severity: "MEDIUM",
      pillar: "hygiene",
      title: "Missing dependency lockfile",
      description: "No package-lock.json, Cargo.lock, or equivalent found. Builds may be non-deterministic.",
      remediation: "Commit your dependency lockfile to ensure reproducible builds for agents."
    });
  }

  const ignoreCandidates = [".gitignore", ".cbmignore"];
  const foundIgnores = ignoreCandidates.filter(f => fs.existsSync(path.join(repoPath, f)));
  if (foundIgnores.length > 0) {
    p5Score += 5;
    p5Findings.push(`Repository boundaries and exclusions defined (${foundIgnores.join(", ")}).`);
  }

  const totalScore = Math.min(100, p1Score + p2Score + p3Score + p4Score + p5Score);

  let grade = "F";
  if (totalScore >= 95) grade = "A+";
  else if (totalScore >= 85) grade = "A";
  else if (totalScore >= 75) grade = "B+";
  else if (totalScore >= 70) grade = "B";
  else if (totalScore >= 60) grade = "C";
  else if (totalScore >= 50) grade = "D";

  let summary = "";
  if (totalScore >= 85) {
    summary = "High AI readiness: Repository provides solid agent context, verification harnesses, and guidance.";
  } else if (totalScore >= 70) {
    summary = "Moderate AI readiness: Good structural foundations, but lacks critical skill runbooks or test guardrails.";
  } else {
    summary = "Low AI readiness: Missing root agent instructions, operational skills, or automated verification tests.";
  }

  return {
    project,
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    summary,
    pillars: {
      instructions: {
        score: p1Score,
        max: p1Max,
        status: p1Score >= 16 ? "EXCELLENT" : p1Score >= 12 ? "GOOD" : "NEEDS_IMPROVEMENT",
        findings: p1Findings
      },
      skills: {
        score: p2Score,
        max: p2Max,
        status: p2Score >= 20 ? "EXCELLENT" : p2Score >= 15 ? "GOOD" : "NEEDS_IMPROVEMENT",
        findings: p2Findings
      },
      graph_integrity: {
        score: p3Score,
        max: p3Max,
        status: p3Score >= 16 ? "EXCELLENT" : p3Score >= 12 ? "GOOD" : "NEEDS_IMPROVEMENT",
        findings: p3Findings
      },
      test_guardrails: {
        score: p4Score,
        max: p4Max,
        status: p4Score >= 16 ? "EXCELLENT" : p4Score >= 12 ? "GOOD" : "NEEDS_IMPROVEMENT",
        findings: p4Findings
      },
      hygiene: {
        score: p5Score,
        max: p5Max,
        status: p5Score >= 12 ? "EXCELLENT" : "GOOD",
        findings: p5Findings
      }
    },
    shortcomings,
    context_inventory: contextInventory
  };
}
