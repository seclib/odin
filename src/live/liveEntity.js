
export const LIVE_ENTITY_SCHEMA_VERSION = 1;

function finite(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function timestampMs(value, now = Date.now) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && value.trim().length <= 13) return asNumber;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function normalizeLiveEntity(input, { now = Date.now } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const id = String(input.id ?? input.entityId ?? input.mmsi ?? input.icao24 ?? "").trim();
  const source = String(input.source ?? input.sourceId ?? "").trim();
  const lat = finite(input.lat ?? input.latitude ?? input.position?.lat);
  const lon = finite(input.lon ?? input.longitude ?? input.position?.lon);
  const sourceTimestampMs = timestampMs(input.sourceTimestamp ?? input.timestamp ?? input.time ?? input.observedAtMs ?? input.lastUpdate);
  const hasReceivedAt = Object.prototype.hasOwnProperty.call(input, "receivedAt") ||
    Object.prototype.hasOwnProperty.call(input, "received_at");
  const receivedAtValue = input.receivedAt ?? input.received_at;
  const receivedAtMs = timestampMs(receivedAtValue);
  if (hasReceivedAt && receivedAtMs === null) return null;
  const finalReceivedAtMs = receivedAtMs ?? now();

  if (!id || !source) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;


  const alt = finite(input.alt ?? input.altitude ?? input.altitudeM ?? input.position?.alt);

  return {
    id,
    source,
    position: { lat, lon, alt: alt === null ? undefined : alt },
    sourceTimestampMs,
    receivedAtMs: finalReceivedAtMs,
    attributes: typeof input.attributes === "object" && input.attributes !== null ? { ...input.attributes } : {},
  };
}

export function compareLiveEntities(previous, next) {
  if (!previous) return 1;
  if (!next) return -1;
  const prevSource = previous.sourceTimestampMs;
  const nextSource = next.sourceTimestampMs;
  if (prevSource !== null && nextSource !== null) {
    if (nextSource > prevSource) return 1;
    if (nextSource < prevSource) return -1;
  }
  if (next.receivedAtMs > previous.receivedAtMs) return 1;
  if (next.receivedAtMs < previous.receivedAtMs) return -1;
  return 0;
}
