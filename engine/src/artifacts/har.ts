import type { Database as Db } from "better-sqlite3";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDbPath } from "../storage/db.js";

interface NetworkPayload {
  url?: string;
  method?: string;
  status?: number;
  resourceType?: string;
  ok?: boolean;
  contentLength?: number | null;
  timing?: {
    startTime?: number;
    domainLookupEnd?: number;
    connectEnd?: number;
    secureConnectionStart?: number;
    requestStart?: number;
    responseStart?: number;
    responseEnd?: number;
  };
  durationMs?: number | null;
  fromCache?: boolean;
  finalUrl?: string;
  capturedAt?: number;
}

export interface HarOutput {
  log: {
    version: "1.2";
    creator: { name: string; version: string };
    entries: Array<Record<string, unknown>>;
  };
}

/**
 * Reconstruct a HAR 1.2 file from the run's network category signals.
 * Writes `./runs/<runId>/run.har` and returns the parsed object.
 */
export function signalsToHar(db: Db, runId: string): HarOutput {
  const rows = db
    .prepare(
      `SELECT id, payload_json, captured_at FROM signals
       WHERE run_id = ? AND category = 'network' AND type IN ('response', 'request_failed')
       ORDER BY captured_at ASC`,
    )
    .all(runId) as Array<{ id: string; payload_json: string; captured_at: number }>;

  const entries: Array<Record<string, unknown>> = rows.map((r) => {
    let p: NetworkPayload;
    try {
      p = JSON.parse(r.payload_json);
    } catch {
      p = {};
    }
    const t = p.timing;
    const blocked = 0;
    const dns = t?.domainLookupEnd && t?.startTime ? Math.max(0, t.domainLookupEnd - t.startTime) : 0;
    const connect = t?.connectEnd && t?.domainLookupEnd ? Math.max(0, t.connectEnd - t.domainLookupEnd) : 0;
    const ssl = t?.secureConnectionStart && t?.connectEnd ? Math.max(0, t.connectEnd - t.secureConnectionStart) : 0;
    const send = t?.requestStart && t?.connectEnd ? Math.max(0, t.requestStart - t.connectEnd) : 0;
    const wait = t?.responseStart && t?.requestStart ? Math.max(0, t.responseStart - t.requestStart) : 0;
    const receive = t?.responseEnd && t?.responseStart ? Math.max(0, t.responseEnd - t.responseStart) : 0;
    const total = p.durationMs ?? 0;

    return {
      startedDateTime: new Date(r.captured_at).toISOString(),
      time: total,
      request: {
        method: p.method ?? "GET",
        url: p.url ?? "",
        httpVersion: "HTTP/1.1",
        headers: [],
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: -1,
      },
      response: {
        status: p.status ?? 0,
        statusText: "",
        httpVersion: "HTTP/1.1",
        headers: [],
        cookies: [],
        content: { size: p.contentLength ?? 0, mimeType: p.resourceType ?? "application/octet-stream" },
        redirectURL: "",
        headersSize: -1,
        bodySize: p.contentLength ?? -1,
      },
      cache: {},
      timings: { blocked, dns, connect, ssl, send, wait, receive, _blocked_queueing: -1 },
      serverIPAddress: "",
      connection: "",
      _transferSize: p.contentLength ?? 0,
      _ftSignalId: r.id,
    };
  });

  return {
    log: {
      version: "1.2",
      creator: { name: "FrictionTrace", version: "0.1.0" },
      entries,
    },
  };
}

export function writeHar(db: Db, runId: string, outDir?: string): string {
  const har = signalsToHar(db, runId);
  const path = join(outDir ?? runDbPath(runId, undefined).replace(/\/audit\.db$/, ""), "run.har");
  writeFileSync(path, JSON.stringify(har, null, 2));
  return path;
}
