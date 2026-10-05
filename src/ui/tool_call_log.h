/*
 * tool_call_log.h — In-memory ring buffer for MCP tool call inspection.
 *
 * Captures the last 500 tool executions with their complete parameter JSON,
 * duration, status, and response size for live display on the Control page.
 */
#ifndef CBM_UI_TOOL_CALL_LOG_H
#define CBM_UI_TOOL_CALL_LOG_H

#include "foundation/compat.h"
#include "foundation/compat_thread.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

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

/* Initialize the tool call ring buffer. Safe for concurrent or repeated calls. */
void cbm_tool_call_log_init(void);

/* Record an MCP tool call into the ring buffer. */
void cbm_tool_call_log_record(const char *tool_name, const char *params_json,
                              bool is_error, int64_t duration_us, size_t response_bytes);

/* Clear all entries from the ring buffer. Returns number of cleared entries. */
int cbm_tool_call_log_clear(void);

/* Retrieve records matching query filters formatted as a JSON response.
 * Caller must free() returned string. Returns NULL on OOM. */
char *cbm_tool_call_log_to_json(int limit, uint64_t since_id, const char *tool_filter,
                                const char *status_filter);

/* For testing / programmatic inspection: get count and copies of records.
 * Returns number of records copied into out_records.
 * Caller must free out_records[i].params_json for each returned record. */
int cbm_tool_call_log_get(cbm_tool_call_record_t *out_records, int max_records);

#endif /* CBM_UI_TOOL_CALL_LOG_H */
