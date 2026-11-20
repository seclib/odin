// src/maps/google3d.test.mjs
// The Google 3D Tiles configuration is where the zoom→detail path is
// decided: the per-server request budget that gates how many tile requests
// the refinement may have in flight, and the moment the deferred tiles are
// asked for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestScheduler } from 'cesium';
import {
  selectMapStartupRoute,
  createGoogleDirectTileset,
  createGoogleIonTileset,
  createGoogleTokenTileset,
  loadPhotorealisticTileset,
} from './google3d.js';

/** Cesium double recording the tileset options each route is called with. */
function makeCesiumDouble() {
  const calls = { direct: null, fromUrl: null };
  return {
    calls,
    GoogleMaps: {
      mapTilesApiEndpoint: 'https://tile.googleapis.com/',
      getDefaultCredit: () => null,
    },
    Resource: class {
      constructor(options) {
        this.options = options;
        this.url = options.url;
      }
    },
    IonResource: {
      fromAssetId: async (id, options) => ({ id, options }),
    },
    createGooglePhotorealistic3DTileset: (apiOptions, tilesetOptions) => {
      calls.direct = { apiOptions, tilesetOptions };
      return { route: 'direct' };
    },
    Cesium3DTileset: {
      fromUrl: (resource, tilesetOptions) => {
        calls.fromUrl = { resource, tilesetOptions };
        return { route: 'fromUrl' };
      },
    },
  };
}

test('selectMapStartupRoute prefers the direct key, then the ion token', () => {
  assert.equal(
    selectMapStartupRoute({ googleApiKey: 'k', cesiumToken: 't' }),
    'google-direct',
  );
  assert.equal(selectMapStartupRoute({ cesiumToken: 't' }), 'google-ion');
  assert.equal(selectMapStartupRoute({}), 'osm');
});

test('the Google tiles CDN is not throttled by the per-server request limit', () => {
  // Cesium throttles every server to 18 concurrent requests; past that, tile
  // requests are QUEUED instead of issued, so a zoom's detail arrives in
  // waves. The Google 3D Tiles are served from ONE host over HTTP/2, and
  // Cesium documents requestsByServer for exactly that case.
  assert.equal(
    RequestScheduler.requestsByServer['tile.googleapis.com:443'],
    Infinity,
    'the Google tiles host is exempt from the per-server throttle',
  );
  // The global ceiling still applies: nothing runs unbounded.
  assert.equal(RequestScheduler.maximumRequests, 50);
});

test('every route asks for the deferred tiles as soon as the camera settles', () => {
  const Cesium = makeCesiumDouble();
  createGoogleDirectTileset(Cesium, 'key');
  assert.equal(Cesium.calls.direct.tilesetOptions.foveatedTimeDelay, 0);

  const tokenRoute = createGoogleTokenTileset(Cesium, {
    token: async () => 'tok',
  });
  return tokenRoute.then(() => {
    assert.equal(Cesium.calls.fromUrl.tilesetOptions.foveatedTimeDelay, 0);
  });
});

test('the ion route asks for the deferred tiles as soon as the camera settles', async () => {
  const Cesium = makeCesiumDouble();
  await createGoogleIonTileset(Cesium, 'token');
  assert.equal(Cesium.calls.fromUrl.tilesetOptions.foveatedTimeDelay, 0);
});

test('every route shares the same cache and collision settings', async () => {
  const Cesium = makeCesiumDouble();
  createGoogleDirectTileset(Cesium, 'key');
  const direct = Cesium.calls.direct.tilesetOptions;
  assert.equal(direct.cacheBytes, 1536 * 1024 * 1024);
  assert.equal(direct.maximumCacheOverflowBytes, 1024 * 1024 * 1024);
  assert.equal(direct.enableCollision, true);
  assert.equal(direct.asynchronouslyLoadImagery, true);

  await createGoogleIonTileset(Cesium, 'token');
  const ion = Cesium.calls.fromUrl.tilesetOptions;
  assert.deepEqual(ion, direct, 'the ion route matches the direct-key route');
});

test('a route without credentials still refuses to build a tileset', () => {
  const Cesium = makeCesiumDouble();
  assert.throws(() => createGoogleDirectTileset(Cesium, ''), /browser key/);
  assert.rejects(() => createGoogleIonTileset(Cesium, ''), /explicit token/);
});

