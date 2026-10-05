# RFC 009: `tool_call_log` — Real-Time MCP Tool Call Inspector on Control Page

- **RFC Number:** 009
- **Title:** `tool_call_log` — Real-Time MCP Tool Call Inspector and Parameter Viewer on Control Page
- **Status:** Proposed
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `src/mcp/`, `src/ui/`, `graph-ui/src/components/ControlTab.tsx`
- **Target Version:** v0.12.0
- **Created:** 2026-10-04

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
When developers, team members, or AI coding assistants (such as Antigravity, Claude Code, Cursor, Codex, or custom MCP agents) interact with `codebase-memory-mcp`, tools are invoked via JSON-RPC `tools/call` over stdio or HTTP.

Currently:
1. **Tool Invocations are Opaque**: The Control page displays CPU and RAM resource gauges, active daemon processes, and raw stderr/stdout process logs (`LogViewer` consuming `/api/logs?lines=200`). However, there is **no dedicated tool call inspector**.
2. **Parameters are Invisible in UI**: Standard logs emit brief one-line summaries (`level=info msg=mcp.request protocol=jsonrpc method=tools/call tool=search_graph status=ok duration_ms=4`), but **omit all arguments and parameters** passed by the AI agent (e.g., the exact query strings, target symbols, regex patterns, depth limits, or filters).
3. **Debugging Agent Hallucinations & Prompts is Difficult**: When an AI agent fails to retrieve the right information or passes erroneous arguments, developers have no UI view to see the exact payload sent by the agent and must dig through raw log files or terminal stdout.
4. **Lack of Performance Telemetry**: Developers cannot easily inspect which specific tool calls took excessive time or failed with errors across a session.

### 1.2 The Solution
Introduce a dedicated, real-time **Tool Call Log** component into the **Control page**, positioned directly **above the Process Logs**.

This feature introduces:
- **In-Memory Tool Call Ring Buffer in Backend**: A thread-safe, memory-bounded circular ring buffer in the C server capturing the last 500 tool executions with their complete parsed argument JSON, execution duration, status (`ok` vs `error`), and response byte count.
- **REST API Endpoint (`/api/tool-calls`)**: Providing pagination, incremental polling via `since_id`, and filtering by tool name or status.
- **Rich Interactive UI Component in `ControlTab.tsx`**:
  - Live auto-refreshing feed with pause/resume controls.
  - Search filter by tool name, parameter text, or project.
  - Color-coded status badges and latency tags.
  - Expandable accordion rows displaying syntax-highlighted, formatted JSON parameters with a 1-click **"Copy Parameters"** button.
  - Summary badges showing key parameters (e.g., `target: "process_payment"`, `max_depth: 3`).

---

## 2. UI Layout & Placement on Control Page

The **Tool Call Log** is positioned on the **Control** page directly between the **Active Processes** grid and the **Process Logs** (`LogViewer`):

```
┌────────────────────────────────────────────────────────────────────────┐
│  Control Panel                                                         │
│                                                                        │
│  [Total CPU: 1.2%]  [Total RAM: 305MB]  [Processes: 2]  [Self: 84MB]   │
├────────────────────────────────────────────────────────────────────────┤
│  Active Processes                                                      │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ PID 3824 (This Process)       │  │ PID 4192 (Daemon)             │  │
│  │ CPU: 0.8%  RAM: 84 MB         │  │ CPU: 0.4%  RAM: 221 MB        │  │
│  └───────────────────────────────┘  └───────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  ▼ TOOL CALL LOG (NEW)                              [Clear] [Pause] ⟳  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Filter: [search params or tool...]  [All | OK | Error]  42 calls │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [OK]  analyze_blast_radius   target: "process_payment"   14.2ms  │  │
│  │   ▼ Parameters:                                     [Copy JSON]  │  │
│  │   {                                                              │  │
│  │     "project": "core-backend",                                   │  │
│  │     "target": "process_payment",                                 │  │
│  │     "max_depth": 3,                                              │  │
│  │     "include_tests": true                                        │  │
│  │   }                                                              │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [OK]  search_graph           query: ".*Handler.*"         3.8ms  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [ERR] get_code_snippet       symbol: "invalid_symbol"     1.1ms  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  Process Logs                                               142 lines  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ level=info msg=mcp.request protocol=jsonrpc method=tools/call... │  │
│  │ level=info msg=autoindex.done project=repo mode=supervised       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Architecture & C Implementation

### 3.1 Data Structures (`src/ui/tool_call_log.h` / `src/mcp/mcp.h`)

```c
#define CBM_TOOL_CALL_RING_SIZE 500
#define CBM_TOOL_CALL_PARAM_MAX (64 * 1024) /* 64 KB cap per call payload */

