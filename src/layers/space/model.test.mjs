import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNASAImageSearch } from './model.js';
import { createSpaceImageSource, nasaImagesSearchUrl } from './source.js';

const nasaItem = (overrides = {}) => ({
  data: [
    {
      nasa_id: 'PIA00001',
      title: 'Mars archive image',
      media_type: 'image',
      date_created: '2024-02-03T00:00:00Z',
      center: 'JPL',
      photographer: 'NASA/JPL',
      description: 'An archived image.',
      ...overrides,
    },
  ],
  links: [
    {
      rel: 'alternate',
      render: 'image',
      href: 'https://images-assets.nasa.gov/image/PIA00001/PIA00001~medium.jpg',
    },
  ],
});

test('NASA image records retain archive date, credits, and source provenance', () => {
  const result = normalizeNASAImageSearch({
    collection: { items: [nasaItem()], metadata: { total_hits: 1 } },
  });
  assert.equal(result.items[0].catalogDate, '2024-02-03T00:00:00Z');
  assert.equal(result.items[0].credit, 'NASA/JPL');
  assert.equal(
    result.items[0].sourceUrl,
    'https://images.nasa.gov/details/PIA00001',
  );
  assert.equal(result.totalHits, 1);
});

test('NASA response rejects malformed collections and filters unsafe/non-image links', () => {
  assert.throws(() => normalizeNASAImageSearch({}), /Malformed/);
  const result = normalizeNASAImageSearch({
    collection: {
      items: [
        nasaItem({ media_type: 'video' }),
        {
          ...nasaItem(),
          links: [
            {
              rel: 'alternate',
              render: 'image',
              href: 'https://evil.test/image.jpg',
            },
          ],
        },
      ],
    },
  });
  assert.deepEqual(result.items, []);
});

test('NASA image search validates input and handles unavailable or invalid responses', async () => {
  assert.throws(() => nasaImagesSearchUrl('x'), /2 to 100/);
  assert.match(nasaImagesSearchUrl('Mars'), /^\/api\/space\/images\?q=Mars$/);
  const networkFailure = createSpaceImageSource({
    fetchImpl: async () => {
      throw new TypeError('offline');
    },
  });
  await assert.rejects(networkFailure.search('Mars'), /offline/);
  const unavailable = createSpaceImageSource({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  await assert.rejects(unavailable.search('Mars'), /HTTP 503/);
  const malformed = createSpaceImageSource({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ collection: {} }),
    }),
  });
  await assert.rejects(malformed.search('Mars'), /Malformed/);
});
