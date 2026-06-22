import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { signalsToHar } from "../../../engine/src/artifacts/har.js";
import { isValidHar } from "../../../engine/src/artifacts/har-schema.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("signalsToHar", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("produces a HAR 1.2 with one entry per network signal", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: {
        url: "https://cdn.example.com/app.js",
        method: "GET",
        status: 200,
        resourceType: "script",
        contentLength: 320000,
        durationMs: 250,
        timing: { startTime: 0, domainLookupEnd: 10, connectEnd: 20, secureConnectionStart: 25, requestStart: 30, responseStart: 200, responseEnd: 250 },
        finalUrl: "https://shop.test/",
      },
    });
    const har = signalsToHar(db, runId);
    expect(har.log.version).toBe("1.2");
    expect(har.log.entries).toHaveLength(1);
    expect(har.log.entries[0]!.request).toMatchObject({ method: "GET", url: "https://cdn.example.com/app.js" });
    expect((har.log.entries[0]!.response as { status: number }).status).toBe(200);
    expect(isValidHar(har)).toBe(true);
  });

  it("validates empty HAR gracefully", () => {
    const har = signalsToHar(db, runId);
    expect(har.log.entries).toHaveLength(0);
    expect(isValidHar(har)).toBe(true);
  });
});
