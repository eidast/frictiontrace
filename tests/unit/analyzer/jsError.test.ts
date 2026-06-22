import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runJsErrorRule } from "../../../engine/src/analyzer/rules/jsError.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("jsError rule", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("emits a high-severity issue for a homepage pageerror", () => {
    signalsRepo.insert(db, runId, {
      category: "console",
      type: "pageerror",
      payload: { message: "Cannot read property 'x' of undefined", url: "https://shop.test/" },
    });
    const issues = runJsErrorRule(db, runId);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("js_error");
    expect(issues[0]!.severity).toBe("high");
    expect(JSON.parse(issues[0]!.evidence_json)).toHaveLength(1);
  });

  it("emits a critical issue when the error is on the checkout path", () => {
    signalsRepo.insert(db, runId, {
      category: "console",
      type: "pageerror",
      payload: { message: "Payment API failed", url: "https://shop.test/checkout" },
    });
    const issues = runJsErrorRule(db, runId);
    expect(issues[0]!.severity).toBe("critical");
  });

  it("returns no issues when there are no pageerror signals", () => {
    expect(runJsErrorRule(db, runId)).toHaveLength(0);
  });
});
