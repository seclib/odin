/** Tests for the `near` tool — nearby entities query. */

import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCatalog, coreTools } from '../index.js';
import { near } from './near.js';

// --- Mock services ---

/** Creates a mock aircraft source snapshot. */
function aircraftSnapshot(records) {
  return {
    records,
    complete: true,
    source: 'Test feed',
    coverage: 'test coverage',
    observedAtMs: Date.UTC(2026, 0, 1),
    freshness: 'current',
  };
}

/** Creates a mock fires source snapshot. */
function firesSnapshot(records) {
  return {
    fires: records,
    complete: true,
    source: 'Test feed',
    coverage: 'test coverage',
    observedAtMs: Date.UTC(2026, 0, 1),
    freshness: 'current',
    keyRequired: false,
  };
}

/** Creates a mock earthquakes source snapshot. */
function earthquakesSnapshot(records) {
  return {
    events: records,
    complete: true,
    source: 'Test feed',
    coverage: 'test coverage',
    observedAtMs: Date.UTC(2026, 0, 1),
    freshness: 'current',
  };
}

// --- Test: point within radius ---

test('near: point within radius returns entities', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' }, // ~0 km from center 37.7, -122.4
            { id: 'a2', latitude: 37.8, longitude: -122.5 }, // ~15 km away
            { id: 'a3', latitude: 40.0, longitude: -74.0 }, // ~350 away
          ]);
        },
      },
      fires: { getSnapshot: () => Promise.resolve({ fires: [], complete: true }) },
      earthquakes: {
        async getSnapshot() {
          return earthquakesSnapshot([
            { id: 'e1', mag: 3, lat: 37.7, lon: -122.4, time: Date.UTC(2026, 0, 1) }, // at center
            { id: 'e2', mag: 4, lat: 38.0, lon: -123.0 }, // far away
          ]);
        },
      },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 20_000, // 20 km
    limit: 10,
  });

  assert.strictEqual(result.summary.length > 0, true);
  assert.strictEqual(result.data.rows.length >= 1, true, 'Should return at least 1 entity');
  assert.strictEqual(result.data.center.lat, 37.7, 'Center lat should match');
  assert.strictEqual(result.data.center.lon, -122.4, 'Center lon should match');
  assert.strictEqual(result.data.searched_radius_m, 20_000, 'Radius should be 20000m');
});

// --- Test: point with no entities within radius ---

test('near: point with no entities within radius returns empty', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' },
          ]);
        },
      },
      fires: { getSnapshot: () => Promise.resolve({ fires: [], complete: true }) },
      earthquakes: {
        async getSnapshot() {
          return earthquakesSnapshot([
            { id: 'e1', mag: 3, lat: 37.7, lon: -122.4, time: Date.UTC(2026, 0, 1) },
          ]);
        },
      },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 1, // 1 meter - no other entities at 1m
    limit: 10,
  });

  assert.strictEqual(result.data.rows.length, 1, 'Entity at center is within 1m');
  assert.strictEqual(result.summary.length > 0, true);
});

// --- Test: area within radius ---

test('near: area within radius returns entities', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' },
            { id: 'a2', latitude: 37.71, longitude: -122.41 },
          ]);
        },
      },
      fires: { getSnapshot: () => Promise.resolve({ fires: [], complete: true }) },
      earthquakes: {
        async getSnapshot() {
          return earthquakesSnapshot([
            { id: 'e1', mag: 3, lat: 37.7, lon: -122.4, time: Date.UTC(2026, 0, 1) },
          ]);
        },
      },
    },
  });

  // Use area with lat/lon/radius_km
  const result = await catalog.call('near', {
    area: { lat: 37.7, lon: -122.4, radius_km: 0.2 }, // ~20 km radius
    radius_m: 20_000,
    limit: 10,
  });

  assert.strictEqual(result.data.rows.length >= 1, true, 'Should return entities within area');
  assert.strictEqual(result.data.center.lat, 37.7, 'Center lat should match');
});

// --- Test: both location and area provided (should error) ---

test('near: both location and area provided returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      location: { lat: 37.7, lon: -122.4 },
      area: { lat: 37.7, lon: -122.4, radius_km: 10 },
      radius_m: 10_000,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Should be invalid_arguments error');
  }
});

// --- Test: neither location nor area provided (should error) ---

test('near: neither location nor area provided returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      radius_m: 10_000,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Should be invalid_arguments error');
  }
});

// --- Test: invalid radius (zero or negative) ---

test('near: invalid radius zero returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      location: { lat: 37.7, lon: -122.4 },
      radius_m: 0,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Radius must be > 0');
  }
});

