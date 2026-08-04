import type { Database as Db } from "better-sqlite3";
import { issuesRepo } from "../../storage/daos.js";
import { resolveSeverity } from "../catalog.js";
import type { IssueRow } from "../../storage/types.js";

const LCP_THRESHOLD_MS = 2500;

interface LcpPayload {
  value?: number;
  url?: string;
  size?: number;
}

export function runSlowLcpRule(db: Db, runId: string): IssueRow[] {
  const rows = db
    .prepare(
      `SELECT id, payload_json FROM signals
       WHERE run_id = ? AND category = 'web_vitals' AND type = 'lcp'`,
    )
    .all(runId) as Array<{ id: string; payload_json: string }>;

  // LCP observers fire repeatedly with updated values of the same metric, so a
  // run may hold several lcp signals (and older run DBs hold duplicates).
  // Evaluate the maximum observed LCP and emit at most one issue per run.
  let max: { id: string; payload: LcpPayload; value: number } | null = null;
  for (const r of rows) {
    let payload: LcpPayload;
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    const v = payload.value;
    if (typeof v !== "number" || v <= LCP_THRESHOLD_MS) continue;
    if (!max || v > max.value) {
      max = { id: r.id, payload, value: v };
    }
  }
  if (!max) return [];

  return [
    issuesRepo.insert(db, runId, {
      kind: "slow_lcp",
      severity: resolveSeverity("slow_lcp", max.payload),
      summary: `LCP ${Math.round(max.value)}ms on ${max.payload.url ?? "page"} (threshold ${LCP_THRESHOLD_MS}ms)`,
      evidence: [max.id],
    }),
  ];
}
