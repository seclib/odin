import {
  createHybridFill,
  flowSegmentsToRoads,
  resolveRoadMode,
  ROAD_SOURCE_LABELS,
} from './roadModes.js';
import { phaseTiming } from '../../sources/phaseTiming.js';
import { createFlowTileSource } from './flowSource.js';
import { tileToBBox, tilesForBounds } from '../../data/tomtomTiles.js';
import { clipTileLine } from '../../sources/openFreeMap.js';
import { createOpenFreeMapSource } from '../../sources/openFreeMap.js';
import { validTileBounds } from '../../sources/vectorTiles.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';
export { normalizeOverpassRoads } from '../../sources/overpassRoads.js';

const ROAD_DISRUPTIONS_ENDPOINT = '/api/road-disruptions';
const ROAD_DISRUPTIONS_MAX_FEATURES = 2500;
const ROAD_DISRUPTIONS_MAX_BYTES = 4 * 1024 * 1024;

export function validateRoadDisruptionSnapshot(payload, now = Date.now()) {
  if (
    !Array.isArray(payload?.features) ||
    payload.features.length > ROAD_DISRUPTIONS_MAX_FEATURES
  )
    return null;
  if (!Number.isFinite(payload.fetchedAt) || payload.fetchedAt > now + 60_000)
    return null;
  const features = [];
  for (const row of payload.features) {
    const coordinates = Array.isArray(row?.coordinates) ? row.coordinates : [];
    const validCoordinates =
      coordinates.length >= 2 &&
      coordinates.length <= 5000 &&
      coordinates.every(
        (point) =>
          Array.isArray(point) &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]) &&
          Math.abs(point[0]) <= 180 &&
          Math.abs(point[1]) <= 90,
      );
    if (
      !row?.id ||
      !validCoordinates ||
      !Number.isFinite(row.startAt) ||
      !Number.isFinite(row.endAt) ||
      !Number.isFinite(row.updatedAt)
    )
      continue;
    if (row.endAt < now || now - row.updatedAt > 45 * 24 * 60 * 60 * 1000)
      continue;
    features.push({
      id: String(row.id).slice(0, 80),
      route: String(row.route || '').slice(0, 80),
      title: String(row.title || '').slice(0, 240),
      detail: String(row.detail || '').slice(0, 1200),
      municipality: String(row.municipality || '').slice(0, 120),
      direction: String(row.direction || '').slice(0, 80),
      restriction: String(row.restriction || '').slice(0, 300),
      startAt: row.startAt,
      endAt: row.endAt,
      updatedAt: row.updatedAt,
      status: row.startAt > now ? 'scheduled' : 'active',
      coordinates: coordinates.map(([lon, lat]) => [lon, lat]),
    });
  }
  return {
    features,
    fetchedAt: payload.fetchedAt,
    sourceUpdatedAt: Number.isFinite(payload.sourceUpdatedAt)
      ? payload.sourceUpdatedAt
      : null,
    stale: payload.stale === true || now - payload.fetchedAt > 10 * 60 * 1000,
  };
}

export function createRoadDisruptionsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      const response = await fetchImpl(ROAD_DISRUPTIONS_ENDPOINT, {
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok)
        throw new Error(`Road disruptions HTTP ${response.status}`);
      const declaredLength = Number(response.headers?.get?.('content-length'));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > ROAD_DISRUPTIONS_MAX_BYTES
      )
        throw new Error('Road disruptions response exceeds size cap');
      const payload = await readResponseJsonCapped(
        response,
        ROAD_DISRUPTIONS_MAX_BYTES,
        signal,
      );
      if (signal?.aborted) throw signal.reason;
      const snapshot = validateRoadDisruptionSnapshot(payload, now());
      if (!snapshot) throw new Error('Malformed road disruptions response');
      return snapshot;
    },
  };
}

