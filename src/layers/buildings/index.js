/**
 * Local 3D buildings layer — optional GMLFP/BD TOPO tileset (Phase E).
 *
 * The layer is OFF by default: nothing is downloaded, fetched or added to the
 * scene unless the operator enables local storage in the POWER UP panel (or
 * pins `VITE_LOCAL_BUILDINGS_URL` at build time for exotic layouts), or
 * injects a `tilesetUrl` into the catalog. Misconfiguration is surfaced —
 * `enable()` throws with the reason and the panel chip shows UNAVAILABLE with
 * that reason — never silently swallowed.
 *
 * Lifecycle: Cesium tileset instances are expensive to recreate (276 MB of
 * Réunion tiles) — `disable()` REMOVES the tileset from the scene but keeps
 * the instance; re-enabling re-uses it (no re-download, no duplicate
 * primitives). `destroy()` removes and destroys it for good. Double-enable
 * never duplicates the primitive (containment is checked, not assumed).
 *
 * Provenance (the only claims this module makes):
 *  - footprints: Microsoft GMLFP, CDLA-Permissive-2.0 (or BD TOPO output of
 *    the same converter when the operator swaps inputs);
 *  - heights: constant `--default-height` from the converter — NOT measured.
 *    Buildings extruded by a default carry `heightSource: "default"` in the
 *    tile batch table; the attribution names this caveat.
 *  - bases: IGN RGE ALTI orthometric when the tileset was enriched with
 *    `tools/buildings/enrich_gmlfp_altitudes.py` (baseSource "ign"), else 0 m.
 *
 * @module layers/buildings
 */
import * as Cesium from 'cesium';
import {
  createLocalBuildingsTileset,
  isLocalBuildingsEnabled,
  refreshLocalBuildingsAvailability,
  LOCAL_BUILDINGS_ATTRIBUTION_HTML,
  LOCAL_BUILDINGS_DISABLED_REASON,
} from '../../maps/localBuildings.js';

/**
 * Camera-height band for the buildings visibility policy. Above the ceiling a
 * 6 m extrusion is sub-pixel on a global view, yet Cesium would still stream
 * and draw every tile in frustum; hiding it removes that cost without touching
 * the tileset or the terrain. The lower threshold is deliberately separated so
 * a camera hovering at the boundary cannot flip the layer on and off per frame.
 */
export const BUILDINGS_HIDE_ABOVE_M = 10_000;
export const BUILDINGS_SHOW_BELOW_M = 8_000;

