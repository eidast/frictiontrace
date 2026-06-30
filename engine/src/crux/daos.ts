import type { Database as Db } from "better-sqlite3";
import type {
  CruxOriginRow,
  CruxQueryRow,
  CruxCollectionRow,
  CruxHistoryRow,
  CruxFractionRow,
} from "./types.js";

function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export interface CreateCruxOriginInput {
  origin: string;
  group_name: string;
  label: string;
  country: string;
}

export const cruxOriginsRepo = {
  upsert(db: Db, input: CreateCruxOriginInput): CruxOriginRow {
    const existing = db
      .prepare(`SELECT * FROM crux_origins WHERE origin = ?`)
      .get(input.origin) as CruxOriginRow | undefined;
    if (existing) return existing;
    const row: CruxOriginRow = {
      id: newId("corig"),
      ...input,
    };
    db.prepare(
      `INSERT OR IGNORE INTO crux_origins (id, origin, group_name, label, country)
       VALUES (@id, @origin, @group_name, @label, @country)`,
    ).run(row);
    return row;
  },

  getByOrigin(db: Db, origin: string): CruxOriginRow | undefined {
    return db
      .prepare(`SELECT * FROM crux_origins WHERE origin = ?`)
      .get(origin) as CruxOriginRow | undefined;
  },
};

export interface CreateCruxQueryInput {
  origin_id: string;
  url: string;
  page_type: string;
  query_level: string;
}

export const cruxQueriesRepo = {
  upsert(db: Db, input: CreateCruxQueryInput): CruxQueryRow {
    const existing = db
      .prepare(
        `SELECT * FROM crux_queries WHERE origin_id = ? AND url = ? AND page_type = ?`,
      )
      .get(input.origin_id, input.url, input.page_type) as
      | CruxQueryRow
      | undefined;
    if (existing) return existing;
    const row: CruxQueryRow = {
      id: newId("cqry"),
      ...input,
    };
    db.prepare(
      `INSERT OR IGNORE INTO crux_queries (id, origin_id, url, page_type, query_level)
       VALUES (@id, @origin_id, @url, @page_type, @query_level)`,
    ).run(row);
    return row;
  },

  getByOrigin(db: Db, originId: string): CruxQueryRow[] {
    return db
      .prepare(`SELECT * FROM crux_queries WHERE origin_id = ?`)
      .all(originId) as CruxQueryRow[];
  },
};

export interface CreateCruxCollectionInput {
  query_id: string;
  form_factor: string;
  fetched_at?: number;
  source?: string;
}

export const cruxCollectionsRepo = {
  insert(db: Db, input: CreateCruxCollectionInput): CruxCollectionRow {
    const row: CruxCollectionRow = {
      id: newId("ccol"),
      query_id: input.query_id,
      form_factor: input.form_factor,
      fetched_at: input.fetched_at ?? Date.now(),
      source: input.source ?? "crux_google",
    };
    db.prepare(
      `INSERT OR IGNORE INTO crux_collections (id, query_id, form_factor, fetched_at, source)
       VALUES (@id, @query_id, @form_factor, @fetched_at, @source)`,
    ).run(row);
    return row;
  },
};

export interface CreateCruxHistoryInput {
  query_id: string;
  form_factor: string;
  metric_name: string;
  collection_start: string;
  collection_end: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
  source?: string;
  query_level: string;
}

export const cruxHistoryRepo = {
  insertMany(db: Db, inputs: CreateCruxHistoryInput[]): CruxHistoryRow[] {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO crux_history
        (id, query_id, form_factor, metric_name, collection_start, collection_end,
         p75_value, good_pct, ni_pct, poor_pct, source, query_level)
       VALUES
        (@id, @query_id, @form_factor, @metric_name, @collection_start, @collection_end,
         @p75_value, @good_pct, @ni_pct, @poor_pct, @source, @query_level)`,
    );
    return db.transaction(() =>
      inputs.map((input) => {
        const row: CruxHistoryRow = {
          id: newId("chist"),
          query_id: input.query_id,
          form_factor: input.form_factor,
          metric_name: input.metric_name,
          collection_start: input.collection_start,
          collection_end: input.collection_end,
          p75_value: input.p75_value,
          good_pct: input.good_pct,
          ni_pct: input.ni_pct,
          poor_pct: input.poor_pct,
          source: input.source ?? "crux_google",
          query_level: input.query_level,
        };
        const info = insert.run(row);
        return info.changes > 0 ? row : null;
      }).filter((r): r is CruxHistoryRow => r !== null),
    )();
  },
};

export interface CreateCruxFractionInput {
  query_id: string;
  form_factor: string;
  metric_name: string;
  category: string;
  collection_start: string;
  collection_end: string;
  fraction_value: number;
  source?: string;
  query_level: string;
}

export const cruxFractionsRepo = {
  insertMany(db: Db, inputs: CreateCruxFractionInput[]): CruxFractionRow[] {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO crux_fractions
        (id, query_id, form_factor, metric_name, category, collection_start, collection_end,
         fraction_value, source, query_level)
       VALUES
        (@id, @query_id, @form_factor, @metric_name, @category, @collection_start, @collection_end,
         @fraction_value, @source, @query_level)`,
    );
    return db.transaction(() =>
      inputs.map((input) => {
        const row: CruxFractionRow = {
          id: newId("cfrac"),
          query_id: input.query_id,
          form_factor: input.form_factor,
          metric_name: input.metric_name,
          category: input.category,
          collection_start: input.collection_start,
          collection_end: input.collection_end,
          fraction_value: input.fraction_value,
          source: input.source ?? "crux_google",
          query_level: input.query_level,
        };
        const info = insert.run(row);
        return info.changes > 0 ? row : null;
      }).filter((r): r is CruxFractionRow => r !== null),
    )();
  },
};
