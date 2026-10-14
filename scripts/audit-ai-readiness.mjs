#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { runAIReadinessAudit, getScaffoldTemplate } from "./audit_engine.mjs";

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: node scripts/audit-ai-readiness.mjs [options]

Options:
  --json                   Output raw JSON report
  --fail-under <num>       Exit with code 1 if total score is below <num> (for CI)
  --fail-on-symbol-drift   Exit with code 1 if unindexed or drifted symbols exist in docs
  --out <file>             Save report JSON to the specified file
  --context-inventory      Display detailed table of agent context markdown files
  --scaffold <tool>        Auto-scaffold missing skill for a specific detected tool ID
  --scaffold-all           Auto-scaffold all missing detected tool skills
  --scaffold-arch          Auto-scaffold missing system ARCHITECTURE.md
  --scaffold-llms          Auto-scaffold missing docs/llms.txt
  --scaffold-agents        Auto-scaffold missing root AGENTS.md
  --mcp-url <url>          URL of the codebase-memory-mcp daemon (default: http://127.0.0.1:9749)
  --help, -h               Show this help message
`);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const isJson = args.includes("--json");
const failUnderIdx = args.indexOf("--fail-under");
const failUnder = failUnderIdx !== -1 ? parseInt(args[failUnderIdx + 1], 10) : null;
const failOnSymbolDrift = args.includes("--fail-on-symbol-drift");
const outIdx = args.indexOf("--out");
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
const scaffoldIdx = args.indexOf("--scaffold");
const scaffoldToolId = scaffoldIdx !== -1 ? args[scaffoldIdx + 1] : null;
const scaffoldAll = args.includes("--scaffold-all");
const scaffoldArch = args.includes("--scaffold-arch");
const scaffoldLlms = args.includes("--scaffold-llms");
const scaffoldAgents = args.includes("--scaffold-agents");
const showContextInventory = args.includes("--context-inventory");

const mcpUrlIdx = args.indexOf("--mcp-url");
const mcpUrl = mcpUrlIdx !== -1 ? args[mcpUrlIdx + 1] : "http://127.0.0.1:9749";

async function main() {
  const report = await runAIReadinessAudit({
    repoPath: process.cwd(),
    mcpUrl
  });

  // Handle document scaffolding
  if (scaffoldArch) {
    const target = path.join(process.cwd(), "ARCHITECTURE.md");
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, getScaffoldTemplate("ARCHITECTURE.md"), "utf-8");
      console.log(`[Scaffold] Created ARCHITECTURE.md at ${target}`);
    } else {
      console.log(`[Scaffold] ARCHITECTURE.md already exists.`);
    }
  }

  if (scaffoldLlms) {
    const docsDir = path.join(process.cwd(), "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const target = path.join(docsDir, "llms.txt");
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, getScaffoldTemplate("docs/llms.txt"), "utf-8");
      console.log(`[Scaffold] Created docs/llms.txt at ${target}`);
    } else {
      console.log(`[Scaffold] docs/llms.txt already exists.`);
    }
  }

  if (scaffoldAgents) {
    const target = path.join(process.cwd(), "AGENTS.md");
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, getScaffoldTemplate("AGENTS.md"), "utf-8");
      console.log(`[Scaffold] Created AGENTS.md at ${target}`);
    } else {
      console.log(`[Scaffold] AGENTS.md already exists.`);
    }
  }

  // Handle skill auto-scaffold if requested
  if (scaffoldToolId || scaffoldAll) {
    let count = 0;
    for (const sc of report.shortcomings) {
      if (sc.autoFixAvailable && sc.scaffoldTemplate && sc.skillTargetDir) {
        if (scaffoldAll || sc.id === `missing-skill-${scaffoldToolId}`) {
          const dir = path.join(process.cwd(), sc.skillTargetDir);
          fs.mkdirSync(dir, { recursive: true });
          const targetFile = path.join(dir, "SKILL.md");
          fs.writeFileSync(targetFile, sc.scaffoldTemplate, "utf-8");
          console.log(`[Scaffold] Created skill template at ${sc.skillTargetDir}/SKILL.md`);
          count++;
        }
      }
    }
    if (count > 0) {
      console.log(`[Scaffold] Successfully generated ${count} skill runbook(s).\n`);
    } else if (scaffoldToolId) {
      console.log(`[Scaffold] No matching missing skill found for tool '${scaffoldToolId}'.\n`);
    }
  }

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf-8");
    if (!isJson) {
      console.log(`Report saved to ${outFile}`);
    }
  }

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Pretty terminal formatting
    console.log("\n=======================================================");
    console.log(`   AI READINESS AUDIT: ${report.project.toUpperCase()}`);
    console.log("=======================================================");
    console.log(`Overall Score : ${report.score} / 100  (Grade: ${report.grade})`);
    console.log(`Diagnostic    : ${report.summary}\n`);

    console.log("------------------ PILLAR BREAKDOWN -------------------");
    const p = report.pillars;
    console.log(`1. Agent Instructions     : ${p.instructions.score} / ${p.instructions.max} [${p.instructions.status}]`);
    console.log(`2. Tool & Skill Coverage  : ${p.skills.score} / ${p.skills.max} [${p.skills.status}]`);
    console.log(`3. Graph & Index Integrity: ${p.graph_integrity.score} / ${p.graph_integrity.max} [${p.graph_integrity.status}]`);
    console.log(`4. Test Guardrails        : ${p.test_guardrails.score} / ${p.test_guardrails.max} [${p.test_guardrails.status}]`);
    console.log(`5. Hygiene & Boundaries   : ${p.hygiene.score} / ${p.hygiene.max} [${p.hygiene.status}]\n`);

    if (report.context_inventory) {
      const ci = report.context_inventory;
      console.log("--------- AGENT CONTEXT & INSTRUCTION ARCHITECTURE --------");
      console.log(`Active Documents  : ${ci.totalDocumentsFound} file(s)`);
      console.log(`Prompt Token Load : ${ci.primaryTokenFootprint} tokens [${ci.budgetStatus}] (Recommended: < ${ci.maxRecommendedTokens})`);
      console.log(`Symbol Drift Gaps : ${ci.driftWarningsCount} warning(s)`);
      console.log(`Ecosystem Support : Universal: ${ci.ecosystemCoverage.universal ? 'YES' : 'NO'}, Claude: ${ci.ecosystemCoverage.claude ? 'YES' : 'NO'}, Gemini: ${ci.ecosystemCoverage.antigravity ? 'YES' : 'NO'}, Cursor: ${ci.ecosystemCoverage.cursor ? 'YES' : 'NO'}, Copilot: ${ci.ecosystemCoverage.copilot ? 'YES' : 'NO'}`);

      if (showContextInventory || ci.documents.length <= 15) {
        console.log("\nDocument Inventory:");
        for (const doc of ci.documents) {
          const statusTag = doc.status === "PRESENT" ? "[OK]" : doc.status === "STALE" ? "[STALE]" : "[MISSING]";
          console.log(`  * ${statusTag.padEnd(9)} ${doc.path.padEnd(36)} (${doc.category}, ~${doc.tokenCount} tok)`);
        }
      }
      console.log("");
    }

    if (report.shortcomings.length > 0) {
      console.log("------------------- SHORTCOMINGS ----------------------");
      for (const item of report.shortcomings) {
        console.log(`[${item.severity}] ${item.title}`);
        console.log(`  Issue : ${item.description}`);
        console.log(`  Fix   : ${item.remediation}`);
        if (item.autoFixAvailable) {
          if (item.id.startsWith("missing-skill-")) {
            console.log(`  * Quick fix: node scripts/audit-ai-readiness.mjs --scaffold ${item.id.replace("missing-skill-", "")}`);
          } else if (item.id === "missing-architecture-docs") {
            console.log(`  * Quick fix: node scripts/audit-ai-readiness.mjs --scaffold-arch`);
          } else if (item.id === "missing-llms-txt") {
            console.log(`  * Quick fix: node scripts/audit-ai-readiness.mjs --scaffold-llms`);
          } else if (item.id === "no-agent-instructions") {
            console.log(`  * Quick fix: node scripts/audit-ai-readiness.mjs --scaffold-agents`);
          }
        }
        console.log("");
      }
    } else {
      console.log("No shortcomings detected. Repository is fully AI-ready!");
    }
    console.log("=======================================================\n");
  }

  if (failOnSymbolDrift && report.context_inventory?.driftWarningsCount > 0) {
    console.error(`[FAILURE] Detected ${report.context_inventory.driftWarningsCount} drifted or unindexed symbol references in documentation.`);
    process.exit(1);
  }

  if (failUnder !== null && report.score < failUnder) {
    console.error(`[FAILURE] AI Readiness Score (${report.score}) is below required threshold (${failUnder}).`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
