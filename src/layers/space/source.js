import { normalizeNASAImageSearch } from './model.js';

export function nasaImagesSearchUrl(query) {
  const value = String(query ?? '').trim();
  if (value.length < 2 || value.length > 100)
    throw new TypeError('Search must contain 2 to 100 characters');
  const url = new URL(
    '/api/space/images',
    globalThis.location?.origin || 'http://localhost',
  );
  url.searchParams.set('q', value);
  return `${url.pathname}${url.search}`;
}

/** Same-origin client for the public NASA image archive. */
export function createSpaceImageSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async search(query, { signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(nasaImagesSearchUrl(query), { signal });
      if (!response.ok)
        throw new Error(`NASA Images unavailable (HTTP ${response.status})`);
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('Malformed NASA Images response');
      }
      signal?.throwIfAborted();
      return normalizeNASAImageSearch(payload);
    },
  };
}
