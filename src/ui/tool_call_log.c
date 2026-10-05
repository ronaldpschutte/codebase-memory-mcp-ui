/*
 * tool_call_log.c — In-memory ring buffer for MCP tool call inspection.
 *
 * Implements thread-safe recording, sanitization, querying, and JSON formatting
 * of MCP tool invocations for the Control page inspector.
 */
#include "ui/tool_call_log.h"
#include "foundation/compat.h"
#include "foundation/compat_thread.h"

#include <ctype.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
#include <windows.h>
#endif

enum {
    CBM_TOOL_MUTEX_UNINIT = 0,
    CBM_TOOL_MUTEX_INITING = 1,
    CBM_TOOL_MUTEX_INITED = 2
};

static atomic_int g_tool_mutex_init = CBM_TOOL_MUTEX_UNINIT;
static cbm_tool_call_ring_t g_tool_ring;

/* Safe for concurrent / repeated initialization */
void cbm_tool_call_log_init(void) {
    int state = atomic_load(&g_tool_mutex_init);
    if (state == CBM_TOOL_MUTEX_INITED) {
        return;
    }

    state = CBM_TOOL_MUTEX_UNINIT;
    if (atomic_compare_exchange_strong(&g_tool_mutex_init, &state, CBM_TOOL_MUTEX_INITING)) {
        memset(&g_tool_ring, 0, sizeof(g_tool_ring));
        g_tool_ring.next_id = 1;
        cbm_mutex_init(&g_tool_ring.lock);
        atomic_store(&g_tool_mutex_init, CBM_TOOL_MUTEX_INITED);
        return;
    }

    while (atomic_load(&g_tool_mutex_init) != CBM_TOOL_MUTEX_INITED) {
        cbm_usleep(1000); /* 1ms */
    }
}

static int64_t get_wall_time_ms(void) {
#ifdef _WIN32
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    uint64_t t = ((uint64_t)ft.dwHighDateTime << 32) | ft.dwLowDateTime;
    t -= 116444736000000000ULL;
    return (int64_t)(t / 10000ULL);
#else
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (int64_t)ts.tv_sec * 1000 + (int64_t)ts.tv_nsec / 1000000;
#endif
}

static void format_iso_time(int64_t ms, char *out, size_t outsz) {
    time_t sec = (time_t)(ms / 1000);
    int rem_ms = (int)(ms % 1000);
    if (rem_ms < 0) {
        rem_ms = 0;
    }
    struct tm tm_buf;
    if (cbm_gmtime_r(&sec, &tm_buf)) {
        char base[32];
        strftime(base, sizeof(base), "%Y-%m-%dT%H:%M:%S", &tm_buf);
        snprintf(out, outsz, "%s.%03dZ", base, rem_ms);
    } else {
        snprintf(out, outsz, "1970-01-01T00:00:00.000Z");
    }
}

/* Extract "project": "..." from JSON if present */
static void extract_project(const char *json, char *out, size_t outsz) {
    out[0] = '\0';
    if (!json) {
        return;
    }
    const char *p = strstr(json, "\"project\"");
    if (!p) {
        return;
    }
    p += 9;
    while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') {
        p++;
    }
    if (*p != ':') {
        return;
    }
    p++;
    while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') {
        p++;
    }
    if (*p == '"') {
        p++;
        size_t idx = 0;
        while (*p && *p != '"' && idx + 1 < outsz) {
            if (*p == '\\' && *(p + 1)) {
                p++;
            }
            out[idx++] = *p++;
        }
        out[idx] = '\0';
    }
}

static bool is_sensitive_key(const char *key, size_t key_len) {
    char lk[128];
    if (key_len >= sizeof(lk)) {
        key_len = sizeof(lk) - 1;
    }
    for (size_t i = 0; i < key_len; i++) {
        lk[i] = (char)tolower((unsigned char)key[i]);
    }
    lk[key_len] = '\0';

    return strstr(lk, "token") != NULL ||
           strstr(lk, "password") != NULL ||
           strstr(lk, "secret") != NULL ||
           strstr(lk, "authorization") != NULL ||
           strstr(lk, "api_key") != NULL ||
           strstr(lk, "apikey") != NULL;
}

