/**
 * Local 3D buildings storage — end-user managed, on this machine only.
 *
 * The ODIN server doubles as the operator's key-holder: this module manages
 * where the locally-downloaded GMLFP footprints, the IGN-enriched versions
 * and the generated 3D Tiles live, so the choice is not hard-wired into the
 * build. The browser talks to three read/write endpoints plus one static file
 * route for the tileset itself.
 *
 *   GET  /api/local-data/status     → { enabled, path, state, counts, ... }
 *   POST /api/local-data/configure  → move/adopt/enable/disable (explicit)
 *   POST /api/local-data/verify     → SHA-256 check of checksums.sha256
 *   POST /api/local-data/delete     → scoped, phrase-confirmed deletion
 *   GET  /local-data/buildings/*    → the tileset, same-origin
 *
 * Design notes:
 *  - The browser cannot rename host directories, so "changing the folder" is
 *    done here, on the server side, with a real move (rename, with a copy
 *    fallback for cross-device moves). The UI is a form, never a fake picker.
 *  - The source GMLFP downloads are never deleted implicitly — only the
 *    generated tiles and the enriched copies can go with a single confirm,
 *    and the sources require a separate, explicit phrase.
 *  - Deletion is scoped strictly to the configured store directory.
 *  - The static route serves exactly <store>/tiles/** and nothing else.
 *
 * Loopback + exact-local-Origin admission reuses the key-setup gate so this
 * surface is invisible to LAN visitors, tunnels and proxied traffic alike.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { admitKeySetupRequest } from '../../src/keySetupCore.mjs';
import { defaultSourceRoot } from '../providers/common/source-root.js';

const STORE_SUBDIRS = ['source', 'enriched', 'tiles', 'pilot'];
const STORE_FILES = ['manifest.json', 'checksums.sha256'];
const CONFIRM_PHRASES = Object.freeze({
  tiles: 'DELETE TILES',
  enriched: 'DELETE ENRICHED',
  source: 'DELETE SOURCE',
  manifest: 'DELETE MANIFEST',
});
const DEPLOY_CONFIRM = 'COPY TO DIST';

/* ── paths ─────────────────────────────────────────────────────────────── */

// Single source of truth for the ODIN storage root: the repository-local
// `storage/` directory by default (the buildings master now lives there),
// overridable per process via ODIN_STORAGE_DIR (absolute) for isolated
// fixtures. The local runtime config defaults to <repo>/config/local-data.json
// (overridable via ODIN_LOCAL_DATA_CONFIG).
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export function resolveStorageRoot(env = process.env) {
  const explicit = String(env?.ODIN_STORAGE_DIR || '').trim();
  if (explicit && path.isAbsolute(explicit)) return path.resolve(explicit);
  return path.join(repoRoot, 'storage');
}

export function defaultStoreDir(env = process.env, storageRoot) {
  const root = storageRoot ?? resolveStorageRoot(env);
  return path.join(path.resolve(root), 'buildings-974');
}

export function defaultConfigPath(env = process.env) {
  const explicit = String(env?.ODIN_LOCAL_DATA_CONFIG || '').trim();
  const dir =
    explicit && path.isAbsolute(explicit)
      ? path.dirname(explicit)
      : path.join(repoRoot, 'config');
  return path.join(dir, 'local-data.json');
}

function configPath(env = process.env, homedir = os.homedir) {
  const explicit = String(env.ODIN_LOCAL_DATA_CONFIG || '').trim();
  if (explicit && path.isAbsolute(explicit)) return explicit;
  return defaultConfigPath(env, homedir);
}

export function storePaths(storeRoot) {
  return {
    storeRoot,
    source: path.join(storeRoot, 'source'),
    enriched: path.join(storeRoot, 'enriched'),
    tiles: path.join(storeRoot, 'tiles'),
    tileset: path.join(storeRoot, 'tiles', 'tileset.json'),
    manifest: path.join(storeRoot, 'manifest.json'),
    checksums: path.join(storeRoot, 'checksums.sha256'),
  };
}

/* ── admission ─────────────────────────────────────────────────────────── */

