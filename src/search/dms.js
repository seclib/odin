/**
 * Degrees, minutes and optional seconds for the search box.
 *
 * Strict, like the decimal parser: each component is degrees with minutes and
 * seconds marked by their symbols (`40°26'46"`), optionally signed, optionally
 * marked with one hemisphere letter on either side. Only the last number may
 * carry a decimal part. Minutes and seconds must be below 60. A sign and a
 * hemisphere letter never both claim the direction.
 *
 * Adapted from God's Eye View (PR #1753) for ODIN's vanilla architecture:
 * pure function, no dependency.
 */

const SYMBOL_DEG = /[°º]/;
const SYMBOL_MIN = /['′’]/;
const SYMBOL_SEC = /["″”]|''|′′/;

/**
 * One degrees-minutes-seconds component, by the same rules as a decimal one.
 * @param {string} text
 * @returns {{ value: number, axis: 'lat'|'lon'|null } | null}
 */
export function parseDmsComponent(text) {
  const match =
    /^([NSEW])?\s*([+-])?(\d{1,3})\s*[°º]\s*(\d{1,2}(?:\.\d+)?)\s*['′’]\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|”|''|′′))?\s*([NSEW])?$/i.exec(
      String(text).trim(),
    );
  if (!match) return null;
  const [, before, sign, degrees, minutes, seconds, after] = match;
  if (before && after) return null;
  const letter = (before || after || '').toUpperCase();
  if (letter && sign) return null;
  if (seconds !== undefined && minutes.includes('.')) return null;
  if (Number(minutes) >= 60 || (seconds !== undefined && Number(seconds) >= 60))
    return null;
  const magnitude =
    Number(degrees) + Number(minutes) / 60 + (seconds ? Number(seconds) / 3600 : 0);
  const value = letter === 'S' || letter === 'W' ? -magnitude : magnitude;
  const axis =
    letter === 'N' || letter === 'S'
      ? 'lat'
      : letter === 'E' || letter === 'W'
        ? 'lon'
        : null;
  return { value, axis };
}
