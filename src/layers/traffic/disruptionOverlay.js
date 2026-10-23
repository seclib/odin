import * as Cesium from 'cesium';
import { viewIntersectsQuebec } from './disruptions.js';

const REFRESH_MS = 5 * 60 * 1000;
const PRUNE_MS = 60 * 1000;
const MAX_STALE_MS = 15 * 60 * 1000;
const SOURCE_CREDIT = Object.freeze({
  key: 'mtmd-quebec-roadworks',
  html: 'Roadworks and closures: <a href="https://www.donneesquebec.ca/recherche/dataset/travaux-routiers" target="_blank" rel="noopener">Québec Ministry of Transport and Sustainable Mobility (CC BY 4.0)</a>',
});

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Draw current and scheduled official Quebec work-zone lines beside traffic flow. */
export function createRoadDisruptionOverlay({
  source,
  services,
  onStatus = () => {},
}) {
  let viewer = null;
  let dataSource = null;
  let request = null;
  let timer = null;
  let cameraRemove = null;
  let enabled = false;
  let inRegion = false;
  let lastUpdate = 0;
  let records = [];
  let freshness = 'unknown';

  const visibleBounds = () => {
    const rectangle = viewer?.camera?.computeViewRectangle?.();
    if (!rectangle) return null;
    const deg = Cesium.Math.toDegrees;
    return {
      west: deg(rectangle.west),
      south: deg(rectangle.south),
      east: deg(rectangle.east),
      north: deg(rectangle.north),
    };
  };

  function render() {
    if (!dataSource) return;
    dataSource.entities.removeAll();
    for (const row of records) {
      const color =
        row.status === 'scheduled' ? Cesium.Color.ORANGE : Cesium.Color.RED;
      const positions = Cesium.Cartesian3.fromDegreesArray(
        row.coordinates.flat(),
      );
      const detail = [
        row.route && `Route ${row.route}`,
        row.municipality,
        row.direction,
        row.restriction,
        row.detail,
        `Valid until ${new Date(row.endAt).toLocaleString()}`,
        `Updated ${new Date(row.updatedAt).toLocaleString()}`,
        'Source: MTMD Quebec / Données Québec (CC BY 4.0)',
      ]
        .filter(Boolean)
        .join('\n');
      dataSource.entities.add({
        id: `mtmd-roadwork:${row.id}`,
        name: row.title,
        description: escapeHtml(detail).replaceAll('\n', '<br>'),
        polyline: {
          positions,
          width: row.status === 'scheduled' ? 3 : 4,
          material: color.withAlpha(0.9),
          clampToGround: true,
        },
      });
    }
  }

  async function refresh(force = false) {
    if (
      !enabled ||
      !inRegion ||
      request ||
      (!force && Date.now() - lastUpdate < REFRESH_MS)
    )
      return false;
    const controller = new AbortController();
    request = controller;
    try {
      const snapshot = await source.getSnapshot({ signal: controller.signal });
      if (controller.signal.aborted || request !== controller || !enabled)
        return false;
      records = snapshot.features.filter((row) => row.endAt >= Date.now());
      lastUpdate = snapshot.fetchedAt;
      freshness = snapshot.stale ? 'stale' : 'fresh';
      render();
      services.credits?.registerDynamicCredit?.(viewer, SOURCE_CREDIT);
      onStatus({
        freshness,
        count: records.length,
        updatedAt: snapshot.sourceUpdatedAt,
      });
      viewer?.scene?.requestRender?.();
      return true;
    } catch {
      if (!controller.signal.aborted && request === controller) {
        if (lastUpdate && Date.now() - lastUpdate > MAX_STALE_MS) {
          records = [];
          dataSource?.entities.removeAll();
        }
        freshness = records.length ? 'stale' : 'unavailable';
        onStatus({
          freshness,
          count: records.length,
          updatedAt: lastUpdate || null,
        });
      }
      return false;
    } finally {
      if (request === controller) request = null;
    }
  }

  function inspectView(force = false) {
    if (!enabled) return;
    inRegion = viewIntersectsQuebec(visibleBounds());
    if (dataSource) dataSource.show = inRegion;
    if (inRegion) void refresh(force);
    else onStatus({ freshness: 'out-of-coverage', count: 0, updatedAt: null });
  }

  return {
    init(nextViewer) {
      viewer = nextViewer;
      dataSource = new Cesium.CustomDataSource('quebec-road-disruptions');
      dataSource.show = false;
      viewer.dataSources?.add?.(dataSource);
    },
    enable() {
      if (enabled) return;
      enabled = true;
      cameraRemove = viewer.camera.changed.addEventListener(() =>
        inspectView(),
      );
      inspectView(true);
      timer = setInterval(() => {
        if (records.some((row) => row.endAt < Date.now())) {
          records = records.filter((row) => row.endAt >= Date.now());
          render();
          viewer?.scene?.requestRender?.();
        }
        if (Date.now() - lastUpdate >= REFRESH_MS) inspectView(true);
      }, PRUNE_MS);
    },
    disable() {
      enabled = false;
      request?.abort();
      request = null;
      if (timer) clearInterval(timer);
      timer = null;
      cameraRemove?.();
      cameraRemove = null;
      inRegion = false;
      if (dataSource) dataSource.show = false;
      onStatus({
        freshness: 'disabled',
        count: records.length,
        updatedAt: lastUpdate || null,
      });
    },
    destroy() {
      this.disable();
      if (viewer && dataSource) viewer.dataSources?.remove?.(dataSource, true);
      dataSource = null;
      viewer = null;
    },
    getStatus() {
      return {
        freshness,
        count: records.length,
        updatedAt: lastUpdate || null,
      };
    },
  };
}