/* Redact sensitive keyword values in JSON and clamp oversized payloads */
static char *sanitize_and_clamp_params(const char *raw) {
    if (!raw || !raw[0]) {
        return strdup("{}");
    }

    size_t raw_len = strlen(raw);
    bool needs_truncation = (raw_len > CBM_TOOL_CALL_PARAM_MAX);
    size_t scan_len = needs_truncation ? (CBM_TOOL_CALL_PARAM_MAX - 32) : raw_len;

    /* Allocate capacity allowing for redaction replacement expansions */
    size_t cap = scan_len + 256;
    char *out = malloc(cap);
    if (!out) {
        return strdup("{}");
    }

    size_t out_len = 0;
    const char *p = raw;
    const char *end = raw + scan_len;

    while (p < end) {
        if (*p == '"') {
            /* Found start of string */
            const char *key_start = ++p;
            while (p < end && *p != '"') {
                if (*p == '\\' && p + 1 < end) {
                    p += 2;
                } else {
                    p++;
                }
            }
            size_t key_len = (size_t)(p - key_start);
            if (p < end) {
                p++; /* skip closing quote */
            }

            /* Copy the quoted key/string into out */
            if (out_len + key_len + 3 >= cap) {
                cap = cap * 2 + key_len + 32;
                char *nb = realloc(out, cap);
                if (!nb) {
                    free(out);
                    return strdup("{}");
                }
                out = nb;
            }
            out[out_len++] = '"';
            memcpy(out + out_len, key_start, key_len);
            out_len += key_len;
            out[out_len++] = '"';

            /* Check if this string is a key followed by ':' */
            const char *lookahead = p;
            while (lookahead < end && (*lookahead == ' ' || *lookahead == '\t' ||
                                       *lookahead == '\r' || *lookahead == '\n')) {
                lookahead++;
            }

            if (lookahead < end && *lookahead == ':' && is_sensitive_key(key_start, key_len)) {
                /* Copy whitespace and colon */
                size_t sep_len = (size_t)(lookahead - p) + 1;
                if (out_len + sep_len + 32 >= cap) {
                    cap = cap * 2 + sep_len + 64;
                    char *nb = realloc(out, cap);
                    if (!nb) {
                        free(out);
                        return strdup("{}");
                    }
                    out = nb;
                }
                memcpy(out + out_len, p, sep_len);
                out_len += sep_len;
                p = lookahead + 1;

                /* Skip whitespace after ':' */
                while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) {
                    out[out_len++] = *p++;
                }

                /* If value is a string, redact it */
                if (p < end && *p == '"') {
                    p++; /* skip opening quote */
                    while (p < end && *p != '"') {
                        if (*p == '\\' && p + 1 < end) {
                            p += 2;
                        } else {
                            p++;
                        }
                    }
                    if (p < end) {
                        p++; /* skip closing quote */
                    }
                    const char *redacted = "\"[REDACTED]\"";
                    size_t rlen = strlen(redacted);
                    if (out_len + rlen + 8 >= cap) {
                        cap = cap * 2 + rlen + 32;
                        char *nb = realloc(out, cap);
                        if (!nb) {
                            free(out);
                            return strdup("{}");
                        }
                        out = nb;
                    }
                    memcpy(out + out_len, redacted, rlen);
                    out_len += rlen;
                }
            }
        } else {
            if (out_len + 2 >= cap) {
                cap = cap * 2 + 64;
                char *nb = realloc(out, cap);
                if (!nb) {
                    free(out);
                    return strdup("{}");
                }
                out = nb;
            }
            out[out_len++] = *p++;
        }
    }

    if (needs_truncation) {
        const char *notice = "... (truncated)";
        size_t nlen = strlen(notice);
        if (out_len + nlen + 1 >= cap) {
            char *nb = realloc(out, out_len + nlen + 16);
            if (nb) {
                out = nb;
            }
        }
        memcpy(out + out_len, notice, nlen);
        out_len += nlen;
    }

    out[out_len] = '\0';
    return out;
}

