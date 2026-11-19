import { normalizeVesselObservation } from '../sources/live/vessels.js';
import { normalizeLiveEntity, compareLiveEntities } from './liveEntity.js';

export const AIS_SOURCE_ID = 'ais';

export function aisObservationToLiveEntity(
  row,
  { source = AIS_SOURCE_ID, now = Date.now, reference = null } = {},
) {
  const vessel = normalizeVesselObservation(row, reference);
  if (!vessel) return null;

  return normalizeLiveEntity(
    {
      id: vessel.id,
      source,
      lat: vessel.latitude,
      lon: vessel.longitude,
      sourceTimestamp: vessel.observedAtMs,
      attributes: {
        name: vessel.name,
        imo: vessel.imo,
        type: vessel.type,
        destination: vessel.destination,
        speedMps: vessel.speedMps,
        courseDeg: vessel.courseDeg,
        headingDeg: vessel.headingDeg,
        altitudeDatum: vessel.altitudeDatum,
      },
    },
    { now },
  );
}

export function createAISLiveAdapter({
  source = AIS_SOURCE_ID,
  now = Date.now,
} = {}) {
  return {
    source,
    normalize(row, reference = null) {
      return aisObservationToLiveEntity(row, { source, now, reference });
    },
    normalizeBatch(rows, referenceFor) {
      if (!Array.isArray(rows)) return [];
      const best = new Map();
      for (const row of rows) {
        const reference =
          typeof referenceFor === 'function' ? referenceFor(row) : null;
        const entity = aisObservationToLiveEntity(row, {
          source,
          now,
          reference,
        });
        if (!entity) continue;
        const previous = best.get(entity.id);
        if (!previous || compareLiveEntities(previous, entity) > 0) {
          best.set(entity.id, entity);
        }
      }
      return Array.from(best.values());
    },
  };
}
