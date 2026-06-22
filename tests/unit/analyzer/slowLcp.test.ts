import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runSlowLcpRule } from "../../../engine/src/analyzer/rules/slowLcp.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("slowLcp rule", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  const cases: Array<{ lcp: number; expected: "med" | "high" | "critical" | null }> = [
    { lcp: 1800, expected: null },
    { lcp: 3000, expected: "med" },
    { lcp: 5000, expected: "high" },
    { lcp: 7000, expected: "critical" },
  ];

  for (const c of cases) {
    it(`LCP ${c.lcp}ms → ${c.expected ?? "no issue"}`, () => {
      signalsRepo.insert(db, runId, {
        category: "web_vitals",
        type: "lcp",
        payload: { value: c.lcp, url: "https://shop.test/" },
      });
      const issues = runSlowLcpRule(db, runId);
      if (c.expected === null) {
        expect(issues).toHaveLength(0);
      } else {
        expect(issues).toHaveLength(1);
        expect(issues[0]!.severity).toBe(c.expected);
      }
    });
  }
});
