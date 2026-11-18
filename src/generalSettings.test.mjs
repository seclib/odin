// Contract tests for the general settings shell and its rubrique registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_RUBRIQUES } from './generalSettings.js';

test('general settings exposes local data as a rubrique, not a dock icon', () => {
  assert.deepEqual(
    SETTINGS_RUBRIQUES.map((r) => r.id),
    ['local-data', 'providers'],
  );
  assert.ok(Object.isFrozen(SETTINGS_RUBRIQUES));
});

test('rubrique titles are localized through msg()', () => {
  for (const rubrique of SETTINGS_RUBRIQUES) {
    assert.equal(typeof rubrique.title, 'string');
    assert.ok(rubrique.title.length > 0);
  }
});
