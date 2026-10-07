import { useCallback, useEffect, useRef, useState } from "react";
import { GraphTab } from "./components/GraphTab";
import { StatsTab } from "./components/StatsTab";
import { ControlTab } from "./components/ControlTab";
import { DiagramsTab } from "./components/DiagramsTab";
import { ToolsTab } from "./components/ToolsTab";
import { ReadinessTab } from "./components/ReadinessTab";
import { ReportsTab } from "./components/reports/ReportsTab";
import { AdrTab } from "./components/AdrTab";
import type { TabId } from "./lib/types";
import { useUiMessages } from "./lib/i18n";
import { FolderGit2, ChevronDown, Check, X } from "lucide-react";

const TAB_IDS: TabId[] = [
  "stats",
  "tools",
  "control",
  "graph",
  "reports",
  "readiness",
  "diagrams",
  "adr",
];

interface RouteState {
  tab: TabId;
  project: string | null;
  diagram: string | null;
}

interface ProjectHeaderItem {
  name: string;
  root_path?: string;
  branch?: string;
}

/* Read the active tab + selected project + diagram from the URL query string so the
 * current view survives refreshes and can be bookmarked or shared. */
function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab");
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : "stats";
  const project = params.get("project");
  const diagram = params.get("diagram");
  return { tab, project: project ? project : null, diagram: diagram ? diagram : null };
}

/* Build the canonical URL for a route, preserving the path and hash. */
function routeUrl(tab: TabId, project: string | null, diagram: string | null = null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (project) params.set("project", project);
  if (diagram && tab === "diagrams") params.set("diagram", diagram);
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

  const { tab: activeTab, project: selectedProject, diagram: activeDiagram } = route;

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
    window.history.replaceState(null, "", routeUrl(initial.tab, initial.project, initial.diagram));
  }, []);

  /* Sync state when the user navigates with the browser back/forward buttons. */
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* Change the route and push a history entry (skips no-op navigations). */
  const navigate = useCallback(
    (tab: TabId, project: string | null, diagram: string | null = null) => {
      const url = routeUrl(tab, project, diagram);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (url === current) return;
      window.history.pushState(null, "", url);
      setRoute({ tab, project, diagram });
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
                onClick={() =>
                  navigate(
                    tab.id,
                    tab.id === "stats" ? null : selectedProject
                  )
                }
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
                  const targetProject =
                    selectedProject || (projects.length > 0 ? projects[0].name : null);
                  navigate(
                    tab.id,
                    targetProject,
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
                selectedProject
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/45"
                  : "bg-white/[0.03] border-border/40 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
              }`}
              title={selectedProject ? `Active Project: ${selectedProject}` : "Click to select a project"}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 leading-none">
                  Project
                </span>
                <span className="text-[12px] font-mono font-medium truncate max-w-[180px]">
                  {selectedProject || "All Projects"}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-60 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {selectedProject && (
              <button
                onClick={() =>
                  navigate(
                    activeTab === "graph" || activeTab === "adr" ? "stats" : activeTab,
                    null
                  )
                }
                className="p-1 rounded-lg border border-border/30 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground text-[12px] transition-colors"
                title="Deselect project (switch to global view)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0e2028] border border-border/50 shadow-2xl p-1.5 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
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

              {/* All Projects item */}
              <button
                onClick={() => {
                  navigate(
                    activeTab === "graph" || activeTab === "adr" ? "stats" : activeTab,
                    null
                  );
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  !selectedProject
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  All Projects (Global)
                </span>
                {!selectedProject && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>

              <div className="h-px bg-border/30 my-1" />

              {/* Projects List */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((p) => {
                    const isSelected = p.name === selectedProject;
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          navigate(activeTab, p.name);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                          isSelected
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-foreground/80 hover:text-foreground hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-mono truncate">{p.name}</p>
                          {p.branch && (
                            <p className="text-[10px] text-muted-foreground/60 font-mono truncate">
                              {p.branch}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-center text-xs text-muted-foreground/50 py-3 font-mono">
                    No matching projects
                  </p>
                )}
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
            onSelectDiagram={(d) => navigate("diagrams", selectedProject, d)}
          />
        ) : activeTab === "tools" ? (
          <ToolsTab selectedProject={selectedProject} />
        ) : activeTab === "readiness" ? (
          <ReadinessTab selectedProject={selectedProject} />
        ) : activeTab === "reports" ? (
          <ReportsTab
            selectedProject={selectedProject}
            onSelectProject={(p) => navigate("reports", p)}
          />
        ) : activeTab === "adr" ? (
          <AdrTab
            selectedProject={selectedProject}
            onSelectProject={(p) => navigate("adr", p)}
          />
        ) : (
          <StatsTab
            onSelectProject={(p, targetTab = "graph") => navigate(targetTab, p)}
          />
        )}
      </main>
    </div>
  );
}
