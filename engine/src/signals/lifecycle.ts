import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Capture page lifecycle signals: DOMContentLoaded, load, networkidle,
 * redirect count, final URL.
 */
export function attachLifecycle(page: Page, db: Db, runId: string): void {
  const lifecycles = new Set<string>();

  page.on("domcontentloaded", () => {
    if (lifecycles.has("dcl")) return;
    lifecycles.add("dcl");
    signalsRepo.insert(db, runId, {
      category: "lifecycle",
      type: "domcontentloaded",
      payload: { url: page.url(), at: Date.now() },
    });
  });

  page.on("load", () => {
    if (lifecycles.has("load")) return;
    lifecycles.add("load");
    signalsRepo.insert(db, runId, {
      category: "lifecycle",
      type: "load",
      payload: { url: page.url(), at: Date.now() },
    });
  });

  // networkidle is not a Playwright event; capture on a waitFor at journey level
  // and record final URL on close.
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    signalsRepo.insert(db, runId, {
      category: "lifecycle",
      type: "framenavigated",
      payload: { url: frame.url(), at: Date.now() },
    });
  });

  page.on("close", () => {
    // No-op; final URL is captured via the navigation signal
  });
}
