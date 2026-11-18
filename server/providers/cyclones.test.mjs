import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCycloneStatus } from './cyclones.js';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const recent = '2026-11-17T11:30:00Z';

function storm(movementSpeed) {
  return {
    id: 'al012026',
    name: 'Test Storm',
    classification: 'TS',
    longitudeNumeric: -60,
    latitudeNumeric: 25,
    lastUpdate: recent,
    intensity: 64,
    pressure: 990,
    movementDir: 280,
    movementSpeed,
    forecastAdvisory: {
      issuance: recent,
      advNum: '5',
      url: 'https://www.nhc.noaa.gov/text/MIATCPAT1.shtml',
    },
  };
}

test('movementSpeed is reported in mph and exposed as knots', () => {
  const [parsed] = parseCycloneStatus({ activeStorms: [storm(10)] }, NOW);
  // 10 mph * 0.868976 = 8.68976 → rounded to 9 kt.
  assert.equal(parsed.movement.speedKt, 9);
});

test('knots stay below mph and a zero speed stays zero', () => {
  const [fast] = parseCycloneStatus({ activeStorms: [storm(100)] }, NOW);
  assert.equal(fast.movement.speedKt, 87); // 100 * 0.868976 = 86.9 → 87
  const [still] = parseCycloneStatus({ activeStorms: [storm(0)] }, NOW);
  assert.equal(still.movement.speedKt, 0);
});

test('a missing movementSpeed stays null instead of becoming zero', () => {
  const [parsed] = parseCycloneStatus({ activeStorms: [storm(null)] }, NOW);
  assert.equal(parsed.movement.speedKt, null);
});
