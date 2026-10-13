import { useState, useEffect, useRef, useMemo } from "react";
import {
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Code2,
  Eye,
  Columns,
  AlertCircle,
  FileCode,
} from "lucide-react";
import mermaid from "mermaid";

export interface MermaidViewerProps {
  diagramId: string;
  title: string;
  code: string;
  className?: string;
}

// Global Mermaid configuration (dark theme optimized for CBM UI)
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  themeVariables: {
    darkMode: true,
    background: "#090d16",
    primaryColor: "#0284c7",
    primaryTextColor: "#f8fafc",
    primaryBorderColor: "#38bdf8",
    lineColor: "#64748b",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    mainBkg: "#0f172a",
    nodeBorder: "#38bdf8",
    clusterBkg: "#0c1524",
    clusterBorder: "#1e293b",
    titleColor: "#38bdf8",
    edgeLabelBackground: "#0b1322",
    actorBkg: "#0f172a",
    actorBorder: "#38bdf8",
    actorTextColor: "#f8fafc",
    actorLineColor: "#64748b",
    signalColor: "#38bdf8",
    signalTextColor: "#f8fafc",
    labelBoxBkgColor: "#1e293b",
    labelBoxBorderColor: "#38bdf8",
    labelTextColor: "#f8fafc",
    loopTextColor: "#f8fafc",
    noteBorderColor: "#38bdf8",
    noteBkgColor: "#0f172a",
    noteTextColor: "#f8fafc",
  },
  fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
});

