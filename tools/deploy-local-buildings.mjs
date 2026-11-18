#!/usr/bin/env node
/**
 * ODIN dev tool — materialize the durable local buildings master into the
 * Vite `dist/` output so `vite preview` (or any static host rooted at dist/)
 * can serve the tileset same-origin.
 *
 * Source of truth is NOT dist/ (vite build wipes it): the master lives in
 * $ODIN_BUILDINGS_MASTER or <repo>/storage/buildings-974 by default.
 *
 * Usage:
 *   node tools/deploy-local-buildings.mjs            # master → dist/odin-local-buildings
 *   node tools/deploy-local-buildings.mjs --pilot    # master/pilot-tiles → dist/odin-local-buildings-pilot
 *
 * The repo's .gitignore already excludes `dist`; nothing here writes outside
 * the repository except the read-only master. Nothing is deleted outside the
 * target directory (which is generated content, recreated wholesale).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isPilot = process.argv.includes('--pilot');

const masterDir =
  process.env.ODIN_BUILDINGS_MASTER ??
  path.join(repoRoot, 'storage', 'buildings-974');
const sourceDir = isPilot
  ? path.join(masterDir, 'pilot', 'pilot-tiles')
  : path.join(masterDir, 'tiles');

const targetDir = path.join(
  repoRoot,
  'dist',
  isPilot ? 'odin-local-buildings-pilot' : 'odin-local-buildings',
);

async function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await dirStats(full);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += (await fs.stat(full)).size;
    }
  }
  return { files, bytes };
}

const tilesetPath = isPilot
  ? path.join(sourceDir, 'tileset.json')
  : path.join(sourceDir, 'tileset.json');

try {
  await fs.access(tilesetPath);
} catch {
  console.error(`[deploy-local-buildings] master tileset not found: ${tilesetPath}`);
  console.error('Run the build pipeline first (tools/buildings/) or set ODIN_BUILDINGS_MASTER.');
  process.exit(1);
}

const t0 = Date.now();
await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(targetDir, { recursive: true });
await fs.cp(sourceDir, targetDir, { recursive: true });

const { files, bytes } = await dirStats(targetDir);
console.log(
  `[deploy-local-buildings] copied ${files} files (${(bytes / 1e6).toFixed(1)} MB)`,
);
console.log(`[deploy-local-buildings] ${sourceDir} → ${targetDir}`);
console.log(
  `[deploy-local-buildings] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
console.log(
  '[deploy-local-buildings] tileset.json:',
  path.join(targetDir, 'tileset.json'),
);
console.log(
  '[deploy-local-buildings] ensure VITE_LOCAL_BUILDINGS_URL=/odin-local-buildings/tileset.json',
);
