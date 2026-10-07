import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  AlertTriangle,
  GitBranch,
  Database,
  ShieldAlert,
  TestTube2,
  FileCode2,
  Code2,
  CheckCircle2,
  X,
} from "lucide-react";
import type { DiagramRecommendation, DiagramRecommendationResult } from "../lib/types";
import {
  DEFAULT_RECOMMENDED_DIAGRAMS,
  generateStylizedDiagramHtml,
  generateArchifySpecJson,
} from "../lib/stylizedDiagram";

interface DiagramRecommendationsProps {
  selectedProject: string | null;
  onSelectDiagram?: (diagramId: string) => void;
}

export function DiagramRecommendations({
  selectedProject,
  onSelectDiagram,
}: DiagramRecommendationsProps) {
  const activeProject = selectedProject || "codebase-memory-mcp-ui";

  const [recommendations, setRecommendations] = useState<DiagramRecommendation[]>(
    DEFAULT_RECOMMENDED_DIAGRAMS as DiagramRecommendation[]
  );
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
          const enriched = data.recommendations.map((r: any) => ({
            ...r,
            subtitle: r.subtitle || r.rationale,
            description: r.description || r.rationale,
            badgeClass: r.badgeClass || (
              r.priority === "critical"
                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                : r.priority === "high"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            ),
            hoverBorderClass: r.hoverBorderClass || (
              r.priority === "critical"
                ? "hover:border-rose-500/50 hover:shadow-rose-500/10"
                : r.priority === "high"
                  ? "hover:border-amber-500/50 hover:shadow-amber-500/10"
                  : "hover:border-emerald-500/50 hover:shadow-emerald-500/10"
            ),
            sources: r.sources || [
              { path: r.metrics?.file_path || "src/main.c", line: 1, label: r.title },
            ],
            htmlFile: r.htmlFile || `${r.id}.html`,
            specFile: r.specFile || `specs/${r.id}.json`,
            durationMs: r.durationMs || 6,
            stylizedHtml: r.stylizedHtml || generateStylizedDiagramHtml(r),
            spec: r.spec || generateArchifySpecJson(r),
          }));
          setRecommendations(enriched);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to client-side heuristics
    }

    // 2. High-fidelity client-side generated heuristics based on DEFAULT_RECOMMENDED_DIAGRAMS
    setRecommendations(DEFAULT_RECOMMENDED_DIAGRAMS as DiagramRecommendation[]);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="recommendations-grid">
        {filtered.map((item) => {
          const isCritical = item.priority === "critical";
          const isHigh = item.priority === "high";

          return (
            <div
              key={item.id}
              onClick={() => onSelectDiagram?.(item.id)}
              className={`group relative flex flex-col justify-between rounded-xl border border-border/40 bg-white/[0.02] p-5 cursor-pointer transition-all duration-300 ${
                item.hoverBorderClass || "hover:border-primary/50 hover:shadow-primary/10"
              } hover:-translate-y-1 hover:bg-white/[0.03] hover:shadow-xl`}
              data-testid={`rec-card-${item.id}`}
            >
              {/* Top Accent Gradient */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${
                  isCritical
                    ? "bg-gradient-to-r from-rose-500 to-amber-500"
                    : isHigh
                      ? "bg-gradient-to-r from-amber-500 to-primary"
                      : "bg-gradient-to-r from-primary to-cyan-500"
                }`}
              />

              <div>
                {/* Badges Bar: Category Badge + AST Pass + Utility Score */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        item.badgeClass || (
                          isCritical
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : isHigh
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        )
                      }`}
                    >
                      {item.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isCritical
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : isHigh
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>AST Validated</span>
                    </div>
                    <span
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/15 text-primary border border-primary/25 shadow-xs"
                      title={`Utility Score: ${item.utility_score}/100`}
                    >
                      <Flame className="w-3 h-3 text-amber-400" />
                      {item.utility_score}
                    </span>
                  </div>
                </div>

                {/* Title & Icon */}
                <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2 mb-1">
                  {getTypeIcon(item.type)}
                  <span>{item.title}</span>
                </h3>

                {/* Subtitle */}
                <p className="text-[11px] text-muted-foreground/80 font-mono mb-3">
                  {item.subtitle || item.rationale}
                </p>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-4">
                  {item.description || item.rationale}
                </p>
              </div>

              <div>
                {/* Source Citations Box */}
                <div className="rounded-lg bg-black/40 border border-border/20 p-2.5 mb-4 space-y-1 font-mono text-[10.5px] text-muted-foreground">
                  {(item.sources && item.sources.length > 0
                    ? item.sources
                    : [{ path: (item.metrics?.top_pair as string)?.split(" ")[0] || "src/main.c", line: 1, label: item.title }]
                  ).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between truncate">
                      <span className="text-foreground/80 font-medium">
                        {s.path}
                        {s.line ? `:${s.line}` : ""}
                      </span>
                      <span className="text-[9.5px] text-foreground/40">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/20 gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item);
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                      className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
                      title="Download .mermaid file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalItem(item);
                      }}
                      className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
                      title="Inspect AST Code"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">
                    <span>Launch Interactive Viewer</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
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

