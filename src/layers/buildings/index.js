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

/** GMLFP conversion emits featureCount/claims in the tileset's extras. */
function countFrom(tileset) {
  const count = Number(tileset?.extras?.featureCount);
  return Number.isFinite(count) && count >= 0 ? count : null;
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

  const inScene = (candidate) =>
    Boolean(viewer?.scene?.primitives?.contains?.(candidate));

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

    async enable(viewerRef) {
      viewer = viewerRef ?? viewer;
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
        if (!tileset) {
          const created = await createTileset();
          if (!created) throw new Error(LOCAL_BUILDINGS_DISABLED_REASON);
          tileset = created;
          lastUpdate = Date.now();
        }
        const primitives = viewer?.scene?.primitives;
        if (primitives && !primitives.contains(tileset)) {
          primitives.add(tileset);
        }
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
      const primitives = viewer?.scene?.primitives;
      if (primitives && tileset && primitives.contains(tileset)) {
        primitives.remove(tileset);
      }
      enabled = false;
      lastUpdate = Date.now();
      return true;
    },

    async update() {
      return enabled;
    },

    getStats() {
      return {
        // null while never created (or the tileset carries no extras) — the
        // panel shows the provenance line either way, never a fake count.
        count: tileset ? countFrom(tileset) : null,
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
      const primitives = viewer?.scene?.primitives;
      if (primitives && tileset && primitives.contains(tileset)) {
        primitives.remove(tileset);
      }
      if (tileset && typeof tileset.destroy === 'function') {
        tileset.destroy();
      }
      tileset = null;
      enabled = false;
      lastUpdate = Date.now();
      viewer = null;
      return true;
    },
  };
}
