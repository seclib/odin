// PHOTON_URL: unset keeps the public default, empty disables, else a URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlaceSearch } from './defaults.js';

async function hosts(endpoints) {
  const asked = [];
  const search = createDefaultPlaceSearch({
    endpoints,
    fetchImpl: async (url) => {
      asked.push(new URL(String(url), 'http://local.test').host);
      return new Response(
        JSON.stringify({ features: [], status: 'ZERO_RESULTS', results: [] }),
        { status: 200 },
      );
    },
  });
  await search.geocode('nowhere-photon-setting');
  return asked;
}

test('place search follows the Photon setting', async () => {
  assert.ok(
    (await hosts({})).includes('photon.komoot.io'),
    'default is public Photon',
  );
  const own = await hosts({ photon: 'https://photon.example.test/api/' });
  assert.ok(own.includes('photon.example.test'));
  assert.ok(!own.includes('photon.komoot.io'));
  const off = await hosts({ photon: null });
  assert.ok(!off.some((host) => host.includes('photon')), off.join(','));
});

test('the place search stays bounded when Photon is disabled', async () => {
  const own = await hosts({ photon: null });
  for (const host of ['photon.example.test', 'photon.komoot.io']) {
    assert.ok(
      !own.includes(host),
      `Photon was reached for ${host}: ${own.join(',')}`,
    );
  }
});

test('a cancelled search throws and does not complete its provider chain', async () => {
  const controller = new AbortController();
  const asked = [];
  const search = createDefaultPlaceSearch({
    signal: controller.signal,
    endpoints: { photon: null },
    fetchImpl: async (url) => {
      const host = new URL(String(url), 'http://local.test').host;
      asked.push(host);
      if (host.includes('photon') || host.includes('google') || host.includes('nominatim')) {
        throw new Error(`unexpected network hop: ${host}`);
      }
      return new Response(
        JSON.stringify({ features: [], status: 'ZERO_RESULTS', results: [] }),
        { status: 200 },
      );
    },
  });
  controller.abort();
  await assert.rejects(
    search.geocode('nowhere-cancelled', { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.ok(
    !asked.some((h) => h.includes('photon') || h.includes('google') || h.includes('nominatim')),
    `unexpected network hop: ${asked.join(',')}`,
  );
});