/** Shrink only the detail footprint, centered on the look-at fetch box, to fit 16 tiles. */
export function trafficDetailBounds(box) {
  const center = {
    lat: (box.north + box.south) / 2,
    lon: (box.east + box.west) / 2,
  };
  let detail = { ...box };
  while (tilesForBounds(detail, 14, { maxTiles: 17 }).length > 16) {
    detail = {
      south: center.lat + (detail.south - center.lat) * 0.9,
      north: center.lat + (detail.north - center.lat) * 0.9,
      west: center.lon + (detail.west - center.lon) * 0.9,
      east: center.lon + (detail.east - center.lon) * 0.9,
    };
  }
  return detail;
}

/** Keep coarse roads only outside the detailed tile cores. */
export function outsideDetailTiles(roads, tiles) {
  return roads.flatMap((road) => {
    let lines = [road.coordinates];
    for (const tile of tiles) {
      const box = tileToBBox(tile.z, tile.x, tile.y);
      const regions = [
        { west: -180, east: box.west, south: -85, north: 85 },
        { west: box.east, east: 180, south: -85, north: 85 },
        { west: box.west, east: box.east, south: -85, north: box.south },
        { west: box.west, east: box.east, south: box.north, north: 85 },
      ];
      lines = lines.flatMap((line) =>
        regions.flatMap((region) => clipTileLine(line, region)),
      );
    }
    return lines.map((coordinates) => ({ ...road, coordinates }));
  });
}

/** A classified road failure with a display-safe reason and machine-readable status. */
export class RoadRequestError extends Error {
  constructor(message, { status = null, cause } = {}) {
    super(message, { cause });
    this.name = 'RoadRequestError';
    this.status = status;
  }
}

// AI tool services import this module, so it marks its English with a local
// msg(); the traffic panel translates the message (controls.js).
const msg = (text) => text;

/** Name the road upstream without exposing raw transport errors or missing codes. */
export function roadRequestError(status, cause) {
  const code = Number.isFinite(status) ? status : null;
  const message =
    code === 429
      ? msg('OpenFreeMap tiles rate-limited')
      : code === 504 || cause?.name === 'TimeoutError'
        ? msg('OpenFreeMap tiles timed out')
        : code === null
          ? msg('OpenFreeMap tiles unavailable')
          : `OpenFreeMap tiles unavailable (HTTP ${code})`;
  return Object.assign(new RoadRequestError(message, { status: code, cause }), {
    retryable: cause?.retryable !== false,
    code: cause?.code,
  });
}

