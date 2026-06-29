import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import type { Database as Db } from "better-sqlite3";
import { CRUX_SCHEMA_DDL } from "../../../engine/src/crux/schema.js";

let db: Db;

beforeAll(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const stmt of CRUX_SCHEMA_DDL) {
    db.exec(stmt);
  }
});

afterAll(() => {
  db.close();
});

describe("crux schema", () => {
  it("creates crux_origins table", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crux_origins'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe("crux_origins");
  });

  it("creates crux_queries table", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crux_queries'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });

  it("creates crux_collections table", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crux_collections'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });

  it("creates crux_history table", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crux_history'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });

  it("creates index on metric_name + collection_end", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_crux_history_metric_time'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });

  it("creates index on query_id + form_factor + metric_name", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_crux_history_query_metric'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });

  it("creates index on query_level + metric_name", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_crux_history_level'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });
});
