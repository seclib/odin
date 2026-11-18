// Pure view-model tests for the local-data settings section.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  localDataStateMeta,
  localDataBreakdown,
  LOCAL_DATA_STATES,
} from './localData.js';

test('formatBytes stays compact and handles bad input', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(-1), '—');
  assert.equal(formatBytes('x'), '—');
});

test('configured is an explicit state, distinct from data availability', () => {
  assert.ok(LOCAL_DATA_STATES.includes('configured'));
  assert.equal(localDataStateMeta('configured').label, 'CONFIGURED');
  assert.equal(localDataStateMeta('ready').label, 'AVAILABLE');
  assert.equal(localDataStateMeta('partial').label, 'INCOMPLETE');
  assert.equal(localDataStateMeta('error').label, 'ERROR');
});

test('breakdown is empty when the server is absent or storage disabled', () => {
  assert.deepEqual(localDataBreakdown(null), []);
  assert.deepEqual(localDataBreakdown({ enabled: false, counts: {} }), []);
  assert.deepEqual(localDataBreakdown({ enabled: true, counts: null }), []);
});

test('breakdown distinguishes sources, enriched and generated data + provenance', () => {
  const lines = localDataBreakdown({
    enabled: true,
    configured: true,
    counts: {
      sourceFiles: 4,
      enrichedLines: 100,
      enrichedIgn: 100,
      tiles: 42,
      buildings: 100,
      bytes: 30_148_184,
    },
    manifest: {
      schemaVersion: 1,
      scope: 'pilot-100',
      license: 'CDLA-Permissive-2.0',
      tilesGeneratedAt: '2026-11-17T15:34:00Z',
    },
    checksumsPresent: true,
    checksumsCount: 135,
  });
  const text = lines.join('\n');
  assert.match(text, /Sources \(original\): 4/);
  assert.match(text, /Enriched \(IGN\): 100/);
  assert.match(text, /Generated \(3D Tiles\): 42 tiles · 100 buildings/);
  assert.match(text, /Total volume: 29 MB/);
  assert.match(text, /pilot-100 · CDLA-Permissive-2\.0 · 2026-11-17T15:34:00Z/);
  assert.match(text, /Manifest schema: v1/);
  assert.match(text, /135 SHA-256 hashes/);
});