void cbm_tool_call_log_record(const char *tool_name, const char *params_json,
                              bool is_error, int64_t duration_us, size_t response_bytes) {
    if (!tool_name) {
        return;
    }
    cbm_tool_call_log_init();

    char project[128] = {0};
    extract_project(params_json, project, sizeof(project));

    char *sanitized = sanitize_and_clamp_params(params_json);

    cbm_mutex_lock(&g_tool_ring.lock);
    int slot = g_tool_ring.head;
    if (g_tool_ring.entries[slot].params_json) {
        free(g_tool_ring.entries[slot].params_json);
        g_tool_ring.entries[slot].params_json = NULL;
    }

    cbm_tool_call_record_t *rec = &g_tool_ring.entries[slot];
    rec->id = g_tool_ring.next_id++;
    rec->timestamp_ms = get_wall_time_ms();
    snprintf(rec->tool_name, sizeof(rec->tool_name), "%s", tool_name);
    snprintf(rec->project, sizeof(rec->project), "%s", project);
    rec->params_json = sanitized;
    rec->duration_us = duration_us;
    rec->is_error = is_error;
    rec->response_bytes = response_bytes;

    g_tool_ring.head = (g_tool_ring.head + 1) % CBM_TOOL_CALL_RING_SIZE;
    if (g_tool_ring.count < CBM_TOOL_CALL_RING_SIZE) {
        g_tool_ring.count++;
    }
    cbm_mutex_unlock(&g_tool_ring.lock);
}

int cbm_tool_call_log_clear(void) {
    cbm_tool_call_log_init();
    cbm_mutex_lock(&g_tool_ring.lock);
    int count = g_tool_ring.count;
    for (int i = 0; i < CBM_TOOL_CALL_RING_SIZE; i++) {
        if (g_tool_ring.entries[i].params_json) {
            free(g_tool_ring.entries[i].params_json);
            g_tool_ring.entries[i].params_json = NULL;
        }
        memset(&g_tool_ring.entries[i], 0, sizeof(g_tool_ring.entries[i]));
    }
    g_tool_ring.head = 0;
    g_tool_ring.count = 0;
    cbm_mutex_unlock(&g_tool_ring.lock);
    return count;
}

int cbm_tool_call_log_get(cbm_tool_call_record_t *out_records, int max_records) {
    if (!out_records || max_records <= 0) {
        return 0;
    }
    cbm_tool_call_log_init();
    cbm_mutex_lock(&g_tool_ring.lock);
    int n = g_tool_ring.count < max_records ? g_tool_ring.count : max_records;
    int start = (g_tool_ring.head - g_tool_ring.count + CBM_TOOL_CALL_RING_SIZE) % CBM_TOOL_CALL_RING_SIZE;

    for (int i = 0; i < n; i++) {
        int idx = (start + i) % CBM_TOOL_CALL_RING_SIZE;
        out_records[i] = g_tool_ring.entries[idx];
        if (g_tool_ring.entries[idx].params_json) {
            out_records[i].params_json = strdup(g_tool_ring.entries[idx].params_json);
        } else {
            out_records[i].params_json = NULL;
        }
    }
    cbm_mutex_unlock(&g_tool_ring.lock);
    return n;
}

typedef struct {
    char *buf;
    size_t cap;
    size_t len;
} dynamic_buf_t;

static bool dyn_buf_append(dynamic_buf_t *db, const char *s, size_t n) {
    if (db->len + n + 1 >= db->cap) {
        size_t new_cap = db->cap ? db->cap * 2 : 4096;
        while (new_cap <= db->len + n + 1) {
            new_cap *= 2;
        }
        char *nb = realloc(db->buf, new_cap);
        if (!nb) {
            return false;
        }
        db->buf = nb;
        db->cap = new_cap;
    }
    memcpy(db->buf + db->len, s, n);
    db->len += n;
    db->buf[db->len] = '\0';
    return true;
}

static bool dyn_buf_appends(dynamic_buf_t *db, const char *s) {
    return dyn_buf_append(db, s, strlen(s));
}

static bool dyn_buf_append_escaped(dynamic_buf_t *db, const char *s) {
    if (!s) return true;
    for (const char *p = s; *p; p++) {
        char ch = *p;
        if (ch == '"') {
            if (!dyn_buf_appends(db, "\\\"")) return false;
        } else if (ch == '\\') {
            if (!dyn_buf_appends(db, "\\\\")) return false;
        } else if (ch == '\n') {
            if (!dyn_buf_appends(db, "\\n")) return false;
        } else if (ch == '\r') {
            if (!dyn_buf_appends(db, "\\r")) return false;
        } else if (ch == '\t') {
            if (!dyn_buf_appends(db, "\\t")) return false;
        } else {
            if (!dyn_buf_append(db, &ch, 1)) return false;
        }
    }
    return true;
}

