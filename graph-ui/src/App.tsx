import { useCallback, useEffect, useRef, useState } from "react";
import { GraphTab } from "./components/GraphTab";
import { StatsTab } from "./components/StatsTab";
import { ControlTab } from "./components/ControlTab";
import { DiagramsTab } from "./components/DiagramsTab";
import { FeaturesTab } from "./components/FeaturesTab";
import { ToolsTab } from "./components/ToolsTab";
import { ReadinessTab } from "./components/ReadinessTab";
import { ReportsTab } from "./components/reports/ReportsTab";
import { AdrTab } from "./components/AdrTab";
import type { TabId } from "./lib/types";
import { useUiMessages } from "./lib/i18n";
import {
  FolderGit2,
  ChevronDown,
  Check,
  X,
  CheckSquare,
  Square,
  Crosshair,
} from "lucide-react";

const TAB_IDS: TabId[] = [
  "stats",
  "tools",
  "control",
  "graph",
  "reports",
  "readiness",
  "diagrams",
  "features",
  "adr",
];

interface RouteState {
  tab: TabId;
  projects: string[];
  diagram: string | null;
}

interface ProjectHeaderItem {
  name: string;
  root_path?: string;
  branch?: string;
}

/* Read the active tab + selected projects + diagram from the URL query string so the
 * current view survives refreshes and can be bookmarked or shared. */
function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab");
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : "stats";
  const diagram = params.get("diagram");

  let projects: string[] = [];
  const projectsParam = params.get("projects");
  const singleProjectParam = params.get("project");

  if (projectsParam) {
    projects = projectsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (singleProjectParam && singleProjectParam.trim() !== "") {
    projects = [singleProjectParam.trim()];
  }

  return { tab, projects, diagram };
}

/* Build the canonical URL for a route, preserving the path and hash. */
function routeUrl(
  tab: TabId,
  projects: string[] | string | null,
  diagram: string | null = null
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);

  const projArr: string[] = Array.isArray(projects)
    ? projects.filter(Boolean)
    : projects && typeof projects === "string" && projects.trim() !== ""
    ? [projects.trim()]
    : [];

  if (projArr.length > 0) {
    params.set("projects", projArr.join(","));
  }
  if (diagram && tab === "diagrams") {
    params.set("diagram", diagram);
  }
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

