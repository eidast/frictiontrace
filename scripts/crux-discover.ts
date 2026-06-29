#!/usr/bin/env node
import { chromium, type Page } from "playwright";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CruxSiteConfigT, CruxPageEntryT } from "../engine/src/crux/config-schema.js";

const CONFIG_PATH = resolve(process.cwd(), "engine", "crux-pages.yaml");

const CHECKOUT_SELECTORS = [
  'a[href*="cart" i]',
  'a[href*="carrito" i]',
  'a[href*="checkout" i]',
  'a[href*="pagar" i]',
  'a[href*="/cart" i]',
  'a[href*="/carrito" i]',
  'a[href*="/checkout" i]',
  'a[href*="bolsa" i]',
  'a[href*="cesta" i]',
  '[data-testid="cart-icon"]',
  '[aria-label*="cart" i]',
  '[aria-label*="carrito" i]',
  'a[href*="minicart" i]',
  'a[href*="mini-cart" i]',
];

const CATEGORY_KEYWORDS = [
  "abarrotes", "despensa", "alimentos", "supermercado",
  "mercado", "categorias", "productos", "departamentos",
];

const PDP_SELECTORS = [
  'a[href*="/product" i]',
  'a[href*="/p/" i]',
  'a[href*="/producto" i]',
  'a[href*="/prod/" i]',
  '[data-testid="product-card"] a',
  '[class*="product" i] a[href]',
];

interface DiscoveredPages {
  checkout: string | null;
  plp: string | null;
  pdp: string | null;
}

async function discoverSite(
  page: Page,
  origin: string,
  label: string,
): Promise<DiscoveredPages> {
  const result: DiscoveredPages = { checkout: null, plp: null, pdp: null };

  const baseUrl = `https://${origin}/`;
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (err) {
    console.warn(`  ! failed to load homepage: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  await page.waitForTimeout(2000);

  result.checkout = await page.evaluate((selectors: string[]) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el instanceof HTMLAnchorElement && el.href) {
        try { new URL(el.href); return el.href; } catch { continue; }
      }
    }
    return null;
  }, CHECKOUT_SELECTORS);

  if (!result.checkout) {
    console.warn(`  ! no checkout link found for ${label}`);
  }

  const categoryUrl = await page.evaluate(({ keywords, homeUrl }: { keywords: string[]; homeUrl: string }) => {
    const anchors = Array.from(document.querySelectorAll("nav a[href], header a[href]"));
    const links = anchors.filter((a) => {
      try { new URL((a as HTMLAnchorElement).href); return true; } catch { return false; }
    }) as HTMLAnchorElement[];

    for (const kw of keywords) {
      const match = links.find(
        (a) => a.textContent?.toLowerCase().includes(kw) || a.href.toLowerCase().includes(kw),
      );
      if (match) return match.href;
    }

    const categoryLink = links.find(
      (a) =>
        a.closest("[class*='nav' i], [class*='menu' i]") &&
        !a.href.includes("cart") &&
        !a.href.includes("checkout") &&
        !a.href.includes("login") &&
        !a.href.includes("account") &&
        a.href !== homeUrl &&
        a.href !== `${homeUrl}#`,
    );
    if (categoryLink) return categoryLink.href;

    return null;
  }, { keywords: CATEGORY_KEYWORDS, homeUrl: baseUrl });

  if (categoryUrl) {
    result.plp = categoryUrl;
    try {
      await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);

      const productUrl = await page.evaluate((selectors: string[]) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el instanceof HTMLAnchorElement && el.href) {
            try { new URL(el.href); return el.href; } catch { continue; }
          }
        }
        return null;
      }, PDP_SELECTORS);

      result.pdp = productUrl;
      if (!productUrl) {
        console.warn(`  ! no product link found on PLP for ${label}`);
      }
    } catch (err) {
      console.warn(`  ! failed to load PLP for ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.warn(`  ! no PLP category link found for ${label}`);
  }

  return result;
}

function updateConfig(
  config: { version: number; sites: CruxSiteConfigT[] },
  origin: string,
  discovered: DiscoveredPages,
): void {
  const site = config.sites.find((s) => s.origin === origin);
  if (!site) return;

  for (const page of site.pages) {
    if (page.url !== null) continue;
    if (page.type === "checkout" && discovered.checkout) {
      (page as CruxPageEntryT).url = discovered.checkout;
    }
    if (page.type === "plp" && discovered.plp) {
      (page as CruxPageEntryT).url = discovered.plp;
    }
    if (page.type === "pdp" && discovered.pdp) {
      (page as CruxPageEntryT).url = discovered.pdp;
    }
  }
}

async function main(): Promise<void> {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const config = parseYaml(raw) as { version: number; sites: CruxSiteConfigT[] };

  const sitesToDiscover = config.sites.filter((s) =>
    s.pages.some((p) => p.url === null),
  );

  if (sitesToDiscover.length === 0) {
    console.log("All sites already have URLs discovered. Nothing to do.");
    return;
  }

  console.log(`Discovering URLs for ${sitesToDiscover.length} site(s)...\n`);

  const browser = await chromium.launch({ headless: true });
  let updated = 0;

  try {
    for (const site of sitesToDiscover) {
      const missing = site.pages.filter((p) => p.url === null).map((p) => p.type).join(", ");
      console.log(`${site.label} (${site.origin}) — discovering: ${missing}`);

      const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: "es",
        timezoneId: "America/Guatemala",
      });
      const page = await context.newPage();

      try {
        const discovered = await discoverSite(page, site.origin, site.label);
        updateConfig(config, site.origin, discovered);

        const found = [];
        if (discovered.checkout) found.push(`checkout: ${discovered.checkout}`);
        if (discovered.plp) found.push(`plp: ${discovered.plp}`);
        if (discovered.pdp) found.push(`pdp: ${discovered.pdp}`);
        console.log(`  -> ${found.length > 0 ? found.join("\n     ") : "nothing found"}`);
        updated++;
      } catch (err) {
        console.warn(`  ! error discovering ${site.origin}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const out = stringifyYaml(config, { lineWidth: 120 });
  writeFileSync(CONFIG_PATH, out, "utf-8");
  console.log(`\nUpdated ${updated} site(s) in ${CONFIG_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
