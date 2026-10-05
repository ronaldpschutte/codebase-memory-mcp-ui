import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRequestKey, deduplicatedCallTool, clearInFlightRequests, getInFlightCount } from "./dedup";
import * as rpc from "./rpc";

describe("api/dedup", () => {
  beforeEach(() => {
    clearInFlightRequests();
    vi.restoreAllMocks();
  });

  describe("buildRequestKey", () => {
    it("sorts keys deterministically", () => {
      const k1 = buildRequestKey("list_projects", { format: "json", detail: "stats", limit: 50 });
      const k2 = buildRequestKey("list_projects", { limit: 50, detail: "stats", format: "json" });
      expect(k1).toBe(k2);
      expect(k1).toBe('list_projects:{"detail":"stats","format":"json","limit":50}');
    });
  });

  describe("deduplicatedCallTool", () => {
    it("shares a single in-flight promise for concurrent identical calls", async () => {
      let callCount = 0;
      vi.spyOn(rpc, "callTool").mockImplementation(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
        return { result: "ok", count: callCount };
      });

      const p1 = deduplicatedCallTool("list_projects", { format: "json" });
      const p2 = deduplicatedCallTool("list_projects", { format: "json" });
      const p3 = deduplicatedCallTool("list_projects", { format: "json" });

      expect(getInFlightCount()).toBe(1);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(rpc.callTool).toHaveBeenCalledTimes(1);
      expect(r1).toEqual({ result: "ok", count: 1 });
      expect(r2).toEqual({ result: "ok", count: 1 });
      expect(r3).toEqual({ result: "ok", count: 1 });
      expect(getInFlightCount()).toBe(0);
    });

    it("triggers a new call once the previous in-flight promise resolves", async () => {
      vi.spyOn(rpc, "callTool").mockImplementation(async (_name, args) => ({
        echo: args,
      }));

      await deduplicatedCallTool("list_projects", { offset: 0 });
      expect(rpc.callTool).toHaveBeenCalledTimes(1);

      await deduplicatedCallTool("list_projects", { offset: 0 });
      expect(rpc.callTool).toHaveBeenCalledTimes(2);
    });

    it("immediately rejects if signal is already aborted", async () => {
      const spy = vi.spyOn(rpc, "callTool");
      const controller = new AbortController();
      controller.abort();

      await expect(
        deduplicatedCallTool("list_projects", {}, { signal: controller.signal }),
      ).rejects.toThrow("The user aborted a request.");

      expect(spy).not.toHaveBeenCalled();
    });

    it("allows one subscriber to abort without cancelling the underlying shared call", async () => {
      vi.spyOn(rpc, "callTool").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ done: true }), 60)),
      );

      const controller = new AbortController();
      const p1 = deduplicatedCallTool("list_projects", {}, { signal: controller.signal });
      const p2 = deduplicatedCallTool("list_projects", {});

      setTimeout(() => controller.abort(), 10);

      await expect(p1).rejects.toThrow("The user aborted a request.");
      const res2 = await p2;
      expect(res2).toEqual({ done: true });
    });
  });
});
