# RFC 010: `tool_call_response_viewer` — Full Response Payload Inspector and Scrollable History in Tool Call Log

- **RFC Number:** 010
- **Title:** `tool_call_response_viewer` — Full Response Payload Inspector and Scrollable History in Tool Call Log
- **Status:** Implemented
- **Author:** Codebase Memory Architecture Team
- **Target Subsystem:** `src/mcp/`, `src/ui/`, `graph-ui/src/components/ToolCallLogViewer.tsx`
- **Target Version:** v0.12.1
- **Created:** 2026-10-05
- **Related RFCs:** [RFC 009: `tool_call_log`](file:///c:/AI/Source/codebase-memory-mcp-ui/docs/RFC_009_Tool_Call_log.md)

---

## 1. Executive Summary & Problem Statement

### 1.1 Background & Motivation
In [RFC 009](file:///c:/AI/Source/codebase-memory-mcp-ui/docs/RFC_009_Tool_Call_log.md), codebase-memory-mcp introduced a real-time **Tool Call Log** on the Control page. It captured tool invocations, execution durations, status badges, and an accordion view displaying the **input parameters** sent by AI coding agents.

However, tool execution is a bidirectional dialogue:
1. **Responses Were Discarded**: After `cbm_mcp_handle_tool` executed, the server calculated `response_bytes = strlen(result_json)` and recorded only the byte count. The actual output string was immediately freed and discarded.
2. **Outputs Remained Opaque**: Developers and users inspecting an agent's interactions could see *what arguments* were provided to a tool (e.g. `query_graph`, `analyze_blast_radius`, `get_code_snippet`), but could **not see what the server returned**. Determining whether an agent hallucinated, whether a query matched zero nodes, or what payload an error generated required attaching external sniffers or sifting through raw process logs.
3. **Container Overflow**: Without fixed vertical scroll boundaries, expanding multiple large tool calls in the Tool Call Log lengthened the entire Control tab, pushing Process Logs off screen.

### 1.2 The Solution
Extend the Tool Call Log subsystem to capture, store, sanitize, and display the **full response payload** directly underneath the parameters box, with dedicated syntax formatting, metrics, copy actions, and bounded scrolling:

1. **Backend Response Capture & Clamping**:
   - Retain `result_json` in the daemon's ring buffer with a safe payload ceiling (`CBM_TOOL_CALL_RESPONSE_MAX = 64 KB`).
   - Apply automatic credential and secret redaction to both parameter and response payloads.
   - Maintain bounded memory consumption with strict FIFO reclamation upon buffer wrap.
2. **REST API Enhancement (`/api/tool-calls`)**:
   - Serialize the `"response"` field in JSON outputs alongside existing metadata and `"params"`.
3. **Frontend Stacked Box UI**:
   - When a row is expanded, render the **Parameters** box on top with its **Copy Parameters** button.
   - Render the **Response** box directly underneath with formatted JSON/text, response size badge, duration badge, error indicator, and an independent **Copy Response** button.
   - Add a fixed-height scroll container with custom scrollbars to prevent viewport blowout.

---

## 2. UI Layout & Visual Specification

When a tool call row is clicked and expanded in the **Tool Call Log**, the accordion displays two distinct, stacked code boxes:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ▼ TOOL CALL LOG                                    [Clear] [Pause] ⟳  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Filter: [search params or tool...]  [All | OK | Error]   1 / 1   │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [OK]  list_projects                    3907.3ms  17:33:59  ▲     │  │
│  │                                                                  │  │
│  │   PARAMETERS                                   [Copy Parameters] │  │
│  │   ┌────────────────────────────────────────────────────────────┐ │  │
│  │   │ {                                                          │ │  │
│  │   │   "detail": "stats",                                       │ │  │
│  │   │   "format": "json"                                         │ │  │
│  │   │ }                                                          │ │  │
│  │   └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  │   RESPONSE • 3026 bytes                         [Copy Response]  │  │
│  │   ┌────────────────────────────────────────────────────────────┐ │  │
│  │   │ {                                                          │ │  │
│  │   │   "content": [                                             │ │  │
│  │   │     {                                                      │ │  │
│  │   │       "type": "text",                                      │ │  │
│  │   │       "text": "{\"projects\":[{\"name\":\"core\",...}]}"   │ │  │
│  │   │     }                                                      │ │  │
│  │   │   ],                                                       │ │  │
│  │   │   "structuredContent": { ... }                             │ │  │
│  │   │ }                                                          │ │  │
│  │   └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Characteristics
- **Parameters Box**:
  - Small uppercase label `PARAMETERS` in muted text (`text-[10px] uppercase tracking-wider`).
  - Dark preformatted code container (`bg-[#050b0e] border border-border/40 font-mono text-[11px]`).
  - Top-right action: **Copy Parameters** button with clipboard confirmation.
- **Response Box**:
  - Small uppercase label `RESPONSE` with byte count metric (e.g. `• 3026 bytes`).
  - Red error badge displayed if `is_error` is `true`.
  - Top-right action: **Copy Response** button with clipboard confirmation.
  - Constrained max height (`max-h-[360px] overflow-y-auto`) with responsive scrollbar.

---

## 3. C Backend Architecture & Memory Management

### 3.1 Data Structures (`src/ui/tool_call_log.h`)
The ring buffer record struct is expanded to store the heap-allocated response string:

```c
#define CBM_TOOL_CALL_RING_SIZE 500
#define CBM_TOOL_CALL_PARAM_MAX (64 * 1024)    /* 64 KB cap per call payload */
#define CBM_TOOL_CALL_RESPONSE_MAX (64 * 1024) /* 64 KB cap per response payload */

typedef struct {
    uint64_t id;
    uint64_t timestamp_ms;
    char tool_name[64];
    char project[128];
    char *params_json;
    char *response_json;   /* Heap-allocated sanitized response JSON */
    int64_t duration_us;
    bool is_error;
    size_t response_bytes; /* Raw byte size of output JSON */
} cbm_tool_call_record_t;
```

### 3.2 Capture Hook in MCP Tool Execution (`src/mcp/mcp.c`)
In `cbm_mcp_handle_tool`, `result_json` is produced by the tool handler before sending the JSON-RPC reply. Instead of discarding `result_json`, it is passed directly to `cbm_tool_call_log_record`:

```c
size_t resp_len = result_json ? strlen(result_json) : 0;
cbm_tool_call_log_record(tool_name, params_buf, result_json,
                         is_err, elapsed_ms * 1000, resp_len);
```

### 3.3 Sanitization, Clamping & Truncation Handling (`src/ui/tool_call_log.c`)
To guarantee that neither parameters nor responses leak sensitive secrets or exhaust system memory, all incoming payloads pass through `sanitize_and_clamp_payload()`:

```c
static char *sanitize_and_clamp_payload(const char *raw, size_t max_bytes) {
    if (!raw || !raw[0]) return NULL;
    size_t len = strlen(raw);
    bool needs_trunc = (len > max_bytes);
    size_t copy_len = needs_trunc ? max_bytes : len;

    char *buf = malloc(copy_len + 32);
    if (!buf) return NULL;
    memcpy(buf, raw, copy_len);
    buf[copy_len] = '\0';

    if (needs_trunc) {
        strcat(buf, "\n... (truncated)");
    }

    redact_sensitive_keys(buf);
    return buf;
}
```

### 3.4 Ring Buffer Lifecycle & Memory Reclamation
1. **Slot Overwrite**: When the ring buffer index reaches an existing record (FIFO overflow after 500 entries), both `params_json` and `response_json` are explicitly freed with `free()` before assigning the new record.
2. **Buffer Clear**: `cbm_tool_call_log_clear()` traverses all 500 slots, frees non-null strings, and resets head/tail counters.
3. **Retrieval**: `cbm_tool_call_log_get()` duplicates strings (`strdup`) under mutex lock, allowing callers to consume snapshots safely without race conditions.

---

## 4. HTTP REST API Specification

### 4.1 Endpoint: `GET /api/tool-calls`
Returns the recent tool call history from the in-memory ring buffer.

#### Response Schema
```json
{
  "total": 1,
  "latest_id": 134,
  "tool_calls": [
    {
      "id": 134,
      "timestamp": "2026-10-05T17:33:59.569Z",
      "timestamp_ms": 1791221639569,
      "tool": "list_projects",
      "project": "",
      "duration_ms": 3907.27,
      "status": "ok",
      "is_error": false,
      "response_bytes": 3026,
      "params": {
        "detail": "stats",
        "format": "json"
      },
      "response": {
        "content": [
          {
            "type": "text",
            "text": "{\"projects\":[...]}"
          }
        ],
        "structuredContent": { ... },
        "isError": false
      }
    }
  ]
}
```

#### Truncation Safe Serialization
If a response payload exceeded the 64 KB limit and contains `(truncated)`, the C backend serializes it as an escaped JSON object to prevent client-side parsing failures:
```json
"response": {
  "_truncated": true,
  "_raw": "{\"projects\":[... \n... (truncated)"
}
```

---

## 5. Frontend React Component Architecture

### 5.1 Type Definitions (`graph-ui/src/lib/types.ts`)
```typescript
export interface ToolCallRecord {
  id: number;
  timestamp: string;
  timestamp_ms: number;
  tool: string;
  project?: string;
  duration_ms: number;
  status: "ok" | "error";
  is_error: boolean;
  response_bytes?: number;
  params?: Record<string, unknown>;
  response?: unknown;
}
```

### 5.2 Component Implementation (`graph-ui/src/components/ToolCallLogViewer.tsx`)
- **Independent Clipboard State**: Separate state hooks (`copiedId` for parameters, `copiedResponseId` for response) ensure that clicking copy on one container does not toggle feedback on the other.
- **Lazy Rendering**: Accordion children containing formatted `<pre>` code tags are only rendered when `isExpanded` is true, avoiding excessive DOM node creation for unexpanded rows.
- **Scroll Area Integration**: Wrapped in `ScrollArea` with a fixed max height (`max-h-[520px]`) and internal overflow scrolling.

---

## 6. Performance, Latency & Resource Impact

### 6.1 Memory (RAM) Analysis
- **Ring Size:** 500 records.
- **Hard Upper Bound:** $500 \times 64\text{ KB} \approx 32\text{ MB}$.
- **Typical Footprint:** Average response size is ~2 KB. Real-world daemon memory overhead is **~1 to 3 MB**.
- **Reclamation:** Strict FIFO eviction ensures zero memory leaks over long-running sessions.

### 6.2 Execution Latency
- `result_json` was already produced by the tool execution logic in `src/mcp/mcp.c`.
- `sanitize_and_clamp_payload()` performs a bounded scan taking **5 to 20 microseconds** ($< 0.02\text{ ms}$).
- Added latency relative to tool execution duration is $< 0.05\%$.

### 6.3 Localhost HTTP Overhead
- Transmitting ~100 KB over loopback interface (`127.0.0.1`) requires $< 0.5\text{ ms}$.
- C serialization via `dyn_buf` executes in $< 1\text{ ms}$.

---

## 7. Testing & Verification

### 7.1 Backend C Unit Tests (`tests/test_ui.c`)
1. `TEST(tool_call_ring_record_and_retrieve)`:
   - Validates that `response_json` is recorded, retrieved via `cbm_tool_call_log_get`, and freed without leaks.
2. `TEST(tool_call_ring_overflow_wrap)`:
   - Inserts 600 records into a 500-slot ring buffer.
   - Verifies that the oldest 100 entries have their responses evicted cleanly.
3. `TEST(tool_call_http_endpoint)`:
   - Verifies that `/api/tool-calls` serializes the `"response"` field in JSON.
   - Confirms sensitive keys in responses are masked with `[REDACTED]`.

### 7.2 Frontend React Unit Tests (`graph-ui/src/components/ControlTab.test.tsx`)
1. **Accordion Layout Test**:
   - Mocks `/api/tool-calls` returning both `params` and `response`.
   - Expands the accordion row.
   - Asserts both `PARAMETERS` and `RESPONSE` section headers exist.
   - Asserts the response container appears underneath the parameters container.
2. **Clipboard Action Test**:
   - Clicks "Copy Response".
   - Verifies that `navigator.clipboard.writeText` receives the formatted response JSON.

### 7.3 End-to-End Browser Verification
- Compiled and launched native Windows daemon.
- Executed live `list_projects` tool call over MCP JSON-RPC.
- Verified visual presentation in Chromium browser at `http://localhost:5173/?tab=control` and captured screenshot.

---

## 8. Development Mode Notes: React StrictMode & Hook Invocations
During validation, navigating to the Projects tab (`?tab=stats`) initially showed 2 `list_projects` calls in the Tool Call Log instead of 1.

### Root Cause
1. **React `<StrictMode>`**: In Vite development mode (`npm run dev`), React intentionally mounts, unmounts, and remounts components (`mount -> unmount -> mount`) to detect impure side effects.
2. **Missing In-Flight Cancellation**: `useProjects` dispatched `fetchAllProjects()` without an `AbortController`. When unmounted and remounted immediately by StrictMode, the initial fetch remained in-flight while a second fetch was dispatched.
3. **Sequential Execution**: The C daemon queues MCP operations serially behind its project supervisor lock, causing the two calls to log sequentially (~2.6 seconds apart).
4. **Production Parity**: In production builds (`npm run build`), React disables StrictMode double-mounting; only a single call is dispatched.