/** GMLFP conversion emits featureCount/claims in the tileset's extras. */
function countFrom(tileset) {
  const count = Number(tileset?.extras?.featureCount);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

/**
 * Height provenance is a claim carried by the tileset, never inferred from the
 * default extrusion value. An absent claim is reported as `unknown`: a missing
 * metadata field must never be read as "measured".
 * @param {object|undefined} extras
 */
function heightProvenance(extras) {
  const raw = extras?.heightSource;
  const heightSource = raw === 'measured' || raw === 'default' ? raw : 'unknown';
  const defaultHeightM = Number.isFinite(extras?.defaultHeightM)
    ? extras.defaultHeightM
    : null;
  const heightNote =
    typeof extras?.heightNote === 'string' && extras.heightNote.trim()
      ? extras.heightNote
      : null;
  return {
    heightSource,
    heightsMeasured: heightSource === 'measured',
    defaultHeightM,
    heightNote,
  };
}

function cameraHeightM(viewer) {
  const height = viewer?.scene?.camera?.positionCartographic?.height;
  return Number.isFinite(height) ? height : null;
}

/**
 * @param {{
 *   createTileset?: (options?: object) => Promise<object|null>,
 *   isEnabled?: () => boolean,
 *   refreshAvailability?: () => Promise<boolean>,
 * }} [deps] injectable for tests
 */
export function createBuildingsLayer(deps = {}) {
  const createTileset =
    typeof deps.createTileset === 'function'
      ? deps.createTileset
      : createLocalBuildingsTileset;
  const isEnabled =
    typeof deps.isEnabled === 'function'
      ? deps.isEnabled
      : isLocalBuildingsEnabled;
  const refreshAvailability =
    typeof deps.refreshAvailability === 'function'
      ? deps.refreshAvailability
      : refreshLocalBuildingsAvailability;

  let viewer = null;
  let tileset = null;
  let enabled = false;
  let loading = false;
  let error = null;
  let lastUpdate = null;
  // A destroy() during an in-flight enable() invalidates the pending result:
  // without this, a late-created tileset would be published into a torn-down
  // scene and Cesium would render a destroyed primitive.
  let generation = 0;

  const inScene = (candidate) =>
    Boolean(viewer?.scene?.primitives?.contains?.(candidate));

  /**
   * Never let a destroyed tileset reach Cesium again. `PrimitiveCollection.remove`
   * and the `show` setter both call `throwOnDestroyed`, so every consumer must
   * revalidate the cached instance before using it and drop stale references.
   */
  function trackedTileset() {
    if (tileset && typeof tileset.isDestroyed === 'function' && tileset.isDestroyed()) {
      tileset = null;
    }
    return tileset;
  }

  /** Apply the camera-height visibility policy without recreating the tileset. */
  function applyVisibilityPolicy() {
    const tracked = trackedTileset();
    if (!tracked || typeof tracked.show !== 'boolean') return;
    const height = cameraHeightM(viewer);
    if (height == null) return;
    if (height > BUILDINGS_HIDE_ABOVE_M && tracked.show) {
      tracked.show = false;
    } else if (height < BUILDINGS_SHOW_BELOW_M && !tracked.show) {
      tracked.show = true;
    }
  }

  return {
    id: 'local-buildings',
    name: 'Buildings',
    icon: '🏢',
    // The source string is shown by the panel as the provenance line; it must
    // not overstate the data. Heights are not measured in the GMLFP pipeline.
    source: 'Microsoft GMLFP · 3D Tiles · heights not measured',
    updateInterval: 0,
    statsRefreshInterval: 1000,

    async init() {
      return undefined;
    },

    async enable(viewerRef, { signal } = {}) {
      viewer = viewerRef ?? viewer;
      const enableGeneration = generation;
      if (!isEnabled() && refreshAvailability) {
        // The operator may have enabled local storage since page load —
        // re-probe the local server once before declaring the layer off.
        try {
          await refreshAvailability();
        } catch {
          /* probe failure keeps the conservative answer */
        }
      }
      if (!isEnabled()) {
        error = LOCAL_BUILDINGS_DISABLED_REASON;
        throw new Error(LOCAL_BUILDINGS_DISABLED_REASON);
      }
      error = null;
      loading = true;
      try {
        if (!trackedTileset()) {
          const created = await createTileset();
          signal?.throwIfAborted();
          if (generation !== enableGeneration) {
            // Owner tore down while creation was in flight: discard it rather
            // than publishing into a dead scene.
            if (created && typeof created.destroy === 'function')
              created.destroy();
            return false;
          }
          if (!created) throw new Error(LOCAL_BUILDINGS_DISABLED_REASON);
          tileset = created;
          lastUpdate = Date.now();
        }
        const tracked = trackedTileset();
        const primitives = viewer?.scene?.primitives;
        if (tracked && primitives && !primitives.contains(tracked)) {
          primitives.add(tracked);
        }
        // The operator may have flown in from a global view while the layer
        // was disabled; apply the policy before the first frame is drawn.
        applyVisibilityPolicy();
        enabled = true;
        return true;
      } catch (cause) {
        error =
          cause instanceof Error
            ? cause.message
            : String(cause ?? 'enable failed');
        enabled = false;
        throw cause instanceof Error ? cause : new Error(error);
      } finally {
        loading = false;
      }
    },

    async disable() {
      const tracked = trackedTileset();
      const primitives = viewer?.scene?.primitives;
      if (tracked && primitives && primitives.contains(tracked)) {
        primitives.remove(tracked);
      }
      enabled = false;
      lastUpdate = Date.now();
      return true;
    },

    async update() {
      applyVisibilityPolicy();
      return enabled;
    },

    getStats() {
      const tracked = trackedTileset();
      return {
        // null while never created (or the tileset carries no extras) — the
        // panel shows the provenance line either way, never a fake count.
        count: tracked ? countFrom(tracked) : null,
        ...heightProvenance(tracked?.extras),
        lastUpdate,
        error,
        loading,
        attribution: LOCAL_BUILDINGS_ATTRIBUTION_HTML,
      };
    },

    getAnalystRecords() {
      return [];
    },

    async destroy() {
      generation += 1;
      const tracked = trackedTileset();
      const primitives = viewer?.scene?.primitives;
      if (tracked && primitives && primitives.contains(tracked)) {
        primitives.remove(tracked);
      }
      if (tracked && typeof tracked.destroy === 'function') {
        tracked.destroy();
      }
      tileset = null;
      enabled = false;
      lastUpdate = Date.now();
      viewer = null;
      return true;
    },
  };
}
