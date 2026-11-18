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
