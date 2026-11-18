import test from 'node:test';
import assert from 'node:assert/strict';
import { pickedOccludes } from './sceneOcclusion.js';

test('pickedOccludes: closer picked surface occludes the contact', () => {
  assert.equal(pickedOccludes(100, 200, 3), true);
  assert.equal(pickedOccludes(198, 200, 3), false, 'within margin');
  assert.equal(pickedOccludes(200, 200, 3), false, 'equal distance');
  assert.equal(pickedOccludes(250, 200, 3), false, 'picked farther');
});

test('pickedOccludes: invalid inputs never report occlusion', () => {
  assert.equal(pickedOccludes(NaN, 200, 3), false);
  assert.equal(pickedOccludes(100, NaN, 3), false);
  assert.equal(pickedOccludes(Infinity, 200, 3), false);
  assert.equal(pickedOccludes(100, Infinity, 3), false);
});

test('pickedOccludes: margin is at least 3 metres', () => {
  assert.equal(pickedOccludes(100, 102, 1), false, 'margin floored to 3');
  assert.equal(pickedOccludes(96, 100, 1), true);
});

test('createSceneOcclusionProbe: unavailable viewer reports unavailable', async () => {
  const { createSceneOcclusionProbe } = await import('./sceneOcclusion.js');
  const probe = createSceneOcclusionProbe(null);
  assert.equal(probe.available(), false);
  const r = probe.probe(10, 10, { x: 1, y: 2, z: 3 });
  assert.equal(r.occluded, false);
  assert.equal(r.method, 'unavailable');
});

test('createSceneOcclusionProbe: invalid inputs', async () => {
  const { createSceneOcclusionProbe } = await import('./sceneOcclusion.js');
  // Minimal fake viewer
  const viewer = { scene: { pickPosition: () => null, isDestroyed: () => false }, camera: { positionWC: { x: 0, y: 0, z: 0 } } };
  const probe = createSceneOcclusionProbe(viewer);
  assert.equal(probe.available(), true);
  assert.equal(probe.probe(NaN, 10, {}).method, 'invalid-input');
  assert.equal(probe.probe(10, 10, null).method, 'invalid-input');
});