const refusal = (status, code, error) => ({ ok: false, status, code, error });
const admit = (req, env = process.env) => {
  const header = (name) => {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return admitKeySetupRequest({
    method: req.method,
    remoteAddress: req.socket?.remoteAddress,
    hostHeader: header('host'),
    protocol: header('x-forwarded-proto')
      ? `${header('x-forwarded-proto')}:`
      : 'http:',
    origin: header('origin'),
    contentType: header('content-type'),
    proxyHeaders: {
      'x-forwarded-for': header('x-forwarded-for'),
      'x-forwarded-host': header('x-forwarded-host'),
      'x-forwarded-proto': header('x-forwarded-proto'),
      'x-real-ip': header('x-real-ip'),
      forwarded: header('forwarded'),
    },
    env,
  });
};

const respond = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const refusalPayload = (admission) => ({
  error: admission.error,
  code: admission.code,
});

const errorPayload = (code, error) => ({ error, code });

/* ── path validation ──────────────────────────────────────────────────── */

// Roots a local build must never use as its storage home.
const SYSTEM_ROOTS = [
  '/',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/root',
  '/run',
  '/sbin',
  '/sys',
  '/tmp',
  '/usr',
  '/var',
];

/**
 * Validate a candidate storage path. Pure (except an fs existence probe) so
 * it can be unit-tested against fixtures. A candidate inside the repository
 * is accepted only within the ODIN storage root (repository storage/ by
 * default) - the buildings master now lives there by design.
 * @param {string} candidate
 * @param {{ storageRoot?: string, repoRoot?: string, fsImpl?: typeof fs }} [options]
 * @returns {{ ok: true, path: string } | { ok: false, code: string, reason: string }}
 */
export function validateStorePath(
  candidate,
  { storageRoot, repoRoot: repo, fsImpl } = {},
) {
  const fsx = fsImpl ?? fs;
  const text = String(candidate || '').trim();
  if (!text)
    return { ok: false, code: 'path-required', reason: 'Path is required' };
  if (!path.isAbsolute(text))
    return { ok: false, code: 'not-absolute', reason: 'Path must be absolute' };

  const resolved = path.resolve(text);
  for (const root of SYSTEM_ROOTS) {
    const rootResolved = path.resolve(root);
    if (root === '/') {
      if (resolved === '/') {
        return {
          ok: false,
          code: 'system-directory',
          reason: 'Storage must not live at the filesystem root',
        };
      }
      continue;
    }
    if (
      resolved === rootResolved ||
      resolved.startsWith(rootResolved + path.sep)
    ) {
      return {
        ok: false,
        code: 'system-directory',
        reason: `Storage must not live inside ${root}`,
      };
    }
  }
  const allowedRoot = storageRoot
    ? path.resolve(storageRoot)
    : resolveStorageRoot();
  const repoResolved = repo ? path.resolve(repo) : repoRoot;
  const withSep = repoResolved.endsWith(path.sep)
    ? repoResolved
    : `${repoResolved}${path.sep}`;
  const insideStore =
    resolved === allowedRoot || resolved.startsWith(allowedRoot + path.sep);
  const insideRepo = resolved === repoResolved || resolved.startsWith(withSep);
  if (insideRepo && !insideStore) {
    return {
      ok: false,
      code: 'inside-repo',
      reason:
        'Storage must live inside the ODIN storage root (repository storage/ by default)',
    };
  }

  // If the directory exists, it must be one; if not, the parent must be.
  let stat = null;
  try {
    stat = fsx.statSync(resolved);
  } catch {
    // missing — find nearest existing ancestor for a writability probe
    let ancestor = resolved;
    while (ancestor !== path.dirname(ancestor) && !fsx.existsSync(ancestor)) {
      ancestor = path.dirname(ancestor);
    }
    try {
      const ancStat = fsx.statSync(ancestor);
      if (!ancStat.isDirectory())
        return {
          ok: false,
          code: 'not-a-directory',
          reason: `${ancestor} is not a directory`,
        };
    } catch {
      return {
        ok: false,
        code: 'unreachable',
        reason: `Cannot reach ${ancestor}`,
      };
    }
    return { ok: true, path: resolved };
  }
  if (!stat.isDirectory())
    return {
      ok: false,
      code: 'not-a-directory',
      reason: `${resolved} is a file, not a directory`,
    };
  return { ok: true, path: resolved };
}

/* ── config read/write ────────────────────────────────────────────────── */

export async function readLocalDataConfig(env = process.env) {
  try {
    const raw = await fsp.readFile(configPath(env), 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeConfig(parsed);
  } catch {
    return { enabled: false, path: null, updatedAt: null, migrated: false };
  }
}

function sanitizeConfig(parsed) {
  if (!isPlain(parsed))
    return { enabled: false, path: null, updatedAt: null, migrated: false };
  const enabled = parsed.enabled === true;
  const p =
    typeof parsed.path === 'string' && parsed.path.trim()
      ? parsed.path.trim()
      : null;
  return {
    enabled,
    path: p,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    migrated: false,
  };
}

function isPlain(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function writeLocalDataConfig(config, env = process.env) {
  const target = configPath(env);
  const doc = {
    version: 1,
    enabled: config.enabled === true,
    path: config.path,
    updatedAt: new Date().toISOString(),
  };
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(tmp, JSON.stringify(doc, null, 2) + '\n', {
      mode: 0o600,
    });
    await fsp.rename(tmp, target);
  } catch (error) {
    try {
      await fsp.rm(tmp, { force: true });
    } catch {
      /* best effort */
    }
    throw Object.assign(new Error('could not write local data config'), {
      code: 'config-write-failed',
      cause: error,
    });
  }
}

/* ── store scan ────────────────────────────────────────────────────────── */

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const cleanString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const cleanNumber = (value) => (Number.isFinite(value) ? value : null);

/**
 * Flatten the on-disk provenance manifest into the status payload. The browser
 * must not re-read a host file (it cannot), and a chip saying "ready" without
 * licence/dates/versions would be impossible to audit after the fact.
 * Unknown fields are dropped; nothing is invented when the manifest is older.
 * @param {unknown} doc
 */
function manifestSummary(doc) {
  if (!isPlain(doc)) return {};
  const src = isPlain(doc.source) ? doc.source : {};
  const gen = isPlain(doc.generator) ? doc.generator : {};
  const heights = isPlain(doc.heights) ? doc.heights : {};
  const bases = isPlain(doc.bases) ? doc.bases : {};
  const result = isPlain(doc.result) ? doc.result : {};
  const integrity = isPlain(doc.integrity) ? doc.integrity : {};
  return {
    schemaVersion: cleanNumber(doc.schemaVersion),
    createdAt: cleanString(doc.createdAt),
    tilesGeneratedAt: cleanString(doc.tilesGeneratedAt),
    versions: isPlain(doc.versions) ? doc.versions : {},
    dataset: cleanString(src.dataset),
    publisher: cleanString(src.publisher),
    license: cleanString(src.license),
    licenseUrl: cleanString(src.licenseUrl),
    datasetRefresh: cleanString(src.datasetRefresh),
    retrieved: cleanString(src.retrieved),
    generatorTool: cleanString(gen.tool),
    altitudeEnricher: cleanString(gen.altitudeEnricher),
    cellDeg: cleanNumber(gen.cellDeg),
    gltfUpAxis: cleanString(gen.gltfUpAxis),
    rtcCenter: typeof gen.rtcCenter === 'boolean' ? gen.rtcCenter : null,
    defaultHeightM: cleanNumber(heights.defaultHeightM),
    heightSource: cleanString(heights.heightSource),
    baseSource: cleanString(bases.source),
    validIgnCount: cleanNumber(bases.validIgnCount),
    scope: cleanString(result.scope),
    scopeNote: cleanString(result.scopeNote),
    checksumsFile: cleanString(integrity.checksumsFile),
  };
}

const countLinesFast = async (file) => {
  // Reads in chunks, counts 0x0A — good enough and fast on 100+ MB files.
  const stream = fs.createReadStream(file, {
    highWaterMark: 1 << 20,
    autoClose: true,
  });
  let count = 0;
  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i += 1) if (chunk[i] === 10) count += 1;
  }
  return count;
};

