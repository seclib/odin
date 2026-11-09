import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STYLES = path.join(HERE, 'styles');
const ROOT = path.join(HERE, '..', '..');

const foundation = readFileSync(path.join(STYLES, 'foundation.css'), 'utf8');
const modern = readFileSync(path.join(STYLES, 'modern.css'), 'utf8');
const stylesheet = readFileSync(path.join(ROOT, 'style.css'), 'utf8');

test('the Cesium container keeps its full-viewport layout', () => {
  const rule = foundation.match(/#cesiumContainer\s*\{[^}]*\}/);
  assert.ok(rule, '#cesiumContainer rule must exist');
  assert.match(rule[0], /width:\s*100%/);
  assert.match(rule[0], /height:\s*100%/);
  assert.match(rule[0], /position:\s*absolute/);
  assert.match(rule[0], /top:\s*0/);
  assert.match(rule[0], /left:\s*0/);
});

test('the modern theme does not override map layout or interaction properties', () => {
  assert.doesNotMatch(modern, /\bposition\s*:/);
  assert.doesNotMatch(modern, /\boverflow\s*:/);
  assert.doesNotMatch(modern, /\bz-index\s*:/);
  assert.doesNotMatch(modern, /\btransform\s*:/);
  assert.doesNotMatch(modern, /\bpointer-events\s*:/);
});

test('the modern theme is imported before the cyber theme', () => {
  assert.match(stylesheet, /modern\.css';/);
  assert.match(stylesheet, /cyber\.css';\s*$/m);
});