typedef struct {
    uint64_t id;                  /* Monotonically increasing call ID */
    int64_t timestamp_ms;         /* Epoch timestamp in milliseconds */
    char tool_name[64];           /* Name of the MCP tool invoked */
    char project[128];            /* Target project if identified in params */
    char *params_json;            /* Heap-allocated JSON string of parameters */
    int64_t duration_us;          /* Execution duration in microseconds */
    bool is_error;                /* True if tool returned isError or failure */
    size_t response_bytes;        /* Size in bytes of output JSON payload */
} cbm_tool_call_record_t;

typedef struct {
    cbm_tool_call_record_t entries[CBM_TOOL_CALL_RING_SIZE];
    int head;                     /* Next write index (0 .. RING_SIZE - 1) */
    int count;                    /* Total items currently stored (<= RING_SIZE) */
    uint64_t next_id;             /* Next sequential ID */
    cbm_mutex_t lock;             /* Thread-safe synchronization mutex */
} cbm_tool_call_ring_t;
```

### 3.2 Capture Hook in `src/mcp/mcp.c`

During JSON-RPC dispatch of `tools/call`, the existing handler extracts:
- `tool_name = cbm_mcp_get_tool_name(req.params_raw)`
- `tool_args = cbm_mcp_get_arguments(req.params_raw)`

The capture hook records the call into the ring buffer right before freeing `tool_args`:

```c
/* In src/mcp/mcp.c around line 18475 */
bool is_err = (result_json != NULL) && (strstr(result_json, "\"isError\":true") != NULL);
size_t resp_len = result_json ? strlen(result_json) : 0;

/* Log to existing text logger */
cbm_log_mcp_request(req.method, tool_name, is_err, request_dur_us);

/* Record into UI Tool Call Ring Buffer */
cbm_tool_call_log_record(tool_name, tool_args, is_err, request_dur_us, resp_len);
```

### 3.3 Safe Memory & Truncation Guardrails
- If `tool_args` exceeds `CBM_TOOL_CALL_PARAM_MAX` (64 KB), the JSON payload is safely truncated with a trailing `"... (truncated)"` notice to prevent out-of-memory denial of service.
- The ring buffer replaces old entries cleanly by freeing the previous `params_json` pointer before overwriting the slot.
- All reads and writes are protected by `cbm_mutex_t`.

---

## 4. HTTP API Contract

### 4.1 Endpoint: `GET /api/tool-calls`

Retrieves recorded MCP tool calls.

#### Query Parameters:
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | integer | `50` | Maximum number of entries to return (max `500`). |
| `since_id` | integer | `0` | If specified, returns only entries with `id > since_id` (for lightweight delta polling). |
| `tool` | string | `""` | Filter by specific tool name (e.g., `analyze_blast_radius`). |
| `status` | string | `"all"` | Filter by outcome: `"all"`, `"ok"`, or `"error"`. |

#### Response Schema (`application/json`):
```json
{
  "total": 42,
  "latest_id": 104,
  "tool_calls": [
    {
      "id": 104,
      "timestamp": "2026-10-04T19:55:00.123Z",
      "timestamp_ms": 1791136500123,
      "tool": "analyze_blast_radius",
      "project": "core-backend",
      "duration_ms": 14.2,
      "status": "ok",
      "is_error": false,
      "response_bytes": 1840,
      "params": {
        "project": "core-backend",
        "target": "process_payment",
        "max_depth": 3,
        "include_tests": true,
        "include_routes": true
      }
    }
  ]
}
```

### 4.2 Endpoint: `DELETE /api/tool-calls`

Clears the in-memory tool call history.

#### Response:
```json
{
  "cleared": true,
  "count": 42
}
```

---

## 5. Frontend UI Implementation (`graph-ui`)

### 5.1 Component Structure

Create a dedicated component:
`graph-ui/src/components/ToolCallLogViewer.tsx`

Integrated into `graph-ui/src/components/ControlTab.tsx` directly above `<LogViewer />`:

```tsx
/* In graph-ui/src/components/ControlTab.tsx */

{/* Process grid */}
<div className="mb-8">
  ...
</div>

{/* Tool Call Log (NEW: Placed directly above Process Logs) */}
<div className="mb-8">
  <ToolCallLogViewer />
</div>

