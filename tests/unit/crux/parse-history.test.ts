import { describe, it, expect } from "vitest";

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
        if (v === null || v === undefined) {
          p75Value = null;
        } else {
          p75Value = String(v);
        }
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
            goodPct = null;
            niPct = null;
            poorPct = null;
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

describe("parseHistoryResponse", () => {
  it("parses a complete CrUX History API response", () => {
    const fixture = {
      record: {
        key: { url: "https://example.com/" },
        metrics: {
          largest_contentful_paint: {
            histogramTimeseries: [
              { start: 0, end: 2500, densities: [0.919, 0.920, 0.918] },
              { start: 2500, end: 4000, densities: [0.052, 0.051, 0.053] },
              { start: 4000, densities: [0.028, 0.029, 0.028] },
            ],
            percentilesTimeseries: {
              p75s: [1362, 1352, 1344],
            },
          },
          cumulative_layout_shift: {
            histogramTimeseries: [
              { start: 0, end: 0.1, densities: [0.85, 0.86, 0.84] },
              { start: 0.1, end: 0.25, densities: [0.10, 0.09, 0.11] },
              { start: 0.25, densities: [0.05, 0.05, 0.05] },
            ],
            percentilesTimeseries: {
              p75s: ["0.15", "0.14", "0.16"],
            },
          },
        },
        collectionPeriods: [
          {
            firstDate: { year: 2026, month: 5, day: 1 },
            lastDate: { year: 2026, month: 5, day: 28 },
          },
          {
            firstDate: { year: 2026, month: 5, day: 8 },
            lastDate: { year: 2026, month: 6, day: 4 },
          },
          {
            firstDate: { year: 2026, month: 5, day: 15 },
            lastDate: { year: 2026, month: 6, day: 11 },
          },
        ],
      },
    };

    const result = parseHistoryResponse(fixture);

    expect(result.length).toBe(6); // 3 periods × 2 metrics

    expect(result[0].metric_name).toBe("largest_contentful_paint");
    expect(result[0].collection_start).toBe("2026-05-01");
    expect(result[0].collection_end).toBe("2026-05-28");
    expect(result[0].p75_value).toBe("1362");
    expect(result[0].good_pct).toBe(0.919);
    expect(result[0].ni_pct).toBe(0.052);
    expect(result[0].poor_pct).toBe(0.028);

    expect(result[3].metric_name).toBe("cumulative_layout_shift");
    expect(result[3].p75_value).toBe("0.15");

    expect(result[5].collection_end).toBe("2026-06-11");
    expect(result[5].p75_value).toBe("0.16");
  });

  it("handles NaN densities as null", () => {
    const fixture = {
      record: {
        key: { url: "https://example.com/" },
        metrics: {
          largest_contentful_paint: {
            histogramTimeseries: [
              { start: 0, end: 2500, densities: [0.919, "NaN" as unknown as number] },
              { start: 2500, end: 4000, densities: [0.052, "NaN" as unknown as number] },
              { start: 4000, densities: [0.028, "NaN" as unknown as number] },
            ],
            percentilesTimeseries: {
              p75s: [1362, null],
            },
          },
        },
        collectionPeriods: [
          {
            firstDate: { year: 2026, month: 5, day: 1 },
            lastDate: { year: 2026, month: 5, day: 28 },
          },
          {
            firstDate: { year: 2026, month: 5, day: 8 },
            lastDate: { year: 2026, month: 6, day: 4 },
          },
        ],
      },
    };

    const result = parseHistoryResponse(fixture);
    expect(result.length).toBe(2);

    expect(result[0].good_pct).toBe(0.919);
    expect(result[0].p75_value).toBe("1362");

    expect(result[1].good_pct).toBeNull();
    expect(result[1].ni_pct).toBeNull();
    expect(result[1].poor_pct).toBeNull();
    expect(result[1].p75_value).toBeNull();
  });

  it("handles missing metric gracefully", () => {
    const fixture = {
      record: {
        key: { url: "https://example.com/" },
        metrics: {
          first_contentful_paint: {
            histogramTimeseries: [
              { start: 0, end: 1800, densities: [0.88] },
              { start: 1800, end: 3000, densities: [0.08] },
              { start: 3000, densities: [0.04] },
            ],
            percentilesTimeseries: {
              p75s: [1200],
            },
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

    const result = parseHistoryResponse(fixture);
    expect(result.length).toBe(1);
    expect(result[0].metric_name).toBe("first_contentful_paint");
  });

  it("returns empty array for empty response", () => {
    expect(parseHistoryResponse({})).toEqual([]);
  });

  it("returns empty array when record has no collectionPeriods", () => {
    expect(parseHistoryResponse({ record: { key: {}, metrics: {} } })).toEqual([]);
  });

  it("zero-pads single-digit months and days", () => {
    const fixture = {
      record: {
        key: { url: "https://example.com/" },
        metrics: {
          largest_contentful_paint: {
            histogramTimeseries: [
              { start: 0, end: 2500, densities: [0.5] },
              { start: 2500, end: 4000, densities: [0.3] },
              { start: 4000, densities: [0.2] },
            ],
            percentilesTimeseries: { p75s: [1000] },
          },
        },
        collectionPeriods: [
          {
            firstDate: { year: 2026, month: 1, day: 5 },
            lastDate: { year: 2026, month: 2, day: 1 },
          },
        ],
      },
    };

    const result = parseHistoryResponse(fixture);
    expect(result[0].collection_start).toBe("2026-01-05");
    expect(result[0].collection_end).toBe("2026-02-01");
  });
});
