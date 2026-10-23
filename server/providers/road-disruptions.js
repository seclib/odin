import { readResponseJsonCapped } from './common/http.js';
import { admitSameSite } from './common/same-site.js';
import { normalizeQuebecRoadworks } from '../../src/layers/traffic/disruptions.js';

const ENDPOINT =
  'https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:chantiers_mtmdet&outfile=TravauxRoutiers&srsname=EPSG:4326&outputformat=geojson&count=2500';
const CACHE_TTL_MS = 2 * 60 * 1000;
const STALE_MAX_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** Official MTMD Quebec roadworks/closures feed. Cache and parse one bounded WFS response. */
export function roadDisruptionsProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  let cached = null;
  let inflight = null;

  async function load() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(ENDPOINT, {
        headers: {
          Accept: 'application/geo+json',
          'User-Agent': 'Odin/1.0 (+https://github.com/seclib/odin)',
        },
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`MTMD HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        MAX_BODY_BYTES,
        controller.signal,
      );
      const features = normalizeQuebecRoadworks(payload, { now: now() });
      if (!features) throw new Error('Malformed MTMD GeoJSON');
      const fetchedAt = now();
      const sourceUpdatedAt =
        features.reduce((latest, row) => Math.max(latest, row.updatedAt), 0) ||
        null;
      cached = { features, fetchedAt, sourceUpdatedAt };
      return { ...cached, stale: false };
    } finally {
      clearTimeout(timer);
    }
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/road-disruptions', async (req, res) => {
      if (admitSameSite(req, res)) return;
      const send = (status, body) => {
        if (res.headersSent) return;
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'GET')
        return send(405, { error: 'method_not_allowed' });
      const clock = now();
      if (cached && clock - cached.fetchedAt <= CACHE_TTL_MS)
        return send(200, { ...cached, stale: false });
      try {
        inflight ||= load().finally(() => {
          inflight = null;
        });
        return send(200, await inflight);
      } catch {
        if (cached && clock - cached.fetchedAt <= STALE_MAX_MS)
          return send(200, { ...cached, stale: true });
        return send(502, { error: 'road_disruptions_unavailable' });
      }
    });
  };

  return {
    name: 'road-disruptions-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
