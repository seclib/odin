// src/app/viewer.test.mjs
// The viewer owns the per-frame rasterization cost paid during a zoom, when
// the 3D Tiles refine frame after frame. These tests pin the antialiasing
// decision so it cannot drift back to the expensive path unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWER_ANTIALIASING } from './viewer.js';

test('the viewer runs without multisampling and keeps FXAA for the edges', () => {
  // MSAA 4 measured 300 ms per rendered frame on the same scene, against
  // 227 ms for MSAA 1 with the FXAA post-process.
  assert.equal(VIEWER_ANTIALIASING.msaaSamples, 1);
  assert.equal(VIEWER_ANTIALIASING.fxaa, true);
});

test('the antialiasing configuration is frozen', () => {
  assert.equal(Object.isFrozen(VIEWER_ANTIALIASING), true);
});
