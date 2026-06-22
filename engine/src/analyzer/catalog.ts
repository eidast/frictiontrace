import type { Severity } from "../storage/types.js";

export type IssueKind =
  | "js_error"
  | "third_party_blocking"
  | "slow_lcp"
  | "mixed_content"
  | "checkout_broken";

export interface IssueKindDef {
  kind: IssueKind;
  description: string;
  defaultSeverity: Severity;
  /** Severity bump rules (magnitude → severity) */
  severityBumps?: Array<{ condition: (payload: unknown) => boolean; severity: Severity }>;
}

export const ISSUE_CATALOG: Record<IssueKind, IssueKindDef> = {
  js_error: {
    kind: "js_error",
    description: "Uncaught JavaScript exception during the journey",
    defaultSeverity: "high",
  },
  third_party_blocking: {
    kind: "third_party_blocking",
    description: "Third-party domain accumulates excessive latency on a critical step",
    defaultSeverity: "high",
  },
  slow_lcp: {
    kind: "slow_lcp",
    description: "Largest Contentful Paint exceeds the 2.5s threshold",
    defaultSeverity: "med",
    severityBumps: [
      { condition: (p) => typeof (p as { value?: number }).value === "number" && (p as { value: number }).value > 6000, severity: "critical" },
      { condition: (p) => typeof (p as { value?: number }).value === "number" && (p as { value: number }).value > 4000, severity: "high" },
    ],
  },
  mixed_content: {
    kind: "mixed_content",
    description: "An http:// resource is loaded on an https:// page",
    defaultSeverity: "med",
  },
  checkout_broken: {
    kind: "checkout_broken",
    description: "Failed network request on the checkout or cart path",
    defaultSeverity: "critical",
  },
};

export function resolveSeverity(kind: IssueKind, payload: unknown): Severity {
  const def = ISSUE_CATALOG[kind];
  if (!def.severityBumps) return def.defaultSeverity;
  for (const bump of def.severityBumps) {
    if (bump.condition(payload)) return bump.severity;
  }
  return def.defaultSeverity;
}
