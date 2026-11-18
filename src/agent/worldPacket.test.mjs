import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';

import { getWorldPacket, withContextModeVocabulary, collectTrackedEntities, activeContactsWindow, TRACKABLE_FAMILIES } from './worldPacket.js';

function harness() {
  const position = Cesium.Cartesian3.fromDegrees(-97.74, 30.26, 500);
  const viewer = {
    clock: { onTick: { addEventListener: () => () => {} } },
    scene: { canvas: { addEventListener() {}, removeEventListener() {} } },
    camera: {
      moveEnd: { addEventListener() {} },
      positionWC: position,
    },
  };
  const rows = [
    {
      id: 'traffic',
      name: 'Traffic',
      enabled: true,
      stats: { count: 3, source: 'fixture', lastUpdate: null },
    },
  ];
  const dataManager = {
    layers: new Map([['traffic', { module: null }]]),
    getAll: () => rows,
  };
  const styleManager = {
    activeStyle: 'normal',
    getContextModeState: () => ({ mode: 'flights' }),
    getCockpitState: () => null,
    getControlState: () => ({ hud: { visible: 'auto' } }),
  };
  return { viewer, dataManager, styleManager };
}

test('getWorldPacket: basic shape', () => {
  const { viewer, dataManager, styleManager } = harness();
  const packet = getWorldPacket({ viewer, dataManager, styleManager });
  assert.equal(packet.ok, true);
  assert.equal(packet.action, 'get_current_view_state');
  assert.equal(packet.style, 'normal');
  assert.equal(packet.layers.length, 1);
  assert.equal(packet.layers[0].id, 'traffic');
  assert.equal(packet.disabledLayerCount, 0);
});

test('getWorldPacket: reads roster once', () => {
  const { viewer, dataManager, styleManager } = harness();
  const rows = dataManager.getAll();
  rows.push({ id: 'earthquakes', name: 'Earthquakes', enabled: false, stats: { count: 99 } });
  let reads = 0;
  dataManager.getAll = () => {
    reads += 1;
    return rows;
  };
  const packet = getWorldPacket({ viewer, dataManager, styleManager });
  assert.equal(reads, 1);
  assert.equal(packet.disabledLayerCount, 1);
  assert.deepEqual(packet.layers.map((l) => l.id), ['traffic']);
});

test('getWorldPacket: passes now for feed aging', () => {
  const { viewer, dataManager, styleManager } = harness();
  const now = Date.UTC(2026, 9, 17, 12, 0, 0);
  dataManager.getAll = () => [
    {
      id: 'traffic',
      name: 'Traffic',
      enabled: true,
      stats: { count: 3, source: 'fixture', lastUpdate: now - 90_000 },
    },
  ];
  const packet = getWorldPacket({ viewer, dataManager, styleManager, now });
  assert.equal(packet.feedProvenance.layers[0].ageSec, 90);
});

test('getWorldPacket: rejects missing dataManager', () => {
  const { viewer, styleManager } = harness();
  assert.throws(() => getWorldPacket({ viewer, styleManager }), /requires a data manager/);
});

test('getWorldPacket: rejects null options', () => {
  assert.throws(() => getWorldPacket(null), /requires a viewer camera/);
});

test('withContextModeVocabulary: translates mode', () => {
  const result = withContextModeVocabulary({ mode: 'flights', entering: null, priorMode: null });
  assert.equal(result.mode, 'contacts');
  assert.equal(result.modeInternal, 'flights');
});

test('collectTrackedEntities: returns array', () => {
  const { dataManager } = harness();
  const tracked = collectTrackedEntities(dataManager);
  assert.equal(Array.isArray(tracked), true);
});

test('activeContactsWindow: returns null when no layer', () => {
  const { dataManager } = harness();
  assert.equal(activeContactsWindow(dataManager), null);
});

test('TRACKABLE_FAMILIES: frozen', () => {
  assert.equal(Object.isFrozen(TRACKABLE_FAMILIES), true);
  assert.equal(TRACKABLE_FAMILIES.length, 4);
});
