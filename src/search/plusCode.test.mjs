// Full Open Location Codes ("plus codes") read to the centre of their area.
// The reference points are from the Open Location Code project's test data
// (decoding.csv), as pinned in God's Eye View. Short codes and invalid codes
// are refused.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlusCode } from './plusCode.js';

test('full plus codes read to the centre of their area', () => {
  const PLUS_CODES = [
    ['849VCWC8+R9', 37.4220625, -122.0840625],
    ['6FPW3600+', 4.075, 18.225],
    ['C55GR473+C5732', 73.8135255, -109.89708496093749],
    ['CV25MQ00+', 70.675, 163.775],
    ['4J86FVGW+9449', -43.5241175, 64.89533984375],
    ['8V2H837Q+44', 30.3128125, 171.08781249999998],
    ['C8C35800+', 78.175, -58.675],
    ['62M5653J+Q3', 3.2044375, -176.8198125],
    ['8H8VW72V+9GXV5', 36.9009955, 57.2938583984375],
  ];
  for (const [code, lat, lon] of PLUS_CODES) {
    const point = parsePlusCode(code);
    assert.ok(point, code);
    assert.ok(
      Math.abs(point.lat - lat) < 1e-9 && Math.abs(point.lon - lon) < 1e-9,
      `${code}: ${JSON.stringify(point)}`,
    );
  }
  // Case and surrounding whitespace are ignored.
  assert.deepEqual(parsePlusCode(' 849vcwc8+r9 '), parsePlusCode('849VCWC8+R9'));
});

test('only valid full plus codes are read; short and invalid ones are refused', () => {
  const VALIDITY = [
    ['8FWC2345+G6', true],
    ['8FWC2345+G6G', true],
    ['8fwc2345+', true],
    ['8FWCX400+', true],
    ['84000000+', true],
    ['WC2345+G6g', false],
    ['2345+G6', false],
    ['45+G6', false],
    ['+G6', false],
    ['G+', false],
    ['+', false],
    ['8FWC2345+G', false],
    ['8FWC2_45+G6', false],
    ['8FWC2345+G6+', false],
    ['8FWC2345G6+', false],
    ['8FWC2300+G6', false],
    ['WC2300+G6g', false],
    ['WC2345+G', false],
    ['WC2300+', false],
    ['84900000+', false],
    ['849VGJQF+VX7QR3J', true],
    ['849VGJQF+VX7QR3U', false],
    ['849VGJQF+VX7QR3JW', true],
    ['849VGJQF+VX7QR3JU', false],
  ];
  for (const [code, isFull] of VALIDITY)
    assert.equal(
      parsePlusCode(code) !== null,
      isFull,
      `${code} must be ${isFull ? 'accepted' : 'refused'}`,
    );
});

test('non-strings and malformed input are refused without throwing', () => {
  for (const code of [null, undefined, 42, {}, [], '', '   ', 'CWC8+R9', 'CWC8+R9 Mountain View', '849VCWC8+R9 extra'])
    assert.equal(parsePlusCode(code), null, JSON.stringify(code));
});
