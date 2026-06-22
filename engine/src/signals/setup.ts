import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { attachConsole } from "./console.js";
import { attachLifecycle } from "./lifecycle.js";
import { attachNetwork } from "./network.js";
import { attachWebVitals } from "./webVitals.js";

/**
 * Wire all signal capture modules to a Playwright page.
 * Call this once per page (the runner creates a new page per run).
 */
export async function attachAllSignals(page: Page, db: Db, runId: string): Promise<void> {
  attachConsole(page, db, runId);
  attachLifecycle(page, db, runId);
  attachNetwork(page, db, runId);
  await attachWebVitals(page, db, runId);
}
