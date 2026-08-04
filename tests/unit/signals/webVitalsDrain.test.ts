import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import type { Page } from "playwright";
import { drainWebVitals } from "../../../engine/src/signals/webVitals.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

function stubPage(buffer: Array<{ type: string; value: number; payload?: unknown; at: number }>): Page {
  return {
    evaluate: async () => {
      const out = buffer.slice();
      buffer.length = 0;
      return out;
    },
  } as unknown as Page;
}

describe("drainWebVitals", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("flushes buffered entries to SQLite and clears the buffer", async () => {
    const buffer = [
      { type: "lcp", value: 3100, payload: { url: "https://shop.test/" }, at: 1000 },
      { type: "cls", value: 0.12, at: 1001 },
    ];
    await drainWebVitals(stubPage(buffer), db, runId);

    const rows = db
      .prepare(`SELECT type, payload_json FROM signals WHERE run_id = ? AND category = 'web_vitals' ORDER BY rowid`)
      .all(runId) as Array<{ type: string; payload_json: string }>;
    expect(rows.map((r) => r.type)).toEqual(["lcp", "cls"]);
    expect(JSON.parse(rows[0]!.payload_json).value).toBe(3100);
    expect(buffer).toHaveLength(0);
  });

  it("writes nothing when the buffer is empty", async () => {
    await drainWebVitals(stubPage([]), db, runId);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM signals WHERE run_id = ?`).get(runId) as { c: number };
    expect(count.c).toBe(0);
  });

  it("ignores evaluate failures (page navigating or closed)", async () => {
    const page = {
      evaluate: async () => {
        throw new Error("Target closed");
      },
    } as unknown as Page;
    await expect(drainWebVitals(page, db, runId)).resolves.toBeUndefined();
  });
});
