import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ensureDocsLayout } from "./ensure-docs-layout.mjs";

describe("ensure-docs-layout (RFC 017)", () => {
  it("creates docs/, docs/diagrams/, docs/reports/, and docs/adr/ in empty repository", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-rfc017-test-"));
    try {
      const res = ensureDocsLayout(tmpDir);

      assert.equal(res.root, path.resolve(tmpDir));
      assert.equal(res.created.docs, true);
      assert.equal(res.created.diagrams, true);
      assert.equal(res.created.reports, true);
      assert.equal(res.created.adr, true);

      assert.ok(fs.existsSync(path.join(tmpDir, "docs")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "diagrams")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "diagrams", "specs")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "reports")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "adr")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "diagrams", "catalog.json")));

      // Verify catalog.json content
      const catalog = JSON.parse(fs.readFileSync(path.join(tmpDir, "docs", "diagrams", "catalog.json"), "utf8"));
      assert.equal(catalog.schema_version, 1);
      assert.deepEqual(catalog.generated_diagrams, []);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("is idempotent when run repeatedly on existing directory structure", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-rfc017-test-"));
    try {
      const firstRun = ensureDocsLayout(tmpDir);
      assert.equal(firstRun.created.docs, true);

      // Second run
      const secondRun = ensureDocsLayout(tmpDir);
      assert.equal(secondRun.created.docs, false);
      assert.equal(secondRun.created.diagrams, false);
      assert.equal(secondRun.created.reports, false);
      assert.equal(secondRun.created.adr, false);
      assert.equal(secondRun.migrated.diagrams, 0);
      assert.equal(secondRun.migrated.reports, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("migrates legacy diagrams, reports, and adr files cleanly into docs/", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-rfc017-test-"));
    try {
      // Create legacy structure
      const legacyDiagrams = path.join(tmpDir, "diagrams");
      const legacyReports = path.join(tmpDir, ".codebase-memory", "reports");
      const legacyCbm = path.join(tmpDir, ".codebase-memory");

      fs.mkdirSync(legacyDiagrams, { recursive: true });
      fs.mkdirSync(legacyReports, { recursive: true });

      fs.writeFileSync(path.join(legacyDiagrams, "arch.mermaid"), "graph TD; A-->B;", "utf8");
      fs.writeFileSync(path.join(legacyReports, "report-1.json"), JSON.stringify({ score: 95 }), "utf8");
      fs.writeFileSync(path.join(legacyCbm, "adr.md"), "## Architecture Decision", "utf8");

      const res = ensureDocsLayout(tmpDir, { migrate: true });

      assert.ok(res.migrated.diagrams >= 1);
      assert.ok(res.migrated.reports >= 1);
      assert.equal(res.migrated.adr, true);

      // Verify files copied to docs/
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "diagrams", "arch.mermaid")));
      assert.equal(fs.readFileSync(path.join(tmpDir, "docs", "diagrams", "arch.mermaid"), "utf8"), "graph TD; A-->B;");

      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "reports", "report-1.json")));
      assert.ok(fs.existsSync(path.join(tmpDir, "docs", "adr", "adr.md")));
      assert.equal(fs.readFileSync(path.join(tmpDir, "docs", "adr", "adr.md"), "utf8"), "## Architecture Decision");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("respects migrate: false option", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-rfc017-test-"));
    try {
      const legacyDiagrams = path.join(tmpDir, "diagrams");
      fs.mkdirSync(legacyDiagrams, { recursive: true });
      fs.writeFileSync(path.join(legacyDiagrams, "skip.mermaid"), "graph LR; X-->Y;", "utf8");

      const res = ensureDocsLayout(tmpDir, { migrate: false });
      assert.equal(res.migrated.diagrams, 0);
      assert.equal(fs.existsSync(path.join(tmpDir, "docs", "diagrams", "skip.mermaid")), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
