/** Nearby entities query — returns entities within a given distance of a point or area. */

import { defineTool, ToolError } from '../catalog.js';
import {
  AREA_SCHEMA,
  POINT_SCHEMA,
  distanceKm,
  resolvePoint,
  resolveArea,
  areaCenter,
} from '../area.js';
import { capRows, LIMIT_SCHEMA } from '../results.js';

const DEFAULT_LIMIT = 25;
const MAX_RADIUS_M = 50_000;

/**
 * Returns entities (aircraft, fires, earthquakes) within a given radius
 * of a point or area, sorted by distance from the center.
 *
 * @param {{location?: {lat: number, lon: number}, area?: any, radius_m: number, limit?: number}}
 *   args - Search configuration
 * @param {{services: {aircraft: any, fires: any, earthquakes: any}}} services - Available data services
 * @param {import('node:abortController').AbortSignal} [signal] - Abort signal for cancellation
 * @returns {{summary: string, data: {rows: [], view?: any, may_have_more: boolean}}}
 */
export const near = defineTool({
  name: 'near',
  title: 'Entités voisines',
  description:
    "Retourne les entités (appareils, feux, séismes) à moins d'un rayon donné d'un point ou d'une aire, triés par distance croissante.",
  inputSchema: {
    type: 'object',
    properties: {
      location: POINT_SCHEMA,
      area: AREA_SCHEMA,
      radius_m: {
        type: 'number',
        minimum: 1,
        maximum: MAX_RADIUS_M,
        description:
          'Rayon de recherche en mètres (1 à 50000). Doit être strictement positif.',
      },
      limit: LIMIT_SCHEMA,
    },
    additionalProperties: false,
    required: ['radius_m'],
  },
  requires: ['aircraft', 'fires', 'earthquakes'],
  async run(args, { services, signal }) {
    // Validate exactly one of location or area
    const hasLocation = args.location != null;
    const hasArea = args.area != null;

    if (hasLocation && hasArea) {
      throw new ToolError(
        'invalid_arguments',
        'Provide either location or area, not both.',
      );
    }

    if (!hasLocation && !hasArea) {
      throw new ToolError(
        'invalid_arguments',
        'Provide either location or area.',
      );
    }

    // Validate radius_m is finite and positive
    if (!Number.isFinite(args.radius_m) || args.radius_m <= 0) {
      throw new ToolError(
        'invalid_arguments',
        'radius_m must be a positive number.',
      );
    }

    // Resolve the center point
    let center;
    let useAreaForDistance = false;

    if (hasLocation) {
      center = await resolvePoint(args.location, { services, signal });
      if (signal?.aborted) throw new ToolError('cancelled', 'Query cancelled');
    } else {
      // area provided
      const resolvedArea = await resolveArea(args.area, { services, signal });
      if (signal?.aborted) throw new ToolError('cancelled', 'Query cancelled');
      center = areaCenter(resolvedArea);
      useAreaForDistance = true;
    }

    if (signal?.aborted) throw new ToolError('cancelled', 'Query cancelled');

    // Collect records from available sources
    const radiusKm = args.radius_m / 1000;
    const results = [];

    // Helper to filter records by distance
    const addRecords = async (records) => {
      const filtered = records.filter((record) => {
        if (!record.latitude || !record.longitude) return false;
        const dKm = distanceKm(center, {
          lat: record.latitude,
          lon: record.longitude,
        });
        return dKm <= radiusKm;
      });

      // Sort by distance from center
      filtered.sort((a, b) => {
        const aDist =
          a.latitude && a.longitude
            ? distanceKm(center, { lat: a.latitude, lon: a.longitude })
            : Infinity;
        const bDist =
          b.latitude && b.longitude
            ? distanceKm(center, { lat: b.latitude, lon: b.longitude })
            : Infinity;
        return aDist - bDist;
      });

      results.push(
        ...filtered.map((record) => ({
          ...record,
          _distance_km:
            record.latitude && record.longitude
              ? distanceKm(center, {
                  lat: record.latitude,
                  lon: record.longitude,
                })
              : null,
        })),
      );
    };

    // Collect from aircraft source
    if (services.aircraft) {
      try {
        const snapshot = await services.aircraft.getSnapshot({ signal });
        if (signal?.aborted)
          throw new ToolError('cancelled', 'Query cancelled');
        await addRecords(snapshot.records);
      } catch (error) {
        // Non-fatal: continue with other sources
      }
    }

    // Collect from fires source
    if (services.fires) {
      try {
        const snapshot = await services.fires.getSnapshot({ signal });
        if (signal?.aborted)
          throw new ToolError('cancelled', 'Query cancelled');
        await addRecords(snapshot.fires || []);
      } catch (error) {
        // Non-fatal: continue with other sources
      }
    }

    // Collect from earthquakes source
    if (services.earthquakes) {
      try {
        const snapshot = await services.earthquakes.getSnapshot({ signal });
        if (signal?.aborted)
          throw new ToolError('cancelled', 'Query cancelled');
        await addRecords(snapshot.events || snapshot.records || []);
      } catch (error) {
        // Non-fatal: continue with other sources
      }
    }

    // Sort all results by distance (already sorted per source, but re-sort combined)
    results.sort((a, b) => {
      const da = a._distance_km != null ? a._distance_km : Infinity;
      const db = b._distance_km != null ? b._distance_km : Infinity;
      return da - db;
    });

    // Apply limit
    const limited = capRows(results, args.limit ?? DEFAULT_LIMIT);

    const totalInRadius = results.filter(
      (r) => r._distance_km != null && r._distance_km <= radiusKm,
    ).length;

    // Build summary
    const resultNoun = totalInRadius <= 1 ? 'entité' : 'entités';
    const summary = `${totalInRadius} ${resultNoun} à moins de ${args.radius_m} m du ${
      hasLocation ? 'point' : 'aire'
    }${totalInRadius > 0 ? ' (triés par distance)' : '.'}`;

    // Build view if there are results
    let view;
    if (totalInRadius > 0) {
      view = {
        type: 'point',
        point: {
          lat: center.lat,
          lon: center.lon,
        },
        altitudeM: 15_000_000,
        layers: hasLocation
          ? ['aircraft', 'fires', 'earthquakes']
          : ['aircraft', 'fires', 'earthquakes'],
      };
    }

    // Clean _distance_km from results before returning
    const cleanResults = results.map(({ _distance_km, ...rest }) => rest);

    return {
      summary,
      data: {
        rows: limited.rows,
        total: limited.total,
        may_have_more: limited.truncated,
        searched_radius_m: args.radius_m,
        center: { lat: center.lat, lon: center.lon },
        view,
      },
    };
  },
});
