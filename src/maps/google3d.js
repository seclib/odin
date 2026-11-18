import { RequestScheduler } from 'cesium';

const clean = (value) => String(value || '').trim();

/**
 * Server key Cesium derives for the Google 3D Tiles CDN (`<host>:<port>`).
 */
const GOOGLE_TILES_SERVER_KEY = 'tile.googleapis.com:443';

/**
 * The Google Photorealistic 3D Tiles are streamed from ONE host, over
 * HTTP/2 (the CDN advertises h3 as well), so every tile of a refinement
 * competes for the same per-server request budget.
 *
 * Cesium throttles a server to 18 concurrent requests: past that, tile
 * requests are QUEUED instead of issued (`serverHasOpenSlots`), so a zoom's
 * detail arrives in waves of 18 rather than as the tiles land — that queue
 * is the part of the zoom-to-detail path the application actually owns.
 *
 * Cesium documents `requestsByServer` for exactly this case — "a known
 * HTTP/2 or HTTP/3 server" — where the browser multiplexes the streams
 * itself, far more efficiently than Cesium's scheduler queues them. The
 * global `RequestScheduler.maximumRequests` (50) stays the ceiling, so this
 * raises the per-server cap for this one CDN and touches nothing else.
 */
RequestScheduler.requestsByServer[GOOGLE_TILES_SERVER_KEY] = Infinity;

/**
 * How long the camera must be still before the tiles Cesium deferred around
 * the screen edges are requested.
 *
 * Cesium defers them for 200 ms by default (`foveatedTimeDelay`), to save
 * bandwidth while the user keeps panning. After a ZOOM that delay is dead
 * time on the path the user actually waits on: the deferred tiles ARE the
 * refined detail of the new position, so the request for them only starts
 * 200 ms after the camera stopped, and the detail arrives a network round
 * trip later than it could.
 *
 * Cesium documents 0 as "immediately request all tiles in any given view".
 * The tiles requested and their fidelity are unchanged — only WHEN they are
 * asked for moves. The foveated prioritisation itself stays on
 * (`foveatedScreenSpaceError` defaults to true), so the tiles under the
 * screen centre still win the queue during the movement.
 */
const FOVEATED_TIME_DELAY = 0;

/**
 * Tileset options shared by every route that loads the Google Photorealistic
 * asset. The cache figures match the installed SDK's Google helper so the
 * direct-key, short-lived-token and ion routes all behave identically.
 */
const GOOGLE_3D_TILESET_OPTIONS = Object.freeze({
  cacheBytes: 1536 * 1024 * 1024,
  maximumCacheOverflowBytes: 1024 * 1024 * 1024,
  enableCollision: true,
  // Tiles keep drawing their own texture while draped weather loads.
  asynchronouslyLoadImagery: true,
  foveatedTimeDelay: FOVEATED_TIME_DELAY,
});

/**
 * Decide which map provider can deliver the best startup experience.
 * @param {{googleApiKey?: string, cesiumToken?: string}} credentials
 * @returns {'google-direct'|'google-ion'|'osm'}
 */
export function selectMapStartupRoute({
  googleApiKey = '',
  cesiumToken = '',
} = {}) {
  if (clean(googleApiKey)) return 'google-direct';
  if (clean(cesiumToken)) return 'google-ion';
  return 'osm';
}

/**
 * Load Google Photorealistic 3D Tiles through direct Google access when
 * configured, otherwise through Cesium ion's hosted Google asset. Direct
 * access uses a browser key, or else short-lived tokens from the app's
 * server (see googleTokens.js). If direct access fails and an ion token is
 * available, ion is the recovery path.
 *
 * @param {object} Cesium
 * @param {{googleApiKey?: string, cesiumToken?: string, googleTokens?: {token: Function}|null}} credentials
 * @returns {Promise<{tileset: object|null, route: 'google-direct'|'google-token'|'google-ion'|'osm', errors: Error[]}>}
 */
export async function loadPhotorealisticTileset(
  Cesium,
  { googleApiKey = '', cesiumToken = '', googleTokens = null } = {},
) {
  const googleKey = clean(googleApiKey);
  const ionToken = clean(cesiumToken);
  const errors = [];

  const attempts = [];
  if (googleKey)
    attempts.push({
      route: 'google-direct',
      create: () => createGoogleDirectTileset(Cesium, googleKey),
    });
  else if (googleTokens)
    attempts.push({
      route: 'google-token',
      create: () => createGoogleTokenTileset(Cesium, googleTokens),
    });
  if (ionToken)
    attempts.push({
      route: 'google-ion',
      create: () => createGoogleIonTileset(Cesium, ionToken),
    });

  for (const attempt of attempts) {
    try {
      const tileset = await attempt.create();
      return { tileset, route: attempt.route, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return { tileset: null, route: 'osm', errors };
}

/** Pass credentials to the source instead of changing SDK-wide defaults. */
export function createGoogleDirectTileset(Cesium, key) {
  key = clean(key);
  if (!key) throw new Error('Google 3D requires an explicit browser key');
  // Tiles keep drawing their own texture while draped weather loads.
  return Cesium.createGooglePhotorealistic3DTileset(
    { key, onlyUsingWithGoogleGeocoder: true },
    { ...GOOGLE_3D_TILESET_OPTIONS },
  );
}

/**
 * Google 3D with short-lived tokens instead of a key. Every tile request
 * carries the token as a header; a tile refused for an expired token gets
 * the renewed one and is tried once more.
 */
export async function createGoogleTokenTileset(Cesium, tokens) {
  const token = await tokens.token();
  if (!token) throw new Error('Google 3D tokens are not offered');
  const credit = Cesium.GoogleMaps.getDefaultCredit?.();
  const resource = new Cesium.Resource({
    url: `${Cesium.GoogleMaps.mapTilesApiEndpoint}v1/3dtiles/root.json`,
    headers: { Authorization: `Bearer ${token}` },
    credits: credit ? [credit] : undefined,
    retryAttempts: 1,
    async retryCallback(failed, error) {
      if (![401, 403].includes(error?.statusCode)) return false;
      const used = failed.headers.Authorization?.replace(/^Bearer /, '');
      const renewed = await tokens.token({ replacing: used });
      if (!renewed || renewed === used) return false;
      failed.headers.Authorization = `Bearer ${renewed}`;
      return true;
    },
  });
  // The settings Cesium's Google helper applies to the key route.
  return Cesium.Cesium3DTileset.fromUrl(resource, {
    ...GOOGLE_3D_TILESET_OPTIONS,
  });
}

export async function createGoogleIonTileset(
  Cesium,
  accessToken,
  { signal } = {},
) {
  accessToken = clean(accessToken);
  if (!accessToken)
    throw new Error('Google 3D through ion requires an explicit token');
  signal?.throwIfAborted();
  const resource = await Cesium.IonResource.fromAssetId(2275207, {
    accessToken,
  });
  signal?.throwIfAborted();
  // Match the installed SDK's Google helper rendering/cache defaults.
  return Cesium.Cesium3DTileset.fromUrl(resource, {
    ...GOOGLE_3D_TILESET_OPTIONS,
  });
}
