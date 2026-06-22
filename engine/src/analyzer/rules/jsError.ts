import type { Database as Db } from "better-sqlite3";
import { issuesRepo } from "../../storage/daos.js";
import type { IssueRow } from "../../storage/types.js";

const CHECKOUT_PATTERN = /\/(checkout|cart)(\/|\?|$)/i;

export function runJsErrorRule(db: Db, runId: string): IssueRow[] {
  const rows = db
    .prepare(
      `SELECT id, payload_json FROM signals
       WHERE run_id = ? AND category = 'console'
         AND (type = 'pageerror' OR type = 'console_error')`,
    )
    .all(runId) as Array<{ id: string; payload_json: string }>;

  if (rows.length === 0) return [];

  let hasCheckoutError = false;
  const evidence: string[] = [];
  const messages: string[] = [];

  for (const r of rows) {
    evidence.push(r.id);
    let payload: { message?: string; text?: string; url?: string };
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    const text = payload.message ?? payload.text ?? "";
    if (text) messages.push(text.slice(0, 100));
    if (payload.url && CHECKOUT_PATTERN.test(payload.url)) {
      hasCheckoutError = true;
    }
  }

  const severity = hasCheckoutError ? "critical" : "high";
  const summary = `${rows.length} uncaught JavaScript error${rows.length > 1 ? "s" : ""}: ${messages.slice(0, 3).join("; ")}`;

  return [
    issuesRepo.insert(db, runId, {
      kind: "js_error",
      severity,
      summary,
      evidence,
    }),
  ];
}
