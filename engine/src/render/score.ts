import type { IssueRow } from "../storage/types.js";

const SEVERITY_WEIGHT: Record<IssueRow["severity"], number> = {
  critical: 25,
  high: 10,
  med: 4,
  low: 1,
};

/**
 * Compute the overall friction score (0–100) as a weighted sum of issue severities,
 * capped at 100. The score is a rough heuristic, not a calibrated metric.
 */
export function computeScore(issues: IssueRow[]): number {
  const raw = issues.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] ?? 0), 0);
  return Math.min(100, raw);
}

export function scoreBand(score: number): "low" | "med" | "high" | "critical" {
  if (score >= 50) return "critical";
  if (score >= 25) return "high";
  if (score >= 10) return "med";
  return "low";
}

export function severityCounts(issues: IssueRow[]): Array<{ severity: IssueRow["severity"]; count: number }> {
  const counts: Record<string, number> = { critical: 0, high: 0, med: 0, low: 0 };
  for (const i of issues) {
    counts[i.severity] = (counts[i.severity] ?? 0) + 1;
  }
  return (Object.keys(counts) as IssueRow["severity"][]).map((severity) => ({ severity, count: counts[severity] ?? 0 }));
}

const SEVERITY_RANK: Record<IssueRow["severity"], number> = { critical: 0, high: 1, med: 2, low: 3 };

export function topIssues(issues: IssueRow[], n = 5): IssueRow[] {
  return [...issues]
    .sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity] ?? 99;
      const sb = SEVERITY_RANK[b.severity] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.kind.localeCompare(b.kind);
    })
    .slice(0, n);
}
