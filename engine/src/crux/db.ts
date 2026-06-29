import Database, { type Database as Db } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CRUX_SCHEMA_DDL } from "./schema.js";

export type CruxDb = Db;

const DEFAULT_CRUX_PATH = resolve(process.cwd(), "data", "crux.db");

export function cruxDbPath(): string {
  return process.env.CRUX_DB_PATH ?? DEFAULT_CRUX_PATH;
}

export function openCruxDb(): CruxDb {
  const path = cruxDbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

export function closeCruxDb(db: CruxDb): void {
  db.close();
}

function applySchema(db: CruxDb): void {
  const tx = db.transaction(() => {
    for (const stmt of CRUX_SCHEMA_DDL) {
      db.exec(stmt);
    }
  });
  tx();
}
