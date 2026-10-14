# RFC 020: Multi-Project Selection & Application-Wide Scope Filtering

- **RFC Number:** 020
- **Title:** Multi-Project Selection & Application-Wide Scope Filtering
- **Status:** Implemented
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `graph-ui/src/App.tsx`, `graph-ui/src/components/StatsTab.tsx`, `graph-ui/src/components/*`, `graph-ui/src/hooks/`
- **Target Version:** v0.20.0
- **Created:** 2026-10-14
- **Related RFCs:** [RFC 012](RFC_012_Code_Quality_Reports_Page.md) (Code Quality Reports), [RFC 015](RFC_015_Repository_Analysis_Reports_Page.md) (Repository Analysis Reports), [RFC 016](RFC_016_Diagram_Recommendation_Engine.md) (Diagram Recommendations), [RFC 017](RFC_017_Standardized_Documentation_And_Artifact_Storage.md) (Standardized Documentation), [RFC 018](RFC_018_Agent_Context_And_Instruction_Architecture.md) (Agent Context Architecture), [RFC 019](RFC_019_Interactive_Multi_Project_Elicitation_And_Cross_Repo_Transplant.md) (Multi-Project Elicitation & Cross-Repo Transplant)

---

## TL;DR — Impact at a Glance

| Question | Answer |
|---|---|
| **What does this RFC propose?** | 1. **Multi-Project Selection in Header Dropdown:** Upgrade the top-right project selector in `App.tsx` from a single-item radio selection to an interactive multi-select dropdown with checkboxes, "Select All", "Clear All", search filtering, and multi-project count badges.<br>2. **Multi-Project Selection on the Projects Tab (`StatsTab`):** Add interactive selection checkboxes to each repository card on the Projects page, with bulk actions, selection counters, and dynamic KPI cards reflecting the aggregated subset.<br>3. **Application-Wide Scope Filtering:** Elevate project selection from a single string (`selectedProject: string \| null`) to a unified multi-project filter state (`selectedProjects: string[]`) synchronized with URL query params (`?projects=repoA,repoB`).<br>4. **Full Tab Interoperability:** Propagate the multi-project filter seamlessly across all tabs: Graph (multi-repo graph clustering), Reports (cross-project quality metrics), Readiness (comparative audit scorecards), Diagrams (cross-repo architectural topologies), and Tools (multi-project parameter templates). |
| **Why is this needed?** | Modern software systems consist of multiple cooperating repositories (e.g. frontend UI, backend daemon, core C library, and microservices). Currently, the UI forces users into a single-project silo or an unrestricted global view. Users cannot isolate and analyze a specific subset of 2–3 related repositories without repeatedly switching between them. |
| **Does it touch Core C?** | **No (0% Core C modifications).** Under the **Core C Preference Rule**, all state management, multi-checkbox UI components, URL synchronization, and filter composition live entirely within the React/TypeScript frontend (`graph-ui`). The backend C daemon already supports multi-project querying via Cypher patterns (`WHERE project IN (...)`), project arrays, and composite queries. |
| **Is it backwards compatible?** | **Yes, 100% backwards compatible.** Single project selections (`?project=foo`) automatically normalize to `selectedProjects = ["foo"]`. When no projects are selected, the application operates in global mode (`selectedProjects = []`), maintaining identical behavior for existing links and bookmarks. |

---

## 1. Motivation & Problem Statement

### 1.1 The Single-Project Silo Constraint
`codebase-memory-mcp-ui` can index dozens of repositories simultaneously into local SQLite storage. However, the user interface currently manages project context as a scalar string:
```typescript
interface RouteState {
  tab: TabId;
  project: string | null; // Single project or null for "All Projects"
  diagram: string | null;
}
```
This scalar model creates severe workflow limitations:
1. **No Comparative Multi-Repo Scoping:** Engineers working on a full-stack feature (e.g., `codebase-memory-mcp-ui` frontend + `codebase-memory-mcp` C backend) cannot scope the UI to *just* those two repositories. They are forced to choose between seeing *all 8+ indexed repositories* (overwhelming noise) or *only 1 repository* (missing cross-repo interactions).
2. **Disconnected Projects Tab:** The Projects tab (`StatsTab.tsx`) lists all indexed repositories with health dots, symbol counts, and action buttons, but offers **zero selection mechanism**. Users must click an individual button (`Graph`, `Reports`, `Diagrams`) which immediately navigates away to that tab with a single project selected.
3. **Dropdown Limitation:** The persistent top-right header dropdown closes immediately upon selecting a single item, making comparative workflows cumbersome and high-friction.

