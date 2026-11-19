/**
 * IGN Géoplateforme (Géoservice) imagery providers — France + Réunion.
 *
 * All layers are WMTS EPSG:3857 256×256 tiles ("PM_…" tile matrix sets),
 * served key-less at https://data.geopf.fr/wmts, rate-limited by the
 * Géoplateforme fair-use rules (WMTS imagery is actually NOT rate-limited —
 * "Diffusion d'images tuilées WMTS" is the sole API exempt from the 400 req/s
 * TMS ceiling, see cartes.gouv.fr/aide/limites-d-usage). Every layer is
 * Licence Ouverte 2.0 (Etalab) — attribution to IGN is required.
 *
 * Coverage (verified live 2026-11-17):
 *   - GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2 (PM_0_19, PNG) — Plan IGN, FR+DOM,
 *     vector cartography, free-flow to ~1:19 000 scale vocabulary.
 *   - HR.ORTHOIMAGERY.ORTHOPHOTOS (PM_6_19, JPEG) — BD ORTHO ~20 cm,
     FR+DOM (Réunion confirmed with a real z12 tile).
 *   - ORTHOIMAGERY.ORTHOPHOTOS.BDORTHO (PM_6_18, JPEG) — BD ORTHO 50 cm,
 *     FR+DOM (Réunion confirmed with a real z12 tile).
 *
 * Tiles are fetched by the browser straight from data.geopf.fr — no proxy,
 * no key. Re:Earth/Esri remain untouched.
 * @module maps/ignImagery
 */
import * as Cesium from 'cesium';

/** Géoplateforme WMTS GetCapabilities/GetTile endpoint (no key needed). */
export const IGN_WMTS_URL = 'https://data.geopf.fr/wmts';

export const IGN_PLAN_LAYER = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';
export const IGN_ORTHO_HR_LAYER = 'HR.ORTHOIMAGERY.ORTHOPHOTOS';
export const IGN_BDORTHO_LAYER = 'ORTHOIMAGERY.ORTHOPHOTOS.BDORTHO';
/** LiDAR HD hillshade (MNT, 0,5 m) — Réunion included, EPSG:3857. */
export const IGN_LIDAR_HILLSHADE_LAYER =
  'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW';

export const IGN_ATTRIBUTION_HTML =
  '<a href="https://www.ign.fr" target="_blank" rel="noopener">IGN</a> — Géoplateforme (Licence Ouverte 2.0)';
export const IGN_CREDIT = () => new Cesium.Credit(IGN_ATTRIBUTION_HTML, true);

/**
 * Shared option builder for the Web Mercator ("PM_…") tile matrix sets: all
 * these layers tile exactly like the standard 256px web-mercator grid — the
 * sets only differ by a starting zoom matrix.
 */
function baseOptions({
  layer,
  format,
  tileMatrixSetID,
  maximumLevel,
  minimumLevel,
}) {
  return {
    url: IGN_WMTS_URL,
    format,
    layer,
    style: 'normal',
    tileMatrixSetID,
    maximumLevel,
    minimumLevel,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    rectangle: Cesium.Rectangle.fromDegrees(-180, -85, 180, 85),
    credit: IGN_CREDIT(),
  };
}

/**
 * Plan IGN (France vector cartography) — street names, POIs, admin, natural
 * features. Zoom 0–19 via tile matrix set PM_0_19.
 * Cesium 1.138 WMTS providers have NO static fromUrl — the constructor is
 * synchronous and does not fetch capabilities.
 * @returns {Cesium.WebMapTileServiceImageryProvider}
 */
export function createIgnPlanImagery() {
  return new Cesium.WebMapTileServiceImageryProvider(
    baseOptions({
      layer: IGN_PLAN_LAYER,
      format: 'image/png',
      tileMatrixSetID: 'PM_0_19',
      maximumLevel: 19,
    }),
  );
}

/**
 * BD ORTHO ~20 cm — national imagery (Réunion included). Zoom 6–19,
 * tile matrix set PM_6_19.
 * @returns {Cesium.WebMapTileServiceImageryProvider}
 */
export function createIgnOrthoHrImagery() {
  return new Cesium.WebMapTileServiceImageryProvider(
    baseOptions({
      layer: IGN_ORTHO_HR_LAYER,
      format: 'image/jpeg',
      tileMatrixSetID: 'PM_6_19',
      maximumLevel: 19,
      minimumLevel: 6,
    }),
  );
}

/**
 * BD ORTHO 50 cm — archive mosaic (Réunion included). Zoom 6–18,
 * tile matrix set PM_6_18.
 * @returns {Cesium.WebMapTileServiceImageryProvider}
 */
export function createIgnBdOrthoImagery() {
  return new Cesium.WebMapTileServiceImageryProvider(
    baseOptions({
      layer: IGN_BDORTHO_LAYER,
      format: 'image/jpeg',
      tileMatrixSetID: 'PM_6_18',
      maximumLevel: 18,
      minimumLevel: 6,
    }),
  );
}

/**
 * LiDAR HD hillshade (MNT "estompage") — France incl. Réunion, 0,5 m
 * source. Zoom 0–18 via PM_0_18. A relief visualization over any zone the
 * LiDAR HD program covers; rendered straight from the WMTS with no extra
 * infrastructure.
 * @returns {Cesium.WebMapTileServiceImageryProvider}
 */
export function createIgnLidarHillshadeImagery() {
  return new Cesium.WebMapTileServiceImageryProvider(
    baseOptions({
      layer: IGN_LIDAR_HILLSHADE_LAYER,
      format: 'image/png',
      tileMatrixSetID: 'PM_0_18',
      maximumLevel: 18,
    }),
  );
}