char *cbm_tool_call_log_to_json(int limit, uint64_t since_id, const char *tool_filter,
                                const char *status_filter) {
    cbm_tool_call_log_init();

    if (limit <= 0) {
        limit = 50;
    } else if (limit > 500) {
        limit = 500;
    }

    bool filter_tool = (tool_filter && tool_filter[0] != '\0');
    bool filter_ok = (status_filter && strcmp(status_filter, "ok") == 0);
    bool filter_err = (status_filter && strcmp(status_filter, "error") == 0);

    cbm_mutex_lock(&g_tool_ring.lock);

    uint64_t latest_id = 0;
    if (g_tool_ring.count > 0) {
        int latest_idx = (g_tool_ring.head - 1 + CBM_TOOL_CALL_RING_SIZE) % CBM_TOOL_CALL_RING_SIZE;
        latest_id = g_tool_ring.entries[latest_idx].id;
    }

    /* Count total matching entries across ring */
    int total_matching = 0;
    for (int i = 0; i < g_tool_ring.count; i++) {
        int idx = (g_tool_ring.head - 1 - i + CBM_TOOL_CALL_RING_SIZE) % CBM_TOOL_CALL_RING_SIZE;
        const cbm_tool_call_record_t *rec = &g_tool_ring.entries[idx];
        if (since_id > 0 && rec->id <= since_id) {
            continue;
        }
        if (filter_tool && strcmp(rec->tool_name, tool_filter) != 0) {
            continue;
        }
        if (filter_ok && rec->is_error) {
            continue;
        }
        if (filter_err && !rec->is_error) {
            continue;
        }
        total_matching++;
    }

    dynamic_buf_t db = {0};
    char num_buf[64];
    snprintf(num_buf, sizeof(num_buf), "{\"total\":%d,\"latest_id\":%llu,\"tool_calls\":[",
             total_matching, (unsigned long long)latest_id);
    if (!dyn_buf_appends(&db, num_buf)) {
        cbm_mutex_unlock(&g_tool_ring.lock);
        return NULL;
    }

    int emitted = 0;
    for (int i = 0; i < g_tool_ring.count && emitted < limit; i++) {
        int idx = (g_tool_ring.head - 1 - i + CBM_TOOL_CALL_RING_SIZE) % CBM_TOOL_CALL_RING_SIZE;
        const cbm_tool_call_record_t *rec = &g_tool_ring.entries[idx];

        if (since_id > 0 && rec->id <= since_id) {
            continue;
        }
        if (filter_tool && strcmp(rec->tool_name, tool_filter) != 0) {
            continue;
        }
        if (filter_ok && rec->is_error) {
            continue;
        }
        if (filter_err && !rec->is_error) {
            continue;
        }

        if (emitted > 0) {
            if (!dyn_buf_appends(&db, ",")) break;
        }

        char iso_time[40];
        format_iso_time(rec->timestamp_ms, iso_time, sizeof(iso_time));
        double dur_ms = (double)rec->duration_us / 1000.0;

        char item_head[512];
        snprintf(item_head, sizeof(item_head),
                 "{\"id\":%llu,\"timestamp\":\"%s\",\"timestamp_ms\":%lld,"
                 "\"tool\":\"%s\",\"project\":\"%s\",\"duration_ms\":%.2f,"
                 "\"status\":\"%s\",\"is_error\":%s,\"response_bytes\":%zu,\"params\":",
                 (unsigned long long)rec->id,
                 iso_time,
                 (long long)rec->timestamp_ms,
                 rec->tool_name,
                 rec->project,
                 dur_ms,
                 rec->is_error ? "error" : "ok",
                 rec->is_error ? "true" : "false",
                 rec->response_bytes);

        if (!dyn_buf_appends(&db, item_head)) break;

        /* Append params */
        const char *pj = rec->params_json ? rec->params_json : "{}";
        size_t pj_len = strlen(pj);
        bool is_truncated = (strstr(pj, "(truncated)") != NULL);

        if (!is_truncated && pj_len > 0 && (pj[0] == '{' || pj[0] == '[')) {
            if (!dyn_buf_appends(&db, pj)) break;
        } else if (is_truncated) {
            if (!dyn_buf_appends(&db, "{\"_truncated\":true,\"_raw\":\"")) break;
            if (!dyn_buf_append_escaped(&db, pj)) break;
            if (!dyn_buf_appends(&db, "\"}")) break;
        } else {
            if (!dyn_buf_appends(&db, "{}")) break;
        }

        if (!dyn_buf_appends(&db, "}")) break;
        emitted++;
    }

    dyn_buf_appends(&db, "]}");
    cbm_mutex_unlock(&g_tool_ring.lock);

    return db.buf;
}
