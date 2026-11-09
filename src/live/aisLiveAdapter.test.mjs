import test from "node:test";
import assert from "node:assert/strict";
import { aisObservationToLiveEntity, createAISLiveAdapter } from "./aisLiveAdapter.js";

test("AIS adapter normalizes a simulated AIS row", (t) => {
  const row = {
    mmsi: "123456789",
    lat: 43.3,
    lon: -5.2,
    speed: "12",
    type: "Cargo",
    destination: "Bilbao",
    last_position_epoch: 100,
  };
  const entity = aisObservationToLiveEntity(row, { now: () => 999, source: "ais-sim" });
  assert.ok(entity);
  assert.equal(entity.id, "123456789");
  assert.equal(entity.source, "ais-sim");
  assert.equal(entity.position.lat, 43.3);
  assert.equal(entity.position.lon, -5.2);
  assert.equal(entity.attributes.type, "Cargo");
  assert.equal(entity.receivedAtMs, 999);
});

test("AIS adapter rejects incomplete row", (t) => {
  assert.equal(aisObservationToLiveEntity({ mmsi: "1", lat: 1 }), null);
  assert.equal(aisObservationToLiveEntity(null), null);
});

test("AIS adapter batch deduplicates", (t) => {
  const rows = [
    { mmsi: "1", lat: 0, lon: 0, last_position_epoch: 1.1 },
    { mmsi: "1", lat: 9, lon: 9, last_position_epoch: 20 },
    { mmsi: "2", lat: 2, lon: 2, last_position_epoch: 3 },
  ];
  const adapter = createAISLiveAdapter({ source: "ais", now: () => 10 });
  const entities = adapter.normalizeBatch(rows);
  assert.equal(entities.length, 2);
  const one = entities.find((e) => e.id === "1");
  assert.equal(one.position.lat, 9);
});