### 1.2 Enterprise & Microservice Use Cases
Multi-project filtering is essential for standard engineering workflows:
- **Client & Server Pair Analysis:** Viewing the API surface and dataflow between a web frontend and backend API.
- **Library & Consumer Validation:** Checking blast radius across a shared utility library and its 3 consuming applications.
- **Cross-Repo Feature Transplanting (RFC 019):** Inspecting the source and target repositories side-by-side during feature transplantation.
- **Audit & Compliance Slicing:** Generating combined AI readiness and quality scorecards for a specific business squad owning 4 repositories out of 20 in the organization.

---

## 2. Core C Preference Rule Justification

The user-defined project rule stipulates:
> **Core C Preference Rule:** ALWAYS prefer implementations that do NOT touch or modify the Core C codebase... ONLY propose or implement changes in Core C when there is a serious, demonstrable performance difference or a strict technical constraint that cannot be achieved outside C.

### Architectural Compliance Analysis
1. **Frontend-Driven State & Routing:** Multi-project selection is fundamentally an application state, filtering, and ergonomic visualization concern. It is managed in React state, URL routing, and component prop trees.
2. **Existing Backend Capabilities:** The Core C engine (`src/store/store.c`, `src/cypher/cypher.c`, `src/mcp/mcp.c`) already supports:
   - Filtering nodes and edges by project lists via Cypher: `MATCH (n) WHERE n.project IN ['projA', 'projB'] RETURN n`.
   - Dedicated multi-project comparison via `compare_graphs(base_project, target_project)`.
   - Composite project listings via `list_projects`.
3. **Conclusion:** **Zero C code modifications are required.** All implementation work will take place in the `graph-ui/` React codebase.

---

## 3. Architecture & User Experience Design

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Codebase Memory v0.20.0    [Projects] [Tools] [Control] | [Graph] [Reports] [Diagrams]│
│                                                            [ 2 Projects Selected ▾ ] (X)│
└───────────────────────────────────────────────────────────────┬────────────────────────┘
                                                                │
                 ┌──────────────────────────────────────────────▼───────────────────────┐
                 │  Search projects...                                                  │
                 │  [☑ Select All]                                     [☐ Clear (2)]     │
                 │  ──────────────────────────────────────────────────────────────────  │
                 │  ☑ C-AI-Source-codebase-memory-mcp-ui               (main)           │
                 │  ☑ CodeVisualizer                                   (-)              │
                 │  ☐ Graft                                            (-)              │
                 │  ☐ docling                                          (main)           │
                 │  ☐ gitdiagram                                       (main)           │
                 └──────────────────────────────────────────────────────────────────────┘
                                                                │
           ┌────────────────────────────────────────────────────┴────────────────────────┐
           ▼                                                    ▼                        ▼
┌───────────────────────┐                            ┌─────────────────────┐  ┌──────────────────┐
│  Projects Tab         │                            │  Reports / Readiness│  │  Graph Tab       │
│  • Card Checkboxes    │                            │  • Combined Metrics │  │  • Multi-Repo 3D │
│  • Dynamic KPI Totals │                            │  • Comparative Grid │  │    Spatial View  │
│  • Bulk Action Bar    │                            │  • Per-Repo Badges  │  │  • Inter-Repo    │
└───────────────────────┘                            └─────────────────────┘  │    Boundaries    │
                                                                              └──────────────────┘
