import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

interface ReportSectionCardProps {
  id: string;
  title: string;
  toolName: string;
  badge?: string;
  badgeColor?: string;
  data: any;
  defaultOpen?: boolean;
}

export function ReportSectionCard({
  id,
  title,
  toolName,
  badge,
  badgeColor = "text-sky-400 bg-sky-950/40 border-sky-500/30",
  data,
  defaultOpen = false,
}: ReportSectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden transition-colors">
      {/* Card Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-card/70 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-muted-foreground">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {title}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/80 bg-secondary/80 px-1.5 py-0.5 rounded border border-border/40">
                {toolName}
              </span>
              {badge && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground/60">
            {isOpen ? "Collapse" : "Expand"}
          </span>
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-5 py-4 border-t border-border/40 bg-card/20 space-y-4">
          {/* Section 1: Test Coverage */}
          {id === "test_coverage" && (
            <div className="space-y-3">
              {data.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/30">
                    <div className="text-xs text-muted-foreground">Prod Functions</div>
                    <div className="text-base font-semibold font-mono text-foreground mt-0.5">
                      {data.summary.total_production_functions ?? "-"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/30">
                    <div className="text-xs text-muted-foreground">Tested Functions</div>
                    <div className="text-base font-semibold font-mono text-emerald-400 mt-0.5">
                      {data.summary.tested_production_functions ?? "-"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/30">
                    <div className="text-xs text-muted-foreground">Untested Entry Points</div>
                    <div className="text-base font-semibold font-mono text-amber-400 mt-0.5">
                      {data.summary.untested_entry_points ?? "-"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/30">
                    <div className="text-xs text-muted-foreground">Coverage</div>
                    <div className="text-base font-semibold font-mono text-primary mt-0.5">
                      {data.coverage_percentage ? `${data.coverage_percentage}%` : "-"}
                    </div>
                  </div>
                </div>
              )}

              {Array.isArray(data.critical_untested_symbols) && data.critical_untested_symbols.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Critical Untested Entry Points
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {data.critical_untested_symbols.slice(0, 10).map((sym: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-md bg-secondary/40 border border-border/30 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono font-medium text-foreground truncate block">
                            {sym.qualified_name || sym.symbol}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground truncate block">
                            {sym.file_path}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400 shrink-0">
                          {sym.inbound_callers_count ?? sym.callers ?? 0} callers
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Code Clones */}
          {id === "code_clones" && (
            <div className="space-y-2">
              {Array.isArray(data.clone_clusters || data.clusters || data.clones) && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(data.clone_clusters || data.clusters || data.clones).map((cl: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-secondary/40 border border-border/30 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-foreground truncate">
                          {cl.representative_symbol || cl.symbol || "Clone Cluster"}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/30">
                          {cl.instance_count || (cl.files_involved?.length) || 2} occurrences
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {cl.description || "Duplicated logic block detected across multiple files."}
                      </p>
                      {Array.isArray(cl.files_involved) && (
                        <div className="text-[10px] font-mono text-muted-foreground/80 flex flex-wrap gap-1 pt-0.5">
                          {cl.files_involved.map((f: string, fi: number) => (
                            <span key={fi} className="px-1 py-0.5 rounded bg-background/50 border border-border/20">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Dead Code */}
          {id === "dead_code" && (
            <div className="space-y-2">
              {Array.isArray(data.dead_symbols || data.unreferenced_symbols) && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(data.dead_symbols || data.unreferenced_symbols).map((d: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md bg-secondary/40 border border-border/30 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-medium text-foreground truncate block">
                          {d.name || d.symbol}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate block">
                          {d.file_path}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary shrink-0">
                        {d.type || "symbol"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 4: Blast Radius */}
          {id === "blast_radius" && (
            <div className="space-y-2">
              {Array.isArray(data.high_impact_nodes || data.hotspots) && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(data.high_impact_nodes || data.hotspots).map((node: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md bg-secondary/40 border border-border/30 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-medium text-foreground truncate block">
                          {node.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate block">
                          {node.file_path}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-red-400 shrink-0">
                        {node.downstream_count || 0} downstream callees
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 5: Coupling */}
          {id === "coupled_files" && (
            <div className="space-y-2">
              {Array.isArray(data.coupled_pairs || data.pairs) && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(data.coupled_pairs || data.pairs).map((pair: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-secondary/40 border border-border/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-foreground">
                          {pair.file_a} ↔ {pair.file_b}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                          {pair.co_change_pct || 75}% co-change
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 6: API Surface */}
          {id === "api_surface" && (
            <div className="space-y-2">
              {Array.isArray(data.ingress_routes || data.endpoints) && (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {(data.ingress_routes || data.endpoints).slice(0, 15).map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md bg-secondary/40 border border-border/30 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                          {r.method || "ANY"}
                        </span>
                        <span className="text-foreground truncate">{r.url_path || r.path}</span>
                      </div>
                      {r.handler_symbol && (
                        <span className="text-muted-foreground text-[11px] truncate max-w-[150px]">
                          {r.handler_symbol}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Raw JSON copy footer */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleCopy}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "JSON Copied" : "Copy Raw JSON"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
