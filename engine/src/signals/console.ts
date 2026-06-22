import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Attach listeners for console.* and uncaught pageerror events.
 * Writes signals with category='console'.
 */
export function attachConsole(page: Page, db: Db, runId: string): void {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "log" || type === "debug" || type === "info") return; // skip noise; revisit if needed
    signalsRepo.insert(db, runId, {
      category: "console",
      type: `console_${type}`,
      payload: {
        text: msg.text(),
        location: msg.location(),
        url: page.url(),
      },
    });
  });

  page.on("pageerror", (err) => {
    signalsRepo.insert(db, runId, {
      category: "console",
      type: "pageerror",
      payload: {
        message: err.message,
        name: err.name,
        stack: err.stack,
        url: page.url(),
      },
    });
  });
}
