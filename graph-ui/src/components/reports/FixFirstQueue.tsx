import { useState } from "react";
import { Check, Copy, Flame, ArrowRight } from "lucide-react";
import type { FixFirstItem } from "../../lib/types";

interface FixFirstQueueProps {
  items: FixFirstItem[];
}

export function FixFirstQueue({ items }: FixFirstQueueProps) {
  const [copiedRank, setCopiedRank] = useState<number | null>(null);

  const handleCopy = (item: FixFirstItem) => {
    const text = `[Fix-First #${item.rank}] Risk: ${item.risk_score} | ${item.symbol} (${item.file_path})\nAction: ${item.recommended_action}\nReasons: ${item.reasons.join("; ")}`;
    void navigator.clipboard.writeText(text);
    setCopiedRank(item.rank);
    setTimeout(() => setCopiedRank(null), 2000);
  };

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-muted-foreground text-sm">
        🎉 No high-risk items detected in this repository snapshot.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              ⚡ Top "Fix First" Priority Action Items
            </h2>
            <p className="text-xs text-muted-foreground">
              Highest-impact risks ranked by composite blast radius, lack of test coverage, and duplication
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary border border-border/40 text-muted-foreground">
          {items.length} items queued
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {items.map((item) => {
          const isExtreme = item.risk_score >= 85;
          const isHigh = item.risk_score >= 70;
          const riskColor = isExtreme ? "text-red-400 bg-red-950/40 border-red-500/40" : isHigh ? "text-orange-400 bg-orange-950/40 border-orange-500/40" : "text-yellow-400 bg-yellow-950/40 border-yellow-500/40";

          return (
            <div
              key={item.rank}
              className="group relative rounded-lg border border-border/60 bg-card/50 hover:bg-card/80 p-3.5 transition-all duration-200 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Rank & Risk */}
                <div className="flex flex-col items-center justify-center shrink-0 w-12 text-center">
                  <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                    #{item.rank}
                  </span>
                  <div className={`mt-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${riskColor}`}>
                    {item.risk_score}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[400px]">
                      {item.symbol}
                    </span>
                    {item.file_path && (
                      <span className="text-[11px] font-mono text-muted-foreground/80 bg-secondary/60 px-1.5 py-0.5 rounded border border-border/30 truncate max-w-[280px]">
                        {item.file_path}
                      </span>
                    )}
                  </div>

                  {/* Reasons */}
                  <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                    {item.reasons.map((r, i) => (
                      <li key={i} className="flex items-center gap-1.5 truncate">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
                        <span className="truncate">{r}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Action recommendation */}
                  <div className="flex items-center gap-1.5 text-xs text-primary/90 font-medium pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <span>{item.recommended_action}</span>
                  </div>
                </div>
              </div>

              {/* Copy button */}
              <button
                onClick={() => handleCopy(item)}
                title="Copy action item"
                className="self-start sm:self-center p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground border border-transparent hover:border-border/60 transition-colors shrink-0"
              >
                {copiedRank === item.rank ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