/** Supply tile-derived road geometry and flow availability without Overpass queries. */
export function createTrafficSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  tileFetchImpl = (...args) => globalThis.fetch(...args),
  mapTiles = createOpenFreeMapSource({ fetchImpl: tileFetchImpl }),
} = {}) {
  const flow = createFlowTileSource({ fetchImpl });
  const disruptions = createRoadDisruptionsSource({ fetchImpl });
  const api = {
    ...flow,
    getRoadDisruptions: disruptions.getSnapshot,
    prefetch: () => mapTiles.getMetadata().catch(() => {}),
    resetFlowTileCache() {
      flow.resetFlowTileCache();
      mapTiles.clear();
    },
    async requestOsmRoads(
      box,
      { majorOnly = false, signal, onTile, coverage = box.coverage } = {},
    ) {
      if (
        !validTileBounds(box) ||
        box.north - box.south > 10 ||
        box.east - box.west > 10
      )
        throw new TypeError('A bounded road viewport is required');
      if (coverage) {
        try {
          const tileSnapshot = (tile) =>
            onTile?.({
              roads: tile.roads,
              roadSource: 'OpenStreetMap',
              roadMode: 'osm',
            });
          // Start nearest detail tiles before the coarse pass consumes workers.
          const detailJob =
            !majorOnly && coverage.detail.length
              ? mapTiles
                  .fetchBounds(box, {
                    zoom: 14,
                    tiles: coverage.detail,
                    signal,
                    onTile: onTile ? tileSnapshot : undefined,
                  })
                  .catch((error) => {
                    signal?.throwIfAborted();
                    if (
                      error?.name === 'AbortError' ||
                      error?.retryable === false
                    )
                      throw error;
                    return { tiles: [], loadedTiles: [], partial: true };
                  })
              : null;
          const coarseJob = mapTiles.fetchBounds(box, {
            zoom: 12,
            tiles: coverage.coarse,
            signal,
            onTile: majorOnly && onTile ? tileSnapshot : undefined,
          });
          const [detail, coarse] = await Promise.all([detailJob, coarseJob]);
          signal?.throwIfAborted();
          let roads = coarse.tiles.flatMap((tile) => tile.roads),
            partial = coarse.partial;
          if (detail) {
            roads = [
              ...detail.tiles.flatMap((tile) => tile.roads),
              ...outsideDetailTiles(
                roads,
                detail.loadedTiles || (detail.partial ? [] : coverage.detail),
              ),
            ];
            partial ||= detail.partial;
          }
          const data = {
            roads,
            roadSource: 'OpenStreetMap',
            roadMode: 'osm',
            partial,
            detailLimited: false,
            replace: true,
          };
          if (!majorOnly) onTile?.(data);
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => data,
          };
        } catch (error) {
          signal?.throwIfAborted();
          if (error?.name === 'AbortError') throw error;
          throw roadRequestError(error?.status, error);
        }
      }
      const area = majorOnly ? box : trafficDetailBounds(box);
      const snapshot = (tiles, partial = false) => ({
        roads: tiles
          .flatMap((tile) => tile.roads)
          .flatMap((road) =>
            clipTileLine(road.coordinates, area).map((coordinates) => ({
              ...road,
              coordinates,
            })),
          ),
        roadSource: 'OpenStreetMap',
        roadMode: 'osm',
        partial,
        detailLimited:
          !majorOnly && (area.north !== box.north || area.east !== box.east),
        detailBounds: majorOnly ? null : area,
      });
      let result;
      try {
        result = await mapTiles.fetchBounds(area, {
          zoom: majorOnly ? 12 : 14,
          signal,
          onTile: onTile ? (tile) => onTile(snapshot([tile])) : undefined,
        });
      } catch (error) {
        signal?.throwIfAborted();
        if (error?.name === 'AbortError') throw error;
        throw roadRequestError(error?.status, error);
      }
      const data = snapshot(result.tiles, result.partial);
      signal?.throwIfAborted();
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return data;
        },
      };
    },
    async getStatus({ signal } = {}) {
      const start = performance.now();
      const timeout = AbortSignal.timeout(8000);
      const response = await fetchImpl('/api/tomtom/status', {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok)
        throw Object.assign(new Error('TomTom status unavailable'), {
          status: Number.isFinite(response.status) ? response.status : null,
        });
      const status = await response.json();
      signal?.throwIfAborted();
      if (typeof status?.hasKey !== 'boolean')
        throw new Error('Malformed traffic status');
      phaseTiming('status', start);
      return status;
    },
  };
  /**
   * Request roads for the selected road source.
   *
   * `osm` streams OpenFreeMap tiles exactly as before. `tomtom` and `hybrid`
   * wait for the flow snapshot the layer started alongside road acquisition;
   * OpenFreeMap tiles stream meanwhile (Hybrid) and are drawn unfiltered until
   * flow arrives, then one replacing snapshot swaps in TomTom lines and drops
   * the duplicated OpenFreeMap stretches. Later tiles publish only their own
   * fill, so parsing stays incremental. TomTom never requests OpenFreeMap
   * unless the missing key forces the OpenStreetMap fallback.
   *
   * @param {{south:number, west:number, north:number, east:number}} box
   * @param {Object} [options]
   * @param {'tomtom'|'osm'|'hybrid'|null} [options.roadMode] - Requested mode (null = default).
   * @param {Promise<{segments:Array, hasKey:boolean, error?:string, partial?:boolean}>} [options.flowSnapshot]
   * @param {() => boolean} [options.liveModeHint] - Key state if the snapshot misses the pass deadline.
   * @param {number} [options.timeoutSec=20] - Pass deadline, also bounding the snapshot wait.
   * @param {(data:Object) => void} [options.onTile] - Incremental snapshots; `replace` resets.
   */
  api.requestRoads = async (
    box,
    {
      roadMode = null,
      flowSnapshot,
      liveModeHint = () => false,
      onTile,
      ...options
    } = {},
  ) => {
    if (
      !validTileBounds(box) ||
      box.north - box.south > 10 ||
      box.east - box.west > 10
    )
      throw new TypeError('A bounded road viewport is required');
    if (roadMode === 'osm' || !flowSnapshot)
      return api.requestOsmRoads(box, { ...options, onTile });
    const signal = options.signal;
    const osm = [];
    let live = null,
      mode = null,
      metadata = {},
      osmError = null,
      tomtom = [],
      fillFor = null;
    const fillMemo = new Map();
    const fill = (roads) =>
      mode === 'hybrid'
        ? roads.flatMap((road) => {
            if (!fillMemo.has(road)) fillMemo.set(road, fillFor(road));
            return fillMemo.get(road);
          })
        : roads;
    // Hybrid without any TomTom line (flow failed, or none here) draws only
    // OpenStreetMap roads, and says so.
    const source = () =>
      !mode || (mode === 'hybrid' && !tomtom.length)
        ? ROAD_SOURCE_LABELS.osm
        : ROAD_SOURCE_LABELS[mode];
    const snapshot = (roads, replace) => ({
      ...metadata,
      roads,
      roadSource: source(),
      roadMode: mode,
      replace,
      partial: Boolean(metadata.partial || osmError || live?.partial),
      roadWarning: osmError && mode !== 'osm' ? osmError.message : null,
    });
    const publish = (roads, replace = false) => {
      if (!signal?.aborted) onTile?.(snapshot(roads, replace));
    };
    const composed = () =>
      mode === 'tomtom' ? tomtom : [...tomtom, ...fill(osm)];
    const loadOsm = async () => {
      try {
        const response = await api.requestOsmRoads(box, {
          ...options,
          onTile: (data) => {
            if (data.replace) osm.splice(0, osm.length, ...data.roads);
            else osm.push(...data.roads);
            metadata = { ...data, roads: undefined };
            // Before flow settles the tile is drawn as plain OpenStreetMap.
            publish(
              data.replace ? composed() : fill(data.roads),
              Boolean(data.replace),
            );
          },
        });
        const data = await response.json();
        metadata = { ...data, roads: undefined };
        // Every tile streams through onTile; adopt the final list if not.
        if (osm.length !== data.roads.length)
          osm.splice(0, osm.length, ...data.roads);
      } catch (error) {
        if (error?.name === 'AbortError' || signal?.aborted) throw error;
        osmError = error;
      }
    };
    const osmJob = roadMode === 'tomtom' ? null : loadOsm();
    osmJob?.catch(() => {});
    // The snapshot waits on the status probe and flow tiles; never let it
    // hold the road pass past its own deadline. A late snapshot counts as a
    // flow failure: TomTom mode reports it, Hybrid falls back to OSM roads.
    let deadline;
    live = await Promise.race([
      flowSnapshot,
      new Promise((resolve) => {
        deadline = setTimeout(
          () =>
            resolve({
              segments: [],
              hasKey: Boolean(liveModeHint()),
              error: 'TomTom flow timed out',
            }),
          (options.timeoutSec ?? 20) * 1000,
        );
      }),
    ]).finally(() => clearTimeout(deadline));
    signal?.throwIfAborted();
    if (!live)
      throw new TypeError(
        'Road selection requires a flow availability snapshot',
      );
    mode = resolveRoadMode(roadMode, live.hasKey);
    if (mode === 'tomtom' && live.error) throw new RoadRequestError(live.error);
    if (mode !== 'osm') {
      tomtom = flowSegmentsToRoads(live.segments);
      fillFor = createHybridFill(live.segments);
      publish(composed(), true);
    }
    if (osmJob) await osmJob;
    else if (mode === 'osm') await loadOsm();
    signal?.throwIfAborted();
    if (osmError && (mode === 'osm' || !tomtom.length)) throw osmError;
    const data = snapshot(composed(), true);
    publish(data.roads, true);
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => data,
    };
  };
  return api;
}
