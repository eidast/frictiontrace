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

  // Additive migration for databases created before throttling_profile existed:
  // CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
  // Default 'slow4g' labels pre-migration rows with the profile they actually used
  // (Lighthouse's previous default).
  const columns = db.prepare("PRAGMA table_info(synthetic_runs)").all() as Array<{ name: string }>;
  if (columns.length > 0 && !columns.some((c) => c.name === "throttling_profile")) {
    db.exec(
      "ALTER TABLE synthetic_runs ADD COLUMN throttling_profile TEXT NOT NULL DEFAULT 'slow4g'"
    );
  }

  // Additive migrations (image-audit-v2): page image stats on synthetic_runs,
  // form factor + displayed dimensions on image_findings.
  const synthColumns = new Set(
    (db.prepare("PRAGMA table_info(synthetic_runs)").all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (synthColumns.size > 0) {
    if (!synthColumns.has("image_bytes_modern")) {
      db.exec("ALTER TABLE synthetic_runs ADD COLUMN image_bytes_modern REAL");
    }
    if (!synthColumns.has("image_bytes_legacy")) {
      db.exec("ALTER TABLE synthetic_runs ADD COLUMN image_bytes_legacy REAL");
    }
    if (!synthColumns.has("image_bytes_third_party")) {
      db.exec("ALTER TABLE synthetic_runs ADD COLUMN image_bytes_third_party REAL");
    }
    if (!synthColumns.has("image_count")) {
      db.exec("ALTER TABLE synthetic_runs ADD COLUMN image_count INTEGER");
    }
  }

  const findingColumns = new Set(
    (db.prepare("PRAGMA table_info(image_findings)").all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (findingColumns.size > 0) {
    if (!findingColumns.has("form_factor")) {
      db.exec("ALTER TABLE image_findings ADD COLUMN form_factor TEXT NOT NULL DEFAULT 'mobile'");
    }
    if (!findingColumns.has("displayed_width")) {
      db.exec("ALTER TABLE image_findings ADD COLUMN displayed_width REAL");
    }
    if (!findingColumns.has("displayed_height")) {
      db.exec("ALTER TABLE image_findings ADD COLUMN displayed_height REAL");
    }
  }
}
