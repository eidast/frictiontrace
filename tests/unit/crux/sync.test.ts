import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import type { Database as Db } from "better-sqlite3";
import { CRUX_SCHEMA_DDL } from "../../../engine/src/crux/schema.js";
import {
  cruxOriginsRepo,
  cruxQueriesRepo,
  cruxCollectionsRepo,
  cruxHistoryRepo,
} from "../../../engine/src/crux/daos.js";

function dateToString(date: { year: number; month: number; day: number }): string {
  const y = date.year;
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseHistoryResponse(
  responseJson: Record<string, unknown>,
): Array<{
  metric_name: string;
  collection_start: string;
  collection_end: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
}> {
  const record = responseJson.record as Record<string, unknown> | undefined;
  if (!record) return [];

  const collectionPeriods = record.collectionPeriods as Array<{
    firstDate: { year: number; month: number; day: number };
    lastDate: { year: number; month: number; day: number };
  }> | undefined;
  if (!collectionPeriods || collectionPeriods.length === 0) return [];

  const metrics = record.metrics as Record<string, unknown> | undefined;
  if (!metrics) return [];

  const METRICS = [
    "largest_contentful_paint",
    "cumulative_layout_shift",
    "interaction_to_next_paint",
    "first_contentful_paint",
    "experimental_time_to_first_byte",
  ];

  const results: Array<{
    metric_name: string;
    collection_start: string;
    collection_end: string;
    p75_value: string | null;
    good_pct: number | null;
    ni_pct: number | null;
    poor_pct: number | null;
  }> = [];
  const N = collectionPeriods.length;

  for (const metricName of METRICS) {
    const metricData = metrics[metricName] as Record<string, unknown> | undefined;
    if (!metricData) continue;

    const histogramTimeseries = metricData.histogramTimeseries as
      | Array<{ start: number; end?: number; densities: Array<number | "NaN"> }>
      | undefined;

    const percentilesTimeseries = metricData.percentilesTimeseries as
      | { p75s?: Array<number | string | null> }
      | undefined;

    for (let i = 0; i < N; i++) {
      const period = collectionPeriods[i];
      if (!period) continue;

      const start = dateToString(period.firstDate);
      const end = dateToString(period.lastDate);

      const p75Arr = percentilesTimeseries?.p75s;
      let p75Value: string | null = null;
      if (p75Arr && i < p75Arr.length) {
        const v = p75Arr[i];
        p75Value = v === null || v === undefined ? null : String(v);
      }

      let goodPct: number | null = null;
      let niPct: number | null = null;
      let poorPct: number | null = null;
      if (histogramTimeseries && histogramTimeseries.length >= 3) {
        const bin0 = histogramTimeseries[0];
        const bin1 = histogramTimeseries[1];
        const bin2 = histogramTimeseries[2];
        if (bin0 && i < bin0.densities.length) {
          const d0 = bin0.densities[i];
          if (d0 === "NaN") {
            goodPct = null; niPct = null; poorPct = null;
          } else {
            goodPct = typeof d0 === "number" ? d0 : null;
            if (bin1 && i < bin1.densities.length) {
              const d1 = bin1.densities[i];
              niPct = d1 === "NaN" ? null : typeof d1 === "number" ? d1 : null;
            }
            if (bin2 && i < bin2.densities.length) {
              const d2 = bin2.densities[i];
              poorPct = d2 === "NaN" ? null : typeof d2 === "number" ? d2 : null;
            }
          }
        }
      }

      results.push({
        metric_name: metricName,
        collection_start: start,
        collection_end: end,
        p75_value: p75Value,
        good_pct: goodPct,
        ni_pct: niPct,
        poor_pct: poorPct,
      });
    }
  }
  return results;
}

function makeSuccessResponse() {
  return {
    record: {
      key: { url: "https://example.com/" },
      metrics: {
        largest_contentful_paint: {
          histogramTimeseries: [
            { start: 0, end: 2500, densities: [0.919] },
            { start: 2500, end: 4000, densities: [0.052] },
            { start: 4000, densities: [0.028] },
          ],
          percentilesTimeseries: { p75s: [1362] },
        },
      },
      collectionPeriods: [
        {
          firstDate: { year: 2026, month: 6, day: 1 },
          lastDate: { year: 2026, month: 6, day: 28 },
        },
      ],
    },
  };
}

describe("sync logic", () => {
  it("persists URL-level data with query_level='url'", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    for (const stmt of CRUX_SCHEMA_DDL) db.exec(stmt);

    const origin = cruxOriginsRepo.upsert(db, {
      origin: "www.test.com",
      group_name: "walmart_propios",
      label: "Test Site",
      country: "XX",
    });

    const query = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://www.test.com/checkout",
      page_type: "checkout",
      query_level: "url",
    });

    expect(query.query_level).toBe("url");

    const parsed = parseHistoryResponse(makeSuccessResponse());
    const records = parsed.map((r) => ({
      query_id: query.id,
      form_factor: "PHONE",
      metric_name: r.metric_name,
      collection_start: r.collection_start,
      collection_end: r.collection_end,
      p75_value: r.p75_value,
      good_pct: r.good_pct,
      ni_pct: r.ni_pct,
      poor_pct: r.poor_pct,
      query_level: "url",
    }));

    const rows = cruxHistoryRepo.insertMany(db, records);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].query_level).toBe("url");
    expect(rows[0].metric_name).toBe("largest_contentful_paint");

    db.close();
  });

  it("persists origin-level fallback data with query_level='origin'", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    for (const stmt of CRUX_SCHEMA_DDL) db.exec(stmt);

    const origin = cruxOriginsRepo.upsert(db, {
      origin: "www.fallback.com",
      group_name: "otros",
      label: "Fallback Site",
      country: "XY",
    });

    const query = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://www.fallback.com",
      page_type: "homepage",
      query_level: "origin",
    });

    expect(query.query_level).toBe("origin");

    const parsed = parseHistoryResponse(makeSuccessResponse());
    const records = parsed.map((r) => ({
      query_id: query.id,
      form_factor: "DESKTOP",
      metric_name: r.metric_name,
      collection_start: r.collection_start,
      collection_end: r.collection_end,
      p75_value: r.p75_value,
      good_pct: r.good_pct,
      ni_pct: r.ni_pct,
      poor_pct: r.poor_pct,
      query_level: "origin",
    }));

    const rows = cruxHistoryRepo.insertMany(db, records);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].query_level).toBe("origin");

    db.close();
  });

  it("INSERT OR IGNORE prevents duplicates across syncs", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    for (const stmt of CRUX_SCHEMA_DDL) db.exec(stmt);

    const origin = cruxOriginsRepo.upsert(db, {
      origin: "www.dedup.com",
      group_name: "walmart_subsidiarias",
      label: "Dedup Site",
      country: "ZZ",
    });

    const query = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://www.dedup.com/",
      page_type: "homepage",
      query_level: "url",
    });

    const parsed = parseHistoryResponse(makeSuccessResponse());
    const records = parsed.map((r) => ({
      query_id: query.id,
      form_factor: "PHONE",
      metric_name: r.metric_name,
      collection_start: r.collection_start,
      collection_end: r.collection_end,
      p75_value: r.p75_value,
      good_pct: r.good_pct,
      ni_pct: r.ni_pct,
      poor_pct: r.poor_pct,
      query_level: "url",
    }));

    const first = cruxHistoryRepo.insertMany(db, records);
    expect(first.length).toBeGreaterThan(0);

    const second = cruxHistoryRepo.insertMany(db, records);
    expect(second.length).toBe(0);

    db.close();
  });

  it("properly stores both URL and origin queries for the same site", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    for (const stmt of CRUX_SCHEMA_DDL) db.exec(stmt);

    const origin = cruxOriginsRepo.upsert(db, {
      origin: "www.mixed.com",
      group_name: "otros",
      label: "Mixed Level Site",
      country: "MX",
    });

    const urlQuery = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://www.mixed.com/checkout",
      page_type: "checkout",
      query_level: "url",
    });

    const originQuery = cruxQueriesRepo.upsert(db, {
      origin_id: origin.id,
      url: "https://www.mixed.com",
      page_type: "checkout",
      query_level: "origin",
    });

    expect(urlQuery.query_level).toBe("url");
    expect(originQuery.query_level).toBe("origin");
    expect(urlQuery.id).not.toBe(originQuery.id);

    db.close();
  });
});
