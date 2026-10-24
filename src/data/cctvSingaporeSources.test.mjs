import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cctvProxy } from '../../server/providers/cctv.js';
import {
  createSingaporeCameraProvider,
  SINGAPORE_TRAFFIC_IMAGES_URL,
} from '../../server/providers/cctv/singapore.js';

const captureTime = '2026-10-24T19:10:43+08:00';
const imageUrl =
  'https://images.data.gov.sg/api/traffic-images/2026/10/123e4567-e89b-12d3-a456-426614174000.jpg';
const validCamera = (overrides = {}) => ({
  camera_id: '2701',
  timestamp: captureTime,
  location: { latitude: 1.447, longitude: 103.771 },
  image: imageUrl,
  ...overrides,
});
const catalogResponse = (cameras = [validCamera()]) =>
  Response.json({
    api_info: { status: 'healthy' },
    items: [{ timestamp: captureTime, cameras }],
  });
const jpegResponse = () =>
  new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), {
    headers: { 'Content-Type': 'application/octet-stream' },
  });

function withIsolatedCctvEnv(t) {
  for (const name of [
    'CCTV_SOURCES_FILE',
    'CCTV_SOURCES_JSON',
    'CCTV_FORCE_AUSTIN',
    'GOOGLE_MAPS_SERVER_API_KEY',
    'GOOGLE_MAPS_API_KEY',
  ]) {
    const previous = process.env[name];
    delete process.env[name];
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

test('Singapore catalog maps verified periodic still images and rejects unsafe rows', async () => {
  const provider = createSingaporeCameraProvider({
    fetchImpl: async (url) => {
      assert.equal(url, SINGAPORE_TRAFFIC_IMAGES_URL);
      return catalogResponse([
        validCamera(),
        validCamera({ camera_id: 'bad/id' }),
        validCamera({ image: 'https://evil.example/image.jpg' }),
        validCamera({ location: { latitude: 50, longitude: 2 } }),
      ]);
    },
  });

  const sources = await provider.loadSources();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 'sg-lta-2701');
  assert.equal(
    sources[0].provider,
    'Land Transport Authority (LTA), Singapore',
  );
  assert.equal(sources[0].feedType, 'image');
  assert.equal(sources[0].mediaMode, 'periodic-image');
  assert.match(sources[0].license, /Open Data Licence/);
});

test('Singapore snapshots validate JPEG bytes, expose source capture time, and cache briefly', async () => {
  let now = Date.parse('2026-10-24T11:15:00Z');
  const calls = [];
  const provider = createSingaporeCameraProvider({
    now: () => now,
    fetchImpl: async (url) => {
      calls.push(String(url));
      return url === SINGAPORE_TRAFFIC_IMAGES_URL
        ? catalogResponse()
        : jpegResponse();
    },
  });

  const first = await provider.fetchSnapshot('sg-lta-2701');
  const second = await provider.fetchSnapshot('sg-lta-2701');
  assert.equal(first.ok, true);
  assert.equal(first.contentType, 'image/jpeg');
  assert.equal(first.capturedAt, Date.parse(captureTime));
  assert.equal(first.checkedAt, now);
  assert.equal(second, first);
  assert.equal(
    calls.filter((url) => url === SINGAPORE_TRAFFIC_IMAGES_URL).length,
    1,
  );
  assert.equal(calls.filter((url) => url === imageUrl).length, 1);

  now += 11_000;
  await provider.fetchSnapshot('sg-lta-2701');
  assert.equal(calls.filter((url) => url === imageUrl).length, 2);
  // The camera catalogue follows the documented one-minute poll interval.
  assert.equal(
    calls.filter((url) => url === SINGAPORE_TRAFFIC_IMAGES_URL).length,
    1,
  );
});

test('Singapore media failures and non-JPEG responses stay unavailable', async () => {
  const networkFailure = createSingaporeCameraProvider({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(await networkFailure.fetchSnapshot('sg-lta-2701'), null);
  assert.deepEqual(await networkFailure.loadSources(), []);

  const invalidImage = createSingaporeCameraProvider({
    fetchImpl: async (url) =>
      url === SINGAPORE_TRAFFIC_IMAGES_URL
        ? catalogResponse()
        : new Response(Buffer.from('not an image'), {
            headers: { 'Content-Type': 'application/octet-stream' },
          }),
  });
  assert.equal(await invalidImage.fetchSnapshot('sg-lta-2701'), null);
  assert.equal(await invalidImage.fetchSnapshot('../other'), null);
});

test('Singapore returns a bounded last catalog on refresh failure and keeps its original capture timestamp', async () => {
  let now = 1_800_000_000_000;
  const startedAt = now;
  let fail = false;
  const provider = createSingaporeCameraProvider({
    now: () => now,
    fetchImpl: async () => {
      if (fail) throw new Error('offline');
      return catalogResponse();
    },
  });
  const original = await provider.loadSources();
  assert.equal(original.length, 1);
  const originalCapture = Date.parse(captureTime);
  now += 61_000;
  fail = true;
  const result = await provider.getCatalog();
  assert.equal(result.stale, true);
  assert.equal(result.rows[0].capturedAt, originalCapture);
  assert.equal(result.checkedAt, startedAt);
});

test('CCTV frame proxy uses Singapore live snapshots and reports observed health', async (t) => {
  withIsolatedCctvEnv(t);
  const sourceRoot = mkdtempSync(path.join(tmpdir(), 'odin-cctv-singapore-'));
  t.after(() => rmSync(sourceRoot, { recursive: true, force: true }));
  const configDir = path.join(sourceRoot, 'config');
  mkdirSync(configDir);
  writeFileSync(
    path.join(configDir, 'cctv_sources.austin.json'),
    JSON.stringify([
      {
        id: 'sg-lta-2701',
        name: 'Singapore test camera',
        city: 'Singapore',
        provider: 'LTA',
        lat: 1.447,
        lon: 103.771,
        feedType: 'image',
        mediaMode: 'periodic-image',
        url: imageUrl,
        snapshotUrl: imageUrl,
        sourceKind: 'singapore-lta',
      },
    ]),
  );
  const checkedAt = Date.parse('2026-10-24T11:20:00Z');
  let handler;
  cctvProxy({
    sourceRoot,
    singaporeSnapshot: async (id) => {
      assert.equal(id, 'sg-lta-2701');
      return {
        ok: true,
        body: Buffer.from([0xff, 0xd8, 0xff]),
        contentType: 'image/jpeg',
        capturedAt: Date.parse(captureTime),
        checkedAt,
      };
    },
  }).configureServer({
    middlewares: {
      use(_prefix, route) {
        handler = route;
      },
    },
  });
  const request = async (url) => {
    const response = {
      writeHead(status, headers = {}) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        this.body = body;
      },
    };
    await handler({ url, method: 'GET', headers: {} }, response);
    return response;
  };

  const frame = await request('/frame/sg-lta-2701');
  assert.equal(frame.status, 200);
  assert.equal(frame.headers['Content-Type'], 'image/jpeg');
  assert.deepEqual(frame.body, Buffer.from([0xff, 0xd8, 0xff]));
  const health = JSON.parse((await request('/health')).body).cameras[0];
  assert.equal(health.availability, 'available');
  assert.equal(health.checkedAt, checkedAt);
  assert.equal(health.capturedAt, Date.parse(captureTime));
});
