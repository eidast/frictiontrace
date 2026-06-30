import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardPath = resolve(__dirname, "../../../engine/src/crux/dashboard.js");

function loadDashboardContext() {
  const source = readFileSync(dashboardPath, "utf8");
  const context = {
    document: {
      addEventListener: () => undefined,
      getElementById: () => null,
      head: { appendChild: () => undefined },
      createElement: () => ({ id: "", textContent: "" }),
    },
    window: { addEventListener: () => undefined },
    history: { replaceState: () => undefined },
    URLSearchParams,
    console,
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return context as Record<string, unknown>;
}

describe("CrUX dashboard UI helpers", () => {
  test("exposes shared metadata for Core Web Vitals metric explanations", () => {
    const context = loadDashboardContext();
    const metadata = context.METRIC_METADATA as Record<string, {
      label: string;
      fullName: string;
      unit: string;
      thresholds: { good: string; ni: string; poor: string };
    }>;
    const metricLabel = context.metricLabel as (name: string) => string;

    expect(metricLabel("largest_contentful_paint")).toBe("LCP");
    expect(metadata.largest_contentful_paint.fullName).toBe("Largest Contentful Paint");
    expect(metadata.largest_contentful_paint.unit).toBe("milliseconds");
    expect(metadata.largest_contentful_paint.thresholds.good).toBe("<= 2.5s");
    expect(metadata.cumulative_layout_shift.unit).toBe("score");
    expect(metadata.cumulative_layout_shift.thresholds.ni).toBe("<= 0.25");
  });

  test("summarizes the current analysis scope", () => {
    const context = loadDashboardContext();
    const getScopeSummary = context.getScopeSummary as (input: { group?: string; sites?: string[] }) => { label: string; value: string };

    expect(getScopeSummary({ sites: [] })).toEqual({ label: "Todos los sitios", value: "" });
    expect(getScopeSummary({ group: "walmart_propios", sites: [] })).toEqual({ label: "Grupo", value: "walmart_propios" });
    expect(getScopeSummary({ sites: ["https://walmart.com.gt"] })).toEqual({ label: "Sitio único", value: "https://walmart.com.gt" });
    expect(getScopeSummary({ sites: ["a", "b", "c"] })).toEqual({ label: "Sitios seleccionados", value: "3 sitios" });
  });

  test("computes site drill-down by replacing sites and clearing group", () => {
    const context = loadDashboardContext();
    const computeDrillDownState = context.computeDrillDownState as (
      current: { group: string; sites: string[] },
      dimension: string,
      value: string,
    ) => { group: string; sites: string[] };

    expect(computeDrillDownState({ group: "walmart_propios", sites: ["old"] }, "sites", "new-site")).toEqual({
      group: "",
      sites: ["new-site"],
    });
    expect(computeDrillDownState({ group: "walmart_propios", sites: ["new-site"] }, "sites", "new-site")).toEqual({
      group: "walmart_propios",
      sites: [],
    });
  });
});
