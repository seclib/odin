const QUEBEC_BOUNDS = Object.freeze({
  west: -80,
  south: 45,
  east: -57,
  north: 63,
});
const MAX_FEATURES = 2500;
const MAX_FEATURE_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function parseRoadDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match =
    /^(\d{4})[/-](\d{2})[/-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      text,
    );
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  // MTMD timestamps are local Quebec time and omit an offset. Resolve the
  // offset from the date itself so server host timezone cannot shift events.
  let instant = wallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offsetName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(instant))
      .find((part) => part.type === 'timeZoneName')?.value;
    const offset = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offsetName || '');
    if (!offset) return null;
    const minutes =
      (Number(offset[2]) * 60 + Number(offset[3])) *
      (offset[1] === '+' ? 1 : -1);
    instant = wallClock - minutes * 60_000;
  }
  return Number.isFinite(instant) ? instant : null;
}

function normalizeCoordinates(geometry) {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates))
    return null;
  const points = geometry.coordinates;
  if (points.length < 2 || points.length > 5000) return null;
  const valid = points.every(
    (point) =>
      Array.isArray(point) &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 180 &&
      Math.abs(point[1]) <= 90,
  );
  return valid ? points : null;
}

/** Reject malformed, expired, too old, or geographically out-of-scope WFS records. */
export function normalizeQuebecRoadworks(
  payload,
  { now = Date.now(), maxFeatures = MAX_FEATURES } = {},
) {
  if (
    payload?.type !== 'FeatureCollection' ||
    !Array.isArray(payload.features) ||
    payload.features.length > maxFeatures
  )
    return null;
  const results = [];
  for (const feature of payload.features) {
    const properties = feature?.properties || {};
    const coordinates = normalizeCoordinates(feature?.geometry);
    if (!coordinates) continue;
    const startAt = parseRoadDate(properties.debut);
    const endAt = parseRoadDate(properties.fin);
    const updatedAt = parseRoadDate(properties.miseAJour);
    const id = String(properties.identifiant || feature.id || '').slice(0, 80);
    if (
      !id ||
      !startAt ||
      !endAt ||
      !updatedAt ||
      endAt < now ||
      updatedAt > now + 24 * 60 * 60 * 1000
    )
      continue;
    if (now - updatedAt > MAX_FEATURE_AGE_MS) continue;
    if (
      !coordinates.some(
        ([lon, lat]) =>
          lon >= QUEBEC_BOUNDS.west &&
          lon <= QUEBEC_BOUNDS.east &&
          lat >= QUEBEC_BOUNDS.south &&
          lat <= QUEBEC_BOUNDS.north,
      )
    )
      continue;
    results.push({
      id,
      route: String(
        properties.routeAutoroute || properties.numeroRoute || '',
      ).slice(0, 80),
      title: String(
        properties.identificationDesTravaux ||
          properties.entrave ||
          'Road works',
      ).slice(0, 240),
      detail: String(
        properties.descriptionFrancais || properties.entrave || '',
      ).slice(0, 1200),
      municipality: String(properties.municipalite || '').slice(0, 120),
      direction: String(properties.direction || '').slice(0, 80),
      restriction: String(properties.entrave || '').slice(0, 300),
      startAt,
      endAt,
      updatedAt,
      status: startAt > now ? 'scheduled' : 'active',
      coordinates,
    });
  }
  return results;
}

export function viewIntersectsQuebec(bounds) {
  if (!bounds) return false;
  const width = bounds.east - bounds.west;
  const height = bounds.north - bounds.south;
  if (!(width > 0 && width <= 40 && height > 0 && height <= 25)) return false;
  return (
    bounds.east >= QUEBEC_BOUNDS.west &&
    bounds.west <= QUEBEC_BOUNDS.east &&
    bounds.north >= QUEBEC_BOUNDS.south &&
    bounds.south <= QUEBEC_BOUNDS.north
  );
}
