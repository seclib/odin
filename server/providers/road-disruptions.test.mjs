import test from 'node:test';
import assert from 'node:assert/strict';
import { roadDisruptionsProxy } from './road-disruptions.js';

const record = {
  type: 'Feature',
  id: 1,
  properties: {
    identifiant: '1',
    debut: '2026/10/01 08:00:00',
    fin: '2026/12/31 23:59:00',
    miseAJour: '2026/10/22 10:00:00',
    identificationDesTravaux: 'Lane closure',
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [-73.56, 45.51],
      [-73.55, 45.52],
    ],
  },
};

function register(proxy) {
  let handler;
  proxy.configureServer({
    middlewares: {
      use(path, fn) {
        assert.equal(path, '/api/road-disruptions');
        handler = fn;
      },
    },
  });
  return async function request() {
    const output = { status: null, body: '', headers: {} };
    const res = {
      headersSent: false,
      writeHead(status, headers) {
        output.status = status;
        output.headers = headers;
        this.headersSent = true;
      },
      setHeader(name, value) {
        output.headers[name] = value;
      },
      end(body = '') {
        output.body = String(body);
      },
    };
    await handler(
      { method: 'GET', url: '/', headers: { host: 'localhost' }, socket: {} },
      res,
    );
    output.json = JSON.parse(output.body || '{}');
    return output;
  };
}

test('official roadworks route caches bounded source results and publishes timestamps', async () => {
  let calls = 0;
  const request = register(
    roadDisruptionsProxy({
      now: () => Date.parse('2026-10-23T12:00:00Z'),
      fetchImpl: async (url, init) => {
        calls += 1;
        assert.match(
          url,
          /typename=ms%3Achantiers_mtmdet|typename=ms:chantiers_mtmdet/,
        );
        assert.equal(init.headers.Accept, 'application/geo+json');
        return new Response(
          JSON.stringify({ type: 'FeatureCollection', features: [record] }),
          {
            headers: { 'content-type': 'application/geo+json' },
          },
        );
      },
    }),
  );
  const first = await request();
  const second = await request();
  assert.equal(first.status, 200);
  assert.equal(first.json.features.length, 1);
  assert.equal(first.json.stale, false);
  assert.equal(first.json.sourceUpdatedAt, Date.parse('2026-10-22T14:00:00Z'));
  assert.equal(second.json.features.length, 1);
  assert.equal(calls, 1, 'fresh cache prevents another upstream request');
});

test('upstream HTTP failure has a safe unavailable response and no false source data', async () => {
  const request = register(
    roadDisruptionsProxy({
      fetchImpl: async () => new Response('denied', { status: 403 }),
    }),
  );
  const response = await request();
  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'road_disruptions_unavailable' });
});
