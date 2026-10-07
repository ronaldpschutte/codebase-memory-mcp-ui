#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { runRepositoryAnalysisReport, saveReportToFile, renderReportMarkdown } from "./report_runner.mjs";

function parseArgs(argv) {
  const options = {
    project: "",
    repoPath: process.cwd(),
    preset: "comprehensive",
    save: false,
    format: "markdown",
    failUnder: null,
    maxHighRisk: null,
    out: null,
    help: false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--project" && i + 1 < argv.length) {
      options.project = argv[++i];
    } else if (arg === "--repo" && i + 1 < argv.length) {
      options.repoPath = path.resolve(argv[++i]);
    } else if (arg === "--preset" && i + 1 < argv.length) {
      options.preset = argv[++i];
    } else if (arg === "--save") {
      options.save = true;
    } else if (arg === "--format" && i + 1 < argv.length) {
      options.format = argv[++i];
    } else if (arg === "--fail-under" && i + 1 < argv.length) {
      options.failUnder = parseInt(argv[++i], 10);
    } else if (arg === "--max-high-risk" && i + 1 < argv.length) {
      options.maxHighRisk = parseInt(argv[++i], 10);
    } else if (arg === "--out" && i + 1 < argv.length) {
      options.out = argv[++i];
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node scripts/run-repo-report.mjs [options]

Options:
  --project <name>         Target project name (defaults to repository directory name)
  --repo <path>            Path to repository root (defaults to cwd)
  --preset <preset>        Analysis preset: 'quick' or 'comprehensive' (default: 'comprehensive')
  --save                   Save snapshot report to .codebase-memory/reports/
  --format <format>        Output format: 'markdown', 'json', or 'summary' (default: 'markdown')
  --fail-under <score>     Exit with code 1 if overall health score drops below <score> (CI gate)
  --max-high-risk <num>    Exit with code 1 if high-risk items (score >= 80) exceed <num>
  --out <file>             Write report output to specified file
  --help, -h               Show this help message
`);
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // Header progress on stderr so stdout can be piped clean
  console.error(`[Codebase Memory] Running '${options.preset}' analysis for repository...`);

  const report = await runRepositoryAnalysisReport({
    repoPath: options.repoPath,
    project: options.project,
    preset: options.preset,
    onProgress: (evt) => {
      if (evt.status === "running") {
        console.error(`  ⏳ Running ${evt.tool}... (${evt.progress}%)`);
      } else if (evt.status === "done" && evt.tool !== "complete") {
        console.error(`  ✅ Completed ${evt.tool}`);
      }
    }
  });

  console.error(`[Codebase Memory] Analysis finished in ${report.execution_time_ms}ms.`);
  console.error(`  Score: ${report.scores.overall}/100 | Grade: ${report.scores.grade} | Fix-First items: ${report.fix_first.length}`);

  let savedPath = null;
  if (options.save) {
    savedPath = saveReportToFile(report, { repoPath: options.repoPath });
    console.error(`  💾 Saved snapshot to: ${savedPath}`);
  }

  let outputText = "";
  if (options.format === "json") {
    outputText = JSON.stringify(report, null, 2);
  } else if (options.format === "summary") {
    outputText = [
      `Repository Health Report: ${report.project}`,
      `Score: ${report.scores.overall}/100 (${report.scores.grade})`,
      `Test Coverage: ${report.scores.test_coverage}% | Hygiene: ${report.scores.hygiene}/100 | AI Readiness: ${report.scores.ai_readiness}/100`,
      `Top Fix-First item: ${report.fix_first[0]?.symbol || "None"} (Risk: ${report.fix_first[0]?.risk_score || 0})`,
      savedPath ? `Snapshot: ${savedPath}` : ""
    ].filter(Boolean).join("\n");
  } else {
    outputText = renderReportMarkdown(report);
  }

  if (options.out) {
    fs.writeFileSync(path.resolve(options.out), outputText, "utf-8");
    console.error(`  📄 Wrote report to ${options.out}`);
  } else {
    // Write formatted report to stdout
    process.stdout.write(outputText + "\n");
  }

  // CI Quality Gates
  if (options.failUnder !== null && report.scores.overall < options.failUnder) {
    console.error(`❌ CI Gate Failed: Overall score ${report.scores.overall} is below threshold ${options.failUnder}`);
    process.exit(1);
  }

  if (options.maxHighRisk !== null) {
    const highRiskCount = report.fix_first.filter(f => f.risk_score >= 80).length;
    if (highRiskCount > options.maxHighRisk) {
      console.error(`❌ CI Gate Failed: Found ${highRiskCount} high-risk items (max allowed: ${options.maxHighRisk})`);
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error running report:", err);
  process.exit(1);
});
