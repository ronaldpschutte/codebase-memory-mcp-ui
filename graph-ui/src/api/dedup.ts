import { callTool, type CallOptions } from "./rpc";

interface InFlightEntry {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: Set<AbortSignal | null>;
}

type InFlightMap = Map<string, InFlightEntry>;
const inFlightRequests: InFlightMap = new Map();

/**
 * Builds a deterministic key for a tool call based on name and sorted JSON arguments.
 */
export function buildRequestKey(tool: string, args: Record<string, unknown> = {}): string {
  const sortedKeys = Object.keys(args).sort();
  const sortedArgs: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    sortedArgs[k] = args[k];
  }
  return `${tool}:${JSON.stringify(sortedArgs)}`;
}

/**
 * Wraps callTool to deduplicate identical in-flight requests.
 * If an identical (tool + arguments) request is already in-flight, returns the active Promise
 * instead of issuing a redundant network request.
 * If subscribers abort, individual callers reject; if all subscribers abort, the underlying fetch is aborted.
 */
export function deduplicatedCallTool<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  options?: CallOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
  }

  const key = buildRequestKey(tool, args);
  let entry = inFlightRequests.get(key);

  if (!entry) {
    const controller = new AbortController();
    const subscribers = new Set<AbortSignal | null>();
    const promise = callTool<T>(tool, args, { signal: controller.signal }).finally(() => {
      inFlightRequests.delete(key);
    });
    entry = { promise, controller, subscribers };
    inFlightRequests.set(key, entry);
  }

  const sub = options?.signal ?? null;
  entry.subscribers.add(sub);

  if (options?.signal) {
    const currentEntry = entry;
    const signal = options.signal;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        currentEntry.subscribers.delete(signal);
        if (currentEntry.subscribers.size === 0) {
          currentEntry.controller.abort();
        }
        reject(new DOMException("The user aborted a request.", "AbortError"));
      };
      signal.addEventListener("abort", onAbort);

      (currentEntry.promise as Promise<T>).then(
        (val) => {
          signal.removeEventListener("abort", onAbort);
          resolve(val);
        },
        (err) => {
          signal.removeEventListener("abort", onAbort);
          reject(err);
        },
      );
    });
  }

  return entry.promise as Promise<T>;
}

/** Clear all tracked in-flight requests (primarily for test resets). */
export function clearInFlightRequests(): void {
  inFlightRequests.clear();
}

/** Return the number of currently active in-flight deduplicated requests. */
export function getInFlightCount(): number {
  return inFlightRequests.size;
}