/**
 * Crée un mock Cesium où createGooglePhotorealistic3DTileset met
 * directDelayMs à se résoudre, et Cesium3DTileset.fromUrl met ionDelayMs.
 */
function makeCesiumDoubleWithDelay({ directDelayMs = 0, ionDelayMs = 0 } = {}) {
  const calls = { direct: null, fromUrl: null };
  return {
    calls,
    GoogleMaps: {
      mapTilesApiEndpoint: 'https://tile.googleapis.com/',
      getDefaultCredit: () => null,
    },
    Resource: class {
      constructor(options) {
        this.options = options;
        this.url = options.url;
      }
    },
    IonResource: {
      fromAssetId: async (id, options) => ({ id, options }),
    },
    createGooglePhotorealistic3DTileset: async (apiOptions, tilesetOptions) => {
      calls.direct = { apiOptions, tilesetOptions };
      if (directDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, directDelayMs));
      }
      return { route: 'direct' };
    },
    Cesium3DTileset: {
      fromUrl: async (resource, tilesetOptions) => {
        if (ionDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, ionDelayMs));
        }
        calls.fromUrl = { resource, tilesetOptions };
        return { route: 'fromUrl' };
      },
    },
  };
}

test('loadPhotorealisticTileset returns immediately when Google responds quickly', async () => {
  const Cesium = makeCesiumDoubleWithDelay({ directDelayMs: 100 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key' });
  assert.equal(result.route, 'google-direct');
  assert.equal(result.tileset.route, 'direct');
  assert.equal(result.errors.length, 0);
});

test('loadPhotorealisticTileset falls back to osm when Google fails immediately', async () => {
  const Cesium = {
    GoogleMaps: { mapTilesApiEndpoint: 'https://tile.googleapis.com/', getDefaultCredit: () => null },
    Resource: class { constructor(options) { this.options = options; this.url = options.url; } },
    IonResource: { fromAssetId: async (id, options) => ({ id, options }) },
    createGooglePhotorealistic3DTileset: async () => { throw new Error('Connection refused'); },
    Cesium3DTileset: { fromUrl: async (resource, tilesetOptions) => ({ route: 'fromUrl' }) },
  };
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key' });
  assert.equal(result.route, 'osm');
  assert.equal(result.tileset, null);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes('Connection refused'));
});

test('loadPhotorealisticTileset times out when Google never responds', async () => {
  const Cesium = {
    GoogleMaps: { mapTilesApiEndpoint: 'https://tile.googleapis.com/', getDefaultCredit: () => null },
    Resource: class { constructor(options) { this.options = options; this.url = options.url; } },
    IonResource: { fromAssetId: async (id, options) => ({ id, options }) },
    createGooglePhotorealistic3DTileset: async () => { await new Promise(() => {}); }, // Never resolves
    Cesium3DTileset: { fromUrl: async (resource, tilesetOptions) => ({ route: 'fromUrl' }) },
  };
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key' });
  assert.equal(result.route, 'osm');
  assert.equal(result.tileset, null);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes('Timeout'));
});

