import { normalizeLiveEntity, compareLiveEntities } from './liveEntity.js';

export function createLiveEntityStore({
  now = Date.now,
  maxEntities = 5000,
  onError = null,
} = {}) {
  const entities = new Map();

  function apply(raw, { now: nowOverride = now } = {}) {
    const entity = normalizeLiveEntity(raw, { now: nowOverride });
    if (!entity) {
      if (typeof onError === 'function')
        onError(new Error('invalid_live_entity'));
      return { applied: false, reason: 'invalid', entity: null };
    }

    const previous = entities.get(entity.id);
    if (compareLiveEntities(previous, entity) < 0) {
      if (typeof onError === 'function')
        onError(new Error('stale_live_entity'));
      return { applied: false, reason: 'stale', entity, previous };
    }

    entities.set(entity.id, entity);
    if (entities.size > maxEntities) pruneOldest();
    return { applied: true, reason: null, entity, previous };
  }

  function get(id) {
    return entities.get(id) ?? null;
  }

  function snapshot() {
    return Array.from(entities.values()).map((entity) => ({
      ...entity,
      position: { ...entity.position },
      attributes: { ...entity.attributes },
    }));
  }

  function pruneOldest() {
    let oldestId = null;
    let oldestTime = Infinity;
    for (const [id, entity] of entities.entries()) {
      const time = entity.sourceTimestampMs ?? entity.receivedAtMs;
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    if (oldestId) entities.delete(oldestId);
  }

  function clear() {
    entities.clear();
  }

  function size() {
    return entities.size;
  }

  function dispose() {
    clear();
  }

  return { apply, get, snapshot, clear, size, dispose };
}
