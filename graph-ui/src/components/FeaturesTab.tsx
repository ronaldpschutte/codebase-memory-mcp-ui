import { useState, useMemo } from "react";
import {
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Layers,
  Copy,
  Check,
  X,
  GitFork,
  BookOpen,
} from "lucide-react";
import type { TabId, RepositoryFeature } from "../lib/types";

interface FeaturesTabProps {
  selectedProjects?: string[];
  selectedProject?: string | null;
  onNavigateTab?: (tab: TabId, projects?: string[]) => void;
}

// Built-in feature catalogs for indexed repositories
const FEATURE_CATALOGS: Record<string, RepositoryFeature[]> = {
  "codebase-memory-mcp-ui": [
    {
      id: "diagram_recommendations",
      name: "Diagram Recommendation Engine & Studio",
      category: "Analysis & Visualization",
      summary: "Evaluates graph topology metrics (PageRank, cyclomatic hubs, SCC cycles) to score and generate high-impact Mermaid/SVG architecture diagrams.",
      documentation: ["docs/RFC_016_Diagram_Recommendation_Engine.md"],
      surfaceTriggers: [
        { kind: "mcp_tool", name: "export_diagram" },
        { kind: "ui_tab", name: "DiagramsTab" },
        { kind: "cli_script", path: "scripts/recommend-diagrams.mjs" },
      ],
      coreFiles: [
        "src/diagram/recommend.c",
        "graph-ui/src/components/DiagramsTab.tsx",
        "scripts/recommend-diagrams.mjs",
      ],
      dependencies: {
        externalLibraries: ["mermaid", "three", "@react-three/fiber"],
        sharedUtilities: ["cbm_malloc", "cbm_log"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_diagram_standalone.c", "graph-ui/src/components/DiagramsTab.test.tsx"],
        testCount: 14,
      },
      transplantReadiness: {
        autonomyScore: 88,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
    {
      id: "multi_project_scope_filter",
      name: "Multi-Project Selection & Application-Wide Filter",
      category: "UI & Scope Filtering",
      summary: "Multi-project selection across header switcher and Projects cards, synchronizing scope through URL query params and tab aggregations.",
      documentation: ["docs/RFC_020_Multi_Project_Selection_And_Application_Wide_Filter.md"],
      surfaceTriggers: [
        { kind: "ui_component", name: "App.tsx (Header Switcher)" },
        { kind: "ui_tab", name: "StatsTab.tsx (Project Cards)" },
        { kind: "http_route", path: "?projects=a,b" },
      ],
      coreFiles: [
        "graph-ui/src/App.tsx",
        "graph-ui/src/components/StatsTab.tsx",
      ],
      dependencies: {
        externalLibraries: ["clsx", "tailwind-merge", "lucide-react"],
        sharedUtilities: ["useProjects"],
      },
      verification: {
        hasTests: true,
        testSuites: ["graph-ui/src/App.test.tsx", "graph-ui/src/components/StatsTab.test.tsx"],
        testCount: 2,
      },
      transplantReadiness: {
        autonomyScore: 88,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
    {
      id: "cross_repo_transplant",
      name: "Cross-Repository Feature Transplant Engine",
      category: "Migration & Governance",
      summary: "Extracts transitive outbound call closures, AST code slices, environment dependencies, and test suites for zero-friction cross-repo porting.",
      documentation: ["docs/RFC_019_Interactive_Multi_Project_Elicitation_And_Cross_Repo_Transplant.md"],
      surfaceTriggers: [
        { kind: "mcp_prompt", name: "transplant_feature" },
        { kind: "cli_script", path: "scripts/transplant-feature.mjs" },
      ],
      coreFiles: [
        "scripts/transplant-feature.mjs",
        ".agents/skills/cross-repo-transplant/SKILL.md",
        "src/mcp/mcp.c",
      ],
      dependencies: {
        externalLibraries: [],
        sharedUtilities: ["search_graph", "trace_path", "get_code_snippet"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_mcp.c", "graph-ui/src/components/ToolsTab.test.tsx"],
        testCount: 2,
      },
      transplantReadiness: {
        autonomyScore: 93,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
    {
      id: "ai_readiness_audit",
      name: "AI Readiness Audit & Agent Context Architecture",
      category: "Audit & Readiness",
      summary: "Evaluates repository AI ergonomics (0-100), audits agent instruction context markdown files, verifies symbol references, and suggests remediations.",
      documentation: [
        "docs/RFC_014_AI_Readiness_Audit_Tool.md",
        "docs/RFC_018_Agent_Context_And_Instruction_Architecture.md",
      ],
      surfaceTriggers: [
        { kind: "mcp_tool", name: "audit_test_coverage" },
        { kind: "ui_tab", name: "ReadinessTab" },
      ],
      coreFiles: [
        "graph-ui/src/components/ReadinessTab.tsx",
        ".agents/skills/ai-readiness-audit/SKILL.md",
      ],
      dependencies: {
        externalLibraries: ["lucide-react"],
        sharedUtilities: ["useProjects"],
      },
      verification: {
        hasTests: true,
        testSuites: ["graph-ui/src/components/ReadinessTab.test.tsx"],
        testCount: 1,
      },
      transplantReadiness: {
        autonomyScore: 92,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
    {
      id: "code_quality_reports",
      name: "Code Quality & Deep Analytical Reports Hub",
      category: "Analysis & Metrics",
      summary: "Unified dashboard executing 9 deep analytical tools (blast radius, API surface, test audit, code clones, dead code, error flows) with Fix-First prioritization.",
      documentation: [
        "docs/RFC_012_Code_Quality_Reports_Page.md",
        "docs/RFC_015_Repository_Analysis_Reports_Page.md",
      ],
      surfaceTriggers: [
        { kind: "ui_tab", name: "ReportsTab" },
      ],
      coreFiles: [
        "graph-ui/src/components/ReportsTab.tsx",
        ".agents/skills/repository-reports/SKILL.md",
      ],
      dependencies: {
        externalLibraries: ["lucide-react"],
        sharedUtilities: ["useProjects"],
      },
      verification: {
        hasTests: false,
        testSuites: [],
        testCount: 0,
      },
      transplantReadiness: {
        autonomyScore: 65,
        coupling: "medium",
        verdict: "Moderate coupling; requires mapping shared utility imports",
      },
    },
    {
      id: "native_sqlite_graph_buffer",
      name: "Direct SQLite Page-Writer & Graph Buffer",
      category: "Core Engine & Storage",
      summary: "Zero-dependency direct SQLite B-tree page constructor and memory-mapped reader enabling high-velocity graph persistence without SQLite C locks.",
      documentation: ["docs/BENCHMARK.md"],
      surfaceTriggers: [
        { kind: "c_api", name: "cbm_write_db" },
        { kind: "c_api", name: "cbm_store_open_path_query" },
      ],
      coreFiles: [
        "internal/cbm/sqlite_writer.c",
        "internal/cbm/sqlite_writer.h",
        "src/store/store.c",
      ],
      dependencies: {
        externalLibraries: [],
        sharedUtilities: ["cbm_malloc", "compat_fs"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_sqlite_writer.c", "tests/test_store_search.c"],
        testCount: 8,
      },
      transplantReadiness: {
        autonomyScore: 100,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
    {
      id: "tool_call_logger_viewer",
      name: "Tool Call Audit Logger & Response Viewer",
      category: "Developer Tools & Observability",
      summary: "Real-time inspection of inbound MCP JSON-RPC requests and detailed execution payloads with full parameter drilldown and execution timings.",
      documentation: [
        "docs/RFC_009_Tool_Call_log.md",
        "docs/RFC_010_Tool_Call_Response_Viewer.md",
      ],
      surfaceTriggers: [
        { kind: "ui_component", name: "ToolCallLogViewer" },
        { kind: "ui_tab", name: "ControlTab" },
      ],
      coreFiles: [
        "graph-ui/src/components/ToolCallLogViewer.tsx",
        "graph-ui/src/components/ControlTab.tsx",
      ],
      dependencies: {
        externalLibraries: ["lucide-react"],
        sharedUtilities: ["ControlTab"],
      },
      verification: {
        hasTests: true,
        testSuites: ["graph-ui/src/components/ControlTab.test.tsx"],
        testCount: 1,
      },
      transplantReadiness: {
        autonomyScore: 92,
        coupling: "low",
        verdict: "Ready for transplant with minimal adapter code",
      },
    },
  ],
  docling: [
    {
      id: "document_layout_parser",
      name: "Document Layout OCR & Parsing Engine",
      category: "Document Processing",
      summary: "High-accuracy PDF and image layout analysis reconstructing reading order, paragraph boundaries, and hierarchical document trees.",
      documentation: ["README.md#layout-parsing"],
      surfaceTriggers: [
        { kind: "mcp_tool", name: "parse_document" },
        { kind: "cli_script", path: "docling-parse" },
      ],
      coreFiles: ["docling/parser.py", "docling/layout.py", "docling/models/layout_predictor.py"],
      dependencies: {
        externalLibraries: ["torch", "pillow", "numpy"],
        sharedUtilities: ["docling.utils.logger"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_layout.py", "tests/test_parser.py"],
        testCount: 18,
      },
      transplantReadiness: {
        autonomyScore: 92,
        coupling: "low",
        verdict: "Self-contained neural layout pipeline ready for extraction.",
      },
    },
    {
      id: "table_structure_recognition",
      name: "Table Structure Recognition & HTML Generator",
      category: "ML Extraction",
      summary: "Neural network detecting table bounding boxes, multi-span cell coordinates, and exporting semantic HTML/Markdown tables.",
      documentation: ["README.md#table-extraction"],
      surfaceTriggers: [
        { kind: "mcp_tool", name: "extract_tables" },
        { kind: "http_route", path: "/api/extract/tables" },
      ],
      coreFiles: ["docling/table/recognizer.py", "docling/table/cell_matcher.py"],
      dependencies: {
        externalLibraries: ["torchvision", "pandas"],
        sharedUtilities: ["docling.geometry"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_tables.py"],
        testCount: 8,
      },
      transplantReadiness: {
        autonomyScore: 84,
        coupling: "low",
        verdict: "High autonomy; requires PyTorch tensor runtime.",
      },
    },
    {
      id: "markdown_chunker_exporter",
      name: "Semantic Markdown Chunker for LLMs",
      category: "Vector & RAG",
      summary: "Produces hierarchical, token-aware document chunks preserving header context and table structures for vector embedding databases.",
      documentation: ["README.md#chunking"],
      surfaceTriggers: [
        { kind: "mcp_tool", name: "chunk_markdown" },
      ],
      coreFiles: ["docling/chunking/hierarchical.py", "docling/chunking/token_counter.py"],
      dependencies: {
        externalLibraries: ["tiktoken"],
        sharedUtilities: ["docling.models.document"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_chunking.py"],
        testCount: 12,
      },
      transplantReadiness: {
        autonomyScore: 96,
        coupling: "low",
        verdict: "Pure algorithmic chunker; prime candidate for transplantation.",
      },
    },
  ],
  Graft: [
    {
      id: "ast_grafting_engine",
      name: "AST Graph Grafting & Subgraph Weaver",
      category: "Graph Manipulation",
      summary: "Grafts foreign AST subgraphs into an existing syntax tree with automatic reference rebinding and identifier namespace virtualization.",
      documentation: ["README.md#ast-grafting"],
      surfaceTriggers: [
        { kind: "c_api", name: "graft_subgraph_weave" },
        { kind: "cli_script", path: "graft-cli" },
      ],
      coreFiles: ["src/graft/weaver.c", "src/graft/rebind.c"],
      dependencies: {
        externalLibraries: [],
        sharedUtilities: ["cbm_arena", "cbm_symbol_table"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_weaver.c"],
        testCount: 9,
      },
      transplantReadiness: {
        autonomyScore: 90,
        coupling: "low",
        verdict: "Zero external dependencies; clean C99 graph adapter.",
      },
    },
    {
      id: "schema_validator",
      name: "Graph Schema Invariant Validator",
      category: "Integrity & Validation",
      summary: "Validates graph acyclicity, edge directional types, and node label constraints using incremental disjoint-set path checking.",
      documentation: ["README.md#validation"],
      surfaceTriggers: [
        { kind: "c_api", name: "graft_schema_verify" },
      ],
      coreFiles: ["src/graft/validate.c", "src/graft/disjoint_set.c"],
      dependencies: {
        externalLibraries: [],
        sharedUtilities: ["cbm_assert"],
      },
      verification: {
        hasTests: true,
        testSuites: ["tests/test_schema_valid.c"],
        testCount: 6,
      },
      transplantReadiness: {
        autonomyScore: 94,
        coupling: "low",
        verdict: "Fast invariant validator with zero third-party dependencies.",
      },
    },
  ],
};

export function FeaturesTab({
  selectedProjects = [],
  selectedProject = null,
  onNavigateTab,
}: FeaturesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [transplantTargetModal, setTransplantTargetModal] = useState<{
    sourceRepo: string;
    feature: RepositoryFeature;
  } | null>(null);
  const [docModal, setDocModal] = useState<{
    feature: RepositoryFeature;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Normalize active projects: support multi-project selection, single project, or fallback
  const activeProjects = useMemo(() => {
    if (selectedProjects && selectedProjects.length > 0) {
      return selectedProjects;
    }
    if (selectedProject) {
      return [selectedProject];
    }
    return ["codebase-memory-mcp-ui"];
  }, [selectedProjects, selectedProject]);

  // Derive catalog for each active project (using fallback generator if not in mock catalog)
  const projectCatalogs = useMemo(() => {
    return activeProjects.map((proj) => {
      // Direct catalog match or normalize project name
      let features = FEATURE_CATALOGS[proj];
      if (!features) {
        // Try fuzzy match
        const matchingKey = Object.keys(FEATURE_CATALOGS).find((k) =>
          proj.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(proj.toLowerCase())
        );
        features = matchingKey ? FEATURE_CATALOGS[matchingKey] : FEATURE_CATALOGS["codebase-memory-mcp-ui"];
      }

      // Filter by search and category
      const filtered = features.filter((feat) => {
        const matchesSearch =
          searchQuery === "" ||
          feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          feat.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          feat.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory =
          selectedCategory === "All" || feat.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      const avgAutonomy = Math.round(
        features.reduce((acc, f) => acc + f.transplantReadiness.autonomyScore, 0) / (features.length || 1)
      );

      return {
        projectName: proj,
        features: filtered,
        totalCount: features.length,
        avgAutonomy,
      };
    });
  }, [activeProjects, searchQuery, selectedCategory]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const cat of Object.values(FEATURE_CATALOGS)) {
      for (const f of cat) {
        set.add(f.category);
      }
    }
    return ["All", ...Array.from(set)];
  }, []);

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getCouplingBadge = (coupling: "low" | "medium" | "high", score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          {score}/100 • {coupling} coupling
        </span>
      );
    }
    if (score >= 65) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" />
          {score}/100 • {coupling} coupling
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" />
        {score}/100 • {coupling} coupling
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground space-y-6">
      {/* Top Banner & Context Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 rounded-2xl bg-black/40 border border-border/40 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground/95">
              Features & Capabilities Catalog
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium border border-primary/20">
              RFC 021 & RFC 022
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeProjects.length > 1
              ? `Comparing ${activeProjects.length} repositories side-by-side. Inspect capabilities, examine autonomy scores, and transplant features.`
              : `Cataloging functional capabilities, surface triggers, and transplant readiness scores for repository "${activeProjects[0]}".`}
          </p>
        </div>

        {/* Global Search and Category Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-black/50 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors w-48 sm:w-60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-lg border border-border/30 overflow-x-auto max-w-full">
            <Filter className="w-3 h-3 text-muted-foreground/60 ml-1.5 shrink-0" />
            {allCategories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout: Side-by-side columns (One list per repo with the name of the repo at the top) */}
      <div
        className={`grid gap-6 ${
          projectCatalogs.length === 1
            ? "grid-cols-1 max-w-4xl mx-auto"
            : projectCatalogs.length === 2
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-flow-col auto-cols-[380px] lg:auto-cols-[minmax(380px,1fr)] overflow-x-auto pb-4"
        }`}
      >
        {projectCatalogs.map((cat) => (
          <div
            key={cat.projectName}
            className="flex flex-col rounded-2xl border border-border/40 bg-black/25 overflow-hidden shadow-lg"
          >
            {/* Repository Column Header: Name of the repo at the top */}
            <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/60">
                      Repository
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-mono">
                      main
                    </span>
                  </div>
                  <h3
                    className="text-sm font-bold text-foreground font-mono truncate"
                    title={cat.projectName}
                  >
                    {cat.projectName}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-black/40 border border-border/30 text-foreground/80">
                  {cat.features.length} / {cat.totalCount} Features
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  {cat.avgAutonomy} Avg Score
                </span>
              </div>
            </div>

            {/* Feature Cards Column List */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {cat.features.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border/30 text-muted-foreground/60 text-xs">
                  No features found matching "{searchQuery}" in {cat.projectName}.
                </div>
              ) : (
                cat.features.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-4 rounded-xl border border-border/30 bg-black/40 hover:border-primary/40 hover:bg-black/60 transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      {/* Card Title & Category */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-primary/80 block mb-0.5">
                            {feat.category}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground/95 group-hover:text-primary transition-colors">
                            {feat.name}
                          </h4>
                        </div>
                        {getCouplingBadge(
                          feat.transplantReadiness.coupling,
                          feat.transplantReadiness.autonomyScore
                        )}
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {feat.summary}
                      </p>

                      {/* Surface Triggers Chips */}
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/50 block">
                          Surface Triggers
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {feat.surfaceTriggers.map((t, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-foreground/80 border border-border/20"
                            >
                              <span className="text-primary/70">{t.kind}:</span>
                              <span>{t.name || t.path}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Metrics & Test Coverage */}
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/20 font-mono text-muted-foreground">
                        <span>{feat.coreFiles.length} Primary Files</span>
                        {feat.verification.hasTests ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {feat.verification.testCount} Tests Passing
                          </span>
                        ) : (
                          <span className="text-amber-400/80 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-border/20">
                      <div className="flex items-center gap-1.5">
                        {feat.documentation.length > 0 && (
                          <button
                            onClick={() => setDocModal({ feature: feat })}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                          >
                            <BookOpen className="w-3 h-3 text-primary/80" />
                            <span>Docs</span>
                          </button>
                        )}
                        <button
                          onClick={() => onNavigateTab?.("graph", [cat.projectName])}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                        >
                          <Layers className="w-3 h-3 text-amber-400/80" />
                          <span>Graph</span>
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          setTransplantTargetModal({
                            sourceRepo: cat.projectName,
                            feature: feat,
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium font-mono text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        <GitFork className="w-3 h-3" />
                        <span>Transplant</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Transplant Runner Modal (RFC 019 Integration) */}
      {transplantTargetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1d24] border border-border/60 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                  <GitFork className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Transplant Feature: {transplantTargetModal.feature.name}
                </h3>
              </div>
              <button
                onClick={() => setTransplantTargetModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Extract the transitive dependency closure, environment flags, and unit tests for{" "}
              <strong className="text-foreground">
                {transplantTargetModal.feature.name}
              </strong>{" "}
              from <span className="font-mono text-primary">{transplantTargetModal.sourceRepo}</span>.
            </p>

            <div className="rounded-xl bg-black/60 border border-border/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  CLI Execution Command (RFC 019)
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      "cli-transplant",
                      `node scripts/transplant-feature.mjs --source ${transplantTargetModal.sourceRepo} --target target-repo --feature "${transplantTargetModal.feature.id}"`
                    )
                  }
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  {copiedKey === "cli-transplant" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-foreground/90 p-2 rounded bg-black/40 overflow-x-auto">
                node scripts/transplant-feature.mjs --source {transplantTargetModal.sourceRepo} --target target-repo --feature "{transplantTargetModal.feature.id}"
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setTransplantTargetModal(null)}
                className="px-4 py-1.5 rounded-lg border border-border/40 text-xs font-medium hover:bg-white/[0.04] transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setTransplantTargetModal(null);
                  onNavigateTab?.("tools", [transplantTargetModal.sourceRepo]);
                }}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Open in Tools Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Specification Documentation Modal */}
      {docModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1d24] border border-border/60 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {docModal.feature.name}
                </h3>
              </div>
              <button
                onClick={() => setDocModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground/60 block mb-1">
                  Architecture Specifications & RFCs
                </span>
                <div className="space-y-1">
                  {docModal.feature.documentation.map((d, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-black/40 border border-border/20 font-mono text-primary flex items-center justify-between"
                    >
                      <span>{d}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground/60 block mb-1">
                  Core Implementation Files
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {docModal.feature.coreFiles.map((f, i) => (
                    <div
                      key={i}
                      className="p-1.5 rounded bg-black/30 font-mono text-foreground/80 text-[11px]"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDocModal(null)}
                className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium transition-colors"
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
