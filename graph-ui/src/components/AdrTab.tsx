import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Edit3,
  Eye,
  Save,
  Trash2,
  Copy,
  Check,
  FolderGit2,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useUiMessages } from "../lib/i18n";

interface AdrTabProps {
  selectedProject: string | null;
  onSelectProject?: (project: string) => void;
}

interface ProjectItem {
  name: string;
  root_path?: string;
  branch?: string;
}

const DEFAULT_ADR_TEMPLATE = `# Architecture Decision Record: [Decision Title]

## Status
Accepted

## Context
What problem or context prompted this architectural decision?
What requirements, constraints, and alternatives were considered?

## Decision
What is the change or architecture design being adopted?
Describe the technical approach and components involved.

## Consequences
### Positive
- Benefits and improvements achieved

### Negative / Trade-offs
- Added complexity or constraints to manage
`;

export function AdrTab({ selectedProject, onSelectProject }: AdrTabProps) {
  const t = useUiMessages();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [hasAdr, setHasAdr] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fallback project list when no project is selected */
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  /* Fetch project list if no project is active */
  useEffect(() => {
    if (selectedProject) return;
    setLoadingProjects(true);
    fetch("/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_projects", arguments: { format: "json" } },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const text = data?.result?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.projects)) {
            setProjectsList(parsed.projects);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, [selectedProject]);

  const fetchAdr = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/adr?project=${encodeURIComponent(selectedProject)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const existing = data.has_adr ?? false;
      const initial = data.content || (existing ? "" : DEFAULT_ADR_TEMPLATE);
      setHasAdr(existing);
      setContent(initial);
      setSavedContent(initial);
      setUpdatedAt(data.updated_at || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ADR");
      setHasAdr(false);
      setContent(DEFAULT_ADR_TEMPLATE);
      setSavedContent(DEFAULT_ADR_TEMPLATE);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    void fetchAdr();
  }, [fetchAdr]);

  const save = async () => {
    if (!selectedProject) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/adr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: selectedProject, content }),
      });
      if (!res.ok) throw new Error(`Failed to save ADR (${res.status})`);
      setSavedContent(content);
      setHasAdr(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      await fetchAdr();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save ADR");
    } finally {
      setSaving(false);
    }
  };

  const deleteAdr = async () => {
    if (!selectedProject) return;
    if (!confirm(`Delete Architecture Decision Record for "${selectedProject}"?`)) return;
    setSaving(true);
    try {
      await fetch("/api/adr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: selectedProject, content: "" }),
      });
      setContent(DEFAULT_ADR_TEMPLATE);
      setSavedContent(DEFAULT_ADR_TEMPLATE);
      setHasAdr(false);
      setUpdatedAt("");
    } catch {
      setError("Failed to delete ADR");
    } finally {
      setSaving(false);
    }
  };

  const copyMarkdown = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = content !== savedContent;

  /* Render simple formatted preview */
  const renderPreview = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="prose prose-invert max-w-none space-y-3 font-sans text-sm leading-relaxed text-foreground/85">
        {lines.map((line, idx) => {
          if (line.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-xl font-bold text-foreground border-b border-border/40 pb-2 mt-4 mb-2">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-base font-semibold text-primary mt-4 mb-1">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-sm font-semibold text-foreground/90 mt-3 mb-1">
                {line.slice(4)}
              </h3>
            );
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <li key={idx} className="ml-5 list-disc text-foreground/80">
                {line.slice(2)}
              </li>
            );
          }
          if (line.trim() === "") {
            return <div key={idx} className="h-2" />;
          }
          return (
            <p key={idx} className="text-foreground/75 leading-relaxed">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  /* Empty State when no project is selected */
  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4 shadow-lg shadow-primary/5">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Architecture Decision Records (ADR)
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-8">
          Document important technical decisions, rationale, context, and consequences alongside your codebase knowledge graph.
        </p>

        <div className="w-full max-w-xl text-left bg-card/40 border border-border/40 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select a project to inspect or create an ADR:
            </span>
            {loadingProjects && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          {projectsList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {projectsList.map((p) => (
                <button
                  key={p.name}
                  onClick={() => onSelectProject?.(p.name)}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] hover:bg-primary/15 border border-border/30 hover:border-primary/40 text-left transition-all group"
                >
                  <FolderGit2 className="w-4 h-4 text-primary/70 group-hover:text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary">
                      {p.name}
                    </p>
                    {p.branch && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {p.branch}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 py-4 text-center">
              No indexed projects found. Index a repository in the Projects tab first.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-border/40 px-6 py-3.5 flex items-center justify-between bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                Architecture Decision Record (ADR)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-primary/15 text-primary border border-primary/25">
                {selectedProject}
              </span>
              {hasAdr ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Documented
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  Template Draft
                </span>
              )}
            </div>
            {updatedAt && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-muted-foreground/70" />
                {t.adr.lastUpdated}: {updatedAt}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border/40 bg-white/[0.03] p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === "edit"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === "preview"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>

          <button
            onClick={copyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-white/[0.03] hover:bg-white/[0.07] text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            title="Copy Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>

          {hasAdr && (
            <button
              onClick={deleteAdr}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/15 text-xs font-medium text-destructive transition-all"
              title="Delete ADR"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}

          <button
            onClick={save}
            disabled={Boolean(saving || (!isDirty && hasAdr))}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
              justSaved
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : isDirty || !hasAdr
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-primary/20"
                  : "bg-white/[0.05] text-muted-foreground/50 border border-border/30 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : justSaved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? t.common.saving : justSaved ? "Saved!" : t.common.save}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 p-6 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            Loading ADR...
          </div>
        ) : mode === "edit" ? (
          <div className="flex-1 flex flex-col rounded-xl border border-border/40 bg-card/20 overflow-hidden shadow-inner">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={DEFAULT_ADR_TEMPLATE}
              className="flex-1 p-5 bg-transparent text-sm font-mono text-foreground placeholder-muted-foreground/30 outline-none resize-none leading-relaxed selection:bg-primary/30"
              spellCheck={false}
            />
            <div className="px-4 py-2 border-t border-border/20 bg-black/20 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>Markdown • Press Ctrl+S to save</span>
              <span>{content.length.toLocaleString()} characters • {content.split("\n").length} lines</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto rounded-xl border border-border/40 bg-card/20 p-8 shadow-inner">
            {content.trim() ? (
              renderPreview(content)
            ) : (
              <p className="text-muted-foreground/40 italic text-center py-12">
                Empty Architecture Decision Record
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
