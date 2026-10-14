import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldCheck,
  AlertTriangle,
  FileCode2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Search,
  FileText,
  Compass,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Cpu,
} from "lucide-react";
import type {
  AIReadinessReport,
  Shortcoming,
  AgentContextDocument,
  AgentContextInventory,
} from "../lib/types";
import { MermaidViewer } from "./MermaidViewer";

interface ReadinessTabProps {
  selectedProject: string | null;
}

type CategoryFilter =
  | "ALL"
  | "PRIMARY"
  | "ARCHITECTURE"
  | "SKILLS"
  | "LLM_INDEX"
  | "STANDARDS"
  | "MISSING";

export function ReadinessTab({ selectedProject }: ReadinessTabProps) {
  const [report, setReport] = useState<AIReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeModalShortcoming, setActiveModalShortcoming] = useState<Shortcoming | null>(null);
  const [activePreviewDoc, setActivePreviewDoc] = useState<AgentContextDocument | null>(null);
  const [previewTab, setPreviewTab] = useState<"content" | "symbols" | "diagnostics">("content");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-readiness?project=${encodeURIComponent(selectedProject || "")}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        setReport(getDefaultReport(selectedProject || "codebase-memory-mcp-ui"));
      }
    } catch {
      setReport(getDefaultReport(selectedProject || "codebase-memory-mcp-ui"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAudit();
  }, [selectedProject]);

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const gradeColor = useMemo(() => {
    if (!report) return "#38bdf8";
    if (report.score >= 90) return "#34d399";
    if (report.score >= 75) return "#38bdf8";
    if (report.score >= 60) return "#fbbf24";
    return "#f87171";
  }, [report?.score]);

  const inventory: AgentContextInventory = useMemo(() => {
    if (report?.context_inventory) {
      return report.context_inventory;
    }
    return getDefaultReport(selectedProject || "codebase-memory-mcp-ui").context_inventory!;
  }, [report, selectedProject]);

  const filteredDocuments = useMemo(() => {
    return inventory.documents.filter((doc) => {
      // Category filter
      if (categoryFilter === "PRIMARY" && doc.category !== "primary_instruction") return false;
      if (categoryFilter === "ARCHITECTURE" && doc.category !== "architecture") return false;
      if (categoryFilter === "SKILLS" && doc.category !== "skill_runbook") return false;
      if (categoryFilter === "LLM_INDEX" && doc.category !== "llm_index") return false;
      if (categoryFilter === "STANDARDS" && doc.category !== "project_standard") return false;
      if (categoryFilter === "MISSING" && doc.status !== "MISSING") return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPath = doc.path.toLowerCase().includes(q);
        const matchName = doc.name.toLowerCase().includes(q);
        const matchCategory = doc.category.toLowerCase().includes(q);
        const matchAgent = doc.targetAgents.some((a) => a.toLowerCase().includes(q));
        if (!matchPath && !matchName && !matchCategory && !matchAgent) return false;
      }
      return true;
    });
  }, [inventory.documents, categoryFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const docs = inventory.documents;
    return {
      all: docs.length,
      primary: docs.filter((d) => d.category === "primary_instruction").length,
      architecture: docs.filter((d) => d.category === "architecture").length,
      skills: docs.filter((d) => d.category === "skill_runbook").length,
      llm_index: docs.filter((d) => d.category === "llm_index").length,
      standards: docs.filter((d) => d.category === "project_standard").length,
      missing: docs.filter((d) => d.status === "MISSING").length,
    };
  }, [inventory.documents]);

  const budgetColor = useMemo(() => {
    if (inventory.budgetStatus === "HEALTHY") return "#34d399";
    if (inventory.budgetStatus === "MODERATE") return "#38bdf8";
    return "#f87171";
  }, [inventory.budgetStatus]);

  const budgetPct = Math.min(
    100,
    Math.round((inventory.primaryTokenFootprint / inventory.maxRecommendedTokens) * 100)
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Banner */}
      <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">AI Readiness & Skill Auditor</h1>
            <p className="text-xs text-muted-foreground">
              Evaluates repository ergonomics, agent instructions, guardrails, and tool-to-skill parity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Auditing..." : "Re-run Audit"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          {/* Hero Score Card */}
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 rounded-xl p-6 bg-gradient-to-b from-card to-card/50 border border-border flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10 blur-2xl pointer-events-none"
                  style={{ backgroundColor: gradeColor }}
                />
                <div className="relative mb-2">
                  <div
                    className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center shadow-lg"
                    style={{ borderColor: gradeColor, boxShadow: `0 0 20px ${gradeColor}33` }}
                  >
                    <span className="text-3xl font-extrabold tracking-tight" style={{ color: gradeColor }}>
                      {report.score}
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                      / 100
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 bg-white/[0.06] border border-border/50">
                  <span>Grade:</span>
                  <span className="font-bold" style={{ color: gradeColor }}>
                    {report.grade}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-3 max-w-[240px]">
                  {report.summary}
                </p>
              </div>

              {/* Pillars Overview */}
              <div className="md:col-span-2 rounded-xl p-6 bg-card border border-border flex flex-col justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  5-Pillar Readiness Breakdown
                </h2>

                <div className="space-y-3.5">
                  {[
                    { key: "instructions", label: "1. Agent Instructions & Anchors", data: report.pillars.instructions },
                    { key: "skills", label: "2. Tool & Skill Runbook Parity", data: report.pillars.skills },
                    { key: "graph_integrity", label: "3. Knowledge Graph Integrity", data: report.pillars.graph_integrity },
                    { key: "test_guardrails", label: "4. Test & Verification Guardrails", data: report.pillars.test_guardrails },
                    { key: "hygiene", label: "5. Code Graph Hygiene & Boundaries", data: report.pillars.hygiene },
                  ].map((p) => {
                    const pct = Math.round((p.data.score / p.data.max) * 100);
                    const statusColor =
                      p.data.status === "EXCELLENT" ? "#34d399" :
                      p.data.status === "GOOD" ? "#38bdf8" : "#fbbf24";

                    return (
                      <div key={p.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground/90">{p.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {p.data.score} / {p.data.max} pts
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded font-medium border"
                              style={{ color: statusColor, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}11` }}
                            >
                              {p.data.status}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: statusColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* RFC 018: Agent Context & Instruction Architecture Hub */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Agent Context & Instruction Architecture
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      RFC 018
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tracks repository markdown files, mental models, and configuration anchors that govern AI agent cognition.
                  </p>
                </div>
              </div>

              {/* Token Budget Gauge */}
              <div className="flex items-center gap-4 bg-background/50 border border-border/60 px-3.5 py-2 rounded-lg shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-sky-400" />
                      Prompt Token Budget:
                    </span>
                    <span className="font-mono font-medium">
                      {inventory.primaryTokenFootprint.toLocaleString()} / {inventory.maxRecommendedTokens.toLocaleString()} tok
                    </span>
                  </div>
                  <div className="w-44 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${budgetPct}%`, backgroundColor: budgetColor }}
                    />
                  </div>
                </div>

                <div
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    color: budgetColor,
                    borderColor: `${budgetColor}44`,
                    backgroundColor: `${budgetColor}15`,
                  }}
                >
                  {inventory.budgetStatus}
                </div>
              </div>
            </div>

            {/* Ecosystem Compatibility Ribbon */}
            <div className="px-6 py-2.5 bg-muted/20 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium text-foreground/80">Ecosystem Coverage:</span>
                <span className="text-[11px]">Active anchors for client agents:</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { name: "Universal (AGENTS.md)", active: inventory.ecosystemCoverage.universal },
                  { name: "Claude Code", active: inventory.ecosystemCoverage.claude },
                  { name: "Antigravity / Gemini", active: inventory.ecosystemCoverage.antigravity },
                  { name: "Cursor IDE", active: inventory.ecosystemCoverage.cursor },
                  { name: "GitHub Copilot", active: inventory.ecosystemCoverage.copilot },
                ].map((eco) => (
                  <span
                    key={eco.name}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                      eco.active
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : "bg-zinc-800/40 text-muted-foreground border-border/40"
                    }`}
                  >
                    {eco.active ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                    {eco.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="px-6 py-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/20">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Documents", count: categoryCounts.all },
                  { id: "PRIMARY", label: "Primary Rules", count: categoryCounts.primary },
                  { id: "ARCHITECTURE", label: "Architecture", count: categoryCounts.architecture },
                  { id: "SKILLS", label: "Skill Runbooks", count: categoryCounts.skills },
                  { id: "LLM_INDEX", label: "LLM Indexes", count: categoryCounts.llm_index },
                  { id: "MISSING", label: "Missing", count: categoryCounts.missing },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCategoryFilter(tab.id as CategoryFilter)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                      categoryFilter === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.1 rounded-full ${
                        categoryFilter === tab.id
                          ? "bg-black/20 text-white"
                          : "bg-background/80 text-muted-foreground"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter context files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs bg-background border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Document Inventory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/10 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-6 font-semibold">Document Path</th>
                    <th className="py-2.5 px-4 font-semibold">Role</th>
                    <th className="py-2.5 px-4 font-semibold">Target Agent</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Tokens / Size</th>
                    <th className="py-2.5 px-4 font-semibold">Symbol Integrity</th>
                    <th className="py-2.5 px-6 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No context documents matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => {
                      const isMissing = doc.status === "MISSING";
                      const isStale = doc.status === "STALE";
                      const hasDrift =
                        doc.symbolIntegrity &&
                        doc.symbolIntegrity.driftedSymbols.length > 0;

                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <FileText
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isMissing
                                    ? "text-rose-400"
                                    : doc.category === "primary_instruction"
                                    ? "text-sky-400"
                                    : doc.category === "architecture"
                                    ? "text-purple-400"
                                    : "text-emerald-400"
                                }`}
                              />
                              <span className="font-mono text-xs font-medium text-foreground/90 group-hover:text-primary transition-colors">
                                {doc.path}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-[10px] px-2 py-0.5 rounded border capitalize font-medium bg-muted/30 border-border/50 text-foreground/80">
                              {doc.category.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {doc.targetAgents.map((ag) => (
                                <span
                                  key={ag}
                                  className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-primary/10 text-primary border border-primary/20 capitalize"
                                >
                                  {ag}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <AlertCircle className="w-2.5 h-2.5" /> Missing
                              </span>
                            ) : isStale ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <Clock className="w-2.5 h-2.5" /> Stale (50+ commits)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Tracked
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isMissing ? (
                              <span className="text-muted-foreground text-[11px] font-mono">-</span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="font-mono text-[11px] text-foreground/90">
                                  {doc.tokenCount.toLocaleString()} tok
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  ({(doc.fileSizeBytes / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isMissing ? (
                              <span className="text-muted-foreground text-[11px] font-mono">-</span>
                            ) : !doc.symbolIntegrity || doc.symbolIntegrity.totalReferencedSymbols === 0 ? (
                              <span className="text-muted-foreground text-[11px]">Prose text</span>
                            ) : hasDrift ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {doc.symbolIntegrity.driftedSymbols.length} drifted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                                <Check className="w-3 h-3 shrink-0" />
                                {doc.symbolIntegrity.validSymbolsCount} verified
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-6 text-right">
                            {isMissing ? (
                              <button
                                onClick={() => {
                                  setActivePreviewDoc(doc);
                                  setPreviewTab("content");
                                }}
                                className="px-2.5 py-1 text-[11px] font-medium rounded bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition-colors inline-flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Scaffold
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActivePreviewDoc(doc);
                                  setPreviewTab("content");
                                }}
                                className="px-2.5 py-1 text-[11px] font-medium rounded bg-secondary hover:bg-secondary/80 border border-border transition-colors inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="w-3 h-3" />
                                Inspect
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shortcomings & Actionable Remediations */}
          {report && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">Identified Shortcomings & Remediations</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  {report.shortcomings.length} finding(s)
                </span>
              </div>

              <div className="divide-y divide-border/40">
                {report.shortcomings.map((sc) => {
                  const badgeColor =
                    sc.severity === "BLOCKER" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                    sc.severity === "HIGH" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                    sc.severity === "MEDIUM" ? "bg-sky-500/15 text-sky-400 border-sky-500/30" :
                    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

                  return (
                    <div key={sc.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-white/[0.01] transition-colors">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                            {sc.severity}
                          </span>
                          <h4 className="text-xs font-semibold text-foreground/90">{sc.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{sc.description}</p>
                        <div className="flex items-center gap-2 text-xs text-emerald-400/90 pt-1">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span><strong>Fix:</strong> {sc.remediation}</span>
                        </div>
                      </div>

                      {sc.autoFixAvailable && sc.scaffoldTemplate && (
                        <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
                          <button
                            onClick={() => setActiveModalShortcoming(sc)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition-colors flex items-center gap-1.5"
                          >
                            <FileCode2 className="w-3.5 h-3.5" />
                            View Scaffold Template
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* RFC 018: Document Detail & Preview Drawer Modal */}
      {activePreviewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/70">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 font-mono">
                    {activePreviewDoc.path}
                    <span className="text-[10px] font-sans uppercase px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                      {activePreviewDoc.category.replace("_", " ")}
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{activePreviewDoc.tokenCount.toLocaleString()} tokens</span>
                    <span>•</span>
                    <span>{(activePreviewDoc.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span className="capitalize">{activePreviewDoc.status.toLowerCase()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActivePreviewDoc(null)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-border/50 flex items-center gap-4 bg-muted/10 text-xs">
              <button
                onClick={() => setPreviewTab("content")}
                className={`py-2.5 font-medium border-b-2 transition-colors ${
                  previewTab === "content"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {activePreviewDoc.status === "MISSING" ? "Scaffold Template" : "Document Content"}
              </button>
              <button
                onClick={() => setPreviewTab("symbols")}
                className={`py-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  previewTab === "symbols"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Symbol Anchor Integrity</span>
                {activePreviewDoc.symbolIntegrity && (
                  <span className="text-[10px] px-1.5 py-0.1 rounded-full bg-secondary">
                    {activePreviewDoc.symbolIntegrity.totalReferencedSymbols}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPreviewTab("diagnostics")}
                className={`py-2.5 font-medium border-b-2 transition-colors ${
                  previewTab === "diagnostics"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Diagnostics & Freshness
              </button>
            </div>

            {/* Modal Body */}
            <ScrollArea className="flex-1 p-6 bg-[#080f14]/80">
              {previewTab === "content" && (
                <div className="space-y-4">
                  {/* Check for embedded Mermaid */}
                  {extractMermaidDiagram(activePreviewDoc.rawContent || activePreviewDoc.scaffoldTemplate || "") && (
                    <div className="rounded-lg border border-border/60 overflow-hidden bg-card/30 p-4 mb-4">
                      <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-sky-400">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Rendered Architectural Flow</span>
                      </div>
                      <div className="h-64 rounded bg-[#090d16] border border-border/40 overflow-hidden">
                        <MermaidViewer
                          diagramId={`doc-mermaid-${activePreviewDoc.id}`}
                          title={activePreviewDoc.name}
                          code={extractMermaidDiagram(activePreviewDoc.rawContent || activePreviewDoc.scaffoldTemplate || "")!}
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                  )}

                  <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-all">
                    {activePreviewDoc.rawContent || activePreviewDoc.scaffoldTemplate || "No content available."}
                  </pre>
                </div>
              )}

              {previewTab === "symbols" && (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Symbols mentioned in code blocks are cross-referenced with the codebase knowledge graph to prevent documentation drift.
                  </div>

                  {!activePreviewDoc.symbolIntegrity ||
                  activePreviewDoc.symbolIntegrity.totalReferencedSymbols === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      No code symbol backticks detected in this document.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-border/40">
                        <span className="font-medium">
                          Referenced Symbol ({activePreviewDoc.symbolIntegrity.totalReferencedSymbols})
                        </span>
                        <span>Graph Node Classification</span>
                      </div>

                      {activePreviewDoc.symbolIntegrity.driftedSymbols.map((s) => (
                        <div
                          key={s.symbol}
                          className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-mono font-semibold text-amber-300">
                              `{s.symbol}`
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-400/90 font-medium">
                            Not Found in Graph (Potential Drift)
                          </span>
                        </div>
                      ))}

                      {/* Display valid symbols */}
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {activePreviewDoc.symbolIntegrity.validSymbolsCount} symbol(s) validated against active graph.
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold">
                          Verified
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previewTab === "diagnostics" && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-border bg-card/40 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">Token Footprint</span>
                      <p className="text-base font-bold font-mono">{activePreviewDoc.tokenCount} tokens</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-card/40 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">File Size</span>
                      <p className="text-base font-bold font-mono">{(activePreviewDoc.fileSizeBytes / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card/40 space-y-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">Content Inspections</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {activePreviewDoc.hasBuildCommands ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-zinc-500">✕</span>
                        )}
                        <span>Build Commands Documented</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activePreviewDoc.hasTestCommands ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-zinc-500">✕</span>
                        )}
                        <span>Test Commands Documented</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activePreviewDoc.hasForbiddenPatterns ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-zinc-500">✕</span>
                        )}
                        <span>Safety / Guardrail Rules Present</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activePreviewDoc.hasValidFrontmatter ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-zinc-500">✕</span>
                        )}
                        <span>YAML Frontmatter Validated</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-card/70">
              <span className="text-[11px] text-muted-foreground font-mono">
                {activePreviewDoc.status === "MISSING"
                  ? `Run: node scripts/audit-ai-readiness.mjs --scaffold-${activePreviewDoc.path.includes("architecture") ? "arch" : activePreviewDoc.path.includes("llms") ? "llms" : "agents"}`
                  : `Path: ${activePreviewDoc.path}`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleCopy(
                      activePreviewDoc.rawContent || activePreviewDoc.scaffoldTemplate || "",
                      `preview-${activePreviewDoc.id}`
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-1.5"
                >
                  {copiedId === `preview-${activePreviewDoc.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActivePreviewDoc(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Template Modal */}
      {activeModalShortcoming && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card/60">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold">
                  Scaffold: {activeModalShortcoming.skillTargetDir || activeModalShortcoming.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalShortcoming(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <ScrollArea className="flex-1 p-5 bg-[#080f14]/80">
              <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-all">
                {activeModalShortcoming.scaffoldTemplate}
              </pre>
            </ScrollArea>

            <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-card/60">
              <span className="text-[11px] text-muted-foreground">
                Run:{" "}
                <code>
                  node scripts/audit-ai-readiness.mjs --scaffold{" "}
                  {activeModalShortcoming.id.replace("missing-skill-", "")}
                </code>
              </span>
              <button
                onClick={() =>
                  handleCopy(
                    activeModalShortcoming.scaffoldTemplate || "",
                    activeModalShortcoming.id
                  )
                }
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-1.5"
              >
                {copiedId === activeModalShortcoming.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractMermaidDiagram(content: string): string | null {
  const match = content.match(/```mermaid\s*\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

function getDefaultReport(project: string): AIReadinessReport {
  return {
    project,
    timestamp: new Date().toISOString(),
    score: 84,
    grade: "B+",
    summary:
      "Solid AI ergonomics: Comprehensive test suite, graph index active, RFC 018 Agent Context inventory tracked, but lacks skill runbooks for Vite and C workflows.",
    pillars: {
      instructions: {
        score: 17,
        max: 20,
        status: "EXCELLENT",
        findings: [
          "Root agent instructions present.",
          "Build and verification commands documented.",
          "Compact prompt context token load (1,420 tokens).",
        ],
      },
      skills: {
        score: 18,
        max: 25,
        status: "GOOD",
        findings: [
          "Installed skills discovered.",
          "Missing skill runbook for detected Vite frontend.",
        ],
      },
      graph_integrity: {
        score: 18,
        max: 20,
        status: "EXCELLENT",
        findings: [
          "Connected to codebase-memory-mcp graph.",
          "Architecture diagrams detected.",
          "All documentation code symbols validated against active graph.",
        ],
      },
      test_guardrails: {
        score: 19,
        max: 20,
        status: "EXCELLENT",
        findings: ["Test suite detected.", "Linters and formatters configured."],
      },
      hygiene: {
        score: 14,
        max: 15,
        status: "EXCELLENT",
        findings: ["Git hygiene and lockfiles verified."],
      },
    },
    shortcomings: [
      {
        id: "missing-skill-vite-frontend",
        severity: "HIGH",
        pillar: "skills",
        title: "Missing skill runbook for detected tool: Vite & React Frontend",
        description:
          "Repository uses Vite & React, but lacks an agent skill (frontend-dev) to guide AI models on build validation and styling rules.",
        remediation:
          "Scaffold '.agents/skills/frontend-dev/SKILL.md' with instructions for Vite frontend development.",
        autoFixAvailable: true,
        skillTargetDir: ".agents/skills/frontend-dev",
        scaffoldTemplate: `---\nname: frontend-dev\ndescription: "Guidelines for Vite development server, React components, and frontend builds."\n---\n\n# Frontend Development Runbook\n\n## Commands\n- Dev server: cd graph-ui && npm run dev\n- Build: cd graph-ui && npm run build\n- Test: cd graph-ui && npm test\n`,
      },
      {
        id: "missing-llms-txt",
        severity: "LOW",
        pillar: "instructions",
        title: "Missing llms.txt summary index",
        description:
          "llms.txt provides a standardized entrypoint for fast LLM repo ingestion (llmstxt.org).",
        remediation:
          "Create a docs/llms.txt summarizing project modules and documentation links.",
        autoFixAvailable: true,
        scaffoldTemplate: `# codebase-memory-mcp-ui\n\n> Fast, local knowledge graph and AI agent developer ergonomics platform.\n\n## Documentation\n- [Architecture](ARCHITECTURE.md): System model and module boundaries\n- [AI Readiness](docs/RFC_014_AI_Readiness_Audit_Tool.md): 5-pillar ergonomics rubric\n`,
      },
    ],
    context_inventory: {
      totalDocumentsFound: 8,
      totalTokenFootprint: 18450,
      primaryTokenFootprint: 1420,
      budgetStatus: "HEALTHY",
      maxRecommendedTokens: 3500,
      ecosystemCoverage: {
        universal: true,
        claude: true,
        antigravity: true,
        cursor: false,
        copilot: false,
        windsurf: false,
      },
      documents: [
        {
          id: "agents-md",
          path: "AGENTS.md",
          name: "AGENTS.md",
          category: "primary_instruction",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 3450,
          tokenCount: 890,
          lastModifiedDaysAgo: 2,
          hasBuildCommands: true,
          hasTestCommands: true,
          hasForbiddenPatterns: true,
          rawContent: `# Agent Instructions & Conventions\n\n## Verification Runbooks\n- Dev Server: cd graph-ui && npm run dev\n- Build: cd graph-ui && npm run build\n- Test: cd graph-ui && npm test\n\n## Core Principles\n- Always preserve comments and docstrings.\n- Avoid modifying Core C codebase.\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 4,
            validSymbolsCount: 4,
            driftedSymbols: [],
          },
        },
        {
          id: "architecture-md",
          path: "ARCHITECTURE.md",
          name: "ARCHITECTURE.md",
          category: "architecture",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 7200,
          tokenCount: 1850,
          lastModifiedDaysAgo: 5,
          rawContent: `# System Architecture & Mental Model\n\n## 1. System Overview\nCodebase Memory provides a persistent graph of code symbols, AST nodes, and architectural links.\n\n\`\`\`mermaid\ngraph TD\n    Client[AI Agent / Browser] --> Daemon[MCP Daemon & HTTP Ingress]\n    Daemon --> Graph[(SQLite Knowledge Graph)]\n    Daemon --> UI[graph-ui React Dashboard]\n\`\`\`\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 8,
            validSymbolsCount: 8,
            driftedSymbols: [],
          },
        },
        {
          id: "docs-rfc-014",
          path: "docs/RFC_014_AI_Readiness_Audit_Tool.md",
          name: "RFC_014_AI_Readiness_Audit_Tool.md",
          category: "architecture",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 22051,
          tokenCount: 5720,
          lastModifiedDaysAgo: 7,
          rawContent: `# RFC 014: AI Readiness Audit Tool\n\nEvaluates repository ergonomics against a 5-pillar rubric.\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 12,
            validSymbolsCount: 12,
            driftedSymbols: [],
          },
        },
        {
          id: "docs-rfc-018",
          path: "docs/RFC_018_Agent_Context_And_Instruction_Architecture.md",
          name: "RFC_018_Agent_Context_And_Instruction_Architecture.md",
          category: "architecture",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 18200,
          tokenCount: 4720,
          lastModifiedDaysAgo: 0,
          rawContent: `# RFC 018: Agent Context & Instruction Architecture\n\nAudits repository markdown anchors and symbol drift.\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 6,
            validSymbolsCount: 6,
            driftedSymbols: [],
          },
        },
        {
          id: "skill-ai-readiness",
          path: ".agents/skills/ai-readiness-audit/SKILL.md",
          name: "ai-readiness-audit/SKILL.md",
          category: "skill_runbook",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 2500,
          tokenCount: 650,
          lastModifiedDaysAgo: 7,
          hasValidFrontmatter: true,
          rawContent: `---\nname: ai-readiness-audit\ndescription: "Audit repository AI readiness and skill runbooks."\n---\n\n# AI Readiness Audit\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 3,
            validSymbolsCount: 3,
            driftedSymbols: [],
          },
        },
        {
          id: "docs-llms-txt",
          path: "docs/llms.txt",
          name: "docs/llms.txt",
          category: "llm_index",
          targetAgents: ["universal"],
          status: "MISSING",
          fileSizeBytes: 0,
          tokenCount: 0,
          scaffoldTemplateAvailable: true,
          scaffoldTemplate: `# codebase-memory-mcp-ui\n\n> Fast, local knowledge graph platform.\n\n## Core Entrypoints\n- [App](graph-ui/src/App.tsx)\n- [Audit Engine](scripts/audit_engine.mjs)\n`,
        },
        {
          id: "cursorrules",
          path: ".cursorrules",
          name: ".cursorrules",
          category: "primary_instruction",
          targetAgents: ["cursor"],
          status: "MISSING",
          fileSizeBytes: 0,
          tokenCount: 0,
          scaffoldTemplateAvailable: true,
          scaffoldTemplate: `# Cursor IDE Rules\n\n- Build: cd graph-ui && npm run build\n- Test: cd graph-ui && npm test\n`,
        },
        {
          id: "readme-md",
          path: "README.md",
          name: "README.md",
          category: "project_standard",
          targetAgents: ["universal"],
          status: "PRESENT",
          fileSizeBytes: 18400,
          tokenCount: 4780,
          lastModifiedDaysAgo: 1,
          rawContent: `# codebase-memory-mcp-ui\n\nWeb visualization dashboard for codebase-memory-mcp.\n`,
          symbolIntegrity: {
            totalReferencedSymbols: 10,
            validSymbolsCount: 10,
            driftedSymbols: [],
          },
        },
      ],
      driftWarningsCount: 0,
    },
  };
}
