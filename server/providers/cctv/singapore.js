import {
  readResponseBytesCapped,
  readResponseJsonCapped,
} from '../common/http.js';

export const SINGAPORE_TRAFFIC_IMAGES_URL =
  'https://api.data.gov.sg/v1/transport/traffic-images';
const IMAGE_ORIGIN = 'https://images.data.gov.sg';
const CATALOG_MAX_BYTES = 512 * 1024;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const CATALOG_TTL_MS = 60_000;
const STALE_INDEX_MAX_MS = 5 * 60_000;
const IMAGE_TTL_MS = 10_000;
const IMAGE_CACHE_MAX = 16;

function cameraImageUrl(raw) {
  try {
    const url = new URL(raw);
    if (
      url.origin !== IMAGE_ORIGIN ||
      !/^\/api\/traffic-images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/i.test(
        url.pathname,
      ) ||
      url.search
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseTimestamp(value) {
  const result = Date.parse(value || '');
  return Number.isFinite(result) && result > 0 ? result : null;
}

function parseCatalog(payload) {
  const group = Array.isArray(payload?.items) ? payload.items[0] : null;
  const cameras = Array.isArray(group?.cameras) ? group.cameras : [];
  const rows = [];
  for (const row of cameras) {
    const id = String(row?.camera_id ?? '').trim();
    const lat = Number(row?.location?.latitude);
    const lon = Number(row?.location?.longitude);
    const imageUrl = cameraImageUrl(row?.image);
    const capturedAt = parseTimestamp(row?.timestamp || group?.timestamp);
    if (
      !/^\d{1,8}$/.test(id) ||
      !Number.isFinite(lat) ||
      lat < 1.1 ||
      lat > 1.5 ||
      !Number.isFinite(lon) ||
      lon < 103.5 ||
      lon > 104.1 ||
      !imageUrl ||
      !capturedAt
    ) {
      continue;
    }
    rows.push({ id, lat, lon, imageUrl, capturedAt });
  }
  return rows;
}

/** Create an independently testable, bounded Singapore LTA camera provider. */
export function createSingaporeCameraProvider({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = Date.now,
} = {}) {
  let catalog = null;
  let catalogFetchedAt = 0;
  let catalogRequest = null;
  const imageCache = new Map();

  async function getCatalog() {
    const current = now();
    if (catalog && current - catalogFetchedAt < CATALOG_TTL_MS)
      return { rows: catalog, checkedAt: catalogFetchedAt, stale: false };
    if (catalogRequest) return catalogRequest;

    catalogRequest = (async () => {
      try {
        const response = await fetchImpl(SINGAPORE_TRAFFIC_IMAGES_URL, {
          headers: { Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
        const payload = await readResponseJsonCapped(
          response,
          CATALOG_MAX_BYTES,
        );
        if (payload?.api_info?.status !== 'healthy')
          throw new Error('Catalog status is not healthy');
        const rows = parseCatalog(payload);
        if (!rows.length) throw new Error('Catalog has no valid camera rows');
        catalog = rows;
        catalogFetchedAt = now();
        return { rows, checkedAt: catalogFetchedAt, stale: false };
      } catch {
        if (catalog && now() - catalogFetchedAt <= STALE_INDEX_MAX_MS) {
          return { rows: catalog, checkedAt: catalogFetchedAt, stale: true };
        }
        return { rows: [], checkedAt: null, stale: false };
      } finally {
        catalogRequest = null;
      }
    })();
    return catalogRequest;
  }

  async function loadSources() {
    const result = await getCatalog();
    return result.rows.map((row) => ({
      id: `sg-lta-${row.id}`,
      name: `LTA traffic camera ${row.id}`,
      city: 'Singapore',
      cityId: 'singapore',
      provider: 'Land Transport Authority (LTA), Singapore',
      lat: row.lat,
      lon: row.lon,
      headingConfidence: 'low',
      pitchDeg: -18,
      fovDeg: 48,
      rangeM: 150,
      mountHeightM: 8,
      feedType: 'image',
      mediaMode: 'periodic-image',
      url: row.imageUrl,
      snapshotUrl: row.imageUrl,
      sourceKind: 'singapore-lta',
      license: 'Singapore Open Data Licence — Traffic Images (LTA)',
      credit: 'LTA Traffic Images · data.gov.sg Open Data Licence',
    }));
  }

  async function fetchSnapshot(cameraId) {
    const key = String(cameraId || '').replace(/^sg-lta-/, '');
    if (!/^\d{1,8}$/.test(key)) return null;
    const cached = imageCache.get(key);
    if (cached && now() - cached.checkedAt < IMAGE_TTL_MS) return cached;

    const { rows, checkedAt: catalogCheckedAt } = await getCatalog();
    const row = rows.find((camera) => camera.id === key);
    if (!row) return null;
    const imageUrl = cameraImageUrl(row.imageUrl);
    if (!imageUrl) return null;

    try {
      const response = await fetchImpl(imageUrl, {
        headers: { 'User-Agent': 'odin-cctv-proxy/1.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok || response.status >= 300) {
        await response.body?.cancel().catch(() => {});
        return null;
      }
      const contentType = response.headers.get('content-type') || '';
      if (
        contentType !== 'application/octet-stream' &&
        !contentType.startsWith('image/')
      ) {
        await response.body?.cancel().catch(() => {});
        return null;
      }
      const body = Buffer.from(
        await readResponseBytesCapped(response, IMAGE_MAX_BYTES),
      );
      // data.gov.sg currently serves JPEG bytes as application/octet-stream.
      // Verify the signature before exposing them as an image.
      if (
        body.length < 3 ||
        body[0] !== 0xff ||
        body[1] !== 0xd8 ||
        body[2] !== 0xff
      )
        return null;
      const result = {
        ok: true,
        body,
        contentType: 'image/jpeg',
        capturedAt: row.capturedAt,
        checkedAt: now(),
        catalogCheckedAt,
      };
      imageCache.delete(key);
      imageCache.set(key, result);
      while (imageCache.size > IMAGE_CACHE_MAX)
        imageCache.delete(imageCache.keys().next().value);
      return result;
    } catch {
      return null;
    }
  }

  return { loadSources, fetchSnapshot, getCatalog };
}

const singaporeCameras = createSingaporeCameraProvider();
export const loadSingaporeSourcesFromOpenData = singaporeCameras.loadSources;
export const fetchSingaporeCameraSnapshot = singaporeCameras.fetchSnapshot;
