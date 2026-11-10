import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialJoin } from './spatialJoin.js';
import { GeometryType } from './geometry.js';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const LYON = { lat: 45.7640, lon: 4.8357 };

test('spatialJoin: Point-to-point intersects', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.type, 'FeatureCollection');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
  assert.deepStrictEqual(result.features[0].geometry, { type: 'Point', coordinates: [-97, 30] });
  assert.deepStrictEqual(result.features[0].properties, { name: 'Paris' });
});

test('spatialJoin: Point-to-point intersects with different coordinates', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-100, 40] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Empty collection A', () => {
  const result = spatialJoin(
    { type: 'FeatureCollection', features: [] },
    { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'f1', geometry: { type: 'Point', coordinates: [-97, 30] }, properties: {} }] },
    'intersects'
  );
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Empty collection B', () => {
  const result = spatialJoin(
    { type: 'Feature', id: 'f1', geometry: { type: 'Point', coordinates: [-97, 30] }, properties: {} },
    { type: 'FeatureCollection', features: [] },
    'intersects'
  );
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Polygon within predicate (contains)', () => {
  // BoxA is larger, BoxB is smaller and inside BoxA
  // Test: features from collectionA (BigBox) match because BoxB (from collectionB) is within BigBox
  // The 'within' predicate checks if A is within B, so we swap: check if SmallBox within BigBox
  // by swapping collections - features from collectionB should match when SmallBox within BigBox
  const bigBox = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-80, 30], [-80, 50], [-100, 50], [-100, 30]]]] },
      properties: { name: 'BigBox' }
    }]
  };

  const smallBox = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Polygon', coordinates: [[[[-95, 35], [-85, 35], [-85, 45], [-95, 45], [-95, 35]]]] },
      properties: { name: 'SmallBox' }
    }]
  };

  // Check if smallBox is within bigBox using within predicate
  const result = spatialJoin(smallBox, bigBox, 'within');
  // smallBox features should match because SmallBox is within BigBox
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f2');
});

test('spatialJoin: Point in polygon intersects', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-95, 35] },
      properties: { name: 'PointInBox' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]]] },
      properties: { name: 'Box' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Point outside polygon', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-95, 20] },
      properties: { name: 'PointOutside' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]]] },
      properties: { name: 'Box' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Point on polygon vertex intersects', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-100, 30] },
      properties: { name: 'PointOnVertex' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]]] },
      properties: { name: 'Box' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Point on polygon edge intersects', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-95, 30] },
      properties: { name: 'PointOnEdge' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]]] },
      properties: { name: 'Box' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Point equals predicate', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'equals');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: No matching features', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-100, 40] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Properties preserved', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris', population: 2000000, elevation: 35 }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features[0].properties.name, 'Paris');
  assert.equal(result.features[0].properties.population, 2000000);
  assert.equal(result.features[0].properties.elevation, 35);
});

test('spatialJoin: Geometries preserved', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.deepStrictEqual(result.features[0].geometry, { type: 'Point', coordinates: [-97, 30] });
});

test('spatialJoin: MultiPoint intersects', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'MultiPoint', coordinates: [[-97, 30], [-100, 40]] },
      properties: { name: 'MPoint' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Unknown predicate returns empty', () => {
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'Paris' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [-97, 30] },
      properties: { name: 'London' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'unknown-predicate');
  assert.equal(result.features.length, 0);
});

test('spatialJoin: Invalid feature skipped gracefully', () => {
  const result = spatialJoin(
    {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'f1', geometry: { type: 'Point', coordinates: [-97, 30] }, properties: {} },
        { id: 'f2', geometry: { type: 'Point', coordinates: [-97, 30] }, properties: {} }, // missing geometry
        { type: 'Feature', id: 'f3', geometry: null, properties: {} }, // null geometry
      ]
    },
    {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'f4', geometry: { type: 'Point', coordinates: [-97, 30] }, properties: {} }
      ]
    },
    'intersects'
  );
  // Only the valid feature f1 should match
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Point in Polygon with extra-nested GeoJSON format', () => {
  // Test with the extra-nested format used in some GeoJSON implementations
  const collectionA = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-95, 35] },
      properties: { name: 'PointInBox' }
    }]
  };

  const collectionB = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'f2',
      // Extra-nested: coordinates = [[[ring]]] instead of [ring]
      geometry: { type: 'Polygon', coordinates: [[[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]]] },
      properties: { name: 'Box' }
    }]
  };

  const result = spatialJoin(collectionA, collectionB, 'intersects');
  assert.equal(result.features.length, 1, 'Point-in-polygon should work with extra-nested GeoJSON format');
  assert.equal(result.features[0].id, 'f1');
});

test('spatialJoin: Supported geometry types', () => {
  // Test all GeometryType values
  const typeChecks = Object.values(GeometryType);
  assert.equal(typeChecks.includes('Point'), true);
  assert.equal(typeChecks.includes('MultiPoint'), true);
  assert.equal(typeChecks.includes('LineString'), true);
  assert.equal(typeChecks.includes('MultiLineString'), true);
  assert.equal(typeChecks.includes('Polygon'), true);
  assert.equal(typeChecks.includes('MultiPolygon'), true);
  assert.equal(typeChecks.includes('GeometryCollection'), true);
});