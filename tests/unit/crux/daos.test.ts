import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import type { Database as Db } from "better-sqlite3";
import { CRUX_SCHEMA_DDL } from "../../../engine/src/crux/schema.js";
import {
  cruxOriginsRepo,
  cruxQueriesRepo,
  cruxCollectionsRepo,
  cruxHistoryRepo,
} from "../../../engine/src/crux/daos.js";

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

describe("cruxOriginsRepo", () => {
  it("inserts a new origin", () => {
    const row = cruxOriginsRepo.upsert(db, {
      origin: "www.walmart.com.gt",
      group_name: "walmart_propios",
      label: "Walmart Guatemala",
      country: "GT",
    });
    expect(row.id).toBeTruthy();
    expect(row.origin).toBe("www.walmart.com.gt");
    expect(row.group_name).toBe("walmart_propios");
  });

  it("upsert returns existing origin on duplicate", () => {
    const first = cruxOriginsRepo.upsert(db, {
      origin: "www.chedraui.com.mx",
      group_name: "otros",
      label: "Chedraui Mexico",
      country: "MX",
    });
    const second = cruxOriginsRepo.upsert(db, {
      origin: "www.chedraui.com.mx",
      group_name: "otros",
      label: "Chedraui Mexico v2",
      country: "MX",
    });
    expect(second.id).toBe(first.id);
    expect(second.label).toBe("Chedraui Mexico");
  });

  it("getByOrigin finds existing origin", () => {
    const row = cruxOriginsRepo.getByOrigin(db, "www.walmart.com.gt");
    expect(row).toBeDefined();
    expect(row!.country).toBe("GT");
  });

  it("getByOrigin returns undefined for unknown origin", () => {
    const row = cruxOriginsRepo.getByOrigin(db, "nonexistent.com");
    expect(row).toBeUndefined();
  });
});

describe("cruxQueriesRepo", () => {
  let originId: string;

  beforeAll(() => {
    const origin = cruxOriginsRepo.upsert(db, {
      origin: "www.exito.com",
      group_name: "otros",
      label: "Exito Colombia",
      country: "CO",
    });
    originId = origin.id;
  });

  it("inserts a new query", () => {
    const row = cruxQueriesRepo.upsert(db, {
      origin_id: originId,
      url: "https://www.exito.com/",
      page_type: "homepage",
      query_level: "url",
    });
    expect(row.id).toBeTruthy();
    expect(row.url).toBe("https://www.exito.com/");
    expect(row.query_level).toBe("url");
  });

  it("upsert returns existing on duplicate", () => {
    const first = cruxQueriesRepo.upsert(db, {
      origin_id: originId,
      url: "https://www.exito.com/checkout",
      page_type: "checkout",
      query_level: "url",
    });
    const second = cruxQueriesRepo.upsert(db, {
      origin_id: originId,
      url: "https://www.exito.com/checkout",
      page_type: "checkout",
      query_level: "origin",
    });
    expect(second.id).toBe(first.id);
    expect(second.query_level).toBe("url");
  });

  it("getByOrigin returns all queries for an origin", () => {
    cruxQueriesRepo.upsert(db, {
      origin_id: originId,
      url: "https://www.exito.com/plp",
      page_type: "plp",
      query_level: "url",
    });
    const rows = cruxQueriesRepo.getByOrigin(db, originId);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});

describe("cruxCollectionsRepo", () => {
  it("inserts a collection record", () => {
    const origin = cruxOriginsRepo.upsert(db, {
      origin: "test-collection.com",
      group_name: "otros",
      label: "Test Collection",
      country: "XX",
    });
    const query = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://test-collection.com/",
      page_type: "homepage",
      query_level: "url",
    });
    const col = cruxCollectionsRepo.insert(db, {
      query_id: query.id,
      form_factor: "PHONE",
    });
    expect(col.id).toBeTruthy();
    expect(col.source).toBe("crux_google");
    expect(col.form_factor).toBe("PHONE");
  });
});

describe("cruxHistoryRepo", () => {
  let queryId: string;

  beforeAll(() => {
    const origin = cruxOriginsRepo.upsert(db, {
      origin: "test-history.com",
      group_name: "walmart_propios",
      label: "Test History",
      country: "XX",
    });
    const query = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://test-history.com/",
      page_type: "homepage",
      query_level: "url",
    });
    queryId = query.id;
  });

  it("inserts multiple history records", () => {
    const inputs = [
      {
        query_id: queryId,
        form_factor: "PHONE",
        metric_name: "largest_contentful_paint",
        collection_start: "2026-05-01",
        collection_end: "2026-05-28",
        p75_value: "3200",
        good_pct: 0.45,
        ni_pct: 0.35,
        poor_pct: 0.20,
        query_level: "url",
      },
      {
        query_id: queryId,
        form_factor: "PHONE",
        metric_name: "largest_contentful_paint",
        collection_start: "2026-05-08",
        collection_end: "2026-06-04",
        p75_value: "3100",
        good_pct: 0.48,
        ni_pct: 0.32,
        poor_pct: 0.20,
        query_level: "url",
      },
    ];
    const rows = cruxHistoryRepo.insertMany(db, inputs);
    expect(rows.length).toBe(2);
    expect(rows[0].p75_value).toBe("3200");
    expect(rows[1].p75_value).toBe("3100");
  });

  it("INSERT OR IGNORE skips duplicates", () => {
    const inputs = [
      {
        query_id: queryId,
        form_factor: "PHONE",
        metric_name: "largest_contentful_paint",
        collection_start: "2026-05-01",
        collection_end: "2026-05-28",
        p75_value: "9999",
        good_pct: 0.99,
        ni_pct: 0.01,
        poor_pct: 0.00,
        query_level: "url",
      },
    ];
    const rows = cruxHistoryRepo.insertMany(db, inputs);
    expect(rows.length).toBe(0);

    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM crux_history WHERE query_id = ? AND collection_end = '2026-05-28'",
    ).get(queryId) as { cnt: number };
    expect(count.cnt).toBe(1);
  });

  it("stores CLS as string p75_value", () => {
    const inputs = [
      {
        query_id: queryId,
        form_factor: "PHONE",
        metric_name: "cumulative_layout_shift",
        collection_start: "2026-06-01",
        collection_end: "2026-06-28",
        p75_value: "0.15",
        good_pct: 0.80,
        ni_pct: 0.15,
        poor_pct: 0.05,
        query_level: "url",
      },
    ];
    const rows = cruxHistoryRepo.insertMany(db, inputs);
    expect(rows.length).toBe(1);
    expect(rows[0].p75_value).toBe("0.15");
  });

  it("stores NULL p75_value for missing data", () => {
    const inputs = [
      {
        query_id: queryId,
        form_factor: "DESKTOP",
        metric_name: "interaction_to_next_paint",
        collection_start: "2026-06-01",
        collection_end: "2026-06-28",
        p75_value: null,
        good_pct: null,
        ni_pct: null,
        poor_pct: null,
        query_level: "url",
      },
    ];
    const rows = cruxHistoryRepo.insertMany(db, inputs);
    expect(rows.length).toBe(1);
    expect(rows[0].p75_value).toBeNull();
    expect(rows[0].good_pct).toBeNull();
  });
});
