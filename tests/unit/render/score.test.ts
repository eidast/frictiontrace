import { describe, it, expect } from "vitest";
import { computeScore, scoreBand, severityCounts, topIssues } from "../../../engine/src/render/score.js";
import type { IssueRow } from "../../../engine/src/storage/types.js";

function issue(severity: IssueRow["severity"], kind: string, summary = ""): IssueRow {
  return {
    id: `i_${kind}`,
    run_id: "run_test",
    kind,
    severity,
    summary: summary || kind,
    evidence_json: "[]",
  };
}

describe("computeScore", () => {
  it("returns 0 with no issues", () => {
    expect(computeScore([])).toBe(0);
  });

  it("adds severity weights", () => {
    const score = computeScore([
      issue("critical", "a"),
      issue("high", "b"),
      issue("med", "c"),
      issue("low", "d"),
    ]);
    expect(score).toBe(25 + 10 + 4 + 1);
  });

  it("caps at 100", () => {
    const issues = Array.from({ length: 10 }, () => issue("critical", "x"));
    expect(computeScore(issues)).toBe(100);
  });
});

describe("scoreBand", () => {
  it("maps ranges correctly", () => {
    expect(scoreBand(0)).toBe("low");
    expect(scoreBand(10)).toBe("med");
    expect(scoreBand(25)).toBe("high");
    expect(scoreBand(60)).toBe("critical");
  });
});

describe("severityCounts", () => {
  it("counts each severity", () => {
    const counts = severityCounts([
      issue("high", "a"),
      issue("high", "b"),
      issue("low", "c"),
    ]);
    const by = Object.fromEntries(counts.map((c) => [c.severity, c.count]));
    expect(by.high).toBe(2);
    expect(by.low).toBe(1);
    expect(by.med).toBe(0);
    expect(by.critical).toBe(0);
  });
});

describe("topIssues", () => {
  it("sorts critical first, then by kind", () => {
    const sorted = topIssues([
      issue("med", "zebra"),
      issue("critical", "alpha"),
      issue("critical", "beta"),
      issue("high", "delta"),
    ]);
    expect(sorted.map((i) => i.kind)).toEqual(["alpha", "beta", "delta", "zebra"]);
  });

  it("limits to n", () => {
    const sorted = topIssues(Array.from({ length: 20 }, () => issue("low", "x")), 5);
    expect(sorted).toHaveLength(5);
  });
});
