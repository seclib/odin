/** Filter entities by spatial containment within an area. */

import { defineTool, ToolError } from '../catalog.js';
import { AREA_SCHEMA, areaContains, resolveArea, areaCenter } from '../area.js';
import { LIMIT_SCHEMA, capRows } from '../results.js';

const DEFAULT_LIMIT = 25;

/**
 * Filter entities by spatial containment within an area.
 * Uses areaContains which checks both bounding box and great-circle distance.
 */
export const filterArea = defineTool({
  name: 'filter_area',
  title: 'Filtrer par aire',
  description:
    'Retourne les entités géographiques qui se trouvent à l\'intérieur d\'une aire donnée.',
  inputSchema: {
    type: 'object',
    properties: {
      area: AREA_SCHEMA,
      features: {
        type: 'array',
        description:
          'Liste d\'entités à filtrer. Chaque entité doit posséder des coordonnées lat/lon.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
            callsign: { type: 'string' },
            registration: { type: 'string' },
            mag: { type: 'number' },
            altitude_m: { type: 'number' },
            frp_mw: { type: 'number' },
            magnitude: { type: 'number' },
          },
          required: ['lat', 'lon'],
          additionalProperties: true,
        },
        default: [],
      },
      limit: LIMIT_SCHEMA,
    },
    additionalProperties: false,
    required: ['area'],
  },
  requires: [],
  async run(args, { services, signal }) {
    if (!args.area) {
      throw new ToolError('invalid_arguments', 'area is required');
    }

    const resolvedArea = await resolveArea(args.area, { services, signal });
    if (signal?.aborted) throw new ToolError('cancelled', 'Query cancelled');
    const center = areaCenter(resolvedArea);

    let features = args.features || [];
    if (!Array.isArray(features)) {
      features = [];
    }

    // Filter by containment: areaChecks bounding box + great-circle distance
    const filtered = features.filter((feature) => {
      if (!feature.lat || !feature.lon) return false;
      return areaContains(resolvedArea, { lat: feature.lat, lon: feature.lon });
    });

    // Total number of input features (for reporting)
    const totalFeatures = features.length;

    // Apply limit
    const limited = capRows(filtered, args.limit ?? 25);

    // Determine supported geometry types based on retained rows
    const geometryTypesSupported = [
      'Point',
      'MultiPoint',
      'LineString',
      'MultiLineString',
      'Polygon',
      'MultiPolygon',
    ].filter((type) => {
      return limited.rows.some(
        (row) =>
          row.id !== undefined || (row.lat !== undefined && typeof row.lat === 'number')
      );
    });

    // Build limitations note
    const limitations = [];
    if (features.length === 0) {
      limitations.push('Aucune entité fournie pour le filtrage');
    }
    if (limited.truncated) {
      limitations.push(
        `Seulement ${limited.returned} sur ${limited.total} entités retournées (limit appliqué)`
      );
    }

    // Build summary
    const noun = limited.rows.length <= 1 ? 'entité' : 'entités';
    const summary = `${limited.rows.length} ${noun} à l'intérieur de ${resolvedArea.label}${
      limited.truncated ? ` (sur ${limited.total} trouvées)` : '.'
    }`;

    // Build view if there are results
    let view;
    if (limited.rows.length > 0) {
      view = {
        type: 'area',
        area: resolvedArea,
        center: { lat: center.lat, lon: center.lon },
        altitudeM: 15_000_000,
        layers: ['aircraft', 'fires', 'earthquakes'],
      };
    }

    // Clean - remove internal _distance_km if present
    const cleanRows = limited.rows.map((row) => {
      const { _distance_km, ...rest } = row;
      return rest;
    });

    return {
      summary,
      data: {
        summary: summary,
        rows: limited.rows,
        total: totalFeatures,
        may_have_more: limited.truncated,
        area: resolvedArea,
        geometry_types_supported: geometryTypesSupported,
        limitations,
        view,
      },
    };
  },
});
