import { useState } from "react";
import { Copy, Check, Download, FileText, X } from "lucide-react";
import type { RepositoryAnalysisReport } from "../../lib/types";
import { generateMarkdownReport } from "./storage";

interface ExportModalProps {
  report: RepositoryAnalysisReport;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ report, isOpen, onClose }: ExportModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const markdownText = generateMarkdownReport(report);
  const jsonText = JSON.stringify(report, null, 2);

  const summaryText = [
    `📊 Repository Health Report: ${report.project}`,
    `Score: ${report.scores.overall}/100 (${report.scores.grade}) | Test Coverage: ${report.scores.test_coverage}% | Hygiene: ${report.scores.hygiene}/100`,
    `Top Fix-First item: #${report.fix_first[0]?.rank ?? 1} ${report.fix_first[0]?.symbol ?? "None"} (Risk: ${report.fix_first[0]?.risk_score ?? 0})`,
    `Snapshot: ${report.report_id} (${new Date(report.created_at).toLocaleString()})`
  ].join("\n");

  const handleCopy = (text: string, type: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownload = (text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Export Repository Report</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Markdown Card */}
          <div className="p-3.5 rounded-lg border border-border/50 bg-secondary/30 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">GitHub-Flavored Markdown (.md)</div>
              <div className="text-[11px] text-muted-foreground">Formatted tables and alerts for PR descriptions or issues</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(markdownText, "markdown")}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 flex items-center gap-1 transition-colors"
              >
                {copiedType === "markdown" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === "markdown" ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => handleDownload(markdownText, `${report.project}-report.md`, "text/markdown")}
                className="p-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 transition-colors"
                title="Download .md"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* JSON Card */}
          <div className="p-3.5 rounded-lg border border-border/50 bg-secondary/30 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">Raw Machine JSON (.json)</div>
              <div className="text-[11px] text-muted-foreground">Complete schema payload for CI pipelines or external dashboards</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(jsonText, "json")}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 flex items-center gap-1 transition-colors"
              >
                {copiedType === "json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === "json" ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => handleDownload(jsonText, `${report.project}-report.json`, "application/json")}
                className="p-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 transition-colors"
                title="Download .json"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 5-line Slack / Chat Summary */}
          <div className="p-3.5 rounded-lg border border-border/50 bg-secondary/30 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">Executive Chat Summary</div>
              <div className="text-[11px] text-muted-foreground">Concise 4-line summary for Slack, Discord, or Teams</div>
            </div>
            <button
              onClick={() => handleCopy(summaryText, "summary")}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 flex items-center gap-1 transition-colors"
            >
              {copiedType === "summary" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === "summary" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
