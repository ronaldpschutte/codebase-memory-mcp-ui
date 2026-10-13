#!/usr/bin/env node

/**
 * ensure-docs-layout.mjs — RFC 017 Standardized Documentation & Artifact Directory Layout
 *
 * Checks target repository for:
 * 1. docs/
 * 2. docs/diagrams/ (and docs/diagrams/specs/)
 * 3. docs/reports/
 * 4. docs/adr/
 *
 * Automatically creates any missing directories, seeds initial catalog if needed,
 * and seamlessly migrates legacy artifacts from <repo_root>/diagrams/,
 * <repo_root>/.codebase-memory/reports/, and <repo_root>/.codebase-memory/adr.md.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Recursively copies directory contents if target file does not already exist.
 */
function copyMissingFilesRecursive(srcDir, destDir) {
  let copiedCount = 0;
  if (!fs.existsSync(srcDir)) return copiedCount;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copiedCount += copyMissingFilesRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (!fs.existsSync(destPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
        } catch {
          // ignore copy errors on locked files
        }
      }
    }
  }
  return copiedCount;
}

/**
 * Ensures the RFC 017 docs directory layout exists in the given repository.
 *
 * @param {string} [repoPath] Target repository root path. Defaults to cwd.
 * @param {object} [options]
 * @param {boolean} [options.migrate=true] Whether to migrate legacy files from diagrams/ and .codebase-memory/
 * @param {boolean} [options.seedCatalog=true] Whether to initialize an empty catalog.json if none exists
 * @returns {object} Layout inspection and creation report
 */
export function ensureDocsLayout(repoPath, options = {}) {
  const root = repoPath ? path.resolve(repoPath) : process.cwd();
  const migrate = options.migrate !== false;
  const seedCatalog = options.seedCatalog !== false;

  const docsDir = path.join(root, "docs");
  const diagramsDir = path.join(docsDir, "diagrams");
  const specsDir = path.join(diagramsDir, "specs");
  const reportsDir = path.join(docsDir, "reports");
  const adrDir = path.join(docsDir, "adr");

  const created = {
    docs: false,
    diagrams: false,
    specs: false,
    reports: false,
    adr: false,
  };

  // 1. Check & create docs/
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    created.docs = true;
  }

  // 2. Check & create docs/diagrams/ and docs/diagrams/specs/
  if (!fs.existsSync(diagramsDir)) {
    fs.mkdirSync(diagramsDir, { recursive: true });
    created.diagrams = true;
  }
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
    created.specs = true;
  }

  // 3. Check & create docs/reports/
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    created.reports = true;
  }

  // 4. Check & create docs/adr/
  if (!fs.existsSync(adrDir)) {
    fs.mkdirSync(adrDir, { recursive: true });
    created.adr = true;
  }

  const migrated = {
    diagrams: 0,
    reports: 0,
    adr: false,
  };

  // 5. Migrate legacy locations if present
  if (migrate) {
    // Legacy diagrams (<repo_root>/diagrams -> <repo_root>/docs/diagrams)
    const legacyDiagramsDir = path.join(root, "diagrams");
    if (fs.existsSync(legacyDiagramsDir) && legacyDiagramsDir !== diagramsDir) {
      migrated.diagrams = copyMissingFilesRecursive(legacyDiagramsDir, diagramsDir);
    }

    // Legacy reports (<repo_root>/.codebase-memory/reports -> <repo_root>/docs/reports)
    const legacyReportsDir = path.join(root, ".codebase-memory", "reports");
    if (fs.existsSync(legacyReportsDir) && legacyReportsDir !== reportsDir) {
      migrated.reports = copyMissingFilesRecursive(legacyReportsDir, reportsDir);
    }

    // Legacy ADR (<repo_root>/.codebase-memory/adr.md -> <repo_root>/docs/adr/adr.md)
    const legacyAdrFile = path.join(root, ".codebase-memory", "adr.md");
    const targetAdrFile = path.join(adrDir, "adr.md");
    if (fs.existsSync(legacyAdrFile) && !fs.existsSync(targetAdrFile)) {
      try {
        fs.copyFileSync(legacyAdrFile, targetAdrFile);
        migrated.adr = true;
      } catch {
        // ignore copy errors
      }
    }
  }

  // 6. Seed catalog.json in docs/diagrams if not present
  const catalogPath = path.join(diagramsDir, "catalog.json");
  if (seedCatalog && !fs.existsSync(catalogPath)) {
    const initialCatalog = {
      schema_version: 1,
      repo_path: root,
      updated_at: new Date().toISOString(),
      system_overview: null,
      generated_diagrams: [],
    };
    try {
      fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2), "utf8");
    } catch {
      // ignore write errors
    }
  }

  return {
    root,
    docsDir,
    diagramsDir,
    specsDir,
    reportsDir,
    adrDir,
    created,
    migrated,
  };
}

// CLI entrypoint
function runCli() {
  const argv = process.argv.slice(2);
  let repoPath = process.cwd();
  let migrate = true;
  let jsonOutput = false;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo-path" && i + 1 < argv.length) {
      repoPath = argv[++i];
    } else if (arg === "--no-migrate") {
      migrate = false;
    } else if (arg === "--migrate") {
      migrate = true;
    } else if (arg === "--json") {
      jsonOutput = true;
    } else if (arg === "--quiet" || arg === "-q") {
      quiet = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/ensure-docs-layout.mjs [options]

Options:
  --repo-path <path>    Target repository root (default: cwd)
  --migrate             Migrate legacy artifacts from diagrams/ & .codebase-memory/ (default: true)
  --no-migrate          Do not copy legacy artifacts
  --json                Output results as JSON
  --quiet, -q           Suppress log output
  --help, -h            Show this help
`);
      process.exit(0);
    }
  }

  const result = ensureDocsLayout(repoPath, { migrate });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!quiet) {
    console.log(`[Codebase Memory] RFC 017 Docs Layout Verification:`);
    console.log(`  Root:     ${result.root}`);
    console.log(`  Docs:     ${result.docsDir} (${result.created.docs ? "created" : "exists"})`);
    console.log(`  Diagrams: ${result.diagramsDir} (${result.created.diagrams ? "created" : "exists"})`);
    console.log(`  Reports:  ${result.reportsDir} (${result.created.reports ? "created" : "exists"})`);
    console.log(`  ADR:      ${result.adrDir} (${result.created.adr ? "created" : "exists"})`);
    if (migrate && (result.migrated.diagrams > 0 || result.migrated.reports > 0 || result.migrated.adr)) {
      console.log(`  Migrated: ${result.migrated.diagrams} diagram(s), ${result.migrated.reports} report(s), ADR: ${result.migrated.adr ? "yes" : "no"}`);
    }
  }
}

const isMainModule = process.argv[1] && (
  process.argv[1] === import.meta.filename ||
  process.argv[1].endsWith("ensure-docs-layout.mjs")
);

if (isMainModule) {
  runCli();
}
