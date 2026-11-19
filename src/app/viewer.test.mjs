// src/app/viewer.test.mjs
// The viewer owns the per-frame rasterization cost paid during a zoom, when
// the 3D Tiles refine frame after frame. These tests pin the antialiasing
// decision so it cannot drift back to the expensive path unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBE_RENDER_DEFAULTS, VIEWER_ANTIALIASING } from './viewer.js';

test('the viewer runs without multisampling and keeps FXAA for the edges', () => {
  // MSAA 4 measured 300 ms per rendered frame on the same scene, against
  // 227 ms for MSAA 1 with the FXAA post-process.
  assert.equal(VIEWER_ANTIALIASING.msaaSamples, 1);
  assert.equal(VIEWER_ANTIALIASING.fxaa, true);
});

test('the antialiasing configuration is frozen', () => {
  assert.equal(Object.isFrozen(VIEWER_ANTIALIASING), true);
});

test('the keyless globe lights naturally while the validated sky balance is kept', () => {
  // A day/night terminator makes the fallback globe readable; the sky
  // atmosphere shifts below were validated visually before this chantier and
  // stay pinned so a later tweak cannot silently change the horizon.
  assert.equal(GLOBE_RENDER_DEFAULTS.enableLighting, true);
  assert.equal(GLOBE_RENDER_DEFAULTS.showGroundAtmosphere, true);
  assert.equal(GLOBE_RENDER_DEFAULTS.atmosphereLightIntensity, 18);
  assert.equal(GLOBE_RENDER_DEFAULTS.atmosphereSaturationShift, -0.12);
  assert.equal(GLOBE_RENDER_DEFAULTS.atmosphereBrightnessShift, -0.08);
  assert.equal(Object.isFrozen(GLOBE_RENDER_DEFAULTS), true);
});
