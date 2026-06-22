import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Inject a script into the page that captures Web Vitals (LCP, INP, CLS, FCP, TTFB),
 * long tasks, and page navigation timing, and writes them to window.__ftVitals__.
 * The drain loop (started by this function) periodically flushes them to SQLite.
 *
 * TypeScript's PerformanceObserver types are strict and don't include newer
 * entry types (largest-contentful-paint, layout-shift, event). We use `as any`
 * to bypass that — Chromium supports them in practice.
 */
export async function attachWebVitals(page: Page, db: Db, runId: string): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __ftVitals__?: Array<{ type: string; value: number; payload?: unknown; at: number }>;
    };
    w.__ftVitals__ = w.__ftVitals__ ?? [];

    const push = (type: string, value: number, payload?: unknown) => {
      w.__ftVitals__!.push({ type, value, payload, at: Date.now() });
    };

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          const e = last as unknown as { startTime: number; name: string; size?: number };
          push("lcp", e.startTime, { url: e.name, size: e.size });
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }

    // FCP (paint)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntriesByName("first-contentful-paint")) {
          push("fcp", entry.startTime);
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }

    // Long tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as unknown as { duration: number; name: string; startTime: number; attribution?: unknown };
          push("long_task", e.duration, { name: e.name, startTime: e.startTime, attribution: e.attribution });
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }

    // CLS (layout-shift)
    try {
      let cls = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
          if (!entry.hadRecentInput && typeof entry.value === "number") {
            cls += entry.value;
          }
        }
        push("cls", cls);
      });
      clsObserver.observe({ type: "layout-shift", buffered: true } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }

    // Navigation timing
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | (PerformanceNavigationTiming & { responseStart?: number })
        | undefined;
      if (nav) {
        if (typeof nav.responseStart === "number") push("ttfb", nav.responseStart);
        if (typeof nav.domContentLoadedEventEnd === "number") push("dcl", nav.domContentLoadedEventEnd);
        if (typeof nav.loadEventEnd === "number") push("load", nav.loadEventEnd);
        if (typeof nav.domInteractive === "number") push("tti", nav.domInteractive);
      }
    } catch {
      // ignore
    }

    // INP via event-timing
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { duration?: number }>) {
          if (typeof entry.duration === "number") {
            push("inp", entry.duration, { name: entry.name });
          }
        }
      });
      inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }
  });

  const drain = async (): Promise<void> => {
    try {
      const collected = await page.evaluate(() => {
        const w = window as unknown as { __ftVitals__?: Array<{ type: string; value: number; payload?: unknown; at: number }> };
        const out = w.__ftVitals__ ?? [];
        w.__ftVitals__ = [];
        return out;
      });
      if (collected.length > 0) {
        for (const entry of collected) {
          signalsRepo.insert(db, runId, {
            category: "web_vitals",
            type: entry.type,
            payload: { value: entry.value, ...(entry.payload as object ?? {}) },
            captured_at: entry.at,
          });
        }
      }
    } catch {
      // Page might be navigating — ignore
    }
  };

  const interval = setInterval(() => void drain(), 1000);
  page.on("close", () => clearInterval(interval));
}
