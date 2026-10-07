import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  recommendDiagramsForProject,
  getFallbackRecommendations,
  renderRecommendationsMarkdown,
  resolveProjectDbPath
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
});
