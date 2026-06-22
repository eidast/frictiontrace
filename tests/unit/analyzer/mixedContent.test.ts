import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMixedContentRule } from "../../../engine/src/analyzer/rules/mixedContent.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("mixedContent rule", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("aggregates multiple http requests on https page into one issue", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: { url: "http://example.com/a.js", finalUrl: "https://shop.test/" },
    });
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: { url: "http://example.com/b.css", finalUrl: "https://shop.test/" },
    });
    const issues = runMixedContentRule(db, runId);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("med");
    expect(JSON.parse(issues[0]!.evidence_json)).toHaveLength(2);
  });

  it("ignores http requests on http page (not mixed)", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: { url: "http://example.com/a.js", finalUrl: "http://shop.test/" },
    });
    expect(runMixedContentRule(db, runId)).toHaveLength(0);
  });
});
