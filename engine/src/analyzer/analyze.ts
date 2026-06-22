import type { Database as Db } from "better-sqlite3";
import { runJsErrorRule } from "./rules/jsError.js";
import { runThirdPartyBlockingRule } from "./rules/thirdPartyBlocking.js";
import { runSlowLcpRule } from "./rules/slowLcp.js";
import { runMixedContentRule } from "./rules/mixedContent.js";
import { runCheckoutBrokenRule } from "./rules/checkoutBroken.js";
import { extractFacts } from "./facts.js";
import type { IssueRow } from "../storage/types.js";

export interface AnalysisResult {
  issues: IssueRow[];
  factsCount: number;
}

/**
 * Run all M0 rules and extract facts.
 * Returns the list of issues persisted for this run.
 */
export function analyzeRun(db: Db, runId: string): AnalysisResult {
  const allIssues: IssueRow[] = [];
  allIssues.push(...runJsErrorRule(db, runId));
  allIssues.push(...runThirdPartyBlockingRule(db, runId));
  allIssues.push(...runSlowLcpRule(db, runId));
  allIssues.push(...runMixedContentRule(db, runId));
  allIssues.push(...runCheckoutBrokenRule(db, runId));
  const facts = extractFacts(db, runId);
  return { issues: allIssues, factsCount: facts.length };
}
