import assert from 'node:assert/strict';
import test from 'node:test';
import { microphoneAccessMessage } from './microphoneError.js';

test('microphone permission refusal names the browser action', () => {
  assert.match(
    microphoneAccessMessage(
      { name: 'NotAllowedError' },
      { secureContext: true },
    ),
    /Allow microphone access/,
  );
});

test('insecure contexts get a secure-origin explanation', () => {
  assert.match(
    microphoneAccessMessage(
      { name: 'NotAllowedError' },
      { secureContext: false },
    ),
    /HTTPS or localhost/,
  );
});

test('missing and busy input devices have distinct diagnostics', () => {
  assert.match(
    microphoneAccessMessage({ name: 'NotFoundError' }),
    /No microphone was found/,
  );
  assert.match(
    microphoneAccessMessage({ name: 'NotReadableError' }),
    /already in use/,
  );
});

test('audio constraint failures are explained and unrelated errors are not reclassified', () => {
  assert.match(
    microphoneAccessMessage({ name: 'OverconstrainedError' }),
    /audio settings/,
  );
  assert.equal(
    microphoneAccessMessage(new Error('token endpoint failed')),
    null,
  );
});