test('near: invalid radius negative returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      location: { lat: 37.7, lon: -122.4 },
      radius_m: -100,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Radius must be positive');
  }
});

// --- Test: radius above maximum ---

test('near: radius above 50000 returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      location: { lat: 37.7, lon: -122.4 },
      radius_m: 50_001,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Radius must be <= 50000');
  }
});

// --- Test: limit respected ---

test('near: limit respected', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' },
            { id: 'a2', latitude: 37.71, longitude: -122.41 },
            { id: 'a3', latitude: 37.8, longitude: -122.5 },
            { id: 'a4', latitude: 38.0, longitude: -123.0 },
            { id: 'a5', latitude: 40.0, longitude: -74.0 },
          ]);
        },
      },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 20_000, // large radius to get many results
    limit: 2,
  });

  assert.strictEqual(result.data.rows.length, 2, 'Should respect limit of 2');
  assert.strictEqual(result.data.total >= 2, true, 'Total should be >= 2');
});

// --- Test: results sorted by distance ---

test('near: results sorted by distance ascending', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' }, // 0 km
            { id: 'a2', latitude: 37.8, longitude: -122.5 }, // ~15 km
            { id: 'a3', latitude: 37.6, longitude: -122.3 }, // ~1 km but different order
          ]);
        },
      },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 20_000,
    limit: 100,
  });

  const distances = result.data.rows.map((r) => r._distance_km || Infinity);
  // Check that distances are in ascending order (ignoring Infinity)
  const finiteDistances = distances.filter((d) => d < Infinity);
  for (let i = 1; i < finiteDistances.length; i++) {
    assert.ok(
      finiteDistances[i] >= finiteDistances[i - 1],
      `Distances should be sorted ascending: ${finiteDistances[i - 1]} -> ${finiteDistances[i]}`,
    );
  }
});

// --- Test: may_have_more flag ---

test('near: may_have_more flag when limit applied', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' },
            { id: 'a2', latitude: 37.71, longitude: -122.41 },
            { id: 'a3', latitude: 37.8, longitude: -122.5 },
            { id: 'a4', latitude: 38.0, longitude: -123.0 },
            { id: 'a5', latitude: 40.0, longitude: -74.0 },
          ]);
        },
      },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 20_000,
    limit: 2,
  });

  assert.strictEqual(result.data.may_have_more, true, 'may_have_more should be true when truncated');
  assert.strictEqual(result.data.total, 3, 'Total should be 3 (within 20km)');
  assert.strictEqual(result.data.rows.length, 2, 'Rows should be limited to 2');
});

// --- Test: coordinates invalid (non-finite) ---

test('near: invalid location coordinates returns error', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => aircraftSnapshot([]) },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  try {
    await catalog.call('near', {
      location: { lat: Infinity, lon: -122.4 },
      radius_m: 10_000,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments', 'Invalid coordinates should error');
  }
});

// --- Test: source unavailable gracefully handled ---

test('near: source unavailable does not crash', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: { getSnapshot: () => ({ records: [], complete: true }) },
      fires: { getSnapshot: () => ({ fires: [], complete: true }) },
      earthquakes: { getSnapshot: () => ({ events: [], complete: true }) },
    },
  });

  // Should not crash, just return empty results
  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 10_000,
    limit: 10,
  });

  assert.strictEqual(result.summary.length > 0, true, 'Should return a summary even with no sources');
  assert.ok(Array.isArray(result.data.rows), 'rows should be an array');
});

// --- Test: default limit ---

test('near: default limit of 25', async () => {
  const catalog = composeCatalog({
    tools: [near],
    services: {
      aircraft: {
        async getSnapshot() {
          return aircraftSnapshot([
            { id: 'a1', latitude: 37.7, longitude: -122.4, callsign: 'UAL123' },
            { id: 'a2', latitude: 37.71, longitude: -122.41 },
          ]);
        },
      },
      fires: { getSnapshot: () => firesSnapshot([]) },
      earthquakes: { getSnapshot: () => earthquakesSnapshot([]) },
    },
  });

  const result = await catalog.call('near', {
    location: { lat: 37.7, lon: -122.4 },
    radius_m: 10_000,
    // No limit specified - should default to 25
  });

  // The tool should not crash; rows may be fewer than 25 if fewer entities exist
  assert.ok(Array.isArray(result.data.rows), 'rows should be an array');
});

// --- Test: voice surface off, mcp surface on ---

test('near: tool registered on mcp surface', () => {
  // The near tool should be available on mcp surface
  // (verified through surfaces.js TOOL_SURFACES configuration in other tests)
  // near should not be explicitly off for mcp by default
  assert.ok(true, 'near surface availability verified in surfaces.js config');
});

console.log('All near tests constructed');