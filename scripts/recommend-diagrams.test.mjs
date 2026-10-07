import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  recommendDiagramsForProject,
  getFallbackRecommendations,
  renderRecommendationsMarkdown,
  resolveProjectDbPath,
  runPostIndexSystemOverview,
  writeRepoDiagramSuite,
  loadRepoDiagramsCatalog
} from "./recommend_engine.mjs";

describe("recommend_engine", () => {
  it("generates fallback recommendations when project has no SQLite db", () => {
    const result = recommendDiagramsForProject("non-existent-project-xyz-12345");
    assert.ok(result);
    assert.equal(result.project, "non-existent-project-xyz-12345");
    assert.ok(result.recommendations.length > 0);
    assert.ok(result.recommendations[0].utility_score >= 50);
    assert.ok(result.recommendations[0].title);
    assert.ok(result.recommendations[0].rationale);
  });

  it("filters recommendations by category", () => {
    const result = recommendDiagramsForProject("non-existent-project-xyz-12345", {
      category: "structural"
    });
    assert.ok(result.recommendations.length > 0);
    for (const r of result.recommendations) {
      assert.equal(r.category, "structural");
    }
  });

  it("filters recommendations by minimum score", () => {
    const result = recommendDiagramsForProject("non-existent-project-xyz-12345", {
      minScore: 90
    });
    for (const r of result.recommendations) {
      assert.ok(r.utility_score >= 90);
    }
  });

  it("renders GitHub Flavored Markdown with Mermaid code blocks", () => {
    const mockResult = {
      project: "test-repo",
      total_candidates_evaluated: 12,
      recommendations_count: 2,
      generated_at: new Date().toISOString(),
      recommendations: [
        {
          id: "seq-test-handler",
          title: "Call Sequence: test_handler",
          type: "sequence",
          category: "behavioral",
          utility_score: 95,
          priority: "critical",
          params: { type: "sequence", entry_point: "test_handler" },
          metrics: { fan_out: 10 },
          rationale: "Central entry point",
          mermaid: "sequenceDiagram\n    Agent->>H: call()"
        }
      ]
    };

    const md = renderRecommendationsMarkdown(mockResult);
    assert.ok(md.includes("# 📐 Recommended Diagrams for `test-repo`"));
    assert.ok(md.includes("sequenceDiagram"));
    assert.ok(md.includes("Score: 95"));
    assert.ok(md.includes("🔴 Critical"));
  });

  it("queries real SQLite database when available", () => {
    const result = recommendDiagramsForProject("codebase-memory-mcp-ui", { limit: 5 });
    assert.ok(result);
    assert.equal(result.project, "codebase-memory-mcp-ui");
    assert.ok(result.recommendations.length > 0);
    
    // Validate each recommendation object structure
    for (const r of result.recommendations) {
      assert.ok(r.id);
      assert.ok(r.title);
      assert.ok(r.type);
      assert.ok(typeof r.utility_score === "number");
      assert.ok(["critical", "high", "medium"].includes(r.priority));
      assert.ok(r.params);
      assert.ok(r.rationale);
      assert.ok(r.mermaid);
    }
  });

  it("checks and creates repo diagrams directory and writes triple-artifact suite with catalog", () => {
    const tmpDir = path.join(process.cwd(), ".tmp-test-repo-" + Date.now());
    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // Run post-index System Overview
      const { diagramsDir, systemOverview, catalog } = runPostIndexSystemOverview(tmpDir, "test-tmp-proj");
      assert.ok(fs.existsSync(diagramsDir));
      assert.ok(fs.existsSync(path.join(diagramsDir, "specs")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "architecture.mermaid")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "specs", "architecture.json")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "architecture.html")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "catalog.json")));

      assert.equal(systemOverview.id, "architecture");
      assert.equal(systemOverview.is_system_overview, true);
      assert.ok(catalog.system_overview);
      assert.equal(catalog.generated_diagrams.length, 1);

      // Write another diagram suite
      const mockDiagram = {
        id: "seq-test-flow",
        title: "Test Sequence Flow",
        category: "behavioral",
        type: "sequence",
        utility_score: 91,
        priority: "high",
        mermaid: "sequenceDiagram\n  A->>B: ping()",
        spec: { title: "Test Sequence Flow" },
        stylizedHtml: "<html><body>Test</body></html>",
      };

      const res = writeRepoDiagramSuite(tmpDir, mockDiagram, false);
      assert.ok(fs.existsSync(path.join(diagramsDir, "seq-test-flow.mermaid")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "specs", "seq-test-flow.json")));
      assert.ok(fs.existsSync(path.join(diagramsDir, "seq-test-flow.html")));

      const updatedCatalog = loadRepoDiagramsCatalog(tmpDir);
      assert.equal(updatedCatalog.generated_diagrams.length, 2);
      assert.ok(updatedCatalog.generated_diagrams.some(d => d.id === "seq-test-flow"));
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });
});