async function scanEnrichedDir(enrichedDir) {
  // Returns per-file counts of IGN vs no-data groundSource without keeping
  // the records in memory. One unreadable file (truncated .gz, partial write)
  // must not make the whole store look broken: count it as unreadable and
  // keep the healthy files.
  const totals = { lines: 0, ign: 0, noData: 0, files: 0, unreadable: 0 };
  let entries = [];
  try {
    entries = await fsp.readdir(enrichedDir, { withFileTypes: true });
  } catch {
    return totals;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.jsonl(\.gz)?$/i.test(entry.name)) continue;
    const file = path.join(enrichedDir, entry.name);
    totals.files += 1;
    const perFile = { lines: 0, ign: 0, noData: 0 };
    let input = null;
    try {
      input = file.endsWith('.gz')
        ? fs.createReadStream(file).pipe(zlib.createGunzip())
        : fs.createReadStream(file);
      let buffer = '';
      for await (const chunk of input) {
        buffer += chunk;
        let idx = buffer.indexOf('\n');
        while (idx !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.trim()) {
            perFile.lines += 1;
            const tail = line.includes('"groundSource":"no-data"')
              ? 'no-data'
              : line.includes('"groundSource":"ign"')
                ? 'ign'
                : 'other';
            if (tail === 'ign') perFile.ign += 1;
            else if (tail === 'no-data') perFile.noData += 1;
          }
          idx = buffer.indexOf('\n');
        }
      }
      totals.lines += perFile.lines;
      totals.ign += perFile.ign;
      totals.noData += perFile.noData;
    } catch {
      totals.unreadable += 1;
    } finally {
      input?.destroy?.();
    }
  }
  return totals;
}