{/* Log viewer (Process Logs) */}
<LogViewer />
```

### 5.2 Interactive Features
1. **Auto-Polling with Pause Switch**: Polls `/api/tool-calls?limit=100` every 2.5 seconds when active. Users can pause updates to inspect or copy parameters without the list jumping.
2. **Key Parameter Extraction**: Employs heuristic badges for common parameters so users can scan the list without opening every item:
   - For `search_graph`: badge showing `query: "..."`
   - For `analyze_blast_radius`: badge showing `target: "..."`
   - For `get_code_snippet`: badge showing `qn: "..."`
   - For `check_index_coverage`: badge showing `paths: N`
3. **Accordion JSON Viewer**: Clicking any row expands an indented JSON view of the complete parameter object.
4. **Copy Parameters Button**: Quick button with visual feedback ("Copied!") to copy formatted parameters into the clipboard.
5. **Filters**:
   - Free-text search input filtering by tool name, project, or parameter values.
   - Status toggle pills: `All`, `OK (Success)`, `Errors`.

### 5.3 Internationalization (i18n)

Add keys to `graph-ui/src/lib/i18n.ts` under `messages.en.control` and `messages.zh.control`:

```ts
// English
toolCallLog: "Tool Call Log",
noToolCalls: "No MCP tool calls recorded yet",
clearToolCalls: "Clear Log",
copyParams: "Copy Parameters",
copied: "Copied!",
filterTools: "Filter by tool or parameter...",
allStatus: "All",
successOnly: "Success",
errorOnly: "Errors",
pausePolling: "Pause Live Updates",
resumePolling: "Resume Live Updates",
duration: "Duration",
params: "Parameters",

// Chinese
toolCallLog: "工具调用日志",
noToolCalls: "暂无 MCP 工具调用记录",
clearToolCalls: "清除记录",
copyParams: "复制参数",
copied: "已复制！",
filterTools: "按工具或参数过滤...",
allStatus: "全部",
successOnly: "成功",
errorOnly: "错误",
pausePolling: "暂停实时更新",
resumePolling: "恢复实时更新",
duration: "耗时",
params: "参数",
```

---

## 6. Security, Privacy & Sanitization

1. **Sensitive Parameter Masking**:
   If an agent passes parameters containing sensitive keywords (`token`, `password`, `secret`, `authorization`, `api_key`), the backend or UI mask the displayed value with `"[REDACTED]"`.
2. **Buffer Bounds**:
   Parameter JSON is capped at 64 KB per record, with an overall ring limit of 500 records (~32 MB maximum worst-case RAM footprint, typically < 1 MB).
3. **Localhost Only**:
   The `/api/tool-calls` endpoint inherits the existing UI server security model (bound strictly to `127.0.0.1` unless explicitly configured).

---

## 7. Testing & Verification Plan

### 7.1 Backend C Tests (`tests/test_ui.c`)
- `test_tool_call_ring_record_and_retrieve`: Verify storing 10 tool calls and retrieving them via `cbm_tool_call_log_get`.
- `test_tool_call_ring_overflow_wrap`: Insert 600 calls into a 500-capacity ring; verify oldest 100 entries are evicted without memory leak under AddressSanitizer.
- `test_tool_call_param_truncation`: Verify oversized (> 64 KB) payloads are safely clamped.
- `test_tool_call_http_endpoint`: Verify `GET /api/tool-calls` returns valid JSON with status codes, headers, and parameter sub-objects.

### 7.2 Frontend React Tests (`graph-ui/src/components/ControlTab.test.tsx`)
- Verify `ToolCallLogViewer` renders on the Control page.
- Verify component appears DOM-wise **before** the process logs `LogViewer`.
- Verify fetching and displaying tool call items with tool badges and latency.
- Verify clicking an item expands the parameter inspector and clicking "Copy Parameters" invokes clipboard API.
- Verify status filter button filters between `All`, `Success`, and `Errors`.

---

## 8. Acceptance Criteria

- [ ] `RFC_009_Tool_Call_log.md` is approved and committed to `docs/`.
- [ ] Backend implements `cbm_tool_call_log` ring buffer and `/api/tool-calls` REST endpoints in `src/ui/http_server.c` and `src/mcp/mcp.c`.
- [ ] Frontend implements `ToolCallLogViewer` and embeds it in `ControlTab.tsx` directly above `LogViewer`.
- [ ] Full parameter JSON is formatted, syntax-styled, and copyable with one click.
- [ ] C tests pass under ASan/UBSan with zero leaks.
- [ ] Vitest test suite in `graph-ui` passes 100%.
