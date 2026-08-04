import { describe, it, expect } from "vitest";
import type { Page } from "playwright";
import { navigateStep } from "../../../engine/src/journey/primitives/navigate.js";
import type { StepT } from "../../../engine/src/journey/schema.js";

function stubStep(overrides: Partial<StepT>): StepT {
  return { name: "go", kind: "navigate", waitFor: "load", timeoutMs: 1000, ...overrides };
}

function stubPage(overrides: Partial<Page>): Page {
  return {
    goto: async () => null,
    url: () => "https://shop.test/",
    ...overrides,
  } as unknown as Page;
}

describe("navigateStep waitFor selector", () => {
  it("waits for the selector after load when waitFor is 'selector'", async () => {
    const waited: Array<{ selector: string; state?: string; timeout?: number }> = [];
    const page = stubPage({
      waitForSelector: async (selector: string, opts?: { state?: "visible"; timeout?: number }) => {
        waited.push({ selector, state: opts?.state, timeout: opts?.timeout });
        return null;
      },
    } as Partial<Page>);

    const result = await navigateStep(
      page,
      stubStep({ waitFor: "selector", selector: ".product-grid", timeoutMs: 5000 }),
      "https://shop.test",
    );

    expect(result.ok).toBe(true);
    expect(waited).toEqual([{ selector: ".product-grid", state: "visible", timeout: 5000 }]);
  });

  it("reports a timeout when the selector never appears", async () => {
    const page = stubPage({
      waitForSelector: async () => {
        throw new Error("Timeout 5000ms exceeded");
      },
    } as Partial<Page>);

    const result = await navigateStep(
      page,
      stubStep({ waitFor: "selector", selector: ".missing", timeoutMs: 5000 }),
      "https://shop.test",
    );

    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it("behaves as 'load' when waitFor is 'selector' but no selector is set", async () => {
    let selectorWaited = false;
    const page = stubPage({
      waitForSelector: async () => {
        selectorWaited = true;
        return null;
      },
    } as Partial<Page>);

    const result = await navigateStep(page, stubStep({ waitFor: "selector" }), "https://shop.test");

    expect(result.ok).toBe(true);
    expect(selectorWaited).toBe(false);
  });
});
