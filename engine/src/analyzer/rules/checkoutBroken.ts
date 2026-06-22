import type { Database as Db } from "better-sqlite3";
import { issuesRepo } from "../../storage/daos.js";
import type { IssueRow } from "../../storage/types.js";

const CHECKOUT_PATTERN = /\/(checkout|cart)(\/|\?|$)/i;

export function runCheckoutBrokenRule(db: Db, runId: string): IssueRow[] {
  const rows = db
    .prepare(
      `SELECT id, payload_json FROM signals
       WHERE run_id = ?
         AND category = 'network'
         AND (
           type = 'request_failed'
           OR (type = 'response' AND CAST(json_extract(payload_json, '$.status') AS INTEGER) >= 500)
         )`,
    )
    .all(runId) as Array<{ id: string; payload_json: string }>;

  const evidence: string[] = [];
  const failedUrls: string[] = [];
  for (const r of rows) {
    let payload: { url?: string; status?: number; failure?: string };
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    if (!payload.url || !CHECKOUT_PATTERN.test(payload.url)) continue;
    evidence.push(r.id);
    failedUrls.push(`${payload.url} (${payload.status ?? payload.failure ?? "failed"})`);
  }

  if (evidence.length === 0) return [];

  return [
    issuesRepo.insert(db, runId, {
      kind: "checkout_broken",
      severity: "critical",
      summary: `${evidence.length} failed request${evidence.length > 1 ? "s" : ""} on checkout/cart path: ${failedUrls.slice(0, 3).join("; ")}`,
      evidence,
    }),
  ];
}
