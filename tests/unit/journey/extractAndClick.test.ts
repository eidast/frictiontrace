import { describe, it, expect } from "vitest";
import type { Page } from "playwright";
import { extractAndClickStep } from "../../../engine/src/journey/primitives/extract-and-click.js";
import type { StepT } from "../../../engine/src/journey/schema.js";

function stubStep(): StepT {
  return {
    name: "pick product",
    kind: "extract_and_click",
    waitFor: "load",
    timeoutMs: 50,
    selector: ".product a",
  };
}

function pageWithClick(click: () => Promise<void>): Page {
  const locator = {
    first: () => locator,
    count: async () => 1,
    isVisible: async () => true,
    getAttribute: async () => "/product/1",
    click,
  };
  return { locator: () => locator } as unknown as Page;
}

describe("extractAndClickStep", () => {
  it("returns ok: true when the click completes within the timeout", async () => {
    const page = pageWithClick(async () => undefined);
    const result = await extractAndClickStep(page, stubStep());
    expect(result).toEqual({ ok: true, href: "/product/1" });
  });

  it("returns ok: false when the click rejects on timeout", async () => {
    const page = pageWithClick(async () => {
      throw new Error("Timeout 50ms exceeded");
    });
    const result = await extractAndClickStep(page, stubStep());
    expect(result.ok).toBe(false);
    expect(result.href).toBe("/product/1");
  });

  it("does not report success for a click that is still pending at the timeout", async () => {
    // Regression: the old implementation raced click() against
    // page.waitForTimeout(), which resolves — a hung click returned ok: true.
    let clickSettled = false;
    const page = pageWithClick(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            clickSettled = true;
            resolve();
          }, 5000);
        }),
    );
    const result = (await Promise.race([
      extractAndClickStep(page, stubStep()),
      new Promise<"pending">((r) => setTimeout(() => r("pending"), 200)),
    ])) as Awaited<ReturnType<typeof extractAndClickStep>> | "pending";
    // The step must still be waiting on the click (click has its own timeout);
    // it must NOT have resolved with ok: true while the click is pending.
    expect(clickSettled).toBe(false);
    expect(result).toBe("pending");
  });
});
