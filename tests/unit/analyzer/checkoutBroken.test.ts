import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runCheckoutBrokenRule } from "../../../engine/src/analyzer/rules/checkoutBroken.js";
import { SCHEMA_DDL } from "../../../engine/src/storage/schema.js";
import { signalsRepo } from "../../../engine/src/storage/daos.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const stmt of SCHEMA_DDL) db.exec(stmt);
  return db;
}

describe("checkoutBroken rule", () => {
  let db: ReturnType<typeof Database>;
  const runId = "run_test";

  beforeEach(() => {
    db = freshDb();
    db.prepare(`INSERT INTO runs (id, target_url, status, warnings_json) VALUES (?, ?, 'queued', '[]')`).run(runId, "https://shop.test");
  });

  it("emits critical on 500 in /checkout", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: { url: "https://shop.test/api/checkout", status: 500 },
    });
    const issues = runCheckoutBrokenRule(db, runId);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("critical");
  });

  it("emits critical on request_failed in /cart", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "request_failed",
      payload: { url: "https://shop.test/cart", failure: "net::ERR_INTERNET_DISCONNECTED" },
    });
    const issues = runCheckoutBrokenRule(db, runId);
    expect(issues[0]!.severity).toBe("critical");
  });

  it("ignores failures outside /checkout and /cart", () => {
    signalsRepo.insert(db, runId, {
      category: "network",
      type: "response",
      payload: { url: "https://shop.test/api/products", status: 500 },
    });
    expect(runCheckoutBrokenRule(db, runId)).toHaveLength(0);
  });
});
