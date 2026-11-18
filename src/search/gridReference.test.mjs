// UTM and MGRS grid references read to latitude and longitude. Each reference
// is exact or refused. The reference points are one per latitude band (and the
// zone edges) from pyproj and the mgrs package, as pinned in God's Eye View.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGridReference } from './gridReference.js';

function metres(a, b) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

// [MGRS, its latitude, its longitude, UTM, its latitude, its longitude]
const GRID = [
  ['18TWL8565011369', 40.7488215, -73.9854319, '18T 585651 4511369', 40.748817, -73.985428],
  ['56HLH3490052290', -33.8567842, 151.2152996, '56H 334900 6252291', -33.856784, 151.215297],
  ['33XWG1427883355', 78.2232003, 15.6266906, '33X 514279 8683355', 78.2232, 15.6267],
  ['32VKN9747700830', 60.392994, 5.3241531, '32V 297477 6700830', 60.39299, 5.32415],
  ['17MQV8185780012', -0.1806554, -78.4678355, '17M 781858 9980013', -0.180653, -78.467834],
  ['60KXF1292941202', -17.713404, 178.0649977, '60K 612930 8041203', -17.7134, 178.065],
  ['03WVM8047852917', 64.5010996, -165.4064093, '3W 480479 7152918', 64.5011, -165.4064],
  ['31NAA6603200011', 0.0001039, 9.92e-5, '31N 166033 11', 0.0001, 0.0001],
  ['01CDM4324728161', -79.8999987, -179.9000186, '1C 443248 1128161', -79.9, -179.9],
  ['19FEV4500027239', -54.7999989, -68.2999931, '19F 545000 3927239', -54.8, -68.3],
  ['54SUD1748374870', 34.9999987, 138.9999956, '54S 317484 3874871', 35.0, 139.0],
  ['30UXC9988909362', 51.500002, -0.1200043, '30U 699890 5709362', 51.5, -0.12],
];

test('MGRS references read to the centre of their area', () => {
  for (const [mgrs, lat, lon] of GRID) {
    const point = parseGridReference(mgrs);
    assert.ok(point, mgrs);
    assert.ok(metres(point, { lat, lon }) < 1, `${mgrs}: ${JSON.stringify(point)}`);
  }
  // Spaced and unspaced forms are equivalent.
  assert.deepEqual(parseGridReference('18TWL8565011369'), parseGridReference('18T WL 85650 11369'));
  assert.deepEqual(parseGridReference('18twl8565011369'), parseGridReference('18T WL 85650 11369'));
});

test('UTM references read to latitude and longitude', () => {
  for (const [, lat, lon, utm, utmLat, utmLon] of GRID) {
    const point = parseGridReference(utm);
    assert.ok(point, utm);
    assert.ok(metres(point, { lat: utmLat, lon: utmLon }) < 1, `${utm}: ${JSON.stringify(point)}`);
  }
});

test('coarser MGRS and month-like square letters are refused', () => {
  for (const query of [
    '18T WL 8511', // coarser MGRS (2 digits each)
    '1 JAN 2023 1200', // letters spell a month
    '3 USA 12',
    '20 KPH 1000',
    '32X ...', // Svalbard zone that does not exist in band X
    '34X ...',
    '36X ...',
    '9A ...', // polar band
    '9B ...',
    '9Y ...',
    '9Z ...',
    '', // empty
    'not a grid reference',
    '33UXP0500444998 extra', // trailing text
  ]) {
    const trimmed = query.replace(/\.\.\./, '');
    assert.equal(
      parseGridReference(trimmed),
      null,
      `${JSON.stringify(trimmed)} must be refused`,
    );
  }
});

test('non-strings and out-of-range values are refused without throwing', () => {
  for (const query of [null, undefined, 42, {}, [], '18T 999999 4511369', '18T 500000 9999999'])
    assert.equal(parseGridReference(query), null, JSON.stringify(query));
});
