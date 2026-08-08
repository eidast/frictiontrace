#!/usr/bin/env node
/**
 * Generates optimized variants (WebP q80, resized to displayed ×2 DPR) for the
 * newest non-excluded homepage image findings per origin + form factor.
 * Output: reports/image-assets/<finding_id>.webp + manifest.json.
 * Idempotent: findings whose variant file already exists are skipped.
 */
import Database from "better-sqlite3";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DB_PATH = process.env.CRUX_DB_PATH ?? resolve(process.cwd(), "data", "crux.db");
const ASSETS_DIR = resolve(process.cwd(), "reports", "image-assets");
const MANIFEST_PATH = resolve(ASSETS_DIR, "manifest.json");

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const DPR_TARGET = 2;
const MAX_DIMENSION = 2560;
const WEBP_QUALITY = 80;
const CONCURRENCY = 4;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface FindingRow {
  id: string;
  resource_url: string;
  displayed_width: number | null;
  displayed_height: number | null;
}

interface ManifestEntry {
  file: string;
  fetched_bytes: number;
  optimized_bytes: number;
  width: number;
  height: number;
}

type Manifest = Record<string, ManifestEntry>;

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
  } catch {
    console.warn("warning: manifest.json corrupto o ilegible; se regenera desde cero.");
    return {};
  }
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/*,*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_DOWNLOAD_BYTES) throw new Error(`demasiado grande (${length} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`demasiado grande (${buf.length} bytes)`);
  if (buf.length === 0) throw new Error("respuesta vacía");
  return buf;
}

async function optimizeFinding(finding: FindingRow): Promise<ManifestEntry> {
  const original = await downloadImage(finding.resource_url);
  let pipeline = sharp(original, { failOn: "error" });
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new Error("dimensiones ilegibles");

  // Target: displayed ×2 DPR (perceptual ceiling), never upscale, hard cap.
  if (finding.displayed_width) {
    const targetWidth = Math.min(
      Math.round(finding.displayed_width * DPR_TARGET),
      MAX_DIMENSION
    );
    if (targetWidth < meta.width) {
      pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
    }
  } else if (meta.width > MAX_DIMENSION) {
    pipeline = pipeline.resize({ width: MAX_DIMENSION, withoutEnlargement: true });
  }

  const out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
  const file = `${finding.id}.webp`;
  writeFileSync(resolve(ASSETS_DIR, file), out.data);
  return {
    file,
    fetched_bytes: original.length,
    optimized_bytes: out.data.length,
    width: out.info.width,
    height: out.info.height,
  };
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error(`Error: no se encontró la base de datos en ${DB_PATH}`);
    process.exit(1);
  }
  mkdirSync(ASSETS_DIR, { recursive: true });

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  // Newest non-excluded run per (origin, form_factor), homepage findings only.
  const findings = db
    .prepare(
      `WITH ranked AS (
         SELECT f.id, f.resource_url, f.displayed_width, f.displayed_height,
                f.origin, f.form_factor, f.run_id, f.fetched_at,
                ROW_NUMBER() OVER (
                  PARTITION BY f.origin, f.form_factor
                  ORDER BY f.fetched_at DESC
                ) AS rn_run
         FROM image_findings f
         JOIN (SELECT DISTINCT run_id FROM synthetic_runs WHERE excluded = 0) s
           ON s.run_id = f.run_id
         WHERE f.page_type = 'homepage'
       ),
       latest AS (
         SELECT origin, form_factor, run_id
         FROM (
           SELECT origin, form_factor, run_id, fetched_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY origin, form_factor ORDER BY fetched_at DESC
                  ) AS rn
           FROM ranked
         ) WHERE rn = 1
       )
       SELECT DISTINCT r.id, r.resource_url, r.displayed_width, r.displayed_height
       FROM ranked r
       JOIN latest l ON l.origin = r.origin AND l.form_factor = r.form_factor
                    AND l.run_id = r.run_id`,
    )
    .all() as FindingRow[];
  db.close();

  if (findings.length === 0) {
    console.log("No hay hallazgos de imágenes. Ejecuta primero una corrida sintética.");
    return;
  }

  const manifest = loadManifest();
  const pending = findings.filter(
    (f) => !manifest[f.id] || !existsSync(resolve(ASSETS_DIR, manifest[f.id].file))
  );
  console.log(
    `Hallazgos: ${findings.length} · ya optimizados: ${findings.length - pending.length} · pendientes: ${pending.length}`
  );

  let done = 0;
  let failed = 0;
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const finding = pending[cursor++];
      try {
        manifest[finding.id] = await optimizeFinding(finding);
        done++;
      } catch (err) {
        failed++;
        console.warn(`  skip ${finding.resource_url.slice(0, 100)} — ${(err as Error).message}`);
      }
      if ((done + failed) % 25 === 0) {
        console.log(`  progreso: ${done + failed}/${pending.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`Listo: ${done} optimizadas, ${failed} fallidas. Manifest: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
