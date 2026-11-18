/**
 * OpenFreeMap vector basemap rendered straight into Cesium imagery.
 *
 * OpenFreeMap publishes MapLibre-style vector tiles only (no raster), and
 * Cesium has no native MVT imagery provider. Rather than add a MapLibre side
 * panel or pull a full MapLibre-GL dependency, this provider fetches the
 * public OpenFreeMap tiles, decodes them with the two small libraries ODIN
 * already ships (`pbf`, `@mapbox/vector-tile`) and rasterizes a small fixed
 * style set onto a canvas. It is EXPERIMENTAL: the rendering path has unit
 * tests for URL/zoom mapping and decode plumbing, but no automated visual
 * verification in this session — turn it on with `VITE_OPENFREEMAP=1`.
 *
 * Why not MapLibre:
 *   ODIN is a globe (Cesium). A second renderer inside the app would double
 *   GPU pipelines and event paths for one accidental basemap. Cesium remains
 *   the only renderer, per the project's architecture rule.
 *
 * Tiles are fetched straight by the browser from tiles.openfreemap.org — no
 * proxy, no key. Tile coordinates follow the same web-mercator grid as
 * Cesium's WebMercatorTilingScheme.
 *
 * Attribution (required): OpenFreeMap © OpenMapTiles · Data from OpenStreetMap.
 * @module maps/openFreeMapImagery
 */
import * as Cesium from 'cesium';
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

export const OPENFREEMAP_ATTRIBUTION_HTML =
  '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Data © OpenStreetMap contributors</a>';

/** MapLibre-style endpoints: planet MLT vector tiles, z0–14. */
export const OPENFREEMAP_TILES_URL = 'https://tiles.openfreemap.org/planet';

const MAX_LEVEL = 14;
const TILE_SIZE = 256;
const MVT_EXTENT = 4096;

/** Fixed minimal style subset — fills then lines, matching "Liberty" vibes. */
const CANVAS_BG = '#f7f5ef'; // paper/land — non-filled land defaults to this
const FILL_LAYERS = [
  { name: 'landcover', key: 'class', color: '#e8ece2' }, // generic lowland scrub
  { name: 'park', key: 'class', color: '#dce8cf' },
  { name: 'water', key: 'class', color: '#aac6d6' },
  { name: 'waterway', key: 'class', color: '#aac6d6' }, // polygon kind where filled
  { name: 'building', key: 'subclass', color: '#e6e2d8' }, // flat fill
];
const LINE_LAYERS = [
  { name: 'waterway', key: 'class', color: '#8fb6cb', width: 1.2 },
  { name: 'road', key: 'class', color: '#efede6', casing: '#c9c6ba', width: 4 }, // low zoom: majors only
  { name: 'aeroway', key: 'class', color: '#d9d7cd', width: 2 }, // runways / taxiways
];
/** Zoom at/below which minor roads are skipped entirely (label-less planet). */
const ROAD_MIN_ZOOM_FOR_MINOR = 12;
/** Rough line-width scale by class so motorways dominate at low zoom. */
function roadWidth(cls, zoom) {
  const base =
    cls === 'motorway' || cls === 'trunk'
      ? 3
      : cls === 'primary'
        ? 2.4
        : cls === 'secondary' || cls === 'tertiary'
          ? 2
          : 1.4;
  return Math.max(0.6, base * ((zoom - 3) / 10 + 0.6));
}
const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary']);

function emptyTileCanvas() {
  if (typeof document === 'undefined') {
    // Node (tests): return an image-like stub so the provider never crashes.
    return {
      width: TILE_SIZE,
      height: TILE_SIZE,
      getContext: () => null,
    };
  }
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  }
  return canvas;
}

