#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  recommendDiagramsForProject,
  renderRecommendationsMarkdown
} from "./recommend_engine.mjs";

function parseArgs(argv) {
  const options = {
    project: "",
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
  --limit <num>            Maximum number of recommendations to return (default: 6)
  --category <cat>         Filter by category: 'all', 'structural', 'behavioral', 'quality', 'dataflow'
  --min-score <score>      Minimum utility score threshold (0-100, default: 50)
  --format <format>        Output format: 'markdown', 'json', or 'summary' (default: 'markdown')
  --generate               Generate Mermaid files into .codebase-memory/diagrams/<project>/
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

  // Derive project name if not specified
  let project = options.project;
  if (!project) {
    const cwd = process.cwd();
    project = path.basename(cwd);
  }

  const result = recommendDiagramsForProject(project, {
    limit: options.limit,
    category: options.category,
    minScore: options.minScore
  });

  // If --generate is requested, write .mermaid, specs/*.json, and stylized .html files
  if (options.generate && result.recommendations.length > 0) {
    const targetDir = path.join(process.cwd(), ".codebase-memory", "diagrams", project);
    const specsDir = path.join(targetDir, "specs");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(specsDir, { recursive: true });

    for (const r of result.recommendations) {
      if (r.mermaid) {
        fs.writeFileSync(path.join(targetDir, `${r.id}.mermaid`), r.mermaid, "utf8");
      }
      if (r.spec) {
        fs.writeFileSync(path.join(specsDir, `${r.id}.json`), JSON.stringify(r.spec, null, 2), "utf8");
      }
      if (r.stylizedHtml) {
        fs.writeFileSync(path.join(targetDir, `${r.id}.html`), r.stylizedHtml, "utf8");
      }
    }
    console.error(`[recommend-diagrams] Generated ${result.recommendations.length} complete diagram suites (.mermaid, .json spec, and stylized .html) in ${targetDir}`);
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