export function MermaidViewer({
  diagramId,
  title,
  code,
  className = "",
}: MermaidViewerProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code" | "split">("preview");
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [downloadingSvg, setDownloadingSvg] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Render diagram whenever code or diagramId changes
  useEffect(() => {
    let cancelled = false;
    setIsRendering(true);
    setError(null);

    const cleanCode = (code || "").trim();
    if (!cleanCode) {
      setError("No Mermaid AST code provided for this diagram.");
      setIsRendering(false);
      return;
    }

    const render = async () => {
      try {
        const renderId = `m_${diagramId.replace(/[^a-zA-Z0-9]/g, "")}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const { svg } = await mermaid.render(renderId, cleanCode);
        if (!cancelled) {
          setSvgHtml(svg);
          setIsRendering(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn("Mermaid AST render notice:", err);
          setError(err?.message || "Failed to render Mermaid diagram.");
          setIsRendering(false);
        }
      } finally {
        // Clean up temporary DOM nodes injected by mermaid if any
        document.querySelectorAll(`[id^="d${diagramId}"]`).forEach((el) => el.remove());
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [diagramId, code]);

  // Diagram metadata & line analysis
  const lines = useMemo(() => (code ? code.split("\n") : []), [code]);
  const diagramType = useMemo(() => {
    const firstNonEmpty = lines.find((l) => l.trim().length > 0) || "";
    const trimmed = firstNonEmpty.trim();
    if (trimmed.startsWith("sequenceDiagram")) return "Sequence Diagram";
    if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) return "Flowchart / Graph";
    if (trimmed.startsWith("classDiagram")) return "Class Diagram";
    if (trimmed.startsWith("stateDiagram")) return "State Diagram";
    if (trimmed.startsWith("erDiagram")) return "Entity Relationship";
    return "Mermaid AST";
  }, [lines]);

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMermaid = () => {
    if (!code) return;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${diagramId}.mermaid`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    setDownloadingSvg(true);
    const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${diagramId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloadingSvg(false), 1000);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoom(1);

  return (
    <div
      title={title}
      data-testid="mermaid-viewer"
      className={`h-full flex flex-col bg-[#090d16] text-foreground select-text ${className}`}
    >
      {/* Sub-toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-[#0c121d] border-b border-border/30 shrink-0 text-xs">
        {/* Left: View Mode Toggles */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-border/30">
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === "preview"
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
            title="Rendered visual SVG diagram"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual Diagram</span>
          </button>

          <button
            onClick={() => setViewMode("code")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === "code"
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
            title="Raw Mermaid AST specification code"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Mermaid AST Code</span>
          </button>

          <button
            onClick={() => setViewMode("split")}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === "split"
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
            title="Side-by-side visual preview and AST code"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>
        </div>

        {/* Center: Diagram Type & Metrics */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
            {diagramType}
          </span>
          <span className="text-border">|</span>
          <span>{lines.length} lines</span>
          <span className="text-border">|</span>
          <span>{code.length} chars</span>
        </div>

        {/* Right: Zoom & Export Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls (Active in preview or split mode) */}
          {(viewMode === "preview" || viewMode === "split") && svgHtml && (
            <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded-lg border border-border/30 font-mono text-[11px]">
              <button
                onClick={handleZoomOut}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded text-[10.5px]"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded"
                title="Reset Zoom to 100%"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Download SVG */}
          {svgHtml && (
            <button
              onClick={handleDownloadSvg}
              disabled={downloadingSvg}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground border border-border/30 text-[11px] transition-all"
              title="Download rendered vector SVG"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">SVG</span>
            </button>
          )}

          {/* Copy AST Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[11px] font-medium transition-all"
            title="Copy raw Mermaid AST to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy AST</span>
              </>
            )}
          </button>

          {/* Download .mermaid File */}
          <button
            onClick={handleDownloadMermaid}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground border border-border/30 text-[11px] transition-all"
            title="Download .mermaid file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.mermaid</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-0 relative flex overflow-hidden">
        {/* Render Error Alert (if any) */}
        {error && (
          <div className="absolute top-3 left-6 right-6 z-20 flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shadow-lg backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <span className="font-semibold">Mermaid AST Compilation Notice: </span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setViewMode("code")}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-medium text-[11px] text-amber-200 border border-amber-500/30"
            >
              View Raw AST
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isRendering && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#090d16]/80 backdrop-blur-sm gap-3">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground font-mono">
              Compiling Mermaid AST graph...
            </p>
          </div>
        )}

        {/* 1. Visual Preview Mode */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            ref={containerRef}
            className={`flex-1 h-full overflow-auto p-6 md:p-10 flex items-center justify-center ${
              viewMode === "split" ? "border-r border-border/30" : ""
            }`}
            style={{
              backgroundImage:
                "radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {svgHtml ? (
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.12s ease-out",
                }}
                className="max-w-full flex items-center justify-center filter drop-shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : !isRendering && error ? (
              <div className="text-center p-8 max-w-md">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Unable to render graphical preview
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  The diagram definition could not be synthesized to SVG vector paths. You can inspect
                  the raw Mermaid AST source code directly.
                </p>
                <button
                  onClick={() => setViewMode("code")}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Switch to Mermaid AST Code
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* 2. AST Code View Mode */}
        {(viewMode === "code" || viewMode === "split") && (
          <div
            className={`flex-1 h-full flex flex-col bg-[#070b12] overflow-hidden ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            {/* AST Code Header */}
            <div className="px-5 py-2.5 bg-[#0a101a] border-b border-border/20 flex items-center justify-between text-xs text-muted-foreground font-mono shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">
                  {diagramId}.mermaid
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10">
                  AST Source
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span>UTF-8</span>
                <span>{lines.length} lines</span>
              </div>
            </div>

            {/* Code Body with Line Numbers */}
            <div className="flex-1 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">
              <div className="flex min-w-full">
                {/* Line Numbers Gutter */}
                <div className="pr-4 select-none text-right text-muted-foreground/40 font-mono text-xs border-r border-border/20 shrink-0">
                  {lines.map((_, idx) => (
                    <div key={idx} className="h-6 leading-6">
                      {idx + 1}
                    </div>
                  ))}
                </div>

                {/* Code Content */}
                <pre className="pl-4 m-0 text-slate-200 overflow-x-auto select-text font-mono text-xs flex-1">
                  {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    const isKeyword =
                      trimmed.startsWith("graph") ||
                      trimmed.startsWith("flowchart") ||
                      trimmed.startsWith("sequenceDiagram") ||
                      trimmed.startsWith("subgraph") ||
                      trimmed.startsWith("end") ||
                      trimmed.startsWith("participant") ||
                      trimmed.startsWith("activate") ||
                      trimmed.startsWith("deactivate") ||
                      trimmed.startsWith("actor");
                    const isComment = trimmed.startsWith("%%");

                    return (
                      <div
                        key={idx}
                        className={`h-6 leading-6 whitespace-pre ${
                          isComment
                            ? "text-muted-foreground/60 italic"
                            : isKeyword
                            ? "text-sky-400 font-semibold"
                            : line.includes("-->") || line.includes("->>")
                            ? "text-emerald-300"
                            : "text-slate-200"
                        }`}
                      >
                        {line || " "}
                      </div>
                    );
                  })}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
