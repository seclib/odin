// ODIN — Module Cameras : couche Cesium pour les sources géolocalisées.
//
// Cette couche est légère : elle positionne des entités billboard Cesium pour
// les sources du catalogue qui possèdent des coordonnées vérifiées, et expose
// un état de sélection pour la fiche détaillée. Elle ne charge aucun flux
// vidéo et ne modifie pas le comportement des couches existantes.
//
// Les sources sans coordonnées vérifiées restent consultables dans le
// catalogue mais ne sont pas positionnées sur la carte.
//
// Le cycle de vie est celui du gestionnaire de couches ODIN : init/enable/
// disable/update + getStats. Aucune actualisation périodique n'est armée
// (updateInterval = 0) : le catalogue est statique par nature.

import * as Cesium from 'cesium';
import {
  CAMERAS_LAYER_ID,
  CAMERA_SYMBOL,
  CAMERA_SYMBOL_SIZE,
  CAMERA_PIN_COLOR,
  CAMERA_PIN_DISABLED_COLOR,
  CAMERA_PIN_HEIGHT_M,
  CAMERA_MAP_AVAILABLE_STATUSES,
} from './policy.js';

/** Construit une couche caméra utilisant les services de l'application. */
export function createCamerasLayer({ services, source }) {
  if (
    !['getCatalog', 'getSourceById', 'hasVerifiedCoordinates'].every(
      (key) => typeof source?.[key] === 'function',
    )
  )
    throw new TypeError('A camera source is required');

  const layerState = {};
  layerState._viewer = null;
  layerState._enabled = false;
  layerState._initialized = false;
  layerState._entities = [];
  layerState._entityBySourceId = new Map();
  layerState._selectedSourceId = null;
  layerState._listeners = new Set();

  /** Construit le descripteur HTML de l'entité (infobulle Cesium). */
  function buildDescription(sourceEntry) {
    const okColor = '#00d4aa';
    const warnColor = '#ffaa00';
    const status = (label, value, tone) =>
      `<span style="color:${tone}">${label}:</span> <span style="color:#e6e9ef">${value}</span>`;
    const coords =
      typeof sourceEntry.latitude === 'number' &&
      typeof sourceEntry.longitude === 'number'
        ? `${sourceEntry.latitude.toFixed(4)}, ${sourceEntry.longitude.toFixed(4)}`
        : 'Non géolocalisée';
    return `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.4;min-width:240px;">
        <div style="color:#00d4aa;font-weight:600;margin-bottom:4px;">${escapeHtml(sourceEntry.name)}</div>
        <div style="color:#8fcfff;margin-bottom:2px;">${escapeHtml(sourceEntry.operator)}</div>
        <div style="color:#9fb2c8;margin-bottom:2px;">${escapeHtml(sourceEntry.category)} · ${escapeHtml(sourceEntry.region)}</div>
        <div style="color:#9fb2c8;margin-bottom:2px;">${coords}</div>
        <div style="color:#9fb2c8;margin-bottom:2px;">${status('Statut juridique', sourceEntry.legalStatus, okColor)}</div>
        <div style="color:#9fb2c8;margin-bottom:2px;">${status('Statut technique', sourceEntry.technicalStatus, warnColor)}</div>
        ${sourceEntry.sourceUrl
          ? `<div style="margin-top:6px;"><a href="${escapeHtml(sourceEntry.sourceUrl)}" target="_blank" rel="noopener" style="color:#78caff;">Page officielle</a></div>`
          : ''}
      </div>
    `;
  }

  /** Échappe le HTML pour éviter les injections dans l'infobulle. */
  function escapeHtml(text) {
    return String(text ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  /** Construit (ou met à jour) l'entité billboard d'une source géolocalisée. */
  function upsertEntity(viewer, sourceEntry) {
    const existing = layerState._entityBySourceId.get(sourceEntry.id);
    const position = Cesium.Cartesian3.fromDegrees(
      sourceEntry.longitude,
      sourceEntry.latitude,
      CAMERA_PIN_HEIGHT_M,
    );
    const isAvailable = CAMERA_MAP_AVAILABLE_STATUSES.includes(
      sourceEntry.technicalStatus,
    );
    const color =
      layerState._enabled && isAvailable
        ? CAMERA_PIN_COLOR
        : CAMERA_PIN_DISABLED_COLOR;

    if (existing) {
      existing.position = position;
      existing.billboard.image = CAMERA_SYMBOL;
      existing.billboard.width = CAMERA_SYMBOL_SIZE;
      existing.billboard.height = CAMERA_SYMBOL_SIZE;
      existing.billboard.color = Cesium.Color.fromCssColorString(color);
      existing.show = layerState._enabled && isAvailable;
      return existing;
    }

    const entity = viewer.entities.add({
      id: `camera-${sourceEntry.id}`,
      name: sourceEntry.name,
      position,
      billboard: {
        image: CAMERA_SYMBOL,
        width: CAMERA_SYMBOL_SIZE,
        height: CAMERA_SYMBOL_SIZE,
        color: Cesium.Color.fromCssColorString(color),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1.0, 1e7, 0.2),
      },
      description: buildDescription(sourceEntry),
      show: layerState._enabled && isAvailable,
    });
    layerState._entities.push(entity);
    layerState._entityBySourceId.set(sourceEntry.id, entity);
    return entity;
  }

  /** Supprime l'entité d'une source. */
  function removeEntity(sourceId) {
    const entity = layerState._entityBySourceId.get(sourceId);
    if (entity && layerState._viewer && !entity.isDestroyed) {
      layerState._viewer.entities.remove(entity);
    }
    layerState._entityBySourceId.delete(sourceId);
    layerState._entities = layerState._entities.filter(
      (e) => e.id !== `camera-${sourceId}`,
    );
  }

  /** Reconstruit toutes les entités depuis le catalogue. */
  function rebuildEntities() {
    if (!layerState._viewer) return;
    for (const sourceId of [...layerState._entityBySourceId.keys()]) {
      removeEntity(sourceId);
    }
    for (const entry of source.getCatalog()) {
      if (source.hasVerifiedCoordinates(entry)) {
        upsertEntity(layerState._viewer, entry);
      }
    }
    refreshVisibility();
  }

  /** Applique la visibilité selon l'état de la couche et le catalogue. */
  function refreshVisibility() {
    for (const entity of layerState._entities) {
      if (entity.isDestroyed) continue;
      const sourceEntry = source.getSourceById(
        String(entity.id).replace(/^camera-/, ''),
      );
      const isAvailable = sourceEntry
        ? CAMERA_MAP_AVAILABLE_STATUSES.includes(sourceEntry.technicalStatus)
        : false;
      entity.show =
        layerState._enabled && sourceEntry?.enabled !== false && isAvailable;
    }
  }

  /** Sélectionne une source et notifie les écouteurs. */
  function selectSource(sourceId) {
    layerState._selectedSourceId = sourceId;
    notifySelection({ sourceId, source: source.getSourceById(sourceId) });
  }

  /** Déselectionne toute source. */
  function clearSelection() {
    layerState._selectedSourceId = null;
    notifySelection({ sourceId: null, source: null });
  }

  function notifySelection(change) {
    for (const listener of [...layerState._listeners]) {
      try {
        listener(change);
      } catch {
        /* listener failure must not break selection */
      }
    }
  }

  // ── Cycle de vie attendu par le gestionnaire de couches ───────────────────

  /** Initialise la couche (appelée à la première activation). */
  function init(viewer) {
    layerState._viewer = viewer;
    layerState._initialized = true;
    rebuildEntities();
    return true;
  }

  /** Active la couche. */
  function enable() {
    layerState._enabled = true;
    refreshVisibility();
    return true;
  }

  /** Désactive la couche. */
  function disable() {
    layerState._enabled = false;
    refreshVisibility();
    return true;
  }

  /** Actualise la couche (recharge le catalogue). */
  function update() {
    rebuildEntities();
    return true;
  }

  /** Statistiques présentées dans le panneau de couches. */
  function getStats() {
    const catalog = source.getCatalog();
    const mapped = catalog.filter((entry) =>
      source.hasVerifiedCoordinates(entry),
    ).length;
    return {
      count: catalog.length,
      countLabel: `${mapped} / ${catalog.length} géolocalisées`,
      lastUpdate: null,
      loading: false,
    };
  }

  /** Libère les ressources (appelé à la destruction). */
  function destroy() {
    if (layerState._viewer) {
      for (const sourceId of [...layerState._entityBySourceId.keys()]) {
        removeEntity(sourceId);
      }
      layerState._viewer = null;
    }
    layerState._initialized = false;
  }

  return {
    id: CAMERAS_LAYER_ID,
    name: 'Cameras',
    icon: CAMERA_SYMBOL,
    source: 'Catalogue Caméras',
    init,
    enable,
    disable,
    update,
    destroy,
    getStats,
    // API de sélection (panneau / carte).
    selectSource,
    clearSelection,
    getSelectedSourceId: () => layerState._selectedSourceId,
    onSelectionChange(listener) {
      layerState._listeners.add(listener);
      return () => layerState._listeners.delete(listener);
    },
    // Compatibilité avec les appelants directs.
    isEnabled: () => layerState._enabled,
    reloadCatalog: rebuildEntities,
    getSource: () => source,
  };
}
