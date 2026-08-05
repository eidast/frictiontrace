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

  `CREATE TABLE IF NOT EXISTS crux_fractions (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL REFERENCES crux_queries(id),
    form_factor TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    category TEXT NOT NULL,
    collection_start TEXT NOT NULL,
    collection_end TEXT NOT NULL,
    fraction_value REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'crux_google',
    query_level TEXT NOT NULL CHECK(query_level IN ('origin', 'url')),
    UNIQUE(query_id, form_factor, metric_name, category, collection_end)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_crux_fractions_metric_cat_time
    ON crux_fractions(metric_name, category, collection_end)`,

  `CREATE INDEX IF NOT EXISTS idx_crux_fractions_query
    ON crux_fractions(query_id, form_factor, metric_name)`,

  `CREATE TABLE IF NOT EXISTS synthetic_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    suite_version TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    config_hash TEXT NOT NULL,
    origin TEXT NOT NULL,
    group_name TEXT NOT NULL,
    page_type TEXT NOT NULL,
    url TEXT NOT NULL,
    form_factor TEXT NOT NULL DEFAULT 'mobile',
    lcp_ms REAL,
    fcp_ms REAL,
    cls REAL,
    tbt_ms REAL,
    speed_index_ms REAL,
    ttfb_ms REAL,
    total_byte_weight REAL,
    performance_score REAL,
    lighthouse_version TEXT,
    throttling_profile TEXT NOT NULL DEFAULT 'slow4g',
    fetched_at INTEGER NOT NULL,
    excluded INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_synthetic_runs_run_id
    ON synthetic_runs(run_id)`,

  `CREATE INDEX IF NOT EXISTS idx_synthetic_runs_origin_page
    ON synthetic_runs(origin, page_type)`,
];
