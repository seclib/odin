export function mpcOrbitLookupUrl(designation) {
  const raw = String(designation || '');
  const value = raw.trim();
  if (!value || value.length > 100 || /[\u0000-\u001f\u007f]/.test(raw))
    throw new TypeError('Enter one valid MPC designation');
  const url = new URL(
    '/api/space/orbits',
    globalThis.location?.origin || 'http://localhost',
  );
  url.searchParams.set('designation', value);
  return `${url.pathname}${url.search}`;
}

function validOrbit(orbit) {
  const elements = orbit?.elements;
  return (
    typeof orbit?.designation === 'string' &&
    Number.isFinite(elements?.qAu) &&
    elements.qAu > 0 &&
    Number.isFinite(elements?.eccentricity) &&
    elements.eccentricity >= 0 &&
    Number.isFinite(elements?.inclinationDeg) &&
    Number.isFinite(elements?.ascendingNodeDeg) &&
    Number.isFinite(elements?.argumentOfPerihelionDeg) &&
    orbit?.provenance?.provider === 'Minor Planet Center'
  );
}

/** Same-origin single-object lookup for catalogued small-body orbit elements. */
export function createMpcOrbitSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async lookup(designation, { signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(mpcOrbitLookupUrl(designation), {
        signal,
        headers: { Accept: 'application/json' },
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('MPC returned invalid data');
      }
      signal?.throwIfAborted();
      if (!response.ok)
        throw new Error(
          payload?.error || `MPC lookup unavailable (HTTP ${response.status})`,
        );
      if (!validOrbit(payload?.orbit))
        throw new Error('MPC orbit data are unavailable or incomplete');
      return payload.orbit;
    },
  };
}
