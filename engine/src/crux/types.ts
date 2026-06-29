export interface CruxOriginRow {
  id: string;
  origin: string;
  group_name: string;
  label: string;
  country: string;
}

export interface CruxQueryRow {
  id: string;
  origin_id: string;
  url: string;
  page_type: string;
  query_level: string;
}

export interface CruxCollectionRow {
  id: string;
  query_id: string;
  form_factor: string;
  fetched_at: number;
  source: string;
}

export interface CruxHistoryRow {
  id: string;
  query_id: string;
  form_factor: string;
  metric_name: string;
  collection_start: string;
  collection_end: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
  source: string;
  query_level: string;
}
