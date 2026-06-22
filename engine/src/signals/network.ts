import type { Page, Request, Response } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Attach network listeners. We measure per-request duration via Date.now() deltas
 * (Playwright's Response does not expose CDP timing directly; the Resource Timing
 * API gives the same data with more ceremony, and for the analyzer's thresholds
 * a Date diff is sufficient).
 */
export function attachNetwork(page: Page, db: Db, runId: string): void {
  const requestStarts = new Map<string, number>();

  page.on("request", (req: Request) => {
    requestStarts.set(req.url() + "|" + req.method(), Date.now());
  });

  page.on("response", async (res: Response) => {
    try {
      const req = res.request();
      const key = req.url() + "|" + req.method();
      const start = requestStarts.get(key);
      const durationMs = typeof start === "number" ? Date.now() - start : null;
      requestStarts.delete(key);
      const headers = await res.allHeaders();
      signalsRepo.insert(db, runId, {
        category: "network",
        type: "response",
        payload: {
          url: res.url(),
          method: req.method(),
          status: res.status(),
          resourceType: req.resourceType(),
          ok: res.ok(),
          contentLength: Number(headers["content-length"] ?? 0) || null,
          durationMs,
          fromCache: res.fromServiceWorker() || headers["age"] !== undefined,
          finalUrl: page.url(),
        },
      });
    } catch {
      // ignore
    }
  });

  page.on("requestfailed", (req) => {
    const key = req.url() + "|" + req.method();
    requestStarts.delete(key);
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "request_failed",
      payload: {
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        failure: req.failure()?.errorText ?? "unknown",
        finalUrl: page.url(),
      },
    });
  });
}
