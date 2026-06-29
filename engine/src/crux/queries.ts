import type { CruxDb } from "./db.js";

export interface GroupMetricRow {
  group_name: string;
  metric_name: string;
  form_factor: string;
  avg_p75_value: number | null;
  avg_good_pct: number | null;
  avg_ni_pct: number | null;
  avg_poor_pct: number | null;
  site_count: number;
}

export interface PageTypeMetricRow {
  origin: string;
  label: string;
  page_type: string;
  metric_name: string;
  form_factor: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
}

export interface TimeSeriesRow {
  collection_end: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
}

export interface LatestSnapshotRow {
  origin: string;
  label: string;
  group_name: string;
  page_type: string;
  metric_name: string;
  form_factor: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
  query_level: string;
  collection_end: string;
}

export function getMetricsByGroup(db: CruxDb, groupName: string): GroupMetricRow[] {
  return db
    .prepare(
      `SELECT
         o.group_name,
         h.metric_name,
         h.form_factor,
         AVG(CAST(NULLIF(h.p75_value, '') AS REAL)) as avg_p75_value,
         AVG(h.good_pct) as avg_good_pct,
         AVG(h.ni_pct) as avg_ni_pct,
         AVG(h.poor_pct) as avg_poor_pct,
         COUNT(DISTINCT o.origin) as site_count
       FROM crux_history h
       JOIN crux_queries q ON h.query_id = q.id
       JOIN crux_origins o ON q.origin_id = o.id
       WHERE o.group_name = ?
         AND h.collection_end = (SELECT MAX(collection_end) FROM crux_history)
         AND h.good_pct IS NOT NULL
       GROUP BY o.group_name, h.metric_name, h.form_factor
       ORDER BY h.metric_name, h.form_factor`,
    )
    .all(groupName) as GroupMetricRow[];
}

export function getMetricsByPageType(
  db: CruxDb,
  pageType: string,
): PageTypeMetricRow[] {
  return db
    .prepare(
      `SELECT
         o.origin,
         o.label,
         q.page_type,
         h.metric_name,
         h.form_factor,
         h.p75_value,
         h.good_pct,
         h.ni_pct,
         h.poor_pct
       FROM crux_history h
       JOIN crux_queries q ON h.query_id = q.id
       JOIN crux_origins o ON q.origin_id = o.id
       WHERE q.page_type = ?
         AND h.collection_end = (SELECT MAX(collection_end) FROM crux_history)
         AND h.good_pct IS NOT NULL
       ORDER BY o.origin, h.metric_name, h.form_factor`,
    )
    .all(pageType) as PageTypeMetricRow[];
}

export function getTimeSeries(
  db: CruxDb,
  origin: string,
  metricName: string,
  formFactor: string,
): TimeSeriesRow[] {
  return db
    .prepare(
      `SELECT
         h.collection_end,
         h.p75_value,
         h.good_pct,
         h.ni_pct,
         h.poor_pct
       FROM crux_history h
       JOIN crux_queries q ON h.query_id = q.id
       JOIN crux_origins o ON q.origin_id = o.id
       WHERE o.origin = ?
         AND h.metric_name = ?
         AND h.form_factor = ?
         AND h.good_pct IS NOT NULL
         AND q.query_level = 'url'
       ORDER BY h.collection_end ASC`,
    )
    .all(origin, metricName, formFactor) as TimeSeriesRow[];
}

export function getLatestSnapshot(db: CruxDb): LatestSnapshotRow[] {
  return db
    .prepare(
      `SELECT
         o.origin,
         o.label,
         o.group_name,
         q.page_type,
         h.metric_name,
         h.form_factor,
         h.p75_value,
         h.good_pct,
         h.ni_pct,
         h.poor_pct,
         h.query_level,
         h.collection_end
       FROM crux_history h
       JOIN crux_queries q ON h.query_id = q.id
       JOIN crux_origins o ON q.origin_id = o.id
       WHERE h.collection_end = (SELECT MAX(collection_end) FROM crux_history)
         AND h.good_pct IS NOT NULL
       ORDER BY o.group_name, o.origin, h.metric_name, h.form_factor`,
    )
    .all() as LatestSnapshotRow[];
}