async function summarizeStoreInternal(storeRoot) {
  const paths = storePaths(storeRoot);
  const result = {
    exists: false,
    readable: false,
    state: 'absent',
    counts: {
      sourceFiles: 0,
      enrichedLines: 0,
      enrichedIgn: 0,
      enrichedNoData: 0,
      enrichedUnreadable: 0,
      tiles: 0,
      buildings: null,
      bytes: 0,
    },
    manifest: null,
    checksumsPresent: false,
    updatedAt: null,
    reason: null,
  };

  let stat = null;
  try {
    stat = await fsp.stat(storeRoot);
    result.exists = true;
    result.readable = true;
  } catch {
    return result;
  }
  if (!stat.isDirectory()) {
    result.state = 'error';
    result.reason = 'The configured path is not a directory';
    return result;
  }

  try {
    const top = await fsp.readdir(storeRoot, { withFileTypes: true });
    result.counts.sourceFiles = top.filter(
      (e) => e.isDirectory() && e.name === 'source',
    ).length;
    // source listing
    try {
      const srcEntries = await fsp.readdir(paths.source, {
        withFileTypes: true,
      });
      result.counts.sourceFiles = srcEntries.filter((e) =>
        /\.csv\.gz$/i.test(e.name),
      ).length;
    } catch {
      result.counts.sourceFiles = 0;
    }

    // tiles
    try {
      const tileFiles = [];
      await walk(
        paths.tiles,
        (name) => {
          if (/\.b3dm$/i.test(name)) tileFiles.push(name);
        },
        10_000,
      );
      result.counts.tiles = tileFiles.length;
    } catch {
      result.counts.tiles = 0;
    }

    // tileset.json extras
    try {
      const raw = await fsp.readFile(paths.tileset, 'utf8');
      const doc = safeJsonParse(raw);
      const extras = doc && typeof doc === 'object' ? doc.extras : null;
      const featureCount = Number(extras?.featureCount);
      result.counts.buildings = Number.isFinite(featureCount)
        ? featureCount
        : null;
      result.manifest = {
        featureCount: Number.isFinite(featureCount) ? featureCount : null,
        tilesetGenerator: extras?.generator ?? null,
        attribution: extras?.attribution ?? null,
        gltfUpAxis: doc?.asset?.gltfUpAxis ?? null,
      };
      result.updatedAt = stat.mtime.toISOString();
    } catch {
      result.counts.buildings = null;
    }
  } catch (error) {
    result.state = 'error';
    result.reason = 'Could not read the storage directory';
    return result;
  }

  try {
    const total = await dirBytes(storeRoot);
    result.counts.bytes = total;
  } catch {
    /* keep zero */
  }

  // enriched counts (may be big — done lazily but only when tiles exist)
  if (result.counts.tiles > 0 || result.counts.sourceFiles > 0) {
    const enriched = await scanEnrichedDir(paths.enriched);
    result.counts.enrichedLines = enriched.lines;
    result.counts.enrichedIgn = enriched.ign;
    result.counts.enrichedNoData = enriched.noData;
    result.counts.enrichedUnreadable = enriched.unreadable;
  }

  try {
    const raw = await fsp.readFile(paths.manifest, 'utf8');
    const doc = safeJsonParse(raw);
    if (doc) {
      result.manifest = {
        ...(result.manifest ?? {}),
        generatedAt: cleanString(doc.createdAt),
        license: cleanString(doc?.source?.license),
        defaultHeightM: cleanNumber(doc?.heights?.defaultHeightM),
        ...manifestSummary(doc),
      };
    }
  } catch {
    /* no manifest — fine */
  }

  result.checksumsPresent = false;
  result.checksumsCount = 0;
  try {
    const raw = await fsp.readFile(paths.checksums, 'utf8');
    result.checksumsPresent = true;
    result.checksumsCount = raw
      .split('\n')
      .filter((line) => line.trim()).length;
  } catch {
    /* no checksums — fine */
  }

  const hasAnyData =
    result.counts.tiles > 0 ||
    result.counts.sourceFiles > 0 ||
    result.counts.enrichedLines > 0;

  if (!hasAnyData) {
    result.state = result.exists ? 'empty' : 'absent';
    return result;
  }
  const tilesetOk = result.counts.buildings !== null && result.counts.tiles > 0;
  result.state = tilesetOk ? 'ready' : 'partial';
  return result;
}

async function dirBytes(dir) {
  let total = 0;
  await walk(dir, (name, filePath, st) => {
    if (st?.isFile()) total += st.size;
  });
  return total;
}

async function walk(dir, onFile, limit = 100_000) {
  let count = 0;
  async function rec(current) {
    if (count >= limit) return;
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= limit) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await rec(full);
      } else if (entry.isFile()) {
        count += 1;
        onFile(entry.name, full, await fsp.stat(full).catch(() => null));
      }
    }
  }
  await rec(dir);
}

/** Public wrapper — intentionally async, never throws. */
export async function summarizeStore(storeRoot) {
  try {
    return await summarizeStoreInternal(storeRoot);
  } catch (error) {
    return {
      exists: false,
      readable: false,
      state: 'error',
      counts: {
        sourceFiles: 0,
        enrichedLines: 0,
        enrichedIgn: 0,
        enrichedNoData: 0,
        tiles: 0,
        buildings: null,
        bytes: 0,
      },
      manifest: null,
      checksumsPresent: false,
      updatedAt: null,
      reason: 'Unexpected error while reading the storage directory',
    };
  }
}

/* ── move / adopt / delete ─────────────────────────────────────────────── */

async function copyTree(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await fsp.copyFile(from, to, fs.constants.COPYFILE_EXCL);
    }
  }
}

/** Move only the known store subtrees — never unknown files. */
export async function moveStoreContents(src, dst) {
  const moved = [];
  await fsp.mkdir(dst, { recursive: true });
  for (const key of STORE_SUBDIRS) {
    const from = path.join(src, key);
    const to = path.join(dst, key);
    if (!fs.existsSync(from)) continue;
    if (fs.existsSync(to)) {
      const st = await fsp.stat(to).catch(() => null);
      if (st?.isDirectory()) {
        const entries = await fsp.readdir(to);
        if (entries.length > 0) {
          return {
            ok: false,
            code: 'destination-not-empty',
            error: `Destination already contains data in ${key}`,
          };
        }
      }
    }
    try {
      await fsp.rename(from, to);
      moved.push(key);
    } catch (error) {
      if (error?.code !== 'EXDEV') throw error;
      await copyTree(from, to);
      await fsp.rm(from, { recursive: true, force: true });
      moved.push(key);
    }
  }
  for (const name of STORE_FILES) {
    const from = path.join(src, name);
    const to = path.join(dst, name);
    if (!fs.existsSync(from)) continue;
    if (fs.existsSync(to)) continue; // keep destination's copy
    try {
      await fsp.rename(from, to);
      moved.push(name);
    } catch (error) {
      if (error?.code !== 'EXDEV') throw error;
      await fsp.copyFile(from, to, fs.constants.COPYFILE_EXCL);
      await fsp.rm(from, { force: true });
      moved.push(name);
    }
  }
  return { ok: true, moved };
}

/** Delete one scope inside the store. Sizes reported; unknown files untouched. */
export async function deleteStoreScope(storeRoot, scope) {
  const paths = storePaths(storeRoot);
  const targets = {
    tiles: [paths.tiles],
    enriched: [paths.enriched],
    source: [paths.source],
    manifest: [paths.manifest, paths.checksums],
  }[scope];
  if (!targets) {
    return {
      ok: false,
      code: 'unknown-scope',
      error: `Unknown delete scope: ${scope}`,
    };
  }
  let freedBy = 0;
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const st = await fsp.stat(target).catch(() => null);
    if (st?.isDirectory()) {
      freedBy += await dirBytes(target);
      await fsp.rm(target, { recursive: true, force: true });
    } else if (st?.isFile()) {
      freedBy += st.size;
      await fsp.rm(target, { force: true });
    }
  }
  return { ok: true, freedBy };
}

/**
 * Materialize the tiles into dist/ for static hosting. The master store is
 * never modified: dist/ is a disposable mirror that the next `npm run build`
 * may wipe. Returns stats so the UI can state exactly what was copied.
 * @param {string} storeRoot
 * @param {string} repoRoot
 */
