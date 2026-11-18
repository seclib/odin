// @module data/wikidataCities
// The bundled world cities pack (Wikidata, CC0), read from
// local_data/wikidata_cities/cities.json. The module reads this file once
// on first use and every answer comes from it: no place service is called.
// Rows are [name, lat, lon, population, country, wikidata].
// This is immutable, pure data plus indexers: it does not call Wikidata or any external service.
// Adaptation for ODIN of the GEV src/data/wikidataCities.js logic.

import { loadBundledJson } from './bundledJson.js';

const WIKIDATA_CITIES_URL = new URL('./local_data/wikidata_cities/cities.json', import.meta.url);

let PACK = null;

async function loadCities(fetchImpl = (...args) => globalThis.fetch(...args)) {
  if (PACK) return PACK;
  const pack = await loadBundledJson(WIKIDATA_CITIES_URL, { fetchImpl });
  const rows = pack.rows;
  const cells = indexCities(rows);
  const names = indexNames(rows);
  const countries = countryNames(rows);
  PACK = { rows, cells, names, countries: countries, meta: pack.meta };
  return PACK;
}

/** Fold a name lower case, without accents, so "Sao Paulo" finds "São Paulo". */
function foldName(name) {
  // Build the plain letter map once
  const PLAIN_LETTERS = { ł: 'l', ø: 'o', đ: 'd', ð: 'd', ı: 'i', ß: 'ss', æ: 'ae', œ: 'oe', þ: 'th' };
  // Normalize: NFD removes accents, toLowerCase lowercases, then replace special chars
  let result = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .trim();
  // Replace special characters one by one
  for (const [special, plain] of Object.entries(PLAIN_LETTERS)) {
    result = result.replace(new RegExp(special, 'g'), plain);
  }
  return result.trim();
}

const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

function distanceKm(lat1, lon1, lat2, lon2) {
  const a =
    Math.sin(rad((lat2 - lat1) / 2)) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
    Math.sin(rad((lon2 - lon1) / 2)) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function lonHalfSpan(lat, r) {
  const a = r / EARTH_KM;
  const fromPole = (Math.PI / 2) - Math.abs((lat * Math.PI) / 180);
  if (a >= fromPole) return 180;
  return (Math.asin(Math.sin(a) / Math.cos((lat * Math.PI) / 180)) * 180) / Math.PI;
}

const latHalfSpan = (r) => ((r / EARTH_KM) * 180) / Math.PI;

function indexCities(rows) {
  const cells = new Map();
  for (const row of rows) {
    const key = `${Math.floor(row[1])},${Math.floor((((row[2] % 360) + 540) % 360) - 180)}`;
    const c = cells.get(key);
    if (c) c.push(row);
    else cells.set(key, [row]);
  }
  return cells;
}

function indexNames(rows) {
  const names = new Map();
  const PLAIN_LETTERS = { ł: 'l', ø: 'o', đ: 'd', ð: 'd', ı: 'i', ß: 'ss', æ: 'ae', œ: 'oe', þ: 'th' };
  for (const row of rows) {
    const key = foldName(row[0]);
    const list = names.get(key);
    if (list) list.push(row);
    else names.set(key, [row]);
  }
  return names;
}

function countryNames(rows) {
  const names = new Map();
  // Indexer chaque code ISO unique : le code lui-même, son nom anglais
  // (via countryName(code, 'en')) et son nom dans la langue active
  // (via countryName(code)). Toutes les clés sont normalisées avec foldName.
  for (const code of new Set(rows.map((row) => row[4]).filter(Boolean))) {
    for (const name of [code, countryName(code, 'en'), countryName(code)])
      names.set(foldName(name), code);
  }
  return names;
}

/** A country's name in the page language, from its ISO code. */
export function countryName(code, language = globalThis.document?.documentElement?.lang || 'en') {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

function cellKey(lat, lon) {
  return `${Math.floor(lat)},${Math.floor((((lon % 360) + 540) % 360) - 180)}`;
}

function citiesWithin(cells, lat, lon, radiusKm) {
  const latSpan = Math.ceil(latHalfSpan(radiusKm) / 1);
  const lonSpan = Math.ceil(lonHalfSpan(lat, radiusKm) / 1);
  const found = [];
  const seen = new Set();
  for (let dLat = -latSpan; dLat <= latSpan; dLat += 1) {
    const lat2 = lat + dLat;
    if (lat2 < -90 - 1 || lat2 > 90 + 1) continue;
    for (let dLon = -Math.min(lonSpan, 180); dLon <= Math.min(lonSpan, 180); dLon += 1) {
      const lon2 = ((lon + dLon) % 360 + 540) % 360 - 180;
      const c = cells.get(cellKey(lat2, lon2));
      if (!c) continue;
      for (const row of c) {
        const rlat = row[1];
        const rlon = row[2];
        if (rlon < lon - lonSpan || rlon > lon + lonSpan) continue;
        const km = distanceKm(lat, lon, rlat, rlon);
        if (km <= radiusKm) {
          const id = `${row[0]}:${rlat}:${rlon}`;
          if (!seen.has(id)) {
            seen.add(id);
            found.push({ name: row[0], latitude: rlat, longitude: rlon, population: row[3] ?? null, country: row[4] ?? null, wikidata: row[5] ?? null, distanceKm: km });
          }
        }
      }
    }
  }
  return found;
}

function toCity(row, km) {
  return { name: row[0], latitude: row[1], longitude: row[2], population: row[3] ?? null, country: row[4] ?? null, wikidata: row[5] ?? null, distanceKm: km };
}

export { distanceKm, lonHalfSpan, latHalfSpan, indexCities, indexNames, countryNames, citiesWithin, toCity, foldName, loadCities };

export async function nearestCity(lat, lon, { radiusKm = 60, nearKm = 12 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const { cells } = await loadCities();
  const found = citiesWithin(cells, lat, lon, radiusKm);
  if (!found.length) return null;
  const near = found.filter((c) => c.distanceKm <= nearKm);
  if (near.length) return near.reduce((a, b) => b.population > a.population ? b : a);
  return found.reduce((a, b) => b.distanceKm < a.distanceKm ? b : a);
}

export async function citiesAround({ latitude, longitude, radiusKm = 50, limit = 8, minPopulation = 0 }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const { cells } = await loadCities();
  return citiesWithin(cells, latitude, longitude, radiusKm)
    .filter((c) => c.population >= minPopulation)
    .sort((a, b) => b.population - a.population || a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export async function findPlace(name, { near = null, radiusKm = 150 } = {}, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const [head, ...rest] = String(name || '').split(',');
  const wanted = foldName(head);
  if (!wanted) return null;
  const qualifier = foldName(rest.join(','));
  const { names, countries } = await loadCities(fetchImpl);
  const country = qualifier ? countries.get(qualifier) : undefined;
  const cities = (names.get(wanted) || []).filter((row) => !country || row[4] === country);
  if (!cities.length) return null;
  if (Number.isFinite(near?.latitude) && Number.isFinite(near?.longitude)) {
    let best = null;
    for (const row of cities) {
      const km = distanceKm(near.latitude, near.longitude, row[1], row[2]);
      if (km <= radiusKm && (!best || km < best.distanceKm)) best = toCity(row, km);
    }
    if (best) return best;
  }
  return toCity(cities[0], 0);
}
