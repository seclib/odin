const REST_TILE_PATH =
  'https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{extension}';
const CATALOG_URL = 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars';

/** NASA Mars Trek public WMTS source for the global MGS MOLA shaded map. */
export const MARS_MOLA_GLOBAL = Object.freeze({
  id: 'mars-mgs-mola-global-463m',
  attribution: 'NASA/USGS MOLA · NASA Mars Trek WMTS',
  resolution: '463 m/pixel (catalog layer identifier)',
  projection: 'EPSG:104905 equirectangular',
  access: 'public, keyless WMTS',
  reuse: 'NASA/USGS MOLA data; retain provider attribution',
  catalogUrl: CATALOG_URL,
  capabilitiesUrl:
    'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml',
  layer: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
  style: 'default',
  tileMatrixSet: 'default028mm',
  tileMatrixLabels: Object.freeze(['0', '1', '2', '3', '4', '5', '6', '7']),
  format: 'image/jpeg',
  extension: 'jpg',
  tileWidth: 256,
  tileHeight: 256,
  maximumLevel: 7,
});

/** NASA Mars Trek MGS MOC global color atlas, distinct from shaded relief. */
export const MARS_MOC_GLOBAL = Object.freeze({
  id: 'mars-mgs-moc-global-color',
  attribution: 'NASA MGS MOC · NASA Mars Trek WMTS',
  resolution: 'Not specified in the reviewed layer metadata',
  projection: 'EPSG:104905 equirectangular',
  access: 'public, keyless WMTS',
  reuse:
    'NASA-led mission data; check per-product notices and retain attribution',
  catalogUrl: CATALOG_URL,
  capabilitiesUrl:
    'https://trek.nasa.gov/tiles/Mars/EQ/msss_atlas_simp_clon/1.0.0/WMTSCapabilities.xml',
  layer: 'msss_atlas_simp_clon',
  style: 'default',
  tileMatrixSet: 'default028mm',
  tileMatrixLabels: Object.freeze(['0', '1', '2', '3', '4', '5', '6']),
  format: 'image/png',
  extension: 'png',
  tileWidth: 256,
  tileHeight: 256,
  maximumLevel: 6,
});

export const MARS_MAP_SOURCES = Object.freeze([
  MARS_MOLA_GLOBAL,
  MARS_MOC_GLOBAL,
]);

/** Get a configured map source; unknown ids are a deliberate data miss. */
export function getMarsMapSource(id = MARS_MOLA_GLOBAL.id) {
  return MARS_MAP_SOURCES.find((source) => source.id === id) ?? null;
}

/** RESTful path template; avoids the WMTS KVP route that lacks browser CORS. */
export function getMarsMapTileUrlTemplate(source) {
  if (!MARS_MAP_SOURCES.includes(source))
    throw new TypeError('A known NASA Mars Trek layer is required');
  return REST_TILE_PATH.replace('{layer}', source.layer)
    .replace('{style}', source.style)
    .replace('{extension}', source.extension);
}
