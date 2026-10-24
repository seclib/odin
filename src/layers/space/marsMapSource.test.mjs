import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarsMapSource,
  getMarsMapTileUrlTemplate,
} from './marsMapSource.js';

test('Mars MOLA WMTS descriptor records public access, coverage and provenance', () => {
  const source = getMarsMapSource();
  assert.equal(source.access, 'public, keyless WMTS');
  assert.match(source.capabilitiesUrl, /WMTSCapabilities\.xml$/);
  assert.equal(source.tileMatrixSet, 'default028mm');
  assert.equal(source.projection, 'EPSG:104905 equirectangular');
  assert.equal(source.format, 'image/jpeg');
  assert.equal(source.maximumLevel, 7);
  assert.deepEqual(source.tileMatrixLabels, [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
  ]);
  assert.match(source.attribution, /NASA\/USGS MOLA/);
  assert.match(source.resolution, /463 m\/pixel/);
  assert.match(
    getMarsMapTileUrlTemplate(source),
    /default\/\{TileMatrixSet\}\/\{TileMatrix\}\/\{TileRow\}\/\{TileCol\}\.jpg$/,
  );
  assert.ok(Object.isFrozen(source));
});

test('NASA MGS MOC mosaic is a separate keyless global color layer with explicit unknown resolution', () => {
  const source = getMarsMapSource('mars-mgs-moc-global-color');
  assert.ok(source);
  assert.equal(source.layer, 'msss_atlas_simp_clon');
  assert.equal(source.access, 'public, keyless WMTS');
  assert.equal(source.format, 'image/png');
  assert.equal(source.maximumLevel, 6);
  assert.equal(
    source.resolution,
    'Not specified in the reviewed layer metadata',
  );
  assert.match(
    getMarsMapTileUrlTemplate(source),
    /msss_atlas_simp_clon.*\.png$/,
  );
  assert.equal(getMarsMapSource('unknown-layer'), null);
});
