import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdsbVerticalRateFpm } from './adsbFields.js';
import { tleLineLaunchYear } from './tle.js';
import { normalizeRadioTag } from './radioBrowser.js';
import { createWorkTrace, recordWorkSlice } from './phaseTiming.js';
import { stitchLines, stitchLine } from './featureGeometry.js';

test('readAdsbVerticalRateFpm: prefere baro_rate', () => {
  assert.equal(readAdsbVerticalRateFpm({ baro_rate: 100, geom_rate: 200 }), 100);
});

test('readAdsbVerticalRateFpm: fallback sur geom_rate', () => {
  assert.equal(readAdsbVerticalRateFpm({ baro_rate: null, geom_rate: 200 }), 200);
});

test('readAdsbVerticalRateFpm: conserve un zero barometrique', () => {
  assert.equal(readAdsbVerticalRateFpm({ baro_rate: 0, geom_rate: 200 }), 0);
});

test('readAdsbVerticalRateFpm: null quand aucun taux', () => {
  assert.equal(readAdsbVerticalRateFpm({}), null);
  assert.equal(readAdsbVerticalRateFpm(null), null);
  assert.equal(readAdsbVerticalRateFpm(undefined), null);
});

test('readAdsbVerticalRateFpm: ignore les valeurs non finies', () => {
  assert.equal(readAdsbVerticalRateFpm({ baro_rate: Infinity, geom_rate: 5 }), 5);
  assert.equal(readAdsbVerticalRateFpm({ baro_rate: 'x', geom_rate: 5 }), 5);
});

test('tleLineLaunchYear: annees >= 57 -> 19xx', () => {
  assert.equal(tleLineLaunchYear('1 25544U 58067A   26001.5'), 1958);
});

test('tleLineLaunchYear: annees < 57 -> 20xx', () => {
  assert.equal(tleLineLaunchYear('1 25544U 25067A   26001.5'), 2025);
});

test('tleLineLaunchYear: entree invalide -> null', () => {
  assert.equal(tleLineLaunchYear(null), null);
  assert.equal(tleLineLaunchYear('short'), null);
  assert.equal(tleLineLaunchYear('1 25544U XX067A   26001.5'), null);
});

test('normalizeRadioTag: normalise et borne', () => {
  assert.equal(normalizeRadioTag('Foo_Bar-Baz'), 'foo bar baz');
  assert.equal(normalizeRadioTag(null), '');
  assert.equal(normalizeRadioTag('   '), '');
});

test('createWorkTrace: retourne null hors DEV', () => {
  const trace = createWorkTrace();
  assert.equal(trace, null);
});

test('recordWorkSlice: ne throw pas avec trace null', () => {
  assert.doesNotThrow(() => recordWorkSlice(null, 'phase', 0, 1, { a: 1 }));
});

test('stitchLines: chaine des segments adjacents', () => {
  const segs = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [2, 0],
    ],
  ];
  const chains = stitchLines(segs, { toleranceM: 1000 });
  assert.equal(chains.length, 1);
  assert.equal(chains[0].length, 3);
});

test('stitchLine: alias backward-compatible', () => {
  const segs = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [2, 0],
    ],
  ];
  const chain = stitchLine(segs);
  assert.equal(Array.isArray(chain), true);
  assert.equal(chain.length, 3);
});

test('stitchLines: maxChains borne le nombre de chaines', () => {
  const segs = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [10, 10],
      [11, 10],
    ],
  ];
  const chains = stitchLines(segs, { maxChains: 1 });
  assert.equal(chains.length, 1);
});

test('stitchLines: segments vides', () => {
  assert.deepEqual(stitchLines([]), []);
});