```

### 3.1 Persistent Header Dropdown (Top-Right)
The top-right project selector in `App.tsx` will be upgraded with the following interactive features:

1. **Trigger Button Appearance:**
   - **0 Selected / Global Mode:** Displays `"All Projects (Global)"` with standard neutral styling.
   - **1 Selected:** Displays `"[Project Name]"` with active primary accent styling.
   - **2+ Selected:** Displays `"[Primary Project] + [N-1] more"` or `"3 Projects Selected"` with an active badge counter `[3]`.
   - **Quick Clear Button (`X`):** Appears whenever 1+ projects are selected, resetting to global mode in one click.

2. **Dropdown Menu Features:**
   - **Multi-Select Checkboxes:** Each project row features an interactive checkbox. Clicking a row toggles its selection **without closing the dropdown**, enabling rapid multi-item selection.
   - **"Focus Only" Action:** Hovering over a row reveals a dedicated "Focus" icon button that selects *only* that project and closes the menu.
   - **Header Controls:**
     - Search input to filter large project lists.
     - `"Select All"` button (checks all visible filtered projects).
     - `"Clear"` button (unchecks all projects, reverting to Global view).
   - **Global View Row:** A top row for `"All Projects (Global)"` that clears all selections.

### 3.2 Projects Tab (`StatsTab.tsx`)
The Projects tab becomes the primary management surface for multi-project scoping:

1. **Card Multi-Selection:**
   - Every repository card receives a visual selection checkbox in its top-left header.
   - Selected cards display an active highlighted border (`border-primary/50`) and subtle glow background.
2. **Dynamic Aggregate KPI Cards:**
   - The aggregate KPI cards at the top of the Projects page dynamically reflect the active selection:
     - When all projects are active: `"8 Projects | 48,210 Nodes | 112,890 Edges"`
     - When 2 projects are selected: `"2 of 8 Projects Selected | 14,320 Nodes | 32,110 Edges"`
3. **Sticky Bulk Actions Bar:**
   - When 1 or more projects are checked, a sleek floating bottom bar appears:
     - `"2 projects selected: [View Combined Graph] [Compare Reports] [Architecture Diagrams] [Deselect All]"`

### 3.3 Application-Wide Filter Propagation
The active project filter is synchronized across the entire application via URL search parameters and passed down to every view:

| Tab | Multi-Project Filtering Behavior |
|---|---|
| **Projects (`StatsTab`)** | Displays all projects, highlighting checked projects; updates KPI summary cards to reflect the checked subset. |
| **Graph (`GraphTab`)** | Renders nodes and edges belonging to all selected projects; visually clusters nodes by project; emphasizes cross-project edges. |
| **Reports (`ReportsTab`)** | Aggregates health metrics across selected projects; displays comparative side-by-side scorecards; filters the Fix-First risk queue to selected repos. |
| **Readiness (`ReadinessTab`)** | Renders comparative AI readiness scorecards for each selected repo; aggregates context inventory and symbol anchor integrity across the subset. |
| **Diagrams (`DiagramsTab`)** | Enables cross-repo architecture diagram generation between selected projects; filters the recommended diagram catalog to matching repos. |
| **Tools (`ToolsTab`)** | Pre-populates `{PROJECT}` variables with the primary selected project; displays a multi-project preset selector for cross-project tools (e.g. `compare_graphs`). |
| **ADR (`AdrTab`)** | Filters Architecture Decision Records to the selected project subset. |
| **Control (`ControlTab`)** | Enables batch operations (re-index, clean, verify) on selected projects. |

---

## 4. Technical Specifications & API Design

### 4.1 URL Route State & Canonical Serialization
To ensure that multi-project views are bookmarkable, shareable, and resilient to browser refreshes:

```typescript
// graph-ui/src/lib/types.ts
export interface RouteState {
  tab: TabId;
  projects: string[]; // Array of selected project names; empty array = All Projects (Global)
  diagram: string | null;
}
```

#### URL Serialization Schema:
- **Multiple Projects:** `?tab=graph&projects=codebase-memory-mcp-ui,docling,gitdiagram`
- **Single Project (canonical):** `?tab=reports&projects=codebase-memory-mcp-ui`
- **Backwards Compatibility:** URLs containing `?project=foo` are parsed into `projects: ["foo"]`.
- **Global View:** `?tab=stats` (no `projects` parameter).

```typescript
// URL Helper implementations in App.tsx
export function parseRoute(search: string): RouteState {
  const params = new URLSearchParams(search);
  const rawTab = params.get("tab");
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : "stats";
  const diagram = params.get("diagram");

  let projects: string[] = [];
  const projectsParam = params.get("projects");
  const singleProjectParam = params.get("project");

  if (projectsParam) {
    projects = projectsParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (singleProjectParam) {
    projects = [singleProjectParam.trim()];
  }

  return { tab, projects, diagram };
}

export function serializeRoute(tab: TabId, projects: string[], diagram: string | null = null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (projects.length > 0) {
    params.set("projects", projects.join(","));
  }
  if (diagram && tab === "diagrams") {
    params.set("diagram", diagram);
  }
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}
```

### 4.2 Shared Project Filter Hook: `useProjectFilter`
A lightweight custom hook providing clean filter state and mutation helpers:

```typescript
// graph-ui/src/hooks/useProjectFilter.ts
export interface ProjectFilterContextValue {
  selectedProjects: string[];
  isGlobal: boolean;
  isProjectSelected: (name: string) => boolean;
  toggleProject: (name: string) => void;
  selectOnly: (name: string) => void;
  selectAll: (names: string[]) => void;
  clearSelection: () => void;
  primaryProject: string | null;
}
```

### 4.3 Component Prop Signatures
Components currently consuming `selectedProject: string | null` will be updated to accept either `selectedProjects: string[]` or both for smooth incremental adoption:

```typescript
// Common pattern across tab components:
interface TabProps {
  selectedProjects?: string[];
  selectedProject?: string | null; // Backwards-compatible alias (evaluates to selectedProjects[0])
  onSelectProjects?: (projects: string[]) => void;
}
```

---

## 5. User Interface Mockups & Interaction Details

### 5.1 Header Dropdown Interaction
```
+-------------------------------------------------------------+
| [Search projects...]                                        |
+-------------------------------------------------------------+
| [Select All (8)]                             [Clear All]    |
+-------------------------------------------------------------+
| [x] All Projects (Global)                                   |
|-------------------------------------------------------------|
| [X] codebase-memory-mcp-ui                   [Focus Only]   |
| [X] docling                                  [Focus Only]   |
| [ ] gitdiagram                               [Focus Only]   |
| [ ] CodeVisualizer                           [Focus Only]   |
| [ ] Graft                                    [Focus Only]   |
+-------------------------------------------------------------+
```
- Clicking any project's row toggles its checkbox and updates application state immediately.
- The dropdown stays open during toggles so users can configure their multi-project scope in seconds.
- Pressing `Escape` or clicking outside closes the dropdown.
- Clicking `"Focus Only"` unchecks all other projects and immediately selects only the targeted project.

### 5.2 Projects Tab Card Selection
```
┌────────────────────────────────────────────────────────────────────────┐
│ [X]  ● C-AI-Source-codebase-memory-mcp-ui               (main)         │
│      C:/AI/Source/codebase-memory-mcp-ui                               │
│      24,180 symbols • 48,200 edges • Healthy (18.4 MB)                 │
│      [Graph] [Reports] [Readiness] [Diagrams] [ADR]                    │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ [X]  ● docling                                          (main)         │
│      C:/AI/Source/storm/docling-main                                   │
│      14,890 symbols • 22,400 edges • Healthy (11.2 MB)                 │
│      [Graph] [Reports] [Readiness] [Diagrams] [ADR]                    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Floating Action Bar:                                                   │
│ 2 Projects Selected: [View Graph (2)] [Combined Reports] [Clear (X)]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Plan & Milestones

### Milestone 1: Routing & State Foundation
- Update `RouteState` in `graph-ui/src/App.tsx` to support `projects: string[]`.
- Implement `parseRoute` and `serializeRoute` with full backwards compatibility for `?project=`.
- Create `graph-ui/src/hooks/useProjectFilter.ts` and test state transitions.

### Milestone 2: Persistent Header Multi-Select Dropdown
- Replace single-select radio list in `App.tsx` with multi-checkbox dropdown.
- Add "Select All", "Clear All", search filtering, and individual row toggle mechanics.
- Add the "Focus Only" hover action.
- Update header trigger label with multi-project badges and one-click clear button (`X`).

### Milestone 3: Projects Tab (`StatsTab.tsx`) Multi-Selection
- Add interactive checkboxes to each project card in `StatsTab.tsx`.
- Connect card selection state to application-wide project filter.
- Implement dynamic recalculation of aggregate KPI summary cards.
- Add floating multi-project action bar when 1+ projects are selected.

### Milestone 4: Downstream Tab Integration
- **`ReportsTab.tsx`**: Update project selector and support filtering reports by `selectedProjects`.
- **`ReadinessTab.tsx`**: Support multi-repo comparative view or tabs.
- **`DiagramsTab.tsx`**: Enable filtering diagram catalog and generating cross-repo diagrams.
- **`ToolsTab.tsx`**: Provide multi-project parameter presets.
- **`GraphTab.tsx`**: Pass `projects: string[]` to the 3D visualization layout.

### Milestone 5: Verification & Testing
- Vitest unit tests for route parsing, serialization, and dropdown interactions.
- End-to-end browser subagent verification of multi-project selection workflows.

---

## 7. Test Plan

### 7.1 Vitest Component & Unit Tests
1. **URL Route Parsing:**
   - Verify `?projects=a,b,c` parses into `["a", "b", "c"]`.
   - Verify legacy `?project=a` parses into `["a"]`.
   - Verify empty query string defaults to `[]` (Global).
2. **Dropdown State Transitions:**
   - Verify clicking checkbox toggles project membership without closing dropdown.
   - Verify "Select All" checks all visible filtered projects.
   - Verify "Clear" unchecks all projects.
   - Verify "Focus Only" isolates a single project.
3. **Projects Tab Interactions:**
   - Verify checking a card updates `selectedProjects`.
   - Verify floating action bar appears on selection and disappears on clear.
   - Verify KPI cards compute correct subset totals.

### 7.2 Visual & E2E Validation
- Use the `browser_subagent` to open the local development server at `http://localhost:5173`.
- Test multi-selection flow across Projects tab, header dropdown, and navigation across tabs.
- Validate responsive layouts and dark-mode styling aesthetics.

---

## 8. Alternatives & Tradeoffs Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| **Option A: Header-only multi-select** | Minimal code changes; dropdown handles selection. | Projects tab remains passive with no bulk actions or visual selection state. | **Rejected**: Inconsistent user experience between the two project surfaces. |
| **Option B: Independent filters per tab** | Each tab remembers its own project selection. | Confusing mental model; switching tabs loses context; hard to share via URL. | **Rejected**: User explicitly requested an *application-wide filter*. |
| **Option C: Unified Application-Wide Multi-Select (Proposed)** | Cohesive experience across Header and Projects tab; shareable URLs; clean mental model; 100% Core C compliant. | Requires updating downstream tabs to consume project arrays. | **Accepted (Recommended)**. |

---

## 9. Compatibility & Migration Strategy

- **Zero Breaking Changes:**
  - Existing MCP tools and daemon endpoints are unaffected.
  - Existing bookmarked URLs with `?project=xyz` continue to work seamlessly.
  - Tab components accept both `selectedProjects` (array) and `selectedProject` (scalar fallback).
- **Core C Preference Rule:**
  - Strictly respected. The C binary remains untouched.

---

## 10. Summary & Sign-off

RFC 020 delivers a modern, high-ergonomics multi-project selection architecture for `codebase-memory-mcp-ui`. By unifying the persistent header dropdown and the Projects tab into an application-wide scope filter, engineers can seamlessly isolate, compare, and investigate multiple repositories simultaneously with zero modifications to Core C.
