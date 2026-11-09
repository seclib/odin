import * as Cesium from 'cesium';
import { cumulativeGeodesicDistanceMeters, geodesicSurfaceDistanceMeters } from './geometryDistance.js';

function pointsDistanceMeters(points) {
  const result = cumulativeGeodesicDistanceMeters(points.map((p) => p));
  return result === null ? 0 : result;
}

export function createMeasurementController(options = {}) {
  const viewer = options.viewer;
  const onDistanceChange = typeof options.onDistanceChange === "function"
    ? options.onDistanceChange
    : () => {};
  const onPointsChange = typeof options.onPointsChange === "function"
    ? options.onPointsChange
    : () => {};
  const onStateChange = typeof options.onStateChange === "function"
    ? options.onStateChange
    : () => {};

  const points = [];
  const entities = [];
  const handler = viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null;
  const ellipsoid = viewer?.scene?.globe?.ellipsoid ?? Cesium.Ellipsoid.default;
  let active = false;
  let disposed = false;

  function removeEntities() {
    for (const entity of entities) {
      try {
        if (viewer?.entities?.remove) viewer.entities.remove(entity);
      } catch {
        /* already gone */
      }
    }
    entities.length = 0;
  }

  function totalMeters() {
    return points.length >= 2 ? (cumulativeGeodesicDistanceMeters(points) ?? 0) : 0;
  }

  function addPoint(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian, ellipsoid);
    if (
      !cartographic ||
      !Number.isFinite(cartographic.latitude) ||
      !Number.isFinite(cartographic.longitude)
    ) {
      return false;
    }
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const point = { lat, lon };
    points.push(point);

    if (viewer?.entities?.add) {
      const marker = viewer.entities.add({
        position: cartesian,
        point: { pixelSize: 8, color: Cesium.Color.YELLOW },
      });
      entities.push(marker);
    }

    if (viewer?.scene?.requestRender) viewer.scene.requestRender();
    const distance = totalMeters();
    onPointsChange(points.map((p) => ({ ...p })));
    onDistanceChange(distance);
    return true;
  }

  function onClick(movement) {
    if (!active || !viewer) return;
    const cartesian = viewer.camera?.pickEllipsoid?.(
      movement.position,
      ellipsoid,
    );
    if (!cartesian) return;
    addPoint(cartesian);
  }

  function activate() {
    if (active || disposed || !handler) return false;
    active = true;
    handler.setInputAction(onClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    onStateChange({ active: true });
    return true;
  }

  function deactivate(clear = true) {
    if (!active && points.length === 0) return;
    active = false;
    try {
      handler?.removeInputAction?.(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } catch {
      /* already removed */
    }
    if (clear) {
      points.length = 0;
      removeEntities();
      onPointsChange([]);
      onDistanceChange(0);
    }
    onStateChange({ active: false });
  }

  function reset() {
    points.length = 0;
    removeEntities();
    onPointsChange([]);
    onDistanceChange(0);
  }

  function dispose() {
    deactivate(true);
    disposed = true;
    try {
      handler?.destroy?.();
    } catch {
      /* already destroyed */
    }
  }

  return {
    activate,
    deactivate,
    reset,
    dispose,
    isActive: () => active,
    getPoints: () => points.map((p) => ({ ...p })),
    getTotalDistanceMeters: totalMeters,
    handleLeftClick: onClick,
    handleClick: onClick,
    _entities: entities,
  };
}
