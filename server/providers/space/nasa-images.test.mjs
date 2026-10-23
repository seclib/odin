import test from 'node:test';
import assert from 'node:assert/strict';
import { nasaImagesProxy } from './nasa-images.js';

function harness(fetchImpl, now = () => 1_000) {
  let handler;
  const plugin = nasaImagesProxy({ fetchImpl, now });
  plugin.configureServer({
    middlewares: {
      use(path, value) {
        assert.equal(path, '/api/space/images');
        handler = value;
      },
    },
  });
  return async (url = '/?q=Mars', method = 'GET') => {
    const response = {
      headersSent: false,
      headers: {},
      status: null,
      body: null,
    };
    response.writeHead = (status, headers) => {
      response.status = status;
      response.headers = headers;
      response.headersSent = true;
    };
    response.end = (body) => {
      response.body = body;
    };
    await handler({ method, url }, response);
    return response;
  };
}

test('NASA image proxy bounds queries, returns upstream archive records, and caches requests', async () => {
  let calls = 0;
  const payload = { collection: { items: [], metadata: { total_hits: 0 } } };
  const request = harness(async (url) => {
    calls += 1;
    assert.equal(url.hostname, 'images-api.nasa.gov');
    assert.equal(url.searchParams.get('q'), 'Mars');
    assert.equal(url.searchParams.get('media_type'), 'image');
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  const first = await request();
  const second = await request();
  assert.equal(first.status, 200);
  assert.equal(first.headers['X-Odin-Cache'], 'MISS');
  assert.equal(second.headers['X-Odin-Cache'], 'HIT');
  assert.equal(calls, 1);
  const invalid = await request('/?q=x');
  assert.equal(invalid.status, 400);
  const wrongMethod = await request('/?q=Mars', 'POST');
  assert.equal(wrongMethod.status, 405);
});

test('NASA image proxy reports upstream, network, and malformed-data failures as unavailable', async () => {
  const upstreamError = await harness(
    async () => new Response('no', { status: 503 }),
  )();
  assert.equal(upstreamError.status, 502);
  const networkError = await harness(async () => {
    throw new Error('offline');
  })();
  assert.equal(networkError.status, 502);
  const invalidJson = await harness(async () => new Response('{'))();
  assert.equal(invalidJson.status, 502);
  const malformed = await harness(
    async () => new Response(JSON.stringify({ collection: {} })),
  )();
  assert.equal(malformed.status, 502);
});
