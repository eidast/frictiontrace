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

    // Cumulative metrics (lcp, cls) fire repeatedly with updated values of the
    // same measurement — keep only the latest unflushed entry. Event-style
    // metrics (long_task, inp, fcp) append: each entry is a distinct event.
    const LATEST_WINS = new Set(["lcp", "cls"]);
    const push = (type: string, value: number, payload?: unknown) => {
      if (LATEST_WINS.has(type)) {
        w.__ftVitals__ = w.__ftVitals__!.filter((e) => e.type !== type);
      }
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

    // Navigation timing. Fields like domContentLoadedEventEnd/loadEventEnd are
    // 0 until their events fire, so only persist values > 0, and re-capture
    // once the window load event fires (or immediately if already complete).
    const pushNavTiming = () => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as
          | (PerformanceNavigationTiming & { responseStart?: number })
          | undefined;
        if (!nav) return;
        if (typeof nav.responseStart === "number" && nav.responseStart > 0) push("ttfb", nav.responseStart);
        if (nav.domContentLoadedEventEnd > 0) push("dcl", nav.domContentLoadedEventEnd);
        if (nav.loadEventEnd > 0) push("load", nav.loadEventEnd);
        if (nav.domInteractive > 0) push("tti", nav.domInteractive);
      } catch {
        // ignore
      }
    };
    try {
      if (document.readyState === "complete") {
        pushNavTiming();
      } else {
        window.addEventListener("load", pushNavTiming, { once: true });
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

  const interval = setInterval(() => void drainWebVitals(page, db, runId), 1000);
  page.on("close", () => clearInterval(interval));
}

/**
 * Flush buffered vitals from the page into SQLite. Called on a 1s interval by
 * attachWebVitals, and must be called once more after the last journey step,
 * before the page/context closes — a closed page can no longer be evaluated,
 * so this cannot run from a "close" handler.
 */
export async function drainWebVitals(page: Page, db: Db, runId: string): Promise<void> {
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
}

