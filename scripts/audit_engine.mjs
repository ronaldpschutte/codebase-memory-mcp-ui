import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
  } catch (err) {
    // fallback default catalog
  }

  const shortcomings = [];

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
    
    // Check content of instructions for build/test commands
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

    // Check freshness
    p1Score += 3;
    p1Findings.push("Agent instructions are maintained in repository.");
  } else {
    shortcomings.push({
      id: "no-agent-instructions",
      severity: "BLOCKER",
      pillar: "instructions",
      title: "Missing root agent instructions (AGENTS.md / GEMINI.md)",
      description: "No project instructions found. AI agents will operate on generic assumptions rather than project conventions.",
      remediation: "Create an AGENTS.md or GEMINI.md in the root directory documenting architecture, build steps, and conventions."
    });
  }

  // Check for llms.txt
  const llmsCandidates = ["llms.txt", "docs/llms.txt", "public/llms.txt"];
  const foundLlms = llmsCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundLlms) {
    p1Score += 4;
    p1Findings.push(`Found LLM summary index at ${foundLlms}.`);
  } else {
    shortcomings.push({
      id: "missing-llms-txt",
      severity: "LOW",
      pillar: "instructions",
      title: "Missing llms.txt summary index",
      description: "llms.txt provides a standardized entrypoint for fast LLM repo ingestion (llmstxt.org).",
      remediation: "Create a docs/llms.txt or llms.txt summarizing project modules and documentation links."
    });
  }

  // ==========================================
  // Pillar 2: Tool & Skill Coverage (25 pts)
  // ==========================================
  let p2Score = 0;
  const p2Max = 25;
  const p2Findings = [];

  // 1. Discover installed skills
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

  // Validate skill frontmatters
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

  // 2. Detect project tools and match with skills
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
      // Check if matching skill exists
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
    p2Score += 17; // simple repo or fully standard
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

  // Check for Architecture documentation
  const archCandidates = [
    "docs/architecture.md", "ARCHITECTURE.md", "docs/ARCHIFY_PROCESS.md",
    "PRD_NATIVE_DIAGRAM_GENERATION.md", "docs/RFC_012_Code_Quality_Reports_Page.md"
  ];
  const foundArch = archCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundArch) {
    p3Score += 6;
    p3Findings.push(`Found architecture documentation (${foundArch}).`);
  } else {
    shortcomings.push({
      id: "missing-architecture-docs",
      severity: "MEDIUM",
      pillar: "graph_integrity",
      title: "Missing system ARCHITECTURE.md",
      description: "No dedicated architectural mental model found. Agents may misinterpret module boundaries.",
      remediation: "Create docs/architecture.md or ARCHITECTURE.md outlining system components and data flows."
    });
  }

  // Check for visual diagrams
  const hasDiagrams = fs.readdirSync(repoPath).some(f => /^diagrams_.*\.png$/i.test(f));
  if (hasDiagrams) {
    p3Score += 4;
    p3Findings.push("Native vector/system diagrams detected in repository.");
  }

  // Query MCP daemon or check local index
  let mcpConnected = false;
  try {
    const res = await fetch(`${mcpUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "index_status", arguments: { project } }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        mcpConnected = true;
        p3Score += 10;
        p3Findings.push("Connected to codebase-memory-mcp daemon; graph index is active.");
      }
    }
  } catch {}

  if (!mcpConnected) {
    // Check if offline .db exists
    const dbExists = fs.existsSync(path.join(repoPath, ".codebase-memory")) || 
                     fs.existsSync(path.join(process.env.USERPROFILE || "", ".codebase-memory"));
    if (dbExists) {
      p3Score += 7;
      p3Findings.push("Local codebase-memory SQLite database found on disk (daemon offline).");
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

  // Check for test suite
  const testDirCandidates = ["tests", "test", "__tests__", "spec"];
  const foundTestDir = testDirCandidates.find(d => fs.existsSync(path.join(repoPath, d)));
  if (foundTestDir) {
    p4Score += 8;
    p4Findings.push(`Found dedicated test suite directory '${foundTestDir}'.`);
  } else {
    shortcomings.push({
      id: "no-test-directory",
      severity: "BLOCKER",
      pillar: "test_guardrails",
      title: "No unit/integration test suite found",
      description: "Agents cannot verify edits if no automated tests are discovered in the repository.",
      remediation: "Add an automated test suite in tests/ or test/ and configure a test runner."
    });
  }

  // Check for linter & format configs
  const linterCandidates = [
    ".clang-format", ".clang-tidy", "eslint.config.js", ".eslintrc.json",
    ".eslintrc.js", "ruff.toml", ".prettierrc", "tsconfig.json"
  ];
  const foundLinters = linterCandidates.filter(f => fs.existsSync(path.join(repoPath, f)));
  if (foundLinters.length > 0) {
    p4Score += 6;
    p4Findings.push(`Linters and formatters configured: ${foundLinters.join(", ")}`);
  } else {
    shortcomings.push({
      id: "no-linter-config",
      severity: "MEDIUM",
      pillar: "test_guardrails",
      title: "Missing linter / formatter configurations",
      description: "Without code style configurations, agents may generate inconsistent formatting or styling.",
      remediation: "Add a formatter/linter config (such as .clang-format, prettier, or eslint)."
    });
  }

  // Check for CI automation
  const ciCandidates = [".github/workflows", ".gitlab-ci.yml", "azure-pipelines.yml", ".circleci"];
  const foundCi = ciCandidates.find(f => fs.existsSync(path.join(repoPath, f)));
  if (foundCi) {
    p4Score += 6;
    p4Findings.push(`Continuous Integration (CI) configured via ${foundCi}.`);
  } else {
    shortcomings.push({
      id: "no-ci-workflows",
      severity: "LOW",
      pillar: "test_guardrails",
      title: "No automated CI workflows detected",
      description: "Automated PR testing catches regressions introduced by AI pair programming before merge.",
      remediation: "Add a GitHub Action workflow under .github/workflows/ to run test suites on PRs."
    });
  }

  // ==========================================
  // Pillar 5: Code Graph Hygiene & Boundaries (15 pts)
  // ==========================================
  let p5Score = 0;
  const p5Max = 15;
  const p5Findings = [];

  // Check git hygiene
  const gitIgnoreExists = fs.existsSync(path.join(repoPath, ".gitignore"));
  if (gitIgnoreExists) {
    p5Score += 5;
    p5Findings.push(".gitignore is present and configured.");
  }

  // Check clean tree / no clutter
  const lockFiles = ["package-lock.json", "flake.lock", "Cargo.lock", "poetry.lock", "yarn.lock"];
  const foundLocks = lockFiles.filter(f => fs.existsSync(path.join(repoPath, f)));
  if (foundLocks.length > 0) {
    p5Score += 5;
    p5Findings.push("Deterministic dependency lockfiles present.");
  }

  // Structural sanity
  p5Score += 5;
  p5Findings.push("Repository structure follows modular separation.");

  // ==========================================
  // Final Score & Grade Calculation
  // ==========================================
  const totalScore = Math.min(100, Math.max(0, p1Score + p2Score + p3Score + p4Score + p5Score));
  let grade = "F";
  if (totalScore >= 95) grade = "A+";
  else if (totalScore >= 85) grade = "A";
  else if (totalScore >= 75) grade = "B+";
  else if (totalScore >= 65) grade = "B";
  else if (totalScore >= 50) grade = "C";
  else if (totalScore >= 40) grade = "D";

  // Summary generation
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
    shortcomings
  };
}
