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