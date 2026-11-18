// Unit tests for the local-data plugin: pure helpers + filesystem fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const MODULE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  './local-data.js',
);
const {
  validateStorePath,
  defaultStoreDir,
  storePaths,
  readLocalDataConfig,
  writeLocalDataConfig,
  summarizeStore,
  moveStoreContents,
  deleteStoreScope,
  resolveLocalData,
  localDataEndpoint,
  deployTilesToDist,
} = await import(`${MODULE}?cachebust=${Date.now()}`);

// Fixtures live under the user's cache dir: the validator correctly refuses
// /tmp-based stores (no permanent storage under tmpfs/system roots).
const fixtureRoot = () => fs.mkdtempSync(path.join(os.homedir(), '.cache', 'odin-ld-test-'));
const tmpdir = () => fixtureRoot();

const fillStore = (root, {
  buildings = 2,
  withTileset = true,
  sourceFiles = 1,
  enrichedLines = 2,
  manifest = true,
} = {}) => {
  fs.mkdirSync(path.join(root, 'tiles', 'tiles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  fs.mkdirSync(path.join(root, 'enriched'), { recursive: true });
  if (withTileset) {
    fs.writeFileSync(
      path.join(root, 'tiles', 'tileset.json'),
      JSON.stringify({
        asset: { version: '1.0', gltfUpAxis: 'Z' },
        extras: { featureCount: buildings, tileCount: 1 },
      }),
    );
    // Two tiles minimum so counts > 0
    fs.writeFileSync(path.join(root, 'tiles', 'tiles', 'a.b3dm'), Buffer.alloc(16));
    fs.writeFileSync(path.join(root, 'tiles', 'tiles', 'b.b3dm'), Buffer.alloc(32));
  }
  for (let i = 0; i < sourceFiles; i += 1)
    fs.writeFileSync(path.join(root, 'source', `src-${i}.csv.gz`), Buffer.alloc(64));
  for (let i = 0; i < enrichedLines; i += 1)
    fs.writeFileSync(
      path.join(root, 'enriched', `enr-${i}.jsonl`),
      `{"properties":{"groundSource":"ign","groundAltitude":10.5}}\n${i === 0 ? '{"properties":{"groundSource":"no-data","groundAltitude":0}}\n' : ''}`,
    );
  if (manifest)
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify({
        createdAt: '2026-11-17T00:00:00Z',
        source: { license: 'CDLA-Permissive-2.0' },
        heights: { defaultHeightM: 6.0 },
      }),
    );
};

test('validateStorePath rejects non-absolute, system dirs and outside the storage root - accepts clean dirs', () => {
  const root = tmpdir();
  const good = path.join(root, 'store');
  const outside = validateStorePath(good, { storageRoot: '/anywhere/else/storage', repoRoot: '/anywhere/else' });
  assert.equal(outside.ok, true);
  assert.equal(validateStorePath('relative/path', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'not-absolute');
  assert.equal(validateStorePath('/tmp/odin-store', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'system-directory');
  assert.equal(validateStorePath('/var/odin-store', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'system-directory');
  assert.equal(validateStorePath('/etc/odin-store', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'system-directory');
  // Inside the repository but outside the ODIN storage root: refused.
  assert.equal(validateStorePath('/repo/src', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'inside-repo');
  assert.equal(validateStorePath('/repo', { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'inside-repo');
  // Inside the ODIN storage root (repository storage/ by default): accepted.
  assert.equal(validateStorePath('/repo/storage/buildings-974', { storageRoot: '/repo/storage', repoRoot: '/repo' }).ok, true);
  const asFile = path.join(root, 'file.txt');
  fs.writeFileSync(asFile, 'x');
  assert.equal(validateStorePath(asFile, { storageRoot: '/repo/storage', repoRoot: '/repo' }).code, 'not-a-directory');
});

test('defaultStoreDir resolves the repository-local storage root by default', () => {
  const repo = path.resolve(path.dirname(MODULE), '../..');
  assert.equal(defaultStoreDir(), path.join(repo, 'storage', 'buildings-974'));
  assert.equal(defaultStoreDir({}, path.join(repo, 'storage')), path.join(repo, 'storage', 'buildings-974'));
  assert.equal(defaultStoreDir({ ODIN_STORAGE_DIR: '/srv/odin-storage' }), '/srv/odin-storage/buildings-974');
});

test('config roundtrip: default when missing, persists when written', async () => {
  const root = tmpdir();
  const env = { ODIN_LOCAL_DATA_CONFIG: path.join(root, 'odin', 'local-data.json') };
  const cfgPath = path.join(root, 'odin', 'local-data.json');
  const before = await readLocalDataConfig(env);
  assert.equal(before.enabled, false);
  assert.equal(before.path, null);
  await writeLocalDataConfig({ enabled: true, path: '/data/store' }, env);
  const after = await readLocalDataConfig(env);
  assert.equal(after.enabled, true);
  assert.equal(after.path, '/data/store');
  assert.equal(fs.statSync(cfgPath).mode & 0o777, 0o600);
});

test('summarizeStore: absent → empty → ready → partial → error', async () => {
  const root = tmpdir();
  const absent = await summarizeStore(path.join(root, 'nope'));
  assert.equal(absent.state, 'absent');
  const empty = path.join(root, 'empty');
  fs.mkdirSync(empty);
  assert.equal((await summarizeStore(empty)).state, 'empty');

  const ready = path.join(root, 'ready');
  fillStore(ready);
  const summary = await summarizeStore(ready);
  assert.equal(summary.state, 'ready');
  assert.equal(summary.counts.tiles, 2);
  assert.equal(summary.counts.buildings, 2);
  assert.equal(summary.counts.sourceFiles, 1);
  assert.equal(summary.counts.enrichedLines, 3);
  assert.equal(summary.counts.enrichedIgn, 2);
  assert.equal(summary.counts.enrichedNoData, 1);
  assert.equal(summary.counts.bytes > 0, true);
  assert.equal(summary.manifest.featureCount, 2);
  assert.equal(summary.manifest.defaultHeightM, 6.0);

  // Partial: data exists but no tileset
  const partial = path.join(root, 'partial');
  fs.mkdirSync(path.join(partial, 'source'), { recursive: true });
  fs.writeFileSync(path.join(partial, 'source', 'x.csv.gz'), 'x');
  assert.equal((await summarizeStore(partial)).state, 'partial');

  // Error: store root is a file
  const asFile = path.join(root, 'asfile');
  fs.writeFileSync(asFile, 'x');
  assert.equal((await summarizeStore(asFile)).state, 'error');
});

test('summarizeStore skips an unreadable enriched file without failing the store', async () => {
  const root = tmpdir();
  fillStore(root);
  fs.writeFileSync(
    path.join(root, 'enriched', 'broken.jsonl.gz'),
    Buffer.from('NOT_A_GZIP'),
  );
  const summary = await summarizeStore(root);
  assert.equal(summary.state, 'ready');
  assert.equal(summary.counts.enrichedLines, 3, 'healthy files still counted');
  assert.equal(summary.counts.enrichedIgn, 2);
  assert.equal(summary.counts.enrichedNoData, 1);
  assert.equal(summary.counts.enrichedUnreadable, 1);
});

test('summarizeStore exposes auditable provenance and checksum count', async () => {
  const root = tmpdir();
  fillStore(root, { manifest: false });
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      createdAt: '2026-11-18T02:00:00Z',
      tilesGeneratedAt: '2026-11-17T15:34:00Z',
      versions: { manifest: 1, converter: 'abc123' },
      source: {
        dataset: 'Microsoft Global ML Building Footprints',
        license: 'CDLA-Permissive-2.0',
        licenseUrl: 'https://cdla.dev/permissive-2-0/',
        datasetRefresh: '2026-08-13',
      },
      generator: { tool: 'gmlfp_to_tiles.py', cellDeg: 0.02, gltfUpAxis: 'Z', rtcCenter: true },
      heights: { defaultHeightM: 6, heightSource: 'default' },
      bases: { source: 'IGN RGE ALTI', validIgnCount: 100 },
      result: { scope: 'pilot-100', scopeNote: 'subset', featuresProcessed: 100, tiles: 42 },
      integrity: { checksumsFile: 'checksums.sha256' },
    }),
  );
  fs.writeFileSync(
    path.join(root, 'checksums.sha256'),
    `${'a'.repeat(64)}  tiles/tileset.json\n${'b'.repeat(64)}  enriched/a.jsonl\n`,
  );
  const summary = await summarizeStore(root);
  assert.equal(summary.state, 'ready');
  assert.equal(summary.checksumsPresent, true);
  assert.equal(summary.checksumsCount, 2);
  assert.equal(summary.manifest.schemaVersion, 1);
  assert.equal(summary.manifest.tilesGeneratedAt, '2026-11-17T15:34:00Z');
  assert.equal(summary.manifest.versions.converter, 'abc123');
  assert.equal(summary.manifest.dataset, 'Microsoft Global ML Building Footprints');
  assert.equal(summary.manifest.license, 'CDLA-Permissive-2.0');
  assert.equal(summary.manifest.cellDeg, 0.02);
  assert.equal(summary.manifest.rtcCenter, true);
  assert.equal(summary.manifest.validIgnCount, 100);
  assert.equal(summary.manifest.scope, 'pilot-100');
  assert.equal(summary.manifest.checksumsFile, 'checksums.sha256');
});

test('moveStoreContents moves known subtrees, keeps unknown files, refuses occupied targets', async () => {
  const root = tmpdir();
  const src = path.join(root, 'src');
  const dst = path.join(root, 'dst');
  fillStore(src);
  fs.writeFileSync(path.join(src, 'unknown-note.txt'), 'keep-me');
  const result = await moveStoreContents(src, dst);
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(dst, 'tiles', 'tileset.json')), true);
  assert.equal(fs.existsSync(path.join(dst, 'source', 'src-0.csv.gz')), true);
  assert.equal(fs.existsSync(path.join(dst, 'enriched', 'enr-0.jsonl')), true);
  assert.equal(fs.existsSync(path.join(src, 'unknown-note.txt')), true, 'unknown files stay');
  // Occupied destination refuses the move
  const src2 = path.join(root, 'src2');
  const dst2 = path.join(root, 'dst2');
  fillStore(src2);
  fillStore(dst2);
  const refused = await moveStoreContents(src2, dst2);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'destination-not-empty');
});

test('deleteStoreScope: tiles scope removes generated files only, enriched keeps sources', async () => {
  const root = tmpdir();
  fillStore(root);
  const result = await deleteStoreScope(root, 'tiles');
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'tiles')), false);
  assert.equal(fs.existsSync(path.join(root, 'source')), true);
  assert.equal(fs.existsSync(path.join(root, 'enriched')), true);
  assert.equal(fs.existsSync(path.join(root, 'manifest.json')), true);
  assert.equal(result.freedBy > 0, true);
  const result2 = await deleteStoreScope(root, 'enriched');
  assert.equal(result2.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'enriched')), false);
  assert.equal(fs.existsSync(path.join(root, 'source')), true);
  const result3 = await deleteStoreScope(root, 'source');
  assert.equal(result3.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'source')), false);
});

