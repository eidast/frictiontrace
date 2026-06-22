#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const pairs = [
  ["render/templates", "render/templates"],
  ["render/assets", "render/assets"],
  ["artifacts/har.schema.json", "artifacts/har.schema.json"],
];

for (const [from, to] of pairs) {
  const srcPath = join(SRC, from);
  const destPath = join(DIST, to);
  if (!existsSync(srcPath)) {
    console.warn(`copy-assets: skip (missing) ${from}`);
    continue;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  cpSync(srcPath, destPath, { recursive: true });
  console.log(`copy-assets: ${from} → ${to}`);
}
