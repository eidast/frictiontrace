export const CRUX_SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS crux_origins (
    id TEXT PRIMARY KEY,
    origin TEXT NOT NULL UNIQUE,
    group_name TEXT NOT NULL,
    label TEXT NOT NULL,
    country TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS crux_queries (
    id TEXT PRIMARY KEY,
    origin_id TEXT NOT NULL REFERENCES crux_origins(id),
    url TEXT NOT NULL,
    page_type TEXT NOT NULL,
    query_level TEXT NOT NULL CHECK(query_level IN ('origin', 'url')),
    UNIQUE(origin_id, url, page_type)
  )`,

  `CREATE TABLE IF NOT EXISTS crux_collections (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL REFERENCES crux_queries(id),
    form_factor TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'crux_google',
    UNIQUE(query_id, form_factor, fetched_at)
  )`,

  `CREATE TABLE IF NOT EXISTS crux_history (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL REFERENCES crux_queries(id),
    form_factor TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    collection_start TEXT NOT NULL,
    collection_end TEXT NOT NULL,
    p75_value TEXT,
    good_pct REAL,
    ni_pct REAL,
    poor_pct REAL,
    source TEXT NOT NULL DEFAULT 'crux_google',
    query_level TEXT NOT NULL CHECK(query_level IN ('origin', 'url')),
    UNIQUE(query_id, form_factor, metric_name, collection_end)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_crux_history_metric_time
    ON crux_history(metric_name, collection_end)`,

  `CREATE INDEX IF NOT EXISTS idx_crux_history_query_metric
    ON crux_history(query_id, form_factor, metric_name)`,

  `CREATE INDEX IF NOT EXISTS idx_crux_history_level
    ON crux_history(query_level, metric_name)`,
];