export function App() {
  const t = useUiMessages();
  const [route, setRoute] = useState<RouteState>(readRoute);
  const [version, setVersion] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectHeaderItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { tab: activeTab, projects: selectedProjects, diagram: activeDiagram } = route;
  const selectedProject = selectedProjects.length > 0 ? selectedProjects[0] : null;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ui-config")
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (!cancelled && typeof config?.version === "string" && config.version) {
          setVersion(config.version);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Fetch project list for persistent header switcher */
  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled && text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.projects)) {
            setProjects(parsed.projects);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Close dropdown on outside click or Escape */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  /* Normalize the URL on first load so it always carries the current route. */
  useEffect(() => {
    const initial = readRoute();
    window.history.replaceState(null, "", routeUrl(initial.tab, initial.projects, initial.diagram));
  }, []);

  /* Sync state when the user navigates with the browser back/forward buttons. */
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* Change the route and push a history entry (skips no-op navigations). */
  const navigate = useCallback(
    (
      tab: TabId,
      projects: string[] | string | null,
      diagram: string | null = null
    ) => {
      const projArr: string[] = Array.isArray(projects)
        ? projects.filter(Boolean)
        : projects && typeof projects === "string" && projects.trim() !== ""
        ? [projects.trim()]
        : [];
      const url = routeUrl(tab, projArr, diagram);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (url === current) return;
      window.history.pushState(null, "", url);
      setRoute({ tab, projects: projArr, diagram });
    },
    []
  );

  const globalTabs: { id: TabId; label: string }[] = [
    { id: "stats", label: t.tabs.projects },
    { id: "tools", label: t.tabs.tools },
    { id: "control", label: t.tabs.control },
  ];

  const projectTabs: { id: TabId; label: string }[] = [
    { id: "graph", label: t.tabs.graph },
    { id: "reports", label: t.tabs.reports },
    { id: "readiness", label: t.tabs.readiness },
    { id: "diagrams", label: t.tabs.diagrams },
    { id: "features", label: t.tabs.features || "Features" },
    { id: "adr", label: t.tabs.adr },
  ];

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-12 border-b border-border bg-[#0b1920]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-[7px] h-[7px] rounded-full bg-primary" />
            <span className="text-[13px] font-semibold text-foreground/90 tracking-tight">
              Codebase Memory
            </span>
            {version && (
              <span
                className="translate-y-px text-[10px] font-mono text-foreground/30"
                title="Server version"
              >
                {version.startsWith("v") ? version : `v${version}`}
              </span>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-0.5">
            {/* Global system tabs */}
            {globalTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id, selectedProjects)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Subtle separator between global and project tabs */}
            <div className="h-4 w-px bg-border/40 mx-1.5 self-center" />

            {/* Project-specific tabs (always active) */}
            {projectTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  const targetProjects =
                    selectedProjects.length > 0
                      ? selectedProjects
                      : projects.length > 0
                      ? [projects[0].name]
                      : [];
                  navigate(
                    tab.id,
                    targetProjects,
                    tab.id === "diagrams" ? activeDiagram : null
                  );
                }}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Header: Persistent Project Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                selectedProjects.length > 0
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/45"
                  : "bg-white/[0.03] border-border/40 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
              }`}
              title={
                selectedProjects.length > 0
                  ? `Active Project Scope: ${selectedProjects.join(", ")}`
                  : "Click to select projects (application-wide filter)"
              }
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 leading-none">
                  Project
                </span>
                <span className="text-[12px] font-mono font-medium truncate max-w-[180px]">
                  {selectedProjects.length === 0
                    ? "All Projects"
                    : selectedProjects.length === 1
                    ? selectedProjects[0]
                    : `${selectedProjects.length} Projects Selected`}
                </span>
              </div>
              {selectedProjects.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-mono font-semibold">
                  {selectedProjects.length}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-60 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {selectedProjects.length > 0 && (
              <button
                onClick={() =>
                  navigate(
                    activeTab === "graph" || activeTab === "adr" ? "stats" : activeTab,
                    []
                  )
                }
                className="p-1 rounded-lg border border-border/30 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground text-[12px] transition-colors"
                title="Clear project filter (switch to global view)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#0e2028] border border-border/50 shadow-2xl p-2 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
              {projects.length > 3 && (
                <div className="p-1 mb-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full px-2.5 py-1 text-xs bg-white/[0.04] border border-border/30 rounded-md outline-none text-foreground placeholder-muted-foreground/40 focus:border-primary/40 font-mono"
                    autoFocus
                  />
                </div>
              )}

              {/* Action row: Select All & Clear All */}
              <div className="flex items-center justify-between px-1.5 py-1 mb-1 text-[11px] text-muted-foreground/70">
                <button
                  type="button"
                  onClick={() => {
                    const allFiltered = filteredProjects.map((p) => p.name);
                    const merged = Array.from(new Set([...selectedProjects, ...allFiltered]));
                    navigate(activeTab, merged);
                  }}
                  className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
                >
                  <CheckSquare className="w-3 h-3" /> Select All ({filteredProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(activeTab, []);
                  }}
                  className="hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <Square className="w-3 h-3" /> Clear ({selectedProjects.length})
                </button>
              </div>

              {/* All Projects (Global) item */}
              <button
                onClick={() => {
                  navigate(
                    activeTab === "graph" || activeTab === "adr" ? "stats" : activeTab,
                    []
                  );
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors mb-1 ${
                  selectedProjects.length === 0
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  All Projects (Global)
                </span>
                {selectedProjects.length === 0 && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>

              <div className="h-px bg-border/30 my-1" />

              {/* Projects List with Checkboxes and Focus Action */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((p) => {
                    const isSelected = selectedProjects.includes(p.name);
                    return (
                      <div
                        key={p.name}
                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                          isSelected
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-foreground/80 hover:text-foreground hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer pr-1"
                          onClick={() => {
                            const next = isSelected
                              ? selectedProjects.filter((n) => n !== p.name)
                              : [...selectedProjects, p.name];
                            navigate(activeTab, next);
                          }}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-black"
                                : "border-border/60 group-hover:border-primary/60 bg-white/[0.02]"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono truncate">{p.name}</p>
                            {p.branch && (
                              <p className="text-[10px] text-muted-foreground/60 font-mono truncate">
                                {p.branch}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Focus Only Action Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(activeTab, [p.name]);
                            setDropdownOpen(false);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-white/[0.08] text-foreground/60 hover:text-foreground flex items-center gap-1 transition-all shrink-0"
                          title={`Focus exclusively on ${p.name}`}
                        >
                          <Crosshair className="w-2.5 h-2.5" />
                          <span>Only</span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-xs text-muted-foreground/50 py-3 font-mono">
                    No matching projects
                  </p>
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="mt-1 pt-1.5 border-t border-border/20 px-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px]">
                  {selectedProjects.length} of {projects.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="px-2.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-xs font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0">
        {activeTab === "graph" ? (
          <GraphTab project={selectedProject} />
        ) : activeTab === "control" ? (
          <ControlTab />
        ) : activeTab === "diagrams" ? (
          <DiagramsTab
            initialDiagram={activeDiagram}
            onSelectDiagram={(d) => navigate("diagrams", selectedProjects, d)}
            selectedProject={selectedProject}
          />
        ) : activeTab === "tools" ? (
          <ToolsTab selectedProject={selectedProject} />
        ) : activeTab === "readiness" ? (
          <ReadinessTab selectedProject={selectedProject} />
        ) : activeTab === "reports" ? (
          <ReportsTab
            selectedProject={selectedProject}
            onSelectProject={(p) => navigate("reports", [p])}
          />
        ) : activeTab === "features" ? (
          <FeaturesTab
            selectedProjects={selectedProjects}
            selectedProject={selectedProject}
            onNavigateTab={(targetTab, targetProjects) =>
              navigate(targetTab, targetProjects || selectedProjects)
            }
          />
        ) : activeTab === "adr" ? (
          <AdrTab
            selectedProject={selectedProject}
            onSelectProject={(p) => navigate("adr", [p])}
          />
        ) : (
          <StatsTab
            onSelectProject={(p, targetTab = "graph") => navigate(targetTab, [p])}
            selectedProjects={selectedProjects}
            onToggleProject={(p) => {
              const isSelected = selectedProjects.includes(p);
              const next = isSelected
                ? selectedProjects.filter((n) => n !== p)
                : [...selectedProjects, p];
              navigate("stats", next);
            }}
            onSelectProjects={(projs) => navigate("stats", projs)}
          />
        )}
      </main>
    </div>
  );
}

