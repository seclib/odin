import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN_PROVIDERS,
  TERRAIN_PROFILES,
  TERRAIN_PROVIDER_IDS,
  getTerrainProfile,
  getTerrainProvider,
  resolvePrimaryProvider,
  listTerrainProfiles,
  listTerrainProviders,
} from './terrainCatalog.js';

test('catalog exposes the three known providers', () => {
  assert.deepEqual(listTerrainProviders().sort(), ['ellipsoid', 'keyless', 'world'].sort());
  for (const id of listTerrainProviders()) {
    const p = getTerrainProvider(id);
    assert.ok(p && p.id === id);
    assert.ok(typeof p.label === 'string');
    assert.ok(p.cache && typeof p.cache.maxTiles === 'number');
    assert.ok(p.resolution && typeof p.resolution.maxScreenSpaceError === 'number');
    assert.ok(p.limits && typeof p.limits.maxConcurrent === 'number');
  }
});

test('profiles include global, high-res, local, hybrid', () => {
  const ids = listTerrainProfiles().sort();
  assert.deepEqual(ids, ['global', 'high-res', 'hybrid', 'local'].sort());
});

test('each profile resolves a primary provider that exists', () => {
  for (const id of listTerrainProfiles()) {
    const profile = getTerrainProfile(id);
    assert.ok(profile, id);
    const primary = resolvePrimaryProvider(id);
    assert.ok(primary, `primary for ${id}`);
    assert.equal(primary.id, profile.primary);
    assert.ok(Array.isArray(profile.fallbacks));
    for (const fb of profile.fallbacks) assert.ok(getTerrainProvider(fb), `fallback ${fb}`);
  }
});

test('getTerrainProfile is case-insensitive and returns null for unknown', () => {
  assert.equal(getTerrainProfile('GLOBAL')?.id, 'global');
  assert.equal(getTerrainProfile('High-Res')?.id, 'high-res');
  assert.equal(getTerrainProfile('nope'), null);
  assert.equal(getTerrainProfile(null), null);
});

test('getTerrainProvider returns null for unknown', () => {
  assert.equal(getTerrainProvider('nope'), null);
});

test('catalogs are frozen', () => {
  assert.ok(Object.isFrozen(TERRAIN_PROVIDERS));
  assert.ok(Object.isFrozen(TERRAIN_PROFILES));
});

test('each provider documents verified license, attribution and coverage', () => {
  for (const id of listTerrainProviders()) {
    const p = getTerrainProvider(id);
    for (const field of ['license', 'attribution', 'coverage', 'heightSource']) {
      assert.equal(typeof p[field], 'string', `${id}.${field}`);
      assert.ok(p[field].trim().length > 0, `${id}.${field} is empty`);
    }
  }
});

test('keyless terrain attribution carries its CC BY 4.0 obligation', () => {
  const keyless = getTerrainProvider('keyless');
  assert.match(keyless.license, /CC BY 4\.0/);
  assert.match(keyless.attribution, /Re:Earth/);
  assert.match(keyless.attribution, /Mapterhorn/);
  assert.equal(keyless.requiresToken, false);
});

test('world terrain records its ion licence and token requirement', () => {
  const world = getTerrainProvider('world');
  assert.match(world.license, /Cesium ion/i);
  assert.equal(world.requiresToken, true);
  assert.equal(world.supportsExaggeration, true);
});

test('ellipsoid fallback declares no external data and no exaggeration', () => {
  const ellipsoid = getTerrainProvider('ellipsoid');
  assert.equal(ellipsoid.supports3D, false);
  assert.equal(ellipsoid.supportsExaggeration, false);
  assert.match(ellipsoid.coverage, /référence|reference|ellipsoïde|ellipsoid/i);
});