test('deployTilesToDist mirrors tiles without touching the master store', async () => {
  const root = tmpdir();
  const store = path.join(root, 'store');
  const repo = path.join(root, 'repo');
  fillStore(store);
  const before = fs.readFileSync(path.join(store, 'tiles', 'tileset.json'), 'utf8');
  const result = await deployTilesToDist(store, repo);
  assert.equal(result.ok, true);
  assert.equal(result.files, 3);
  assert.ok(result.bytes > 0);
  assert.ok(fs.existsSync(path.join(repo, 'dist', 'odin-local-buildings', 'tileset.json')));
  assert.equal(fs.readFileSync(path.join(store, 'tiles', 'tileset.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(store, 'source', 'src-0.csv.gz')), true);
  const missing = await deployTilesToDist(path.join(root, 'empty'), repo);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'tileset-missing');
});

test('configure endpoint reports the fresh state right after a move (cache bust)', async () => {
  const root = tmpdir();
  const env = { ODIN_LOCAL_DATA_CONFIG: path.join(root, 'odin', 'local-data.json') };
  const source = path.join(root, 'source-store');
  const target = path.join(root, 'target-store');
  fillStore(source);
  fs.mkdirSync(target);
  await writeLocalDataConfig({ enabled: true, path: source }, env);

  const routes = new Map();
  localDataEndpoint({ env, repoRoot: '/repo' }).configureServer({
    middlewares: { use: (url, handler) => routes.set(url, handler) },
  });
  const req = Readable.from([
    JSON.stringify({ path: target }),
  ]);
  Object.assign(req, {
    method: 'POST',
    url: '/api/local-data/configure',
    headers: {
      host: 'localhost:5199',
      origin: 'http://localhost:5199',
      'content-type': 'application/json',
    },
    socket: { remoteAddress: '127.0.0.1' },
  });
  let statusCode = 200;
  let payload = '';
  const res = {
    set statusCode(value) { statusCode = value; },
    get statusCode() { return statusCode; },
    setHeader() {},
    end(chunk) { payload += String(chunk ?? ''); },
  };
  await routes.get('/api/local-data/configure')(req, res);
  const body = JSON.parse(payload || '{}');
  assert.equal(statusCode, 200, body.error);
  assert.equal(body.ok, true);
  assert.ok(body.moved.includes('tiles'));
  assert.equal(body.summary.state, 'ready', 'must not report the pre-move empty scan');
  assert.equal(body.summary.counts.buildings, 2);
  assert.equal((await readLocalDataConfig(env)).path, target);
});

test('resolveLocalData: disabled gate skips scanning; enabled reads store', async () => {
  const root = tmpdir();
  const env = { ODIN_STORAGE_DIR: path.join(root, 'storage') };
  const cfg = path.join(root, 'odin', 'local-data.json');
  const envFull = { ...env, ODIN_LOCAL_DATA_CONFIG: cfg };
  const store = path.join(root, 'store');
  fillStore(store);
  await writeLocalDataConfig({ enabled: false, path: root }, envFull);
  const off = await resolveLocalData(envFull);
  assert.equal(off.enabled, false);
  assert.equal(off.summary.state, 'disabled');
  await writeLocalDataConfig({ enabled: true, path: store }, envFull);
  const on = await resolveLocalData(envFull);
  assert.equal(on.enabled, true);
  assert.equal(on.summary.state, 'ready');
  assert.equal(on.summary.counts.buildings, 2);
  assert.equal(on.path, store);
  assert.equal(on.defaultPath, path.join(root, 'storage', 'buildings-974'));
});