export async function deployTilesToDist(storeRoot, repoRoot) {
  const source = storePaths(storeRoot).tiles;
  const target = path.join(
    path.resolve(repoRoot),
    'dist',
    'odin-local-buildings',
  );
  const sourceStat = await fsp
    .stat(path.join(source, 'tileset.json'))
    .catch(() => null);
  if (!sourceStat?.isFile())
    return {
      ok: false,
      code: 'tileset-missing',
      error: 'No tileset in the local store',
    };
  const resolvedSource = path.resolve(source);
  if (
    resolvedSource === path.resolve(target) ||
    resolvedSource.startsWith(path.resolve(target) + path.sep)
  )
    return {
      ok: false,
      code: 'target-is-store',
      error: 'dist target overlaps the master store',
    };
  let files = 0;
  let bytes = 0;
  const count = async (dir) => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await count(full);
      else if (entry.isFile()) {
        files += 1;
        bytes += (await fsp.stat(full)).size;
      }
    }
  };
  await count(source);
  await fsp.rm(target, { recursive: true, force: true });
  await fsp.mkdir(target, { recursive: true });
  await fsp.cp(source, target, { recursive: true });
  return { ok: true, target, files, bytes };
}

/* ── config resolution ────────────────────────────────────────────────── */

export async function resolveLocalData(
  env = process.env,
  homedir = os.homedir,
  scan = summarizeStore,
) {
  const config = await readLocalDataConfig(env);
  const storeRoot = config.path ?? defaultStoreDir(env);
  const paths = storePaths(storeRoot);
  const summary = config.enabled
    ? await scan(storeRoot)
    : {
        exists: false,
        state: 'disabled',
        counts: null,
        manifest: null,
        checksumsPresent: false,
        updatedAt: null,
        reason: null,
      };
  return {
    enabled: config.enabled,
    path: storeRoot,
    defaultPath: defaultStoreDir(env),
    configured: config.path !== null,
    summary,
    paths,
  };
}

/* ── static file serving for the tileset ───────────────────────────────── */

const CONTENT_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.b3dm': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json; charset=utf-8',
  '.terrain': 'application/vnd.quantized-mesh',
};

const sendFile = async (req, res, filePath) => {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      CONTENT_TYPES[ext] ?? 'application/octet-stream',
    );
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.end(await fsp.readFile(filePath));
    return true;
  } catch {
    return false;
  }
};

const serveTileset = (storeRoot) => async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const suffix = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const safe = path.normalize(suffix).replace(/^(\.\.[\/\\])+/, '');
  if (safe.startsWith('..') || path.isAbsolute(safe) || safe.includes('\0')) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }
  const filePath = path.join(storeRoot, 'tiles', safe);
  const ok = await sendFile(req, res, filePath);
  if (!ok) {
    res.statusCode = 404;
    res.end('not found');
  }
};

/* ── plugin ─────────────────────────────────────────────────────────────── */

