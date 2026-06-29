#!/usr/bin/env node
import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CruxPagesConfig, type CruxSiteConfigT, type CruxPageEntryT } from "../engine/src/crux/config-schema.js";
import {
  openCruxDb,
  closeCruxDb,
  type CruxDb,
} from "../engine/src/crux/db.js";
import {
  cruxOriginsRepo,
  cruxQueriesRepo,
  cruxCollectionsRepo,
  cruxHistoryRepo,
} from "../engine/src/crux/daos.js";

const CONFIG_PATH = resolve(process.cwd(), "engine", "crux-pages.yaml");
const API_BASE = "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord";

const METRICS = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const FORM_FACTORS = ["PHONE", "DESKTOP"] as const;

interface SyncStats {
  total: number;
  success: number;
  failed: number;
  fallbacks: number;
  newPeriods: number;
  skippedPeriods: number;
}

interface HistoryRecord {
  metric_name: string;
  collection_start: string;
  collection_end: string;
  p75_value: string | null;
  good_pct: number | null;
  ni_pct: number | null;
  poor_pct: number | null;
}

function dateToString(date: { year: number; month: number; day: number }): string {
  const y = date.year;
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseHistoryResponse(
  responseJson: Record<string, unknown>,
): HistoryRecord[] {
  const record = responseJson.record as Record<string, unknown> | undefined;
  if (!record) return [];

  const collectionPeriods = record.collectionPeriods as Array<{
    firstDate: { year: number; month: number; day: number };
    lastDate: { year: number; month: number; day: number };
  }> | undefined;
  if (!collectionPeriods || collectionPeriods.length === 0) return [];

  const metrics = record.metrics as Record<string, unknown> | undefined;
  if (!metrics) return [];

  const results: HistoryRecord[] = [];
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

async function fetchWithRetry(
  url: string,
  body: Record<string, unknown>,
  retries = 3,
): Promise<Record<string, unknown>> {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        return (await resp.json()) as Record<string, unknown>;
      }

      if (resp.status === 429 && attempt < retries) {
        console.warn(`    429 rate limited, retry in ${delays[attempt] / 1000}s...`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }

      if (resp.status >= 500 && attempt < retries) {
        console.warn(`    ${resp.status} server error, retry in ${delays[attempt] / 1000}s...`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }

      return { error: true, status: resp.status, body: await resp.text().catch(() => "") };
    } catch (err) {
      if (attempt < retries && err instanceof Error && (err.message.includes("fetch") || err.message.includes("timeout") || err.message.includes("network"))) {
        console.warn(`    network error, retry in ${delays[attempt] / 1000}s...`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      return { error: true, message: err instanceof Error ? err.message : String(err) };
    }
  }

  return { error: true, message: "max retries exceeded" };
}

async function syncSite(
  db: CruxDb,
  site: CruxSiteConfigT,
  stats: SyncStats,
): Promise<void> {
  const apiKey = process.env.CRUX_API_KEY;
  if (!apiKey) {
    console.error(`CRUX_API_KEY not set. Skipping ${site.label}`);
    stats.failed++;
    return;
  }

  const origin = cruxOriginsRepo.upsert(db, {
    origin: site.origin,
    group_name: site.group,
    label: site.label,
    country: site.country,
  });

  for (const page of site.pages) {
    if (!page.url) continue;

    for (const ff of FORM_FACTORS) {
      let queryLevel: "url" | "origin" = "url";
      let queryUrl = page.url;

      const urlBody = {
        url: page.url,
        formFactor: ff,
        metrics: METRICS,
        collectionPeriodCount: 40,
      };

      stats.total++;
      const resp = await fetchWithRetry(`${API_BASE}?key=${apiKey}`, urlBody);

      if ((resp as Record<string, unknown>).error) {
        const urlBodyOrigin = {
          origin: `https://${site.origin}`,
          formFactor: ff,
          metrics: METRICS,
          collectionPeriodCount: 40,
        };

        stats.total++;
        const originResp = await fetchWithRetry(`${API_BASE}?key=${apiKey}`, urlBodyOrigin);

        if ((originResp as Record<string, unknown>).error) {
          console.warn(`  FAILED: ${site.origin} ${page.type} ${ff} (url+origin) — ${JSON.stringify(originResp)}`);
          stats.failed++;
          continue;
        }

        queryLevel = "origin";
        queryUrl = `https://${site.origin}`;
        stats.fallbacks++;

        const historyRecords = parseHistoryResponse(originResp);
        if (historyRecords.length === 0) {
          stats.failed++;
          continue;
        }

        persistHistory(db, origin.id, page, queryUrl, queryLevel, ff, historyRecords, stats);
        continue;
      }

      const historyRecords = parseHistoryResponse(resp);
      if (historyRecords.length === 0) {
        stats.failed++;
        continue;
      }

      persistHistory(db, origin.id, page, queryUrl, queryLevel, ff, historyRecords, stats);
      stats.success++;
    }
  }
}

function persistHistory(
  db: CruxDb,
  originId: string,
  page: CruxPageEntryT,
  queryUrl: string,
  queryLevel: string,
  formFactor: string,
  records: HistoryRecord[],
  stats: SyncStats,
): void {
  const query = cruxQueriesRepo.upsert(db, {
    origin_id: originId,
    url: queryUrl,
    page_type: page.type,
    query_level: queryLevel,
  });

  cruxCollectionsRepo.insert(db, {
    query_id: query.id,
    form_factor: formFactor,
  });

  const inputs = records.map((r) => ({
    query_id: query.id,
    form_factor: formFactor,
    metric_name: r.metric_name,
    collection_start: r.collection_start,
    collection_end: r.collection_end,
    p75_value: r.p75_value,
    good_pct: r.good_pct,
    ni_pct: r.ni_pct,
    poor_pct: r.poor_pct,
    query_level: queryLevel,
  }));

  const inserted = cruxHistoryRepo.insertMany(db, inputs);
  stats.newPeriods += inserted.length;
  stats.skippedPeriods += inputs.length - inserted.length;
}

async function main(): Promise<void> {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parseYaml(raw);
  const validated = CruxPagesConfig.safeParse(parsed);

  if (!validated.success) {
    console.error("Invalid crux-pages.yaml:");
    for (const issue of validated.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const config = validated.data;
  const pagesWithUrls = config.sites
    .flatMap((s) => s.pages.filter((p) => p.url !== null))
    .length;
  const totalQueries = pagesWithUrls * FORM_FACTORS.length;

  console.log(`CrUX Sync — ${config.sites.length} sites, ${pagesWithUrls} pages with URLs`);
  console.log(`Estimated queries: ${totalQueries} (max, with fallbacks)\n`);

  const db = openCruxDb();
  const stats: SyncStats = { total: 0, success: 0, failed: 0, fallbacks: 0, newPeriods: 0, skippedPeriods: 0 };

  try {
    for (const site of config.sites) {
      console.log(`${site.label} (${site.origin})`);
      await syncSite(db, site, stats);
    }
  } finally {
    closeCruxDb(db);
  }

  const summary = {
    total_queries: stats.total,
    successful: stats.success,
    failed: stats.failed,
    origin_fallbacks: stats.fallbacks,
    new_periods_inserted: stats.newPeriods,
    duplicated_skipped: stats.skippedPeriods,
  };

  process.stdout.write(JSON.stringify(summary) + "\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
