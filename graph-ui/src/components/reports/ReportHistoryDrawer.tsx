import { History, X, GitBranch, ArrowRight } from "lucide-react";
import type { RepositoryAnalysisReport } from "../../lib/types";

interface ReportHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reports: RepositoryAnalysisReport[];
  currentReportId: string | null;
  compareReportId: string | null;
  onSelectReport: (report: RepositoryAnalysisReport) => void;
  onSelectCompare: (report: RepositoryAnalysisReport | null) => void;
}

export function ReportHistoryDrawer({
  isOpen,
  onClose,
  reports,
  currentReportId,
  compareReportId,
  onSelectReport,
  onSelectCompare,
}: ReportHistoryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md h-full bg-card border-l border-border p-6 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Snapshot History</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Historical repository analysis snapshots saved locally or imported from CI runs.
        </p>

        {/* Snapshots List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No historical snapshots saved yet. Run an analysis or import a report file.
            </div>
          ) : (
            reports.map((r) => {
              const isCurrent = r.report_id === currentReportId;
              const isComparing = r.report_id === compareReportId;
              const score = r.scores?.overall ?? 0;
              const grade = r.scores?.grade ?? "C";
              const gradeColor =
                score >= 85 ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30" : score >= 70 ? "text-sky-400 bg-sky-950/40 border-sky-500/30" : "text-amber-400 bg-amber-950/40 border-amber-500/30";

              return (
                <div
                  key={r.report_id}
                  className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                    isCurrent
                      ? "border-primary/60 bg-primary/5"
                      : isComparing
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-border/60 bg-secondary/30 hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-medium text-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                            Viewing
                          </span>
                        )}
                        {isComparing && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Baseline
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {r.git_branch || "main"}
                        </span>
                        <span>•</span>
                        <span>{r.preset || "comprehensive"}</span>
                      </div>
                    </div>

                    <div className={`px-2 py-0.5 rounded text-center font-mono font-bold border ${gradeColor}`}>
                      {score} ({grade})
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/20">
                    <button
                      onClick={() => onSelectReport(r)}
                      disabled={isCurrent}
                      className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
                        isCurrent
                          ? "text-muted-foreground cursor-default"
                          : "text-primary hover:text-primary/80"
                      }`}
                    >
                      {isCurrent ? "Active Report" : "Load Report"}
                      {!isCurrent && <ArrowRight className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => onSelectCompare(isComparing ? null : r)}
                      disabled={isCurrent}
                      className={`text-[11px] transition-colors ${
                        isCurrent
                          ? "opacity-0 pointer-events-none"
                          : isComparing
                          ? "text-amber-400 font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isComparing ? "Remove Baseline" : "Compare with This"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-border/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
