import { describe, it, expect } from "vitest";
import { validateJourney } from "../../../engine/src/journey/validate.js";

const goodConfig = {
  name: "good",
  version: 1,
  target: { baseUrl: "https://shop.test" },
  settings: {
    viewport: { width: 1366, height: 768 },
    userAgent: "desktop",
    locale: "en-US",
    timezone: "UTC",
    throttle: "none",
    cookies: [],
  },
  artifacts: {
    har: true,
    mhtml: true,
    trace: true,
    video: true,
    screenshots: { viewport: true, fullPage: true },
  },
  steps: [
    { name: "home", kind: "navigate", url: "/", waitFor: "domcontentloaded", timeoutMs: 10000 },
  ],
};

describe("validateJourney", () => {
  it("accepts a well-formed config", () => {
    const r = validateJourney(goodConfig);
    expect(r.valid).toBe(true);
  });

  it("rejects missing steps", () => {
    const r = validateJourney({ ...goodConfig, steps: [] });
    expect(r.valid).toBe(false);
  });

  it("rejects unknown step kind", () => {
    const r = validateJourney({
      ...goodConfig,
      steps: [{ name: "x", kind: "weird_kind", url: "/", waitFor: "load", timeoutMs: 1000 }],
    });
    expect(r.valid).toBe(false);
  });

  it("rejects step without a name", () => {
    const r = validateJourney({
      ...goodConfig,
      steps: [{ kind: "navigate", url: "/", waitFor: "load", timeoutMs: 1000 }],
    });
    expect(r.valid).toBe(false);
  });

  it("rejects missing target.baseUrl", () => {
    const r = validateJourney({ ...goodConfig, target: {} });
    expect(r.valid).toBe(false);
  });
});
