import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Domain → category map. Extend as needed. Used to bucket third-party domains
 * when emitting the third_party inventory.
 */
export const DOMAIN_CATEGORIES: Record<string, string> = {
  "googletagmanager.com": "tag_manager",
  "www.googletagmanager.com": "tag_manager",
  "google-analytics.com": "analytics",
  "www.google-analytics.com": "analytics",
  "analytics.google.com": "analytics",
  "segment.com": "analytics",
  "cdn.segment.com": "analytics",
  "api.segment.io": "analytics",
  "mixpanel.com": "analytics",
  "cdn.mxpnl.com": "analytics",
  "amplitude.com": "analytics",
  "cdn.amplitude.com": "analytics",
  "hotjar.com": "heatmap",
  "static.hotjar.com": "heatmap",
  "script.hotjar.com": "heatmap",
  "fullstory.com": "session_replay",
  "facebook.net": "ads",
  "connect.facebook.net": "ads",
  "googleadservices.com": "ads",
  "doubleclick.net": "ads",
  "tiktok.com": "ads",
  "analytics.tiktok.com": "ads",
  "intercom.io": "chat",
  "widget.intercom.io": "chat",
  "js.intercomcdn.com": "chat",
  "zendesk.com": "chat",
  "static.zdassets.com": "chat",
  "drift.com": "chat",
  "js.driftt.com": "chat",
  "stripe.com": "payments",
  "js.stripe.com": "payments",
  "paypal.com": "payments",
  "www.paypalobjects.com": "payments",
  "mercadopago.com": "payments",
  "secure.mlstatic.com": "payments",
  "klaviyo.com": "marketing",
  "static.klaviyo.com": "marketing",
  "list-manage.com": "marketing",
  "hubspot.com": "marketing",
  "js.hsforms.net": "marketing",
  "yotpo.com": "reviews",
  "staticw2.yotpo.com": "reviews",
  "trustpilot.com": "reviews",
  "widget.trustpilot.com": "reviews",
  "cloudflare.com": "cdn",
  "cdnjs.cloudflare.com": "cdn",
  "akamaihd.net": "cdn",
  "fastly.net": "cdn",
};

export function categorizeDomain(domain: string): string {
  return DOMAIN_CATEGORIES[domain] ?? "other";
}

export interface ThirdPartyEntry {
  domain: string;
  category: string;
  requestCount: number;
  totalBytes: number;
  totalDurationMs: number;
  failureCount: number;
}

/**
 * Post-process network signals into a per-domain third-party inventory.
 * Groups by non-first-party domain and emits one signal per domain.
 */
export function buildThirdPartyInventory(db: Db, runId: string, firstPartyDomain: string): ThirdPartyEntry[] {
  const rows = db
    .prepare(
      `SELECT payload_json FROM signals
       WHERE run_id = ? AND category = 'network' AND type IN ('response', 'request_failed')`,
    )
    .all(runId) as Array<{ payload_json: string }>;

  const byDomain = new Map<string, ThirdPartyEntry>();
  for (const r of rows) {
    let payload: { url?: string; method?: string; status?: number; ok?: boolean; resourceType?: string; durationMs?: number | null; contentLength?: number | null; failure?: string };
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      continue;
    }
    if (!payload.url) continue;
    let host: string;
    try {
      host = new URL(payload.url).hostname;
    } catch {
      continue;
    }
    if (host === firstPartyDomain) continue;

    const existing = byDomain.get(host) ?? {
      domain: host,
      category: categorizeDomain(host),
      requestCount: 0,
      totalBytes: 0,
      totalDurationMs: 0,
      failureCount: 0,
    };
    existing.requestCount += 1;
    existing.totalBytes += payload.contentLength ?? 0;
    existing.totalDurationMs += payload.durationMs ?? 0;
    if (payload.failure || (payload.status !== undefined && payload.status >= 400)) {
      existing.failureCount += 1;
    }
    byDomain.set(host, existing);
  }

  const entries = Array.from(byDomain.values());
  for (const e of entries) {
    signalsRepo.insert(db, runId, {
      category: "third_party",
      type: "third_party_domain",
      payload: e,
    });
  }
  return entries;
}
