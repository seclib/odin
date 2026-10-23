import { readResponseTextCapped } from '../common/http.js';

export const NASA_IMAGES_CACHE_TTL_MS = 10 * 60_000;
const MAX_QUERY_LENGTH = 100;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function nasaSearchUrl(query) {
  const url = new URL('https://images-api.nasa.gov/search');
  url.searchParams.set('q', query);
  url.searchParams.set('media_type', 'image');
  url.searchParams.set('page_size', '12');
  return url;
}

/** Same-origin bounded proxy for NASA's public, keyless Images API. */
export function nasaImagesProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

  const plugin = (server) => {
    server.middlewares.use('/api/space/images', async (req, res) => {
      const send = (status, body, cacheState = 'NONE') => {
        if (res.headersSent) return;
        res.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': status === 200 ? 'public, max-age=600' : 'no-store',
          'X-Odin-Cache': cacheState,
        });
        res.end(body);
      };
      if (req.method !== 'GET') {
        send(405, JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
      const url = new URL(req.url || '/', 'http://odin.local');
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
        send(
          400,
          JSON.stringify({ error: 'Search must contain 2 to 100 characters' }),
        );
        return;
      }
      const prior = cache.get(query.toLowerCase());
      if (prior && now() - prior.at < NASA_IMAGES_CACHE_TTL_MS) {
        send(200, prior.body, 'HIT');
        return;
      }
      try {
        const response = await fetchImpl(nasaSearchUrl(query), {
          signal: AbortSignal.timeout(12_000),
          headers: { Accept: 'application/json' },
        });
        const body = await readResponseTextCapped(response, MAX_RESPONSE_BYTES);
        if (!response.ok) {
          send(
            502,
            JSON.stringify({
              error: `NASA Images unavailable (HTTP ${response.status})`,
            }),
          );
          return;
        }
        const payload = JSON.parse(body);
        if (!Array.isArray(payload?.collection?.items))
          throw new Error('malformed response');
        const key = query.toLowerCase();
        cache.delete(key);
        cache.set(key, { at: now(), body });
        while (cache.size > 64) cache.delete(cache.keys().next().value);
        send(200, body, 'MISS');
      } catch {
        send(502, JSON.stringify({ error: 'NASA Images unavailable' }));
      }
    });
  };

  return {
    name: 'nasa-images-proxy',
    configureServer: plugin,
    configurePreviewServer: plugin,
  };
}
