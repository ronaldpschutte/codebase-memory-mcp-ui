/* Graph data types matching the C layout3d.c JSON output */

export interface GraphNode {
  id: number;
  x: number;
  y: number;
  z: number;
  label: string;
  name: string;
  file_path?: string;
  qualified_name?: string;
  start_line?: number;
  end_line?: number;
  size: number;
  color: string;
  /* Dead-code classification from the backend layout (layout3d.c). */
  status?: NodeStatus;
  in_calls?: number;
}

export type NodeStatus =
  | "dead"
  | "single"
  | "entry"
  | "test"
  | "exported"
  | "normal"
  | "structural";

/* Git remote metadata for building GitHub deep-links (/api/repo-info). */
export interface RepoInfo {
  root_path: string;
  branch: string;
  remote_url: string;
  web_base: string; /* e.g. github.com/<org>/<repo> */
  blob_base: string; /* e.g. github.com/<org>/<repo>/blob/<branch> */
}

export interface GraphEdge {
  source: number;
  target: number;
  type: string;
}

export interface LinkedProject {
  project: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  offset: { x: number; y: number; z: number };
  cross_edges: GraphEdge[];
}

/* Missed-graph skeleton (#963): the file structure of files the indexer
 * could not fully cover, laid out as a satellite cluster beside the code
 * galaxy (server-computed offset, same shape as LinkedProject's). */
export interface MissedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  offset: { x: number; y: number; z: number };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  linked_projects?: LinkedProject[];
  missed_graph?: MissedGraph;
}

export interface Project {
  name: string;
  root_path: string;
  indexed_at: string;
  branch?: string;
  nodes?: number;
  edges?: number;
  size_bytes?: number;
}

export interface SchemaInfo {
  node_labels: { label: string; count: number }[];
  edge_types: { type: string; count: number }[];
  total_nodes: number;
  total_edges: number;
}

export type TabId = "control" | "stats" | "diagrams" | "tools" | "graph" | "readiness" | "reports" | "adr";

export type ReportPreset = "quick" | "comprehensive" | "custom";

export interface FixFirstItem {
  rank: number;
  symbol: string;
  file_path: string;
  risk_score: number;
  reasons: string[];
  recommended_action: string;
}

export interface ReportScore {
  overall: number;
  grade: string;
  test_coverage: number;
  hygiene: number;
  ai_readiness: number;
}

export interface RepositoryAnalysisReport {
  report_id: string;
  project: string;
  git_branch: string;
  commit_hash: string;
  created_at: string;
  execution_time_ms: number;
  preset: ReportPreset;
  scores: ReportScore;
  fix_first: FixFirstItem[];
  sections: {
    test_coverage?: any;
    code_clones?: any;
    dead_code?: any;
    blast_radius?: any;
    coupled_files?: any;
    api_surface?: any;
    error_flow?: any;
    env_vars?: any;
    ai_readiness?: AIReadinessReport;
    [key: string]: any;
  };
}

export interface ReportDelta {
  overall_diff: number;
  grade_from: string;
  grade_to: string;
  test_coverage_diff: number;
  hygiene_diff: number;
  ai_readiness_diff: number;
  fix_first_diff: number;
}

export interface DiagramRecommendation {
  id: string;
  title: string;
  type: "sequence" | "architecture" | "fragility_network" | "dataflow" | "error_flow" | "clone_clusters" | "test_coverage" | string;
  category: "behavioral" | "structural" | "quality" | "dataflow" | string;
  utility_score: number;
  priority: "critical" | "high" | "medium";
  params: {
    type: string;
    entry_point?: string;
    scope_path?: string;
    max_depth?: number;
    format: string;
    [key: string]: any;
  };
  metrics?: Record<string, any>;
  rationale: string;
  mermaid?: string;
}

export interface DiagramRecommendationResult {
  project: string;
  db_path?: string;
  total_candidates_evaluated: number;
  recommendations_count: number;
  recommendations: DiagramRecommendation[];
  generated_at: string;
}

export interface PillarScore {
  score: number;
  max: number;
  status: "EXCELLENT" | "GOOD" | "NEEDS_IMPROVEMENT" | "CRITICAL";
  findings: string[];
}

export interface Shortcoming {
  id: string;
  severity: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  pillar: string;
  title: string;
  description: string;
  remediation: string;
  autoFixAvailable?: boolean;
  scaffoldTemplate?: string;
  skillTargetDir?: string;
}

export interface AIReadinessReport {
  project: string;
  timestamp: string;
  score: number;
  grade: string;
  summary: string;
  pillars: {
    instructions: PillarScore;
    skills: PillarScore;
    graph_integrity: PillarScore;
    test_guardrails: PillarScore;
    hygiene: PillarScore;
  };
  shortcomings: Shortcoming[];
}

export interface McpToolParam {
  name: string;
  type: string;
  required: boolean;
  defaultVal?: string | number | boolean;
  enumVals?: string[];
  description: string;
}

export interface McpToolDefinition {
  name: string;
  category: "Code Discovery" | "Tracing & Architecture" | "Indexing & Projects" | "Governance & Schema";
  summary: string;
  description: string;
  readOnly: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  parameters: McpToolParam[];
  cliExample: string;
  jsonExample: string;
}

export interface ProcessInfo {
  pid: number;
  cpu: number;
  cpu_time_s?: number;
  rss_mb: number;
  elapsed: string;
  command: string;
  is_self: boolean;
}

export interface ToolCallRecord {
  id: number;
  timestamp: string;
  timestamp_ms: number;
  tool: string;
  project?: string;
  duration_ms: number;
  status: "ok" | "error";
  is_error: boolean;
  response_bytes: number;
  params: Record<string, unknown>;
  response?: unknown;
}
