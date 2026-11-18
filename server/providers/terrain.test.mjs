// IGN/Re:Earth routing behavior of /api/terrain/heights, tested offline with
// an injected global fetch. Each test builds a fresh proxy instance so module
// state (in-flight cache, IGN cooldown) never leaks across tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainHeightsProxy } from './terrain.js';

function captureMiddleware() {
  let handler = null;
  const stubServer = {
    middlewares: {
      use(path, fn) {
        if (path === '/api/terrain/heights') handler = fn;
      },
    },
  };
  const proxy = terrainHeightsProxy();
  proxy.configureServer(stubServer);
  assert.equal(typeof handler, 'function');
  return handler;
}

function makeRes() {
  const res = {
    headersSent: false,
    status: null,
    bodyText: null,
    writeHead(status) {
      this.status = status;
      this.headersSent = true;
    },
    end(text) {
      this.bodyText = String(text ?? '');
    },
  };
  return res;
}

function makeReq(points) {
  return { url: `/api/terrain/heights?points=${points}` };
}

/** A fetch mock that routes by URL: IGN for elevation.json, Re:Earth else. */
function makeFetch({ ignResponse, earthResponse }) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (String(url).includes('altimetrie/1.0/calcul/alti/rest/elevation.json')) {
      return ignResponse(url);
    }
    return earthResponse(url);
  };
  return { calls, impl };
}

const IGN_OK = (zValues) => () => ({
  ok: true,
  text: async () => JSON.stringify({ elevations: zValues }),
});
const EARTH_OK = (heights) => () => ({
  ok: true,
  json: async () => ({
    results: heights.map((e) => ({ ellipsoid: e, elevation: e - 10, geoid: 10 })),
  }),
});

test('FR point routes to IGN, international point routes to Re:Earth', async () => {
  const handler = captureMiddleware();
  const mock = makeFetch({
    ignResponse: IGN_OK([31.34]),
    earthResponse: EARTH_OK([1200]),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.impl;
  try {
    const req = makeReq('55.45,-20.88;-74.0,40.7');
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.bodyText);
    assert.equal(body.results.length, 2);
    // Réunion → IGN orthometric (client adds geoid)
    assert.equal(body.results[0].source, 'ign-rge-alti');
    assert.equal(body.results[0].heightOrthometric, 31.34);
    // New York → Re:Earth ellipsoidal
    assert.equal(body.results[1].ellipsoid, 1200);
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls[0].includes('altimetrie'));
    assert.ok(mock.calls[1].includes('terrain.reearth.land'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('IGN -99999 at a position falls back to Re:Earth for that point', async () => {
  const handler = captureMiddleware();
  const mock = makeFetch({
    ignResponse: IGN_OK([-99999]),
    earthResponse: EARTH_OK([333]),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.impl;
  try {
    const res = makeRes();
    await handler(makeReq('55.45,-20.88'), res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.bodyText);
    assert.equal(body.results[0].ellipsoid, 333);
    // IGN 1 m (-99999) + IGN static pyramid (-99999), then Re:Earth answers
    assert.equal(mock.calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('IGN 429 puts IGN in cooldown and Re:Earth serves FR points', async () => {
  const handler = captureMiddleware();
  let ignCalls = 0;
  const mock = makeFetch({
    ignResponse: () => {
      ignCalls += 1;
      return {
        ok: false,
        status: 429,
        headers: { get: () => '7' },
        text: async () => 'Too Many Requests',
      };
    },
    earthResponse: EARTH_OK([444]),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.impl;
  try {
    const first = makeRes();
    await handler(makeReq('55.45,-20.88'), first);
    assert.equal(first.status, 200);
    assert.equal(JSON.parse(first.bodyText).results[0].ellipsoid, 444);
    const second = makeRes();
    await handler(makeReq('2.35,48.85'), second);
    assert.equal(second.status, 200);
    // Cooldown active after the first failure: Paris never reaches IGN.
    // First request consumed IGN 1 m and static pyramid before giving up.
    assert.equal(ignCalls, 2);
    assert.equal(JSON.parse(second.bodyText).results[0].ellipsoid, 444);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('IGN down and Re:Earth down → 502', async () => {
  const handler = captureMiddleware();
  const mock = makeFetch({
    ignResponse: () => ({
      ok: false,
      status: 503,
      headers: { get: () => null },
      text: async () => 'Service Unavailable',
    }),
    earthResponse: () => ({
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({}),
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.impl;
  try {
    const res = makeRes();
    await handler(makeReq('55.45,-20.88'), res);
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
