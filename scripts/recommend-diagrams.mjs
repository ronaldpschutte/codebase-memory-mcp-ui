#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  recommendDiagramsForProject,
  renderRecommendationsMarkdown,
  ensureRepoDiagramsDir,
  writeRepoDiagramSuite,
  runPostIndexSystemOverview,
  loadRepoDiagramsCatalog
} from "./recommend_engine.mjs";

function parseArgs(argv) {
  const options = {
    project: "",
    repoPath: "",
    postIndex: false,
    limit: 6,
    category: "all",
    minScore: 50,
    format: "markdown",
    generate: false,
    out: null,
    help: false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--project" && i + 1 < argv.length) {
      options.project = argv[++i];
    } else if (arg === "--repo-path" && i + 1 < argv.length) {
      options.repoPath = argv[++i];
    } else if (arg === "--post-index") {
      options.postIndex = true;
    } else if (arg === "--limit" && i + 1 < argv.length) {
      options.limit = parseInt(argv[++i], 10);
    } else if (arg === "--category" && i + 1 < argv.length) {
      options.category = argv[++i];
    } else if (arg === "--min-score" && i + 1 < argv.length) {
      options.minScore = parseInt(argv[++i], 10);
    } else if (arg === "--format" && i + 1 < argv.length) {
      options.format = argv[++i];
    } else if (arg === "--generate") {
      options.generate = true;
    } else if (arg === "--out" && i + 1 < argv.length) {
      options.out = argv[++i];
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node scripts/recommend-diagrams.mjs [options]

Options:
  --project <name>         Target project name (defaults to repository folder name)
  --repo-path <path>       Target repository path (defaults to current working directory)
  --post-index             Run post-indexing hook: ensures diagrams/ dir, generates System Overview
  --limit <num>            Maximum number of recommendations to return (default: 6)
  --category <cat>         Filter by category: 'all', 'structural', 'behavioral', 'quality', 'dataflow'
  --min-score <score>      Minimum utility score threshold (0-100, default: 50)
  --format <format>        Output format: 'markdown', 'json', or 'summary' (default: 'markdown')
  --generate               Generate Mermaid, Spec, and Stylized HTML files into repo diagrams/
  --out <file>             Write output to specified file
  --help, -h               Show this help message
`);
}

export async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const repoPath = options.repoPath ? path.resolve(options.repoPath) : process.cwd();

  // Derive project name if not specified
  let project = options.project;
  if (!project) {
    project = path.basename(repoPath);
  }

  // Handle post-indexing lifecycle hook
  if (options.postIndex) {
    const { diagramsDir, systemOverview } = runPostIndexSystemOverview(repoPath, project);
    console.error(`[recommend-diagrams] Post-index hook executed: verified diagrams dir at ${diagramsDir}`);
    console.error(`[recommend-diagrams] Generated primary System Overview: ${systemOverview.title}`);
    if (!options.generate && options.format !== "json") {
      console.log(`Post-index completed. System Overview generated in ${diagramsDir}`);
      return;
    }
  }

  const result = recommendDiagramsForProject(project, {
    limit: options.limit,
    category: options.category,
    minScore: options.minScore
  });

  // If --generate is requested, write .mermaid, specs/*.json, and stylized .html files into <repo_root>/diagrams/
  if (options.generate && result.recommendations.length > 0) {
    const { diagramsDir } = ensureRepoDiagramsDir(repoPath);

    for (const r of result.recommendations) {
      writeRepoDiagramSuite(repoPath, r, false);
    }
    console.error(`[recommend-diagrams] Generated ${result.recommendations.length} complete diagram suites (.mermaid, .json spec, and stylized .html) in ${diagramsDir}`);
  }

  let outputText = "";
  if (options.format === "json") {
    outputText = JSON.stringify(result, null, 2);
  } else if (options.format === "summary") {
    outputText = `Project: ${result.project} | Evaluated: ${result.total_candidates_evaluated} | Recommended: ${result.recommendations_count}\n` +
      result.recommendations.map(r => `  [Score ${r.utility_score}] ${r.title} (${r.type}) - ${r.priority.toUpperCase()}`).join("\n");
  } else {
    outputText = renderRecommendationsMarkdown(result);
  }

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, outputText, "utf8");
    console.error(`[recommend-diagrams] Wrote output to ${outPath}`);
  } else {
    console.log(outputText);
  }
}

// Run if directly executed
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch((err) => {
    console.error("Error running recommend-diagrams:", err);
    process.exit(1);
  });
}
