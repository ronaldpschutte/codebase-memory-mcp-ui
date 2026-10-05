import { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolCallRecord } from "../lib/types";
import { useUiMessages } from "../lib/i18n";

const SENSITIVE_KEY_REGEX = /token|password|secret|authorization|api_key|apikey/i;

function maskSensitiveParams(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveParams);
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key) && typeof val === "string") {
      result[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      result[key] = maskSensitiveParams(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getKeyParamBadge(tool: string, params: Record<string, unknown> | undefined): string | null {
  if (!params || typeof params !== "object") return null;

  if (tool === "search_graph" && typeof params.query === "string") {
    return `query: "${params.query}"`;
  }
  if (tool === "analyze_blast_radius" && typeof params.target === "string") {
    return `target: "${params.target}"`;
  }
  if (tool === "get_code_snippet" && typeof params.qualified_name === "string") {
    return `qn: "${params.qualified_name}"`;
  }
  if (tool === "check_index_coverage") {
    if (Array.isArray(params.paths)) {
      return `paths: ${params.paths.length}`;
    }
    if (typeof params.scope === "string") {
      return `scope: "${params.scope}"`;
    }
  }
  if (tool === "trace_path" && typeof params.function_name === "string") {
    return `fn: "${params.function_name}"`;
  }
  if ((tool === "find_code_clones" || tool === "get_coupled_files" || tool === "trace_error_flow") &&
      typeof params.target === "string") {
    return `target: "${params.target}"`;
  }
  if (typeof params.target === "string") {
    return `target: "${params.target}"`;
  }
  if (typeof params.project === "string") {
    return `project: "${params.project}"`;
  }
  if (typeof params.query === "string") {
    return `query: "${params.query}"`;
  }
  if (typeof params.symbol === "string") {
    return `symbol: "${params.symbol}"`;
  }
  return null;
}

export function ToolCallLogViewer() {
  const t = useUiMessages();
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "error">("all");
  const [isPaused, setIsPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchToolCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/tool-calls?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setToolCalls(data.tool_calls ?? []);
      setTotalCount(data.total ?? 0);
    } catch {
      /* ignore background fetch errors */
    }
  }, []);

  useEffect(() => {
    fetchToolCalls();
    if (isPaused) return;

    const interval = setInterval(fetchToolCalls, 2500);
    return () => clearInterval(interval);
  }, [fetchToolCalls, isPaused]);

  const handleClear = async () => {
    try {
      await fetch("/api/tool-calls", { method: "DELETE" });
      setToolCalls([]);
      setTotalCount(0);
      setExpandedId(null);
    } catch {
      /* ignore */
    }
  };

  const handleCopyParams = (id: number, params: Record<string, unknown>) => {
    const masked = maskSensitiveParams(params);
    const text = JSON.stringify(masked, null, 2);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const filteredCalls = useMemo(() => {
    return toolCalls.filter((call) => {
      // Status filter
      if (statusFilter === "ok" && call.is_error) return false;
      if (statusFilter === "error" && !call.is_error) return false;

      // Text filter
      if (filterText.trim()) {
        const query = filterText.toLowerCase();
        const matchesTool = call.tool.toLowerCase().includes(query);
        const matchesProject = call.project?.toLowerCase().includes(query);
        const matchesParams = JSON.stringify(call.params ?? {}).toLowerCase().includes(query);
        return matchesTool || matchesProject || matchesParams;
      }
      return true;
    });
  }, [toolCalls, statusFilter, filterText]);

  return (
    <div className="rounded-xl border border-border/30 bg-black/30 overflow-hidden shadow-lg shadow-black/20">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-border/20 flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary/70 animate-pulse" />
          <h3 className="text-[12px] font-semibold text-foreground/80 tracking-wide">
            {t.control.toolCallLog}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground/40 font-mono">
            {filteredCalls.length} / {totalCount || toolCalls.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={fetchToolCalls}
            title={t.common.refresh}
            className="px-2 py-1 rounded-md text-[11px] text-foreground/50 hover:text-foreground/90 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
          >
            ⟳
          </button>

          {/* Pause / Resume toggle */}
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPaused
                ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30"
                : "bg-white/[0.04] text-foreground/60 hover:text-foreground/90 hover:bg-white/[0.08]"
            }`}
          >
            {isPaused ? t.control.resumePolling : t.control.pausePolling}
          </button>

          {/* Clear Log button */}
          <button
            onClick={handleClear}
            className="px-2.5 py-1 rounded-md text-[11px] text-red-400/70 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
          >
            {t.control.clearToolCalls}
          </button>
        </div>
      </div>

      {/* Filter and controls bar */}
      <div className="px-4 py-2 border-b border-border/15 flex flex-wrap items-center justify-between gap-3 bg-white/[0.005]">
        {/* Search Input */}
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t.control.filterTools}
            className="w-full text-[11px] bg-white/[0.03] border border-border/30 rounded-lg px-3 py-1.5 text-foreground/80 placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Status Toggle Pills */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-border/20 text-[11px]">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-0.5 rounded-md transition-colors ${
              statusFilter === "all"
                ? "bg-white/[0.12] text-foreground font-medium"
                : "text-foreground/40 hover:text-foreground/70"
            }`}
          >
            {t.control.allStatus}
          </button>
          <button
            onClick={() => setStatusFilter("ok")}
            className={`px-2.5 py-0.5 rounded-md flex items-center gap-1.5 transition-colors ${
              statusFilter === "ok"
                ? "bg-emerald-500/20 text-emerald-300 font-medium"
                : "text-foreground/40 hover:text-foreground/70"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t.control.successOnly}
          </button>
          <button
            onClick={() => setStatusFilter("error")}
            className={`px-2.5 py-0.5 rounded-md flex items-center gap-1.5 transition-colors ${
              statusFilter === "error"
                ? "bg-red-500/20 text-red-300 font-medium"
                : "text-foreground/40 hover:text-foreground/70"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {t.control.errorOnly}
          </button>
        </div>
      </div>

      {/* Calls List */}
      <ScrollArea className="max-h-[460px]">
        <div className="divide-y divide-border/10">
          {filteredCalls.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[12px] text-foreground/25 font-medium">{t.control.noToolCalls}</p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isExpanded = expandedId === call.id;
              const keyBadge = getKeyParamBadge(call.tool, call.params);
              const isCopied = copiedId === call.id;

              return (
                <div key={call.id} className="transition-colors hover:bg-white/[0.015]">
                  {/* Summary row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : call.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setExpandedId(isExpanded ? null : call.id);
                      }
                    }}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Status badge */}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                          call.is_error
                            ? "bg-red-500/15 text-red-400 border border-red-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {call.is_error ? "ERR" : "OK"}
                      </span>

                      {/* Tool name */}
                      <span className="font-mono text-[12px] font-semibold text-foreground/90 truncate">
                        {call.tool}
                      </span>

                      {/* Key parameter summary badge */}
                      {keyBadge && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-foreground/50 font-mono truncate max-w-[280px]">
                          {keyBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Latency */}
                      <span
                        className={`text-[11px] font-mono tabular-nums ${
                          call.duration_ms < 50
                            ? "text-emerald-400/80"
                            : call.duration_ms < 200
                            ? "text-yellow-400/80"
                            : "text-orange-400/90"
                        }`}
                      >
                        {call.duration_ms.toFixed(1)}ms
                      </span>

                      {/* Timestamp */}
                      <span className="text-[10px] text-foreground/30 font-mono hidden sm:inline">
                        {call.timestamp ? call.timestamp.split("T")[1]?.slice(0, 8) : ""}
                      </span>

                      {/* Expand chevron */}
                      <span className="text-[10px] text-foreground/30 transition-transform">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Accordion Details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-border/10 bg-black/40">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-[10px] text-foreground/40 font-mono">
                          <span>{t.control.params}</span>
                          <span>•</span>
                          <span>{call.response_bytes ?? 0} bytes response</span>
                          {call.project && (
                            <>
                              <span>•</span>
                              <span>project: {call.project}</span>
                            </>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyParams(call.id, call.params ?? {});
                          }}
                          className={`text-[10px] px-2.5 py-1 rounded font-medium transition-all ${
                            isCopied
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/[0.05] hover:bg-white/[0.1] text-foreground/70 hover:text-foreground"
                          }`}
                        >
                          {isCopied ? t.control.copied : t.control.copyParams}
                        </button>
                      </div>

                      {/* JSON Parameters viewer */}
                      <pre className="bg-black/60 border border-white/[0.06] rounded-lg p-3 font-mono text-[11px] text-foreground/80 overflow-x-auto leading-relaxed max-h-[300px]">
                        {JSON.stringify(maskSensitiveParams(call.params ?? {}), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
