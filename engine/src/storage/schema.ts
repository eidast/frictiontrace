export const SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    target_url TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    config_json TEXT,
    journey_id TEXT,
    warnings_json TEXT NOT NULL DEFAULT '[]'
  )`,

  `CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    screenshot_path TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    step_id TEXT REFERENCES steps(id),
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    captured_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    step_id TEXT REFERENCES steps(id),
    path TEXT NOT NULL,
    kind TEXT NOT NULL,
    width INTEGER,
    height INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_json TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    source_signal_ids_json TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS report_docs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
    executive_json TEXT,
    insights_json TEXT,
    rendered_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_signals_run ON signals(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_signals_category ON signals(run_id, category)`,
  `CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(run_id, category, type)`,
  `CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_issues_run ON issues(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_facts_run ON facts(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_run ON screenshots(run_id)`,
];
