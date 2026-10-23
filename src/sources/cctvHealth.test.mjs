import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCctvMediaMode } from './cctvTypes.js';
import { cctvAvailability } from '../../server/providers/cctv/availability.js';
import {
  cctvCapturedAtLabel,
  cctvCheckedAtLabel,
  cctvHealthFreshness,
  cctvMediaModeLabel,
  cctvSourceStatusLabel,
} from '../ui/cctvFrames.js';

test('availability follows observed media state, not catalog presence', () => {
  assert.equal(cctvAvailability({ status: 'unknown' }), 'unknown');
  assert.equal(
    cctvAvailability({ status: 'ok', sourceKind: 'snapshot' }),
    'available',
  );
  assert.equal(
    cctvAvailability({ status: 'degraded', sourceKind: 'upstream' }),
    'unavailable',
  );
  assert.equal(
    cctvAvailability({ status: 'degraded', sourceKind: 'synthetic' }),
    'fallback',
  );
});

test('stale and future health timestamps are not presented as fresh', () => {
  const now = 1_800_000_000_000;
  assert.equal(cctvHealthFreshness(NaN, now), 'unknown');
  assert.equal(cctvHealthFreshness(now - 60_000, now), 'fresh');
  assert.equal(cctvHealthFreshness(now - 6 * 60_000, now), 'stale');
  assert.equal(cctvHealthFreshness(now + 1, now), 'stale');
  assert.match(cctvCheckedAtLabel(now - 6 * 60_000, now), /LAST CHECK STALE/);
  assert.equal(cctvCapturedAtLabel(null), '');
  assert.match(cctvCapturedAtLabel(now), /CAPTURE TIME/);
  assert.match(cctvCapturedAtLabel(now - 6 * 60_000), /CAPTURE TIME STALE/);
});

test('media protocols stay distinct and no protocol alone claims periodic cadence', () => {
  assert.equal(normalizeCctvMediaMode('', 'hls'), 'continuous-video');
  assert.equal(normalizeCctvMediaMode('', 'mjpeg'), 'continuous-video');
  assert.equal(normalizeCctvMediaMode('', 'image'), 'still-image');
  assert.equal(normalizeCctvMediaMode('', 'mp4'), 'video-clip');
  assert.equal(normalizeCctvMediaMode('', 'webm'), 'video-clip');
  assert.equal(normalizeCctvMediaMode('periodic-loop', 'mp4'), 'periodic-loop');
  assert.equal(
    normalizeCctvMediaMode('', 'hls', 'https://example.org/cam'),
    'external-embed',
  );
  assert.equal(normalizeCctvMediaMode('', 'hls'), 'continuous-video');
  assert.match(cctvMediaModeLabel('continuous-video'), /CONTINUOUS VIDEO/);
  assert.match(cctvMediaModeLabel('periodic-loop'), /PERIODIC VIDEO LOOP/);
  assert.match(cctvSourceStatusLabel('unknown'), /UNKNOWN/);
  assert.match(cctvSourceStatusLabel('unavailable'), /UNAVAILABLE/);
});
