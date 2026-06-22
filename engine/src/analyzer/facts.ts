import type { Database as Db } from "better-sqlite3";
import { factsRepo } from "../storage/daos.js";
import type { FactRow } from "../storage/types.js";

/**
 * Extract structured facts from signals. These are read by the template layer
 * to render the executive summary and perspectives.
 *
 * M0 facts:
 *  - home.lcp_ms           : number
 *  - home.cls              : number
 *  - home.third_party_count: number
 *  - home.third_party_total_ms: number
 *  - cart.checkout_failures: number
 *  - issues.<kind>_count   : number (one per detected issue kind)
 */
export function extractFacts(db: Db, runId: string): FactRow[] {
  const out: FactRow[] = [];

  // Helper: get last numeric value of a web_vitals signal of a given type
  const lastWebVital = (type: string): number | null => {
    const row = db
      .prepare(
        `SELECT payload_json FROM signals
         WHERE run_id = ? AND category = 'web_vitals' AND type = ?
         ORDER BY captured_at DESC LIMIT 1`,
      )
      .get(runId, type) as { payload_json: string } | undefined;
    if (!row) return null;
    try {
      const p = JSON.parse(row.payload_json) as { value?: number };
      return typeof p.value === "number" ? p.value : null;
    } catch {
      return null;
    }
  };

  const lcp = lastWebVital("lcp");
  if (lcp !== null) {
    out.push(factsRepo.upsert(db, runId, { key: "home.lcp_ms", value: Math.round(lcp) }));
  }
  const cls = lastWebVital("cls");
  if (cls !== null) {
    out.push(factsRepo.upsert(db, runId, { key: "home.cls", value: Math.round(cls * 1000) / 1000 }));
  }

  // Third-party aggregates
  const thirdPartyRows = db
    .prepare(
      `SELECT payload_json FROM signals
       WHERE run_id = ? AND category = 'third_party' AND type = 'third_party_domain'`,
    )
    .all(runId) as Array<{ payload_json: string }>;
  let tpTotalMs = 0;
  for (const r of thirdPartyRows) {
    try {
      const p = JSON.parse(r.payload_json) as { totalDurationMs?: number };
      tpTotalMs += p.totalDurationMs ?? 0;
    } catch {
      // ignore
    }
  }
  out.push(factsRepo.upsert(db, runId, { key: "home.third_party_count", value: thirdPartyRows.length }));
  out.push(factsRepo.upsert(db, runId, { key: "home.third_party_total_ms", value: Math.round(tpTotalMs) }));

  // Checkout failures
  const checkoutFailures = db
    .prepare(
      `SELECT COUNT(*) as c FROM signals
       WHERE run_id = ? AND category = 'network' AND (
         type = 'request_failed' OR (type = 'response' AND CAST(json_extract(payload_json, '$.status') AS INTEGER) >= 500)
       ) AND (
         json_extract(payload_json, '$.url') LIKE '%/checkout%' OR
         json_extract(payload_json, '$.url') LIKE '%/cart%'
       )`,
    )
    .get(runId) as { c: number };
  out.push(factsRepo.upsert(db, runId, { key: "cart.checkout_failures", value: checkoutFailures.c }));

  // Issue counts by kind
  const issues = db
    .prepare(`SELECT kind, COUNT(*) as c FROM issues WHERE run_id = ? GROUP BY kind`)
    .all(runId) as Array<{ kind: string; c: number }>;
  for (const i of issues) {
    out.push(factsRepo.upsert(db, runId, { key: `issues.${i.kind}_count`, value: i.c }));
  }

  return out;
}
