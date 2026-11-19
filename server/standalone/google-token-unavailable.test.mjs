import assert from 'node:assert/strict';
import test from 'node:test';
import { googleTokenUnavailablePlugin } from './google-token-unavailable.js';

/** Minimal Connect-like middleware harness: no server, no network, no files. */
function invoke({ method = 'GET', url = '/api/google/tiles-token' } = {}) {
  let nextCalled = false;
  let head = null;
  let ended = false;
  const server = {
    middlewares: {
      use(handler) {
        handler(
          { method, url, headers: {} },
          {
            writeHead(status, headers) {
              head = { status, headers };
            },
            end() {
              ended = true;
            },
          },
          () => {
            nextCalled = true;
          },
        );
      },
    },
  };
  googleTokenUnavailablePlugin().configureServer(server);
  return { nextCalled, head, ended };
}

test('an absent Google token endpoint is a supported 204 outcome', () => {
  const result = invoke();
  assert.equal(result.nextCalled, false);
  assert.equal(result.head.status, 204);
  assert.deepEqual(result.head.headers, { 'Cache-Control': 'no-store' });
  assert.equal(result.ended, true);
});

test('HEAD is treated like GET', () => {
  const result = invoke({ method: 'HEAD' });
  assert.equal(result.head.status, 204);
  assert.equal(result.nextCalled, false);
});

test('other methods and paths are left to the next middleware', () => {
  for (const options of [
    { method: 'POST', url: '/api/google/tiles-token' },
    { method: 'GET', url: '/api/google/tiles-token/extra' },
    { method: 'GET', url: '/api/other' },
  ]) {
    const result = invoke(options);
    assert.equal(result.nextCalled, true);
    assert.equal(result.head, null);
    assert.equal(result.ended, false);
  }
});
