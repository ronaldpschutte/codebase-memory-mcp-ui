#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { runAIReadinessAudit } from "./audit_engine.mjs";

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: node scripts/audit-ai-readiness.mjs [options]

Options:
  --json              Output raw JSON report
  --fail-under <num>  Exit with code 1 if total score is below <num> (for CI)
  --out <file>        Save report JSON to the specified file
  --scaffold <tool>   Auto-scaffold missing skill for a specific detected tool ID
  --scaffold-all      Auto-scaffold all missing detected tool skills
  --mcp-url <url>     URL of the codebase-memory-mcp daemon (default: http://127.0.0.1:9749)
  --help, -h          Show this help message
`);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const isJson = args.includes("--json");
const failUnderIdx = args.indexOf("--fail-under");
const failUnder = failUnderIdx !== -1 ? parseInt(args[failUnderIdx + 1], 10) : null;
const outIdx = args.indexOf("--out");
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
const scaffoldIdx = args.indexOf("--scaffold");
const scaffoldToolId = scaffoldIdx !== -1 ? args[scaffoldIdx + 1] : null;
const scaffoldAll = args.includes("--scaffold-all");

const mcpUrlIdx = args.indexOf("--mcp-url");
const mcpUrl = mcpUrlIdx !== -1 ? args[mcpUrlIdx + 1] : "http://127.0.0.1:9749";

async function main() {
  const report = await runAIReadinessAudit({
    repoPath: process.cwd(),
    mcpUrl
  });

  // Handle auto-scaffold if requested
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

    if (report.shortcomings.length > 0) {
      console.log("------------------- SHORTCOMINGS ----------------------");
      for (const item of report.shortcomings) {
        console.log(`[${item.severity}] ${item.title}`);
        console.log(`  Issue : ${item.description}`);
        console.log(`  Fix   : ${item.remediation}`);
        if (item.autoFixAvailable) {
          console.log(`  * Quick fix: node scripts/audit-ai-readiness.mjs --scaffold ${item.id.replace("missing-skill-", "")}`);
        }
        console.log("");
      }
    } else {
      console.log("No shortcomings detected. Repository is fully AI-ready!");
    }
    console.log("=======================================================\n");
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
