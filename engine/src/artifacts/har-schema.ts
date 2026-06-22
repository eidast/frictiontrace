import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Minimal HAR 1.2 validator. Returns true if `har` has the required shape.
 * (We embed a minimal JSON schema and check the most important fields by hand,
 * to avoid pulling in ajv. M0 is deliberately small.)
 */
export function isValidHar(har: unknown): boolean {
  if (!har || typeof har !== "object") return false;
  const log = (har as { log?: unknown }).log;
  if (!log || typeof log !== "object") return false;
  const l = log as { version?: string; creator?: { name?: string; version?: string }; entries?: unknown[] };
  if (l.version !== "1.2") return false;
  if (!l.creator || typeof l.creator.name !== "string" || typeof l.creator.version !== "string") return false;
  if (!Array.isArray(l.entries)) return false;
  for (const entry of l.entries) {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as { startedDateTime?: string; request?: { method?: string; url?: string }; response?: { status?: number }; timings?: object };
    if (typeof e.startedDateTime !== "string") return false;
    if (!e.request || typeof e.request.method !== "string" || typeof e.request.url !== "string") return false;
    if (!e.response || typeof e.response.status !== "number") return false;
    if (!e.timings) return false;
  }
  return true;
}

export function loadHarSchema(): unknown {
  const path = join(__dirname, "har.schema.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

export const HAR_SCHEMA_PATH = resolve(__dirname, "har.schema.json");
