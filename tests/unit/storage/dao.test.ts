import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import {
  runsRepo,
  stepsRepo,
  signalsRepo,
  issuesRepo,
  factsRepo,
} from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("DAO round-trips", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    runsRepo.insert(db, { id: runId, target_url: "https://shop.test" });
  });

  it("runsRepo insert + getById + updateStatus + addWarning", () => {
    const r = runsRepo.getById(db, runId);
    expect(r?.status).toBe("queued");
    runsRepo.updateStatus(db, runId, "done");
    expect(runsRepo.getById(db, runId)?.status).toBe("done");
    runsRepo.addWarning(db, runId, { code: "x", message: "y" });
    const w = JSON.parse(runsRepo.getById(db, runId)!.warnings_json);
    expect(w).toEqual([{ code: "x", message: "y" }]);
  });

  it("stepsRepo insert + updateStatus", () => {
    const s = stepsRepo.insert(db, runId, { name: "home" });
    expect(s.status).toBe("ok");
    stepsRepo.updateStatus(db, s.id, "failed");
    expect(stepsRepo.getByRun(db, runId)[0]!.status).toBe("failed");
  });

  it("signalsRepo insert + query by category", () => {
    signalsRepo.insert(db, runId, { category: "console", type: "pageerror", payload: { msg: "x" } });
    signalsRepo.insert(db, runId, { category: "console", type: "console_warn", payload: { msg: "y" } });
    signalsRepo.insert(db, runId, { category: "network", type: "response", payload: { url: "z" } });
    const consoleSignals = signalsRepo.query(db, runId, { category: "console" });
    expect(consoleSignals).toHaveLength(2);
  });

  it("issuesRepo rejects empty evidence", () => {
    expect(() =>
      issuesRepo.insert(db, runId, { kind: "js_error", severity: "high", summary: "x", evidence: [] }),
    ).toThrow();
  });

  it("factsRepo upsert replaces existing", () => {
    factsRepo.upsert(db, runId, { key: "home.lcp_ms", value: 1234 });
    factsRepo.upsert(db, runId, { key: "home.lcp_ms", value: 5678 });
    const f = factsRepo.getByRun(db, runId);
    expect(f).toHaveLength(1);
    expect(JSON.parse(f[0]!.value_json)).toBe(5678);
  });
});
