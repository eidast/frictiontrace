import Database, { type Database as Db } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { SCHEMA_DDL } from "./schema.js";

export type RunDb = Db;

export interface OpenRunDbOptions {
  baseDir?: string;
}

const DEFAULT_BASE = resolve(process.cwd(), "runs");

export function runsBaseDir(baseDir?: string): string {
  return baseDir ?? process.env.FRICTIONTRACE_RUNS_DIR ?? DEFAULT_BASE;
}

export function runDbPath(runId: string, baseDir?: string): string {
  return join(runsBaseDir(baseDir), runId, "audit.db");
}

export function openRunDb(runId: string, opts: OpenRunDbOptions = {}): RunDb {
  const path = runDbPath(runId, opts.baseDir);
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

export function closeRunDb(db: RunDb): void {
  db.close();
}

function applySchema(db: RunDb): void {
  const tx = db.transaction(() => {
    for (const stmt of SCHEMA_DDL) {
      db.exec(stmt);
    }
  });
  tx();
}
