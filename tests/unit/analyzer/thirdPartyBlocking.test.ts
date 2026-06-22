import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runThirdPartyBlockingRule } from "../../../engine/src/analyzer/rules/thirdPartyBlocking.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("thirdPartyBlocking rule", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("emits when total duration > 1500ms", () => {
    signalsRepo.insert(db, runId, {
      category: "third_party",
      type: "third_party_domain",
      payload: { domain: "googletagmanager.com", category: "tag_manager", totalDurationMs: 2200, requestCount: 4 },
    });
    const issues = runThirdPartyBlockingRule(db, runId);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("high");
  });

  it("emits critical when total duration > 3000ms", () => {
    signalsRepo.insert(db, runId, {
      category: "third_party",
      type: "third_party_domain",
      payload: { domain: "segment.com", category: "analytics", totalDurationMs: 4000, requestCount: 6 },
    });
    const issues = runThirdPartyBlockingRule(db, runId);
    expect(issues[0]!.severity).toBe("critical");
  });

  it("does not emit when under threshold", () => {
    signalsRepo.insert(db, runId, {
      category: "third_party",
      type: "third_party_domain",
      payload: { domain: "x.com", category: "other", totalDurationMs: 800, requestCount: 2 },
    });
    expect(runThirdPartyBlockingRule(db, runId)).toHaveLength(0);
  });
});