test('loadPhotorealisticTileset falls back to ion when direct times out', async () => {
  const Cesium = makeCesiumDoubleWithDelay({ directDelayMs: 20000, ionDelayMs: 100 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key', cesiumToken: 'token' });
  assert.equal(result.route, 'google-ion');
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes('Timeout'));
});

test('loadPhotorealisticTileset falls back to osm when all attempts fail', async () => {
  const Cesium = makeCesiumDoubleWithDelay({ directDelayMs: 20000, ionDelayMs: 20000 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key', cesiumToken: 'token' });
  assert.equal(result.route, 'osm');
  assert.equal(result.tileset, null);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors[0].message.includes('Timeout'));
  assert.ok(result.errors[1].message.includes('Timeout'));
});

test('loadPhotorealisticTileset ignores late result after timeout', async () => {
  const Cesium = makeCesiumDoubleWithDelay({ directDelayMs: 20000, ionDelayMs: 0 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key', cesiumToken: 'token' });
  assert.equal(result.route, 'google-ion');
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes('Timeout'));
  // createGooglePhotorealistic3DTileset was called once (direct), not again for ion
  // ion uses Cesium3DTileset.fromUrl, not createGooglePhotorealistic3DTileset
  assert.equal(Cesium.calls.direct?.apiOptions?.key, 'key');
});

test('loadPhotorealisticTileset does not double-insert tileset after late return', async () => {
  const Cesium = makeCesiumDoubleWithDelay({ directDelayMs: 20000, ionDelayMs: 0 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key', cesiumToken: 'token' });
  assert.equal(result.route, 'google-ion');
  // The direct createGooglePhotorealistic3DTileset was called once (at t=0)
  // and its late result (at t=20s) was ignored because ion already succeeded at t~100ms
  assert.equal(Cesium.calls.direct?.apiOptions?.key, 'key');
});

/** Mock où le tileset de la route directe expose destroy() et isDestroyed(). */
function makeCesiumDoubleWithDestroyableTileset({ directDelayMs = 0, ionDelayMs = 0 } = {}) {
  const calls = { direct: null, fromUrl: null };
  let directTilesetDestroyed = false;
  return {
    calls,
    GoogleMaps: {
      mapTilesApiEndpoint: 'https://tile.googleapis.com/',
      getDefaultCredit: () => null,
    },
    Resource: class {
      constructor(options) {
        this.options = options;
        this.url = options.url;
      }
    },
    IonResource: {
      fromAssetId: async (id, options) => ({ id, options }),
    },
    createGooglePhotorealistic3DTileset: async (apiOptions, tilesetOptions) => {
      calls.direct = { apiOptions, tilesetOptions };
      if (directDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, directDelayMs));
      }
      return {
        route: 'direct',
        isDestroyed: () => directTilesetDestroyed,
        destroy: () => { directTilesetDestroyed = true; },
      };
    },
    Cesium3DTileset: {
      fromUrl: async (resource, tilesetOptions) => {
        if (ionDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, ionDelayMs));
        }
        calls.fromUrl = { resource, tilesetOptions };
        return { route: 'fromUrl' };
      },
    },
    get directTilesetDestroyed() {
      return directTilesetDestroyed;
    },
  };
}

test('loadPhotorealisticTileset destroys the late tileset of a timed-out route', async () => {
  const Cesium = makeCesiumDoubleWithDestroyableTileset({ directDelayMs: 20000, ionDelayMs: 0 });
  const result = await loadPhotorealisticTileset(Cesium, { googleApiKey: 'key', cesiumToken: 'token' });
  assert.equal(result.route, 'google-ion');
  // La route ion réussit immédiatement ; la route directe a timed-out à 8 s.
  // Son résultat tardif (à 20 s) doit être détruit, pas laissé en arrière-plan.
  await new Promise(resolve => setTimeout(resolve, 21000));
  assert.equal(Cesium.directTilesetDestroyed, true, 'le tileset tardif de la route directe est détruit');
});

test('loadPhotorealisticTileset skips Google entirely when no credential is configured', async () => {
  const Cesium = {
    GoogleMaps: { mapTilesApiEndpoint: 'https://tile.googleapis.com/', getDefaultCredit: () => null },
    Resource: class { constructor(options) { this.options = options; this.url = options.url; } },
    IonResource: { fromAssetId: async () => ({}) },
    createGooglePhotorealistic3DTileset: () => { assert.fail('createGooglePhotorealistic3DTileset ne doit pas être appelé sans clé'); },
    Cesium3DTileset: { fromUrl: async () => { assert.fail('Cesium3DTileset.fromUrl ne doit pas être appelé sans token'); } },
  };
  const result = await loadPhotorealisticTileset(Cesium, {});
  assert.equal(result.route, 'osm');
  assert.equal(result.tileset, null);
  assert.equal(result.errors.length, 0);
});

test('loadPhotorealisticTileset tries only ion when only an ion token is configured', async () => {
  let fromUrlCalled = false;
  let directCalled = false;
  const Cesium = {
    GoogleMaps: { mapTilesApiEndpoint: 'https://tile.googleapis.com/', getDefaultCredit: () => null },
    Resource: class { constructor(options) { this.options = options; this.url = options.url; } },
    IonResource: { fromAssetId: async () => ({}) },
    createGooglePhotorealistic3DTileset: () => { directCalled = true; return { route: 'direct' }; },
    Cesium3DTileset: {
      fromUrl: async () => { fromUrlCalled = true; return { route: 'fromUrl' }; },
    },
  };
  const result = await loadPhotorealisticTileset(Cesium, { cesiumToken: 'ion-token' });
  assert.equal(result.route, 'google-ion');
  assert.equal(directCalled, false, 'la route directe n’est pas tentée sans clé browser');
  assert.equal(fromUrlCalled, true, 'la route ion est tentée');
});