export function localDataEndpoint(options = {}) {
  const env = options.env ?? process.env;
  const root = options.repoRoot ?? defaultSourceRoot;

  // Short-lived scan cache — a status render walks every tile and every
  // enriched line, which is slow enough to matter on big stores. 30 s TTL,
  // busted by any mutation through this plugin.
  const summaryCache = new Map();
  const scanStore = async (storeRoot) => {
    const hit = summaryCache.get(storeRoot);
    if (hit && Date.now() - hit.at < 30_000) return hit.summary;
    const summary = await summarizeStore(storeRoot);
    summaryCache.set(storeRoot, { at: Date.now(), summary });
    return summary;
  };
  const bustSummary = (storeRoot) => summaryCache.delete(storeRoot);

  const readBody = (req) =>
    new Promise((resolve) => {
      let body = '';
      let overflowed = false;
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 16_384) {
          overflowed = true;
          req.destroy();
        }
      });
      req.on('end', () => resolve({ body, overflowed }));
      req.on('error', () => resolve({ body: '', overflowed: true }));
    });

  const jsonBody = async (req) => {
    const { body, overflowed } = await readBody(req);
    if (overflowed)
      return {
        ok: false,
        status: 413,
        code: 'too-large',
        error: 'Request too large',
      };
    try {
      const parsed = JSON.parse(body || '{}');
      if (!isPlain(parsed))
        return {
          ok: false,
          status: 400,
          code: 'not-object',
          error: 'Body must be a JSON object',
        };
      return { ok: true, value: parsed };
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'invalid-json',
        error: 'Invalid JSON',
      };
    }
  };

  const registerMiddleware = (server) => {
    server.middlewares.use('/api/local-data/status', async (req, res) => {
      if (req.method !== 'GET')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const admission = admit(req, env);
      if (!admission.ok)
        return respond(res, admission.status, refusalPayload(admission));
      const resolved = await resolveLocalData(env, undefined, scanStore);
      respond(res, 200, { ok: true, ...resolved });
    });
    server.middlewares.use('/api/local-data/configure', async (req, res) => {
      if (req.method !== 'POST')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const admission = admit(req, env);
      if (!admission.ok)
        return respond(res, admission.status, refusalPayload(admission));
      const parsed = await jsonBody(req);
      if (!parsed.ok)
        return respond(
          res,
          parsed.status,
          errorPayload(parsed.code, parsed.error),
        );
      const body = parsed.value;
      const wantsEnabled = Object.prototype.hasOwnProperty.call(
        body,
        'enabled',
      );
      const wantsPath =
        typeof body.path === 'string' && body.path.trim()
          ? body.path.trim()
          : null;
      if (!wantsEnabled && !wantsPath) {
        return respond(
          res,
          400,
          errorPayload('nothing-to-configure', 'Provide enabled and/or path'),
        );
      }

      const previous = await resolveLocalData(env, undefined, scanStore);
      // Missing `enabled` keeps the current state; explicit false disables.
      const enabled = wantsEnabled ? body.enabled === true : previous.enabled;

      // ── path resolution & validation ──
      let newRoot = wantsPath ?? previous.path ?? previous.defaultPath;
      const verdict = validateStorePath(newRoot, {
        storageRoot: resolveStorageRoot(env),
        repoRoot: root,
      });
      if (!verdict.ok)
        return respond(res, 400, errorPayload(verdict.code, verdict.reason));
      newRoot = verdict.path;

      // Ensure it exists & is writable (create missing dirs).
      try {
        await fsp.mkdir(newRoot, { recursive: true });
        const probe = path.join(newRoot, `.odin-write-probe-${process.pid}`);
        await fsp.writeFile(probe, 'ok');
        await fsp.rm(probe, { force: true });
      } catch (error) {
        return respond(
          res,
          400,
          errorPayload(
            'not-writable',
            `Storage path is not writable: ${error?.message ?? 'unknown error'}`,
          ),
        );
      }

      const newSummary = await scanStore(newRoot);
      const oldRoot = previous.path ?? previous.defaultPath;
      const oldSummary = await scanStore(oldRoot);

      // Case analysis — never overwrite non-empty foreign content.
      const newHasData =
        newSummary.counts.tiles > 0 ||
        newSummary.counts.sourceFiles > 0 ||
        newSummary.counts.enrichedLines > 0;
      const newIsReady = newSummary.state === 'ready';
      const oldHasData =
        oldSummary.counts.tiles > 0 ||
        oldSummary.counts.sourceFiles > 0 ||
        oldSummary.counts.enrichedLines > 0;
      const oldIsReady = oldSummary.state === 'ready';

      let moveResult = null;
      if (
        newHasData &&
        !newIsReady &&
        oldIsReady &&
        path.resolve(newRoot) !== path.resolve(oldRoot)
      ) {
        // Partial foreign content in target + working data elsewhere — refuse.
        return respond(
          res,
          409,
          errorPayload(
            'target-not-empty',
            'Target directory already contains partial data and cannot be adopted. Choose an empty directory or the existing store.',
          ),
        );
      }

      // If the new path is empty and the old store has data, move it over.
      if (
        !newHasData &&
        oldHasData &&
        path.resolve(newRoot) !== path.resolve(oldRoot)
      ) {
        moveResult = await moveStoreContents(oldRoot, newRoot);
        if (!moveResult.ok)
          return respond(
            res,
            409,
            errorPayload(moveResult.code, moveResult.error),
          );
      }

      await writeLocalDataConfig(
        { enabled, path: newRoot, updatedAt: null },
        env,
      );
      // The pre-move scans are cached for 30 s. Without invalidating both
      // roots, the response would still report the OLD empty target and the
      // UI would claim the data vanished right after a successful move.
      bustSummary(newRoot);
      bustSummary(oldRoot);
      const fresh = await resolveLocalData(env, undefined, scanStore);
      respond(res, 200, {
        ok: true,
        moved: moveResult?.moved ?? [],
        adopted: newIsReady,
        ...fresh,
      });
    });
    server.middlewares.use('/api/local-data/delete', async (req, res) => {
      if (req.method !== 'POST')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const admission = admit(req, env);
      if (!admission.ok)
        return respond(res, admission.status, refusalPayload(admission));
      const parsed = await jsonBody(req);
      if (!parsed.ok)
        return respond(
          res,
          parsed.status,
          errorPayload(parsed.code, parsed.error),
        );
      const scope =
        typeof parsed.value.scope === 'string' ? parsed.value.scope : '';
      const phrase = CONFIRM_PHRASES[scope];
      if (!phrase)
        return respond(
          res,
          400,
          errorPayload('unknown-scope', `Unknown scope: ${scope}`),
        );
      if (parsed.value.confirm !== phrase)
        return respond(
          res,
          400,
          errorPayload('confirm-phrase', `Type exactly "${phrase}" to confirm`),
        );
      const resolved = await resolveLocalData(env, undefined, scanStore);
      if (!resolved.enabled)
        return respond(
          res,
          409,
          errorPayload('disabled', 'Local storage is disabled'),
        );
      const result = await deleteStoreScope(resolved.path, scope);
      if (!result.ok)
        return respond(res, 409, errorPayload(result.code, result.error));
      bustSummary(resolved.path);
      const fresh = await resolveLocalData(env, undefined, scanStore);
      respond(res, 200, { ok: true, freedBy: result.freedBy, ...fresh });
    });
    server.middlewares.use('/api/local-data/verify', async (req, res) => {
      if (req.method !== 'POST')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const admission = admit(req, env);
      if (!admission.ok)
        return respond(res, admission.status, refusalPayload(admission));
      const parsed = await jsonBody(req);
      if (!parsed.ok)
        return respond(
          res,
          parsed.status,
          errorPayload(parsed.code, parsed.error),
        );
      const resolved = await resolveLocalData(env, undefined, scanStore);
      if (!resolved.enabled)
        return respond(
          res,
          409,
          errorPayload('disabled', 'Local storage is disabled'),
        );
      const checksumsPath = storePaths(resolved.path).checksums;
      try {
        const raw = await fsp.readFile(checksumsPath, 'utf8');
        const lines = raw
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const mismatches = [];
        let verified = 0;
        for (const line of lines) {
          const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line);
          if (!match) {
            mismatches.push({ file: line, code: 'bad-line' });
            continue;
          }
          const [, expected, rel] = match;
          const file = path.join(resolved.path, rel);
          try {
            const hash = await hashFile(file);
            if (hash !== expected)
              mismatches.push({ file: rel, code: 'mismatch' });
            else verified += 1;
          } catch {
            mismatches.push({ file: rel, code: 'missing' });
          }
        }
        respond(res, 200, {
          ok: mismatches.length === 0,
          present: true,
          total: lines.length,
          verified,
          mismatches,
        });
      } catch {
        respond(res, 200, {
          ok: true,
          present: false,
          total: 0,
          verified: 0,
          mismatches: [],
        });
      }
    });
    server.middlewares.use('/api/local-data/deploy', async (req, res) => {
      if (req.method !== 'POST')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const admission = admit(req, env);
      if (!admission.ok)
        return respond(res, admission.status, refusalPayload(admission));
      const parsed = await jsonBody(req);
      if (!parsed.ok)
        return respond(
          res,
          parsed.status,
          errorPayload(parsed.code, parsed.error),
        );
      if (parsed.value.confirm !== DEPLOY_CONFIRM)
        return respond(
          res,
          400,
          errorPayload(
            'confirm-phrase',
            `Type exactly "${DEPLOY_CONFIRM}" to confirm`,
          ),
        );
      const resolved = await resolveLocalData(env, undefined, scanStore);
      if (!resolved.enabled)
        return respond(
          res,
          409,
          errorPayload('disabled', 'Local storage is disabled'),
        );
      if (resolved.summary?.state !== 'ready')
        return respond(
          res,
          409,
          errorPayload('not-ready', 'The store is not ready'),
        );
      const result = await deployTilesToDist(resolved.path, root);
      if (!result.ok)
        return respond(res, 409, errorPayload(result.code, result.error));
      respond(res, 200, { ok: true, ...result });
    });
    // Tileset files — exactly <store>/tiles/, nothing else.
    server.middlewares.use('/local-data/buildings', async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return respond(res, 405, errorPayload('method', 'Method not allowed'));
      const resolved = await resolveLocalData(env, undefined, scanStore);
      if (!resolved.enabled) {
        res.statusCode = 404;
        res.end('local buildings disabled');
        return;
      }
      await serveTileset(resolved.path)(req, res);
    });
  };
  // Preview builds keep the same surface — ODIN deploys through the preview
  // of the production build in some setups.
  return {
    name: 'gev-local-data',
    configureServer(server) {
      registerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerMiddleware(server);
    },
  };
}

const hashFile = (file) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
