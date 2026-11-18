// Contract tests for the extensible local-data settings rubrique.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_DATA_CATEGORIES,
  categoryStateMeta,
  localDataHubCategories,
} from './localDataHub.js';

test('registry declares the five initial categories in order', () => {
  assert.deepEqual(
    LOCAL_DATA_CATEGORIES.map((c) => c.id),
    ['storage', 'buildings', 'terrain', 'imagery', 'integrity'],
  );
  assert.ok(Object.isFrozen(LOCAL_DATA_CATEGORIES));
});

test('only the 3D buildings category is available; the rest are upcoming', () => {
  assert.equal(LOCAL_DATA_CATEGORIES.find((c) => c.id === 'buildings').state, 'available');
  for (const id of ['storage', 'terrain', 'imagery', 'integrity']) {
    assert.equal(LOCAL_DATA_CATEGORIES.find((c) => c.id === id).state, 'upcoming', id);
  }
  assert.equal(categoryStateMeta('available').label, 'AVAILABLE');
  assert.equal(categoryStateMeta('upcoming').label, 'UPCOMING');
  assert.equal(categoryStateMeta('available').tone, 'ok');
  assert.equal(categoryStateMeta('upcoming').tone, 'off');
});

test('storage category documents planned features and server-side path rule', () => {
  const storage = LOCAL_DATA_CATEGORIES.find((c) => c.id === 'storage');
  assert.equal(storage.planned.length, 5);
  assert.match(storage.note, /local ODIN server/i);
  assert.match(storage.note, /browser cannot write/i);
});

test('registry is extensible: an added category renders through the same pipeline', () => {
  const extended = [
    ...LOCAL_DATA_CATEGORIES,
    {
      id: 'future',
      title: 'Future category',
      description: 'Description of a category added later.',
      state: 'upcoming',
      planned: [],
      note: null,
    },
  ];
  const view = localDataHubCategories(extended);
  assert.equal(view.length, 6);
  const future = view.at(-1);
  assert.equal(future.id, 'future');
  assert.equal(future.state, 'upcoming');
  assert.equal(future.label, 'UPCOMING');
  assert.deepEqual(future.planned, []);
});

test('view model is localized, complete and carries no controls', () => {
  const view = localDataHubCategories();
  assert.equal(view.length, 5);
  for (const category of view) {
    assert.ok(category.title && category.description && category.label);
    assert.ok(['available', 'upcoming'].includes(category.state));
    assert.equal(typeof category.note === 'string' || category.note === null, true);
    assert.equal(Array.isArray(category.planned), true);
  }
  assert.equal(view.find((c) => c.id === 'buildings').planned.length, 0);
  assert.equal(view.find((c) => c.id === 'storage').planned.length, 5);
});