function clipAndTrace(ctx, rings, scale) {
  for (const ring of rings) {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i];
      const x = p.x * scale;
      const y = p.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

function strokePath(ctx, ring, width, color) {
  ctx.beginPath();
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i];
    const x = p.x * (TILE_SIZE / MVT_EXTENT);
    const y = p.y * (TILE_SIZE / MVT_EXTENT);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function renderVectorTile(arrayBuffer, x, y, z) {
  const canvas = emptyTileCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  let tile;
  try {
    tile = new VectorTile(new PbfReader(new Uint8Array(arrayBuffer)));
  } catch {
    return canvas; // corrupt tile → blank land, never throw Cesium
  }

  const scale = TILE_SIZE / MVT_EXTENT;
  const zoom = z;

  // 1) Polygon fills, least-specific first.
  for (const { name, color } of FILL_LAYERS) {
    const layer = tile.layers?.[name];
    if (!layer) continue;
    ctx.fillStyle = color;
    for (let i = 0; i < layer.length; i += 1) {
      const feature = layer.feature(i);
      const geom = feature.loadGeometry();
      if (feature.type !== 3 /* polygon */) continue;
      clipAndTrace(ctx, geom, scale);
      ctx.fill('evenodd');
    }
  }

  // 2) Line work: casing then inner stroke for roads.
  for (const { name, color, casing, width: baseWidth } of LINE_LAYERS) {
    const layer = tile.layers?.[name];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i += 1) {
      const feature = layer.feature(i);
      if (feature.type !== 2 /* lines */) continue;
      const cls = String(
        feature.properties?.class ?? feature.properties?.subclass ?? '',
      );
      if (
        name === 'road' &&
        zoom < ROAD_MIN_ZOOM_FOR_MINOR &&
        !MAJOR_ROADS.has(cls)
      )
        continue; // minor roads unreadable at this zoom — skip them
      const width = name === 'road' ? roadWidth(cls, zoom) : baseWidth;
      const geom = feature.loadGeometry();
      for (const ring of geom) {
        if (casing) strokePath(ctx, ring, width + 1.6, casing);
        strokePath(ctx, ring, width, color);
      }
    }
  }

  return canvas;
}

export class OpenFreeMapImageryProvider {
  /**
   * @param {object} [options]
   * @param {number} [options.maximumLevel]
   */
  constructor(options = {}) {
    // Cesium's ImageryProvider is an interface, not a base class to extend —
    // providers are duck-typed by the layer collection.
    this._maximumLevel = options.maximumLevel ?? MAX_LEVEL;
    this._minimumLevel = 0;
    this._tileWidth = TILE_SIZE;
    this._tileHeight = TILE_SIZE;
    this._tilingScheme = new Cesium.WebMercatorTilingScheme();
    this._rectangle = Cesium.Rectangle.fromDegrees(-180, -85, 180, 85);
    this._credit = new Cesium.Credit(OPENFREEMAP_ATTRIBUTION_HTML, false);
    this._errorEvent = new Cesium.Event();
    this._tileDiscardPolicy = undefined;
    this._proxy = undefined;
    this._hasAlphaChannel = true;
  }

  get rectangle() { return this._rectangle; }
  get tileWidth() { return this._tileWidth; }
  get tileHeight() { return this._tileHeight; }
  get maximumLevel() { return this._maximumLevel; }
  get minimumLevel() { return this._minimumLevel; }
  get tilingScheme() { return this._tilingScheme; }
  get tileDiscardPolicy() { return this._tileDiscardPolicy; }
  get proxy() { return this._proxy; }
  get errorEvent() { return this._errorEvent; }
  get credit() { return this._credit; }
  get hasAlphaChannel() { return this._hasAlphaChannel; }

  getTileCredits() {
    return [this._credit];
  }

  /**
   * Fetch + decode + rasterize one tile. Returns a canvas (Cesium accepts
   * canvases as imagery). A failed tile renders the empty land canvas instead
   * of throwing — the globe must never blank because one PBF hiccuped.
   */
  requestImage(x, y, level) {
    const url = `${OPENFREEMAP_TILES_URL}/${level}/${x}/${y}.pbf`;
    if (typeof fetch !== 'function') return Promise.resolve(emptyTileCanvas());
    return fetch(url, { method: 'GET' })
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((buffer) =>
        buffer ? renderVectorTile(buffer, x, y, level) : emptyTileCanvas(),
      )
      .catch((error) => {
        if (typeof console !== 'undefined')
          console.warn('[openFreeMap] tile failed', url, error?.message);
        if (this._errorEvent)
          this._errorEvent.raiseEvent(
            new Cesium.TileProviderError(this, 'OpenFreeMap tile failed', x, y, level, 0, error),
          );
        return emptyTileCanvas();
      });
  }
}

/** Feature-flagged factory used by createDefaultMapSources. */
export function createOpenFreeMapImagery() {
  const enabled =
    typeof import.meta !== 'undefined' &&
    Boolean(import.meta.env && import.meta.env.VITE_OPENFREEMAP === '1');
  if (!enabled) {
    return null; // caller treats null as "provider unavailable" with reason
  }
  return new OpenFreeMapImageryProvider();
}

/** Reason string surfaced in the UI when the provider is not enabled. */
export const OPENFREEMAP_EXPERIMENTAL_REASON =
  'OpenFreeMap is experimental (MVT rasterization unverified) — set VITE_OPENFREEMAP=1 to enable';
