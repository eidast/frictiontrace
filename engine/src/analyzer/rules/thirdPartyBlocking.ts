import type { Database as Db } from "better-sqlite3";
import { issuesRepo } from "../../storage/daos.js";
import type { IssueRow } from "../../storage/types.js";

const THRESHOLD_MS = 1500;

interface ThirdPartyPayload {
  domain?: string;
  totalDurationMs?: number;
  requestCount?: number;
  category?: string;
}

export function runThirdPartyBlockingRule(db: Db, runId: string): IssueRow[] {
  const rows = db
    .prepare(
      `SELECT id, payload_json FROM signals
       WHERE run_id = ? AND category = 'third_party' AND type = 'third_party_domain'`,
    )
    .all(runId) as Array<{ id: string; payload_json: string }>;

  const out: IssueRow[] = [];
  for (const r of rows) {
    let payload: ThirdPartyPayload;
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    if (!payload.domain) continue;
    const total = payload.totalDurationMs ?? 0;
    if (total > THRESHOLD_MS) {
      out.push(
        issuesRepo.insert(db, runId, {
          kind: "third_party_blocking",
          severity: total > 3000 ? "critical" : "high",
          summary: `Third-party ${payload.domain} (${payload.category ?? "other"}) accumulated ${Math.round(total)}ms total latency across ${payload.requestCount ?? 0} requests`,
          evidence: [r.id],
        }),
      );
    }
  }
  return out;
}
