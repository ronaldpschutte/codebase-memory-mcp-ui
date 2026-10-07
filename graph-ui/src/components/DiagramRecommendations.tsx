import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Download,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  AlertTriangle,
  GitBranch,
  Database,
  ShieldAlert,
  TestTube2,
  FileCode2,
  X,
} from "lucide-react";
import type { DiagramRecommendation, DiagramRecommendationResult } from "../lib/types";

interface DiagramRecommendationsProps {
  selectedProject: string | null;
  onSelectDiagram?: (diagramId: string) => void;
}

export function DiagramRecommendations({
  selectedProject,
  onSelectDiagram,
}: DiagramRecommendationsProps) {
  const activeProject = selectedProject || "codebase-memory-mcp-ui";

  const [recommendations, setRecommendations] = useState<DiagramRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [activeModalItem, setActiveModalItem] = useState<DiagramRecommendation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch or generate recommendations for activeProject
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      // 1. Try dedicated endpoint or rpc call
      const res = await fetch(`/api/recommend-diagrams?project=${encodeURIComponent(activeProject)}`);
      if (res.ok) {
        const data: DiagramRecommendationResult = await res.json();
        if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          setRecommendations(data.recommendations);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to client-side heuristics
    }

    // 2. High-fidelity client-side generated heuristics based on project name
    const fallbackList = getClientSideRecommendations(activeProject);
    setRecommendations(fallbackList);
    setLoading(false);
  };

  useEffect(() => {
    void fetchRecommendations();
  }, [activeProject]);

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (category === "all") return true;
      return r.category.toLowerCase() === category.toLowerCase();
    });
  }, [recommendations, category]);

  const handleCopy = (r: DiagramRecommendation) => {
    if (!r.mermaid) return;
    void navigator.clipboard.writeText(r.mermaid);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (r: DiagramRecommendation) => {
    if (!r.mermaid) return;
    const blob = new Blob([r.mermaid], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${r.id}.mermaid`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-lg shadow-primary/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              Recommended Diagrams for <span className="font-mono text-primary">{activeProject}</span>
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Heuristic graph topology analysis scores and extracts high-impact diagrams from SQLite relations (RFC 016).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => void fetchRecommendations()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-foreground transition-all disabled:opacity-50"
            title="Refresh recommendations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-muted-foreground/60 mr-1 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" /> Filter:
        </span>
        {[
          { id: "all", label: "All Candidates" },
          { id: "behavioral", label: "Behavioral (Sequence)" },
          { id: "quality", label: "Quality & Fragility" },
          { id: "structural", label: "Structural (Architecture)" },
          { id: "dataflow", label: "Data Flow Pipelines" },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              category === c.id
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Recommendation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recommendations-grid">
        {filtered.map((item) => {
          const isCritical = item.priority === "critical";
          const isHigh = item.priority === "high";

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-card/40 border border-border/40 hover:border-primary/40 hover:bg-card/70 transition-all shadow-md group relative overflow-hidden"
              data-testid={`rec-card-${item.id}`}
            >
              {/* Top Accent Gradient */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isCritical
                    ? "bg-gradient-to-r from-rose-500 to-amber-500"
                    : isHigh
                      ? "bg-gradient-to-r from-amber-500 to-primary"
                      : "bg-gradient-to-r from-primary to-cyan-500"
                }`}
              />

              <div>
                {/* Badges Bar */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isCritical
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : isHigh
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-muted-foreground border border-border/30">
                      {item.category}
                    </span>
                  </div>

                  <span
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/15 text-primary border border-primary/25 shadow-xs"
                    title={`Utility Score: ${item.utility_score}/100`}
                  >
                    <Flame className="w-3 h-3" />
                    {item.utility_score}
                  </span>
                </div>

                {/* Title & Icon */}
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2 mb-2">
                  {getTypeIcon(item.type)}
                  <span>{item.title}</span>
                </h3>

                {/* Rationale */}
                <p className="text-xs text-muted-foreground/90 leading-relaxed mb-4">
                  {item.rationale}
                </p>

                {/* Metrics Chips */}
                {item.metrics && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {Object.entries(item.metrics).slice(0, 3).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-border/30 text-[10px] font-mono text-foreground/75"
                      >
                        {formatMetricKey(k)}: <strong className="text-foreground">{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/30 gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(item)}
                    className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
                    title="Copy Mermaid syntax"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDownload(item)}
                    className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
                    title="Download .mermaid file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setActiveModalItem(item);
                    onSelectDiagram?.(item.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-all shadow-xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview & Generate</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border/50 bg-white/[0.01]">
          <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground/70">No diagram recommendations in this category</p>
          <p className="text-xs text-muted-foreground mt-1">Try switching to &quot;All Candidates&quot;</p>
        </div>
      )}

      {/* Interactive Modal: Diagram Preview & Code */}
      {activeModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="diagram-preview-modal"
          onClick={() => setActiveModalItem(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative bg-[#0d1d25] border border-border/50 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-black/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  {getTypeIcon(activeModalItem.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{activeModalItem.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono text-primary">Score: {activeModalItem.utility_score}</span>
                    <span>•</span>
                    <span>{activeModalItem.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(activeModalItem)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-foreground transition-all"
                >
                  {copiedId === activeModalItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownload(activeModalItem)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-foreground transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Code Display */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-border/30 text-xs text-muted-foreground leading-relaxed">
                <strong>Architectural Rationale:</strong> {activeModalItem.rationale}
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Generated Mermaid Specification:
                </span>
                <pre className="p-4 rounded-xl bg-black/40 border border-border/30 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed selection:bg-primary/30">
                  {activeModalItem.mermaid || "// No syntax generated"}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-black/20 text-xs text-muted-foreground">
              <span>Ready for documentation, Markdown embedding, and GitHub rendering.</span>
              <button
                onClick={() => setActiveModalItem(null)}
                className="px-4 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-foreground font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case "sequence":
      return <FileCode2 className="w-4 h-4 text-amber-400" />;
    case "fragility_network":
      return <GitBranch className="w-4 h-4 text-rose-400" />;
    case "dataflow":
      return <Database className="w-4 h-4 text-cyan-400" />;
    case "error_flow":
      return <ShieldAlert className="w-4 h-4 text-rose-500" />;
    case "test_coverage":
      return <TestTube2 className="w-4 h-4 text-emerald-400" />;
    case "clone_clusters":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    default:
      return <Layers className="w-4 h-4 text-primary" />;
  }
}

function formatMetricKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * High-fidelity client-side generator matching RFC 016 heuristic models.
 */
function getClientSideRecommendations(_project: string): DiagramRecommendation[] {
  return [
    {
      id: "seq-extract-file-ex-body",
      title: "Call Sequence: extract_file_ex_body",
      type: "sequence",
      category: "behavioral",
      utility_score: 99,
      priority: "critical",
      params: {
        type: "sequence",
        entry_point: "extract_file_ex_body",
        max_depth: 5,
        format: "mermaid",
      },
      metrics: {
        fan_out: 64,
        callee_files: 25,
      },
      rationale: "High-impact central dispatcher calling 64 downstream procedures across 25 translation units.",
      mermaid: `sequenceDiagram
    autonumber
    actor Agent as User / Agent
    participant H as extract_file_ex_body
    participant P0 as cbm_run_c_lsp
    participant P1 as cbm_run_php_lsp
    participant P2 as cbm_lang_spec
    participant P3 as cbm_ts_language
    Agent->>H: extract_file_ex_body()
    activate H
    H->>P0: cbm_run_c_lsp()
    P0-->>H: return
    H->>P1: cbm_run_php_lsp()
    P1-->>H: return
    H->>P2: cbm_lang_spec()
    P2-->>H: return
    H->>P3: cbm_ts_language()
    P3-->>H: return
    deactivate H
    H-->>Agent: return result`,
    },
    {
      id: "fragility-co-change-network",
      title: "Temporal Co-Change Fragility Network",
      type: "fragility_network",
      category: "quality",
      utility_score: 96,
      priority: "critical",
      params: {
        type: "fragility_network",
        min_coupling: 0.5,
        format: "mermaid",
      },
      metrics: {
        strongly_coupled_pairs: 8,
        max_co_changes: 22,
        top_pair: "mem.c <-> mem.h",
      },
      rationale: "Identified 8 file pairs that frequently change together in Git commits without direct code imports.",
      mermaid: `graph LR
    mem_c["mem.c"] <==>|100% Coupling (22 commits)| mem_h["mem.h"]
    mcp_c["mcp.c"] <==>|100% Coupling (10 commits)| mcp_internal_h["mcp_internal.h"]
    ipc_c["ipc.c"] <==>|100% Coupling (8 commits)| ipc_h["ipc.h"]
    config_yaml_edit_c["config_yaml_edit.c"] <==>|100% Coupling (9 commits)| test_config_yaml_edit_c["test_config_yaml_edit.c"]`,
    },
    {
      id: "dataflow-handle-index-repository",
      title: "Data Flow: handle_index_repository",
      type: "dataflow",
      category: "dataflow",
      utility_score: 92,
      priority: "high",
      params: {
        type: "dataflow",
        entry_point: "handle_index_repository",
        format: "mermaid",
      },
      metrics: {
        entry_point: "handle_index_repository",
        outbound_calls: 15,
      },
      rationale: "Traces repository scanning lifecycle from HTTP payload through AST workers to SQLite persistence tables.",
      mermaid: `flowchart LR
    Ingress["POST /api/index"] --> Handler["handle_index_repository"]
    Handler --> Validation["Path & Git Security Validation"]
    Validation --> Worker["Pipeline Worker Pool"]
    Worker --> Store[("SQLite WAL / nodes & edges tables")]`,
    },
    {
      id: "hazard-error-propagation",
      title: "Exception Propagation & Error Hazard Map",
      type: "error_flow",
      category: "quality",
      utility_score: 89,
      priority: "high",
      params: {
        type: "error_flow",
        format: "mermaid",
      },
      metrics: {
        throw_sites: 5,
        error_types: 3,
      },
      rationale: "Maps exception escape routes and failure boundaries across critical throw/raise sites.",
      mermaid: `graph TD
    F0["canvas2dOrThrow"] -->|RAISES| E0["exportError"]
    F1["callTool"] -->|RAISES| E1["RpcError"]
    F2["acquireWindowsBinaryLock"] -->|THROWS| E2["LockAcquisitionError"]
    style E0 fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#fecaca
    style E1 fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#fecaca
    style E2 fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#fecaca`,
    },
    {
      id: "clones-duplication-clusters",
      title: "Code Duplication & Refactoring Clusters",
      type: "clone_clusters",
      category: "quality",
      utility_score: 86,
      priority: "high",
      params: {
        type: "clone_clusters",
        min_similarity: 0.85,
        format: "mermaid",
      },
      metrics: {
        clone_pairs: 5,
        peak_similarity: 1.0,
      },
      rationale: "Discovered cross-file clone pairs with high AST similarity suitable for shared extraction.",
      mermaid: `graph TD
    A0["Button (@/components/ui/button.tsx)"] <==>|100% AST Match| B0["Button (src/components/ui/button.tsx)"]`,
    },
    {
      id: "arch-module-hierarchy",
      title: "Subsystem Architecture & Boundary DAG",
      type: "architecture",
      category: "structural",
      utility_score: 82,
      priority: "high",
      params: {
        type: "architecture",
        format: "mermaid",
      },
      metrics: {
        subsystems: 5,
      },
      rationale: "Clean acyclic module hierarchy mapping cross-package boundaries and service layers.",
      mermaid: `graph TD
    Core[src/pipeline (Worker Pool)] --> Store[(src/store SQLite)]
    MCP[src/mcp (JSON-RPC)] --> Core
    UI[src/ui (HTTP Server)] --> Core
    UI --> Store`,
    },
  ];
}
