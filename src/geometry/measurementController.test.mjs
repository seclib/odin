import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { createMeasurementController } from './measurementController.js';

globalThis.document = {
  createElement: () => ({
    addEventListener() {}, removeEventListener() {},
    style: {}, dataset: {}, getBoundingClientRect() { return {}; }
  }),
  addEventListener() {},
  removeEventListener() {},
  createEvent() { return {}; },
};
import { cumulativeGeodesicDistanceMeters } from './geometryDistance.js';

function makeViewer() {
  const canvas = { addEventListener() {}, removeEventListener() {} };
  let clickHandler = null;
  const entities = [];
  const viewer = {
    canvas,
    scene: {
      globe: { ellipsoid: Cesium.Ellipsoid.default },
      requestRender() {},
    },
    camera: {
      pickEllipsoid(pos, ellipsoid) {
        if (!pos) return null;
        if (viewer._nextPick === undefined) return Cesium.Cartesian3.fromDegrees(0,0);
        return viewer._nextPick;
      },
    },
    entities: {
      add(entity) { entities.push(entity); return entity; },
      remove(entity) {
        const idx = entities.indexOf(entity);
        if (idx >= 0) entities.splice(idx,1);
      },
    },
    _nextPick: Cesium.Cartesian3.fromDegrees(0,0),
    _handlerRegistered: false,
  };
  // ScreenSpaceEventHandler mock
  return viewer;
}

test('measurement controller activates and deactivates', (t) => {
  const viewer = makeViewer();
  const controller = createMeasurementController({ viewer });
  assert.equal(controller.isActive(), false);
  const activated = controller.activate();
  assert.equal(activated, true);
  assert.equal(controller.isActive(), true);
  controller.deactivate(true);
  assert.equal(controller.isActive(), false);
});

test('measurement controller adds and resets points', (t) => {
  const viewer = makeViewer();
  viewer._nextPick = Cesium.Cartesian3.fromDegrees(1,0);
  const controller = createMeasurementController({ viewer });
  controller.activate();
  controller.handleLeftClick({ position: { x:1,y:1 } });
  viewer._nextPick = Cesium.Cartesian3.fromDegrees(2,0);
  controller.handleLeftClick({ position: { x:2,y:2 } });
  assert.equal(controller.getPoints().length, 2);
  assert.ok(controller.getTotalDistanceMeters() > 0);
  controller.reset();
  assert.equal(controller.getPoints().length, 0);
  assert.equal(controller.getTotalDistanceMeters(), 0);
  controller.dispose();
});
