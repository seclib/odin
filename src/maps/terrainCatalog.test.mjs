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
  listTerrainProvidersByKind,
  listAvailableTerrainProviders,
  listProvidersForLocation,
} from './terrainCatalog.js';

test('catalog exposes the known providers (terrain + elevation + hybrid)', () => {
  const ids = listTerrainProviders().sort();
  // Core providers always present.
  for (const core of ['ellipsoid', 'keyless', 'world']) assert.ok(ids.includes(core), core);
  // New global providers added by the multi-provider integration.
  for (const added of [
    'aws-terrain-tiles',
    'copernicus-dem',
    'arcgis-world-elevation',
    'opentopography',
    'ign-rge-alti',
    'ign-lidar-hd',
    'cesium-terrain-builder',
    'personal-terrain-server',
  ]) assert.ok(ids.includes(added), added);
  for (const id of ids) {
    const p = getTerrainProvider(id);
    assert.ok(p && p.id === id);
    assert.ok(typeof p.label === 'string');
    assert.ok(p.cache && typeof p.cache.maxTiles === 'number');
    assert.ok(p.resolution && typeof p.resolution.maxScreenSpaceError === 'number');
    assert.ok(p.limits && typeof p.limits.maxConcurrent === 'number');
    assert.ok(typeof p.kind === 'string');
    assert.ok(Array.isArray(p.products) && p.products.length > 0);
    assert.ok(p.auth && typeof p.auth.required === 'boolean');
    assert.ok(typeof p.status === 'string');
    assert.ok(typeof p.adapter === 'string');
  }
});

test('listTerrainProvidersByKind filters by kind', () => {
  const terrain = listTerrainProvidersByKind('terrain');
  assert.ok(terrain.includes('world'));
  assert.ok(terrain.includes('keyless'));
  assert.ok(terrain.includes('aws-terrain-tiles'));
  const elevation = listTerrainProvidersByKind('elevation');
  assert.ok(elevation.includes('copernicus-dem'));
  assert.ok(elevation.includes('ign-rge-alti'));
  assert.ok(elevation.includes('opentopography'));
});

test('listAvailableTerrainProviders returns only available (no key/infra)', () => {
  const avail = listAvailableTerrainProviders();
  assert.ok(avail.includes('keyless'));
  assert.ok(avail.includes('ellipsoid'));
  assert.ok(avail.includes('aws-terrain-tiles'));
  assert.ok(avail.includes('copernicus-dem'));
  assert.ok(avail.includes('ign-rge-alti'));
  assert.ok(avail.includes('ign-lidar-hd'));
  assert.ok(!avail.includes('world')); // needs ion token
  assert.ok(!avail.includes('arcgis-world-elevation')); // needs key
  assert.ok(!avail.includes('opentopography')); // needs key
  assert.ok(!avail.includes('cesium-terrain-builder')); // needs infra
});

test('listProvidersForLocation matches global providers everywhere', () => {
  const paris = listProvidersForLocation(48.8566, 2.3522);
  assert.ok(paris.includes('world'));
  assert.ok(paris.includes('keyless'));
  assert.ok(paris.includes('aws-terrain-tiles'));
  const reunion = listProvidersForLocation(-20.8823, 55.4507);
  assert.ok(reunion.includes('ign-lidar-hd'));
  assert.ok(reunion.includes('ign-rge-alti'));
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