import test from 'node:test';
import assert from 'node:assert/strict';
import { admitSameSiteRequest } from '../../../src/localRequestGate.mjs';
import { admitSameSite, admitSameSiteKeyless } from './same-site.js';

function makeReq(overrides = {}) {
  const base = {
    headers: {},
    socket: { encrypted: false },
  };
  return {
    headers: { ...base.headers, ...overrides.headers },
    socket: overrides.socket || base.socket,
    ...overrides,
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(v) {
      this.body = v;
    },
  };
  return res;
}

const sameOrigin = {
  hostHeader: 'localhost:4173',
  protocol: 'http:',
  origin: 'http://localhost:4173',
  secFetchSite: 'same-origin',
};

test('admitSameSiteKeyless: autorise une requete same-origin', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'http://localhost:4173',
      'sec-fetch-site': 'same-origin',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), false);
  assert.equal(res.statusCode, 200);
});

test('admitSameSiteKeyless: refuse un Origin cross-site', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), true);
  assert.equal(res.statusCode, 403);
});

test('admitSameSiteKeyless: refuse Sec-Fetch-Site cross-site sans Origin (<img>)', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      'sec-fetch-site': 'cross-site',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), true);
  assert.equal(res.statusCode, 403);
});

test('admitSameSiteKeyless: refuse un Origin opaque (null)', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'null',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), true);
  assert.equal(res.statusCode, 403);
});

test('admitSameSiteKeyless: autorise les proxy headers (keyless)', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'http://localhost:4173',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': '10.0.0.1',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), false);
  assert.equal(res.statusCode, 200);
});

test('admitSameSiteKeyless: utilise X-Forwarded-Proto pour le scheme', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'https://localhost:4173',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-proto': 'https',
    },
    socket: { encrypted: false },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), false);
});

test('admitSameSite: refuse les proxy headers (credentialed)', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      origin: 'http://localhost:4173',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': '10.0.0.1',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSite(req, res), true);
  assert.equal(res.statusCode, 403);
});

test('admitSameSiteKeyless: autorise un client non-navigateur (curl)', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), false);
  assert.equal(res.statusCode, 200);
});

test('admitSameSiteKeyless: Sec-Fetch-Site none (typed URL) autorise', () => {
  const req = makeReq({
    headers: {
      host: 'localhost:4173',
      'sec-fetch-site': 'none',
    },
  });
  const res = makeRes();
  assert.equal(admitSameSiteKeyless(req, res), false);
});
