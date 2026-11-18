import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeFetchError,
  isAddressSelectionFailure,
  fetchFirms,
  fetchIpv4,
} from './firms.js';

test('plain errors keep their message', () => {
  assert.equal(describeFetchError(new Error('boom')), 'boom');
  assert.equal(describeFetchError('oops'), 'oops');
});

test('nested causes surface their code without leaking a URL', () => {
  const err = Object.assign(new TypeError('fetch failed'), {
    cause: {
      code: 'UND_ERR_CONNECT_TIMEOUT',
      message: 'address 2001:db8::1',
      errors: [
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
      ],
    },
  });
  const described = describeFetchError(err);
  assert.match(described, /fetch failed/);
  assert.match(described, /ECONNREFUSED/);
  assert.match(described, /ETIMEDOUT/);
  assert.doesNotMatch(described, /MAP_KEY|api\/area\/csv|https?:\/\//);
});

test('a single cause is included', () => {
  const err = Object.assign(new TypeError('fetch failed'), {
    cause: { code: 'ENOTFOUND' },
  });
  assert.equal(describeFetchError(err), 'fetch failed (ENOTFOUND)');
});

test(`isAddressSelectionFailure: true pour TypeError avec erreurs de connexion`, () => {
  const err = Object.assign(new TypeError('fetch failed'), {
    cause: {
      errors: [
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      ],
    },
  });
  assert.equal(isAddressSelectionFailure(err), true);
});

test(`isAddressSelectionFailure: false sans TypeError ni erreurs de connexion`, () => {
  assert.equal(isAddressSelectionFailure(new Error('boom')), false);
  assert.equal(isAddressSelectionFailure(new TypeError('nope')), false);
  assert.equal(isAddressSelectionFailure('oops'), false);
});

test('fetchFirms: retourne le resultat de fetchImpl en cas de succes', async () => {
  const response = new Response('{}', { status: 200 });
  const fetchImpl = async () => response;
  const result = await fetchFirms('https://example.com', { signal: undefined }, { fetchImpl });
  assert.equal(result, response);
});

test(`fetchFirms: relance sur IPv4 uniquement en cas d'echec de selection d'adresse`, async () => {
  const addressErr = Object.assign(new TypeError('fetch failed'), {
    cause: { errors: [Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })] },
  });
  const ipv4Response = new Response('{}', { status: 200 });
  let fetchIpv4Called = false;
  const fetchImpl = async () => {
    throw addressErr;
  };
  const fetchIpv4Impl = async (url) => {
    fetchIpv4Called = true;
    assert.equal(url, 'https://example.com');
    return ipv4Response;
  };
  let warned = '';
  const result = await fetchFirms('https://example.com', { signal: undefined }, {
    fetchImpl,
    fetchIpv4Impl,
    warn: (msg) => { warned = msg; },
  });
  assert.equal(result, ipv4Response);
  assert.equal(fetchIpv4Called, true);
  assert.match(warned, /retrying over IPv4/);
  assert.match(warned, /ETIMEDOUT/);
  assert.doesNotMatch(warned, /example\.com/);
});

test(`fetchFirms: ne relance pas si le signal est deja aborte`, async () => {
  const addressErr = Object.assign(new TypeError('fetch failed'), {
    cause: { errors: [Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })] },
  });
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = async () => {
    throw addressErr;
  };
  let ipv4Called = false;
  await assert.rejects(
    fetchFirms('https://example.com', { signal: controller.signal }, {
      fetchImpl,
      fetchIpv4Impl: async () => { ipv4Called = true; return new Response('{}'); },
    }),
    (err) => err === addressErr,
  );
  assert.equal(ipv4Called, false);
});

test('fetchFirms: propage les erreurs qui ne sont pas de selection d adresse', async () => {
  const dnsErr = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  const fetchImpl = async () => {
    throw dnsErr;
  };
  let ipv4Called = false;
  await assert.rejects(
    fetchFirms('https://example.com', { signal: undefined }, {
      fetchImpl,
      fetchIpv4Impl: async () => { ipv4Called = true; return new Response('{}'); },
    }),
    (err) => err === dnsErr,
  );
  assert.equal(ipv4Called, false);
});

test('fetchIpv4 est exportee et est une fonction', () => {
  assert.equal(typeof fetchIpv4, 'function');
});
