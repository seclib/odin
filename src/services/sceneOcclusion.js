/**
 * Native Cesium scene-occlusion probe for ODIN.
 *
 * ODIN has no GEV `render/` subsystem and no GPU depth probe. This module
 * provides the best native alternative: it uses Cesium's own depth buffer via
 * `scene.pickPosition`, which returns the world position the renderer actually
 * drew at a screen pixel. Comparing that distance with a contact's distance
 * tells whether something (terrain, building, 3D tile) stands in front of it.
 *
 * The probe is synchronous with respect to the last rendered frame and must be
 * called after the scene has drawn. It never blocks the GPU and never waits.
 * On any failure (no depth, context loss, exception) it reports `occluded:
 * false` so contacts are never wrongly hidden.
 *
 * This is a *prototype*: it is not wired into `detection.js` or
 * `SurfaceOcclusion` yet. The arithmetic in `src/data/detectionOcclusion.js`
 * (surfaceOcclusionMargin, projectContact, SurfaceOcclusion) is the intended
 * consumer once a frame budget and scheduling policy are added.
 */

import * as Cesium from 'cesium';

/**
 * Create a scene-occlusion probe bound to a Cesium viewer.
 * @param {object} viewer A Cesium.Viewer (or any object with `.scene`).
 * @returns {{probe: (screenX: number, screenY: number, contactCartesian: object) => {occluded: boolean, method: string, pickedDistance?: number, contactDistance?: number}, available: () => boolean}}
 */
export function createSceneOcclusionProbe(viewer) {
  const scene = viewer?.scene;
  const camera = viewer?.camera;

  function available() {
    try {
      return !!scene && !!camera && !scene.isDestroyed?.();
    } catch {
      return false;
    }
  }

  /**
   * Test whether something is drawn in front of the contact at its screen
   * position.
   * @param {number} screenX
   * @param {number} screenY
   * @param {object} contactCartesian World position (Cartesian3) of the contact.
   * @param {number} [marginM=3] Occlusion margin in metres.
   * @returns {{occluded: boolean, method: string, pickedDistance?: number, contactDistance?: number}}
   */
  function probe(screenX, screenY, contactCartesian, marginM = 3) {
    if (!available()) return { occluded: false, method: 'unavailable' };
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return { occluded: false, method: 'invalid-input' };
    }
    if (!contactCartesian) return { occluded: false, method: 'invalid-input' };

    let pickedPosition = null;
    try {
      pickedPosition = scene.pickPosition(
        new Cesium.Cartesian2(screenX, screenY),
      );
    } catch (error) {
      return { occluded: false, method: 'error', error: String(error) };
    }

    if (!pickedPosition) {
      // Nothing drawn at that pixel (sky / empty): contact not occluded.
      return { occluded: false, method: 'no-depth' };
    }

    const cameraPosition = camera.positionWC || camera.position;
    const contactDistance = Cesium.Cartesian3.distance(
      cameraPosition,
      contactCartesian,
    );
    const pickedDistance = Cesium.Cartesian3.distance(
      cameraPosition,
      pickedPosition,
    );

    if (!Number.isFinite(contactDistance) || !Number.isFinite(pickedDistance)) {
      return { occluded: false, method: 'invalid-distance' };
    }

    const margin = Math.max(3, Number(marginM) || 3);
    const occluded = pickedDistance < contactDistance - margin;

    return {
      occluded,
      method: 'pickPosition',
      pickedDistance,
      contactDistance,
    };
  }

  return { probe, available };
}

/**
 * Pure helper: whether a picked distance occludes a contact distance.
 * Exported for unit testing without a viewer.
 * @param {number} pickedDistance
 * @param {number} contactDistance
 * @param {number} [marginM=3]
 * @returns {boolean}
 */
export function pickedOccludes(pickedDistance, contactDistance, marginM = 3) {
  if (!Number.isFinite(pickedDistance) || !Number.isFinite(contactDistance))
    return false;
  const margin = Math.max(3, Number(marginM) || 3);
  return pickedDistance < contactDistance - margin;
}
