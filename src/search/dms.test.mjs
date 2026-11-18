// DEGREES-MINUTES-SECONDS — what the search box accepts as a DMS component,
// and what it refuses. A misread DMS flies the operator somewhere else and
// looks like success, so every malformed form is pinned.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDmsComponent } from './dms.js';

test('a DMS component reads degrees, minutes and seconds to a signed value', () => {
  assert.deepEqual(parseDmsComponent(`40°26'46"N`), {
    value: 40 + 26 / 60 + 46 / 3600,
    axis: 'lat',
  });
  assert.deepEqual(parseDmsComponent(`79°58'56"W`), {
    value: -(79 + 58 / 60 + 56 / 3600),
    axis: 'lon',
  });
  // Without a hemisphere letter the sign is not applied; range checks happen
  // at the parse-coordinate-query level.
  assert.deepEqual(parseDmsComponent(`33°51'24"`), {
    value: 33 + 51 / 60 + 24 / 3600,
    axis: null,
  });
});

test('hemisphere letters fix the axis and override the sign', () => {
  assert.deepEqual(parseDmsComponent(`40°26'46"S`), {
    value: -(40 + 26 / 60 + 46 / 3600),
    axis: 'lat',
  });
  assert.deepEqual(parseDmsComponent(`E 74°0'0"`), {
    value: 74,
    axis: 'lon',
  });
  // A sign and a letter both claiming the direction is refused, not guessed.
  assert.equal(parseDmsComponent(`-40°26'46"N`), null);
  assert.equal(parseDmsComponent(`N -40°26'46"`), null);
});

test('two letters on one component are a contradiction', () => {
  assert.equal(parseDmsComponent(`N40°W`), null);
  assert.equal(parseDmsComponent(`N40°26'46"S`), null);
});

test('minutes and seconds must be below 60', () => {
  assert.equal(parseDmsComponent(`40°60'0"N`), null);
  assert.equal(parseDmsComponent(`40°0'60"N`), null);
  assert.ok(parseDmsComponent(`40°59'59"N`) !== null);
});

test('only the last number may carry a decimal part', () => {
  assert.ok(parseDmsComponent(`40°26'46.5"N`) !== null);
  assert.equal(parseDmsComponent(`40°26.5'46.5"N`), null);
});

test('degrees accept one to three digits', () => {
  assert.ok(parseDmsComponent(`0°0'0"N`) !== null);
  assert.ok(parseDmsComponent(`90°0'0"N`) !== null);
  assert.ok(parseDmsComponent(`180°0'0"W`) !== null);
});

test('symbol variants are accepted', () => {
  assert.ok(parseDmsComponent(`40°26'46″N`) !== null);
  assert.ok(parseDmsComponent(`40º26'46"N`) !== null);
  assert.ok(parseDmsComponent(`40°26'46''N`) !== null);
  assert.ok(parseDmsComponent(`40°26'46"N`) !== null);
});

test('non-strings and malformed input are refused without throwing', () => {
  for (const text of [null, undefined, 42, {}, [], '', '   ', '40', '40 26', '40°26', 'Paris', `40.7128 N 74.0060 W`])
    assert.equal(parseDmsComponent(text), null, JSON.stringify(text));
});
