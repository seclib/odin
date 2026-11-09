
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLiveEntity,
  compareLiveEntities,
  LIVE_ENTITY_SCHEMA_VERSION,
} from "./liveEntity.js";
import { createLiveEntityStore } from "./liveEntityStore.js";
import { createLiveSourceController } from "./liveSourceController.js";

test("normalizeLiveEntity validates and normalizes", (t) => {
  const now = () => 100;
  const entity = normalizeLiveEntity(
    { id: "a", source: "ais", lat: "1.5", lon: "2.5", timestamp: "2020-01-01T00:00:00Z" },
    { now },
  );
  assert.ok(entity);
  assert.equal(entity.id, "a");
  assert.equal(entity.source, "ais");
  assert.equal(entity.position.lat, 1.5);
  assert.equal(entity.position.lon, 2.5);
  assert.equal(entity.receivedAtMs, 100);
});

test("normalizeLiveEntity rejects invalid data", (t) => {
  assert.equal(normalizeLiveEntity(null), null);
  assert.equal(normalizeLiveEntity({ id: "" }), null);
  assert.equal(normalizeLiveEntity({ id: "a" }), null);
  assert.equal(normalizeLiveEntity({ id: "a", source: "ais", lat: 1000, lon: 0 }), null);
  assert.equal(normalizeLiveEntity({ id: "a", source: "ais", lat: 0, lon: 0, receivedAt: "not-a-date" }), null);
});

test("store updates an entity in place", (t) => {
  const store = createLiveEntityStore({ now: () => 0 });
  const first = store.apply({ id: "a", source: "ais", lat: 0, lon: 0, timestamp: 1 });
  assert.equal(first.applied, true);
  const second = store.apply({ id: "a", source: "ais", lat: 1, lon: 1, timestamp: 2 });
  assert.equal(second.applied, true);
  assert.equal(store.size(), 1);
  assert.equal(store.get("a").position.lat, 1);
});

test("store ignores stale messages", (t) => {
  const store = createLiveEntityStore({ now: () => 0 });
  store.apply({ id: "a", source: "ais", lat: 0, lon: 0, timestamp: 2 });
  const stale = store.apply({ id: "a", source: "ais", lat: 9, lon: 9, timestamp: 1 });
  assert.equal(stale.applied, false);
  assert.equal(stale.reason, "stale");
  assert.equal(store.get("a").position.lat, 0);
});

test("store ignores invalid payload", (t) => {
  const store = createLiveEntityStore({ now: () => 0 });
  const result = store.apply({ id: "a", source: "ais", lat: 999, lon: 0 });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "invalid");
  assert.equal(store.size(), 0);
});

test("store preserves newer equal timestamp update", (t) => {
  const store = createLiveEntityStore({ now: () => 0 });
  store.apply({ id: "a", source: "ais", lat: 0, lon: 0, timestamp: 1 });
  const result = store.apply({ id: "a", source: "ais", lat: 1, lon: 1, timestamp: 1 });
  assert.equal(result.applied, true);
  assert.equal(store.get("a").position.lat, 1);
});

test("controller lifecycle and cleanup", (t) => {
  const store = createLiveEntityStore({ now: () => 0 });
  const applied = [];
  const controller = createLiveSourceController({
    id: "test-source",
    fetchEntities: async () => [{ id: "a", source: "ais", lat: 0, lon: 0 }],
    applyBatch: async (batch) => batch.forEach((entity) => store.apply(entity)),
    pollIntervalMs: 100000,
    now: () => 0,
  });
  controller.start();
  const status = controller.status();
  assert.ok(status);
  controller.stop();
  const stopped = controller.status();
  assert.equal(stopped.connected, false);
  controller.dispose();
});

test("controller reports errors", (t) => {
  let seen = null;
  const controller = createLiveSourceController({
    id: "bad-source",
    fetchEntities: async () => { throw new Error("boom"); },
    applyBatch: async () => {},
    pollIntervalMs: 100000,
    onError: (err) => { seen = err; },
    now: () => 0,
  });
  controller.start();
  // give a microtask
  const wait = new Promise((resolve) => setTimeout(resolve, 10));
  return wait.then(() => {
    assert.ok(seen instanceof Error);
    assert.match(seen.message, /boom/);
    controller.dispose();
  });
});

test("LIVE_ENTITY_SCHEMA_VERSION", (t) => {
  assert.equal(LIVE_ENTITY_SCHEMA_VERSION, 1);
});
