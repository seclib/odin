import https from 'node:https';

export const MPC_ORBITS_URL = 'https://data.minorplanetcenter.net/api/get-orb';
export const MPC_ORBIT_CACHE_TTL_MS = 30 * 60_000;
const MAX_DESIGNATION_LENGTH = 100;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MIN_REQUEST_INTERVAL_MS = 2_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

function normalizeDesignation(value) {
  const raw = String(value || '');
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  const designation = raw.trim();
  if (designation.length < 1 || designation.length > MAX_DESIGNATION_LENGTH)
    return null;
  return designation;
}

/** The MPC documents a GET with a JSON request body for this endpoint. */
function requestMpcOrbit(designation, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({ desig: designation }));
    const request = https.request(
      MPC_ORBITS_URL,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          'User-Agent': 'OdinSpace/1.0 (single-object orbit lookup)',
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            request.destroy(new Error('MPC response exceeds size limit'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode || 502,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('timeout', () =>
      request.destroy(new Error('MPC request timed out')),
    );
    request.on('error', reject);
    request.end(body);
  });
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Normalize one MPC record; do not turn missing fields into guessed values. */
export function normalizeMpcOrbit(payload, requestedDesignation, retrievedAt) {
  const record = Array.isArray(payload)
    ? payload[0]?.mpc_orb?.[0]
    : payload?.mpc_orb?.[0];
  const names = record?.COM?.coefficient_names;
  const values = record?.COM?.coefficient_values;
  const uncertainties = record?.COM?.coefficient_uncertainties;
  if (!record || !Array.isArray(names) || !Array.isArray(values)) return null;
  const coefficients = Object.fromEntries(
    names.map((name, index) => [name, values[index]]),
  );
  const required = ['q', 'e', 'i', 'node', 'argperi'];
  if (
    required.some((name) => !finite(coefficients[name])) ||
    coefficients.q <= 0 ||
    coefficients.e < 0 ||
    coefficients.i < 0 ||
    coefficients.i > 180
  )
    return null;
  const uncertaintyByName = Object.fromEntries(
    names.map((name, index) => [
      name,
      finite(uncertainties?.[index]) ? uncertainties[index] : null,
    ]),
  );
  const designation = record.designation_data || {};
  const fit = record.orbit_fit_statistics || {};
  const epoch = record.epoch_data || {};
  return {
    designation:
      designation.iau_name ||
      designation.name ||
      designation.unpacked_primary_provisional_designation ||
      requestedDesignation,
    requestedDesignation,
    elements: {
      qAu: coefficients.q,
      eccentricity: coefficients.e,
      inclinationDeg: coefficients.i,
      ascendingNodeDeg: coefficients.node,
      argumentOfPerihelionDeg: coefficients.argperi,
      // MPC's returned epoch_data is explicit; do not infer a time scale for
      // COM.peri_time, so this version does not calculate dated positions.
      perihelionTime: finite(coefficients.peri_time)
        ? coefficients.peri_time
        : null,
      uncertainties: {
        qAu: uncertaintyByName.q,
        eccentricity: uncertaintyByName.e,
        inclinationDeg: uncertaintyByName.i,
        ascendingNodeDeg: uncertaintyByName.node,
        argumentOfPerihelionDeg: uncertaintyByName.argperi,
      },
    },
    epoch: {
      value: finite(epoch.epoch) ? epoch.epoch : null,
      format: typeof epoch.timeform === 'string' ? epoch.timeform : null,
      timeSystem:
        typeof epoch.timesystem === 'string' ? epoch.timesystem : null,
    },
    reference: {
      system:
        typeof record.system_data?.refsys === 'string'
          ? record.system_data.refsys
          : null,
      frame:
        typeof record.system_data?.refframe === 'string'
          ? record.system_data.refframe
          : null,
      ephemeris:
        typeof record.system_data?.eph === 'string'
          ? record.system_data.eph
          : null,
      forceModel:
        typeof record.system_data?.force_model === 'string'
          ? record.system_data.force_model
          : null,
    },
    fit: {
      observations: finite(fit.nobs_total) ? fit.nobs_total : null,
      arc: fit.arc_length_total || fit.arc_length_sel || null,
      normalizedRms: finite(fit.normalized_RMS) ? fit.normalized_RMS : null,
      orbitQuality: fit.orbit_quality || null,
      fitUpdatedAt:
        typeof record.software_data?.fitting_datetime === 'string'
          ? record.software_data.fitting_datetime
          : null,
      formatVersion:
        typeof record.software_data?.mpcorb_version === 'string'
          ? record.software_data.mpcorb_version
          : null,
    },
    provenance: {
      provider: 'Minor Planet Center',
      sourceUrl: MPC_ORBITS_URL,
      retrievedAt,
      dataKind: 'catalogued-orbital-elements',
      licenseNote: 'MPC database data are freely available to the public',
    },
  };
}

/** A single-object MPC client with deduplication, serialization and bounded cache. */
export function createMpcOrbitService({
  requestImpl = requestMpcOrbit,
  now = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  let requestTail = Promise.resolve();
  let lastRequestAt = -Infinity;
  let blockedUntil = 0;

  async function lookup(rawDesignation) {
    const designation = normalizeDesignation(rawDesignation);
    if (!designation) return { status: 400, error: 'Invalid designation' };
    const key = designation.toLocaleLowerCase('en');
    const cached = cache.get(key);
    if (cached && now() - cached.at < MPC_ORBIT_CACHE_TTL_MS)
      return { status: 200, orbit: cached.orbit, cache: 'HIT' };
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = (async () => {
      try {
        const previousRequest = requestTail;
        let releaseRequest;
        requestTail = new Promise((resolve) => {
          releaseRequest = resolve;
        });
        await previousRequest;
        let response;
        try {
          if (now() < blockedUntil)
            return { status: 503, error: 'MPC temporarily rate limited' };
          const delay = Math.max(
            lastRequestAt + MIN_REQUEST_INTERVAL_MS - now(),
            0,
          );
          if (delay) await wait(delay);
          if (now() < blockedUntil)
            return { status: 503, error: 'MPC temporarily rate limited' };
          lastRequestAt = now();
          response = await requestImpl(designation);
        } finally {
          releaseRequest();
        }
        if (response.status === 429) {
          blockedUntil = now() + RATE_LIMIT_BACKOFF_MS;
          return { status: 503, error: 'MPC temporarily rate limited' };
        }
        if (response.status < 200 || response.status >= 300)
          return {
            status: 502,
            error: `MPC unavailable (HTTP ${response.status})`,
          };
        let payload;
        try {
          payload =
            typeof response.body === 'string'
              ? JSON.parse(response.body)
              : response.body;
        } catch {
          return { status: 502, error: 'MPC returned invalid data' };
        }
        const orbit = normalizeMpcOrbit(payload, designation, now());
        if (!orbit) return { status: 404, error: 'No usable MPC orbit found' };
        cache.set(key, { at: now(), orbit });
        while (cache.size > 128) cache.delete(cache.keys().next().value);
        return { status: 200, orbit, cache: 'MISS' };
      } catch {
        return { status: 502, error: 'MPC orbit service unavailable' };
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, promise);
    return promise;
  }

  return { lookup };
}

/** Same-origin endpoint for one explicitly searched minor planet or comet. */
export function mpcOrbitsProxy(options = {}) {
  const service = createMpcOrbitService(options);
  const plugin = (server) => {
    server.middlewares.use('/api/space/orbits', async (req, res) => {
      const send = (status, body, cache = 'NONE') => {
        if (res.headersSent) return;
        res.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
          'X-Odin-Cache': cache,
        });
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'GET') {
        send(405, { error: 'Method Not Allowed' });
        return;
      }
      const url = new URL(req.url || '/', 'http://odin.local');
      const result = await service.lookup(url.searchParams.get('designation'));
      send(result.status, result, result.cache || 'NONE');
    });
  };
  return {
    name: 'mpc-orbits-proxy',
    configureServer: plugin,
    configurePreviewServer: plugin,
  };
}
