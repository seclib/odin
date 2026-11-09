const DEG_TO_RAD = Math.PI / 180;

/** Sample an MPC osculating conic in heliocentric ecliptic coordinates (AU). */
export function sampleCataloguedOrbit(orbit, { segments = 180 } = {}) {
  const elements = orbit?.elements;
  const q = elements?.qAu;
  const e = elements?.eccentricity;
  const i = elements?.inclinationDeg;
  const node = elements?.ascendingNodeDeg;
  const peri = elements?.argumentOfPerihelionDeg;
  if (
    ![q, e, i, node, peri].every(Number.isFinite) ||
    q <= 0 ||
    e < 0 ||
    i < 0 ||
    i > 180 ||
    !Number.isInteger(segments) ||
    segments < 24 ||
    segments > 720
  )
    throw new TypeError('A valid catalogued MPC conic is required');

  const p = q * (1 + e);
  const inclination = i * DEG_TO_RAD;
  const ascendingNode = node * DEG_TO_RAD;
  const argumentOfPerihelion = peri * DEG_TO_RAD;
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosPeri = Math.cos(argumentOfPerihelion);
  const sinPeri = Math.sin(argumentOfPerihelion);
  // Keep open conics bounded for a readable catalog view. This is a plot
  // extent only, not a physical cutoff or a time-based prediction.
  const plotRadiusLimitAu = 100;
  const maxAnomaly =
    e < 1
      ? Math.PI
      : Math.min(
          Math.acos(-1 / e) - 0.025,
          Math.acos(Math.max(-1, (p / plotRadiusLimitAu - 1) / e)),
        );
  const points = [];
  for (let index = 0; index <= segments; index++) {
    const anomaly = -maxAnomaly + (2 * maxAnomaly * index) / segments;
    const denominator = 1 + e * Math.cos(anomaly);
    if (denominator <= 0) continue;
    const radius = p / denominator;
    if (!Number.isFinite(radius) || radius > plotRadiusLimitAu) continue;
    const planeX = radius * Math.cos(anomaly);
    const planeY = radius * Math.sin(anomaly);
    const inclinedX = planeX * cosPeri - planeY * sinPeri;
    const inclinedY = (planeX * sinPeri + planeY * cosPeri) * cosI;
    const inclinedZ = (planeX * sinPeri + planeY * cosPeri) * sinI;
    const point = {
      xAu: inclinedX * cosNode - inclinedY * sinNode,
      yAu: inclinedX * sinNode + inclinedY * cosNode,
      zAu: inclinedZ,
    };
    if (Object.values(point).every(Number.isFinite)) points.push(point);
  }
  if (points.length < 2)
    throw new TypeError('MPC orbital elements do not form a drawable conic');
  return points;
}
