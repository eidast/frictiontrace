import type { Database as Db } from "better-sqlite3";
import { issuesRepo } from "../../storage/daos.js";
import type { IssueRow } from "../../storage/types.js";

/**
 * Mixed content = an http:// request on a https:// page.
 * We have two sources:
 *  1. network category with type 'response' or 'request_failed' AND payload.url starts with http://
 *     while the originating page is https://
 *  2. (Future) explicit 'mixed_content' signal
 *
 * For M0, derive from network signals: if the pageUrl is https but the request scheme is http.
 */
export function runMixedContentRule(db: Db, runId: string): IssueRow[] {
  const rows = db
    .prepare(
      `SELECT id, payload_json FROM signals
       WHERE run_id = ? AND category = 'network' AND type IN ('response', 'request_failed')`,
    )
    .all(runId) as Array<{ id: string; payload_json: string }>;

  const evidence: string[] = [];
  const urls: string[] = [];
  for (const r of rows) {
    let payload: { url?: string; finalUrl?: string };
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    if (!payload.url || !payload.finalUrl) continue;
    if (payload.url.startsWith("http://") && payload.finalUrl.startsWith("https://")) {
      evidence.push(r.id);
      urls.push(payload.url);
    }
  }

  if (evidence.length === 0) return [];

  return [
    issuesRepo.insert(db, runId, {
      kind: "mixed_content",
      severity: "med",
      summary: `${evidence.length} mixed-content request${evidence.length > 1 ? "s" : ""} (http:// resource on https:// page): ${urls.slice(0, 3).join(", ")}`,
      evidence,
    }),
  ];
}
