# ODIN — Buildings → Cesium 3D Tiles (Phase E / F feeder)

Converts building footprint files into a Cesium-compatible **3D Tiles
explicit quadtree** (`tileset.json` + per-cell `.b3dm`). Two input families
are supported by the same code path:

| Input | Source | Réunion coverage | Heights |
|-------|--------|------------------|---------|
| GMLFP GeoJSONL (`.jsonl` / `.jsonl.gz`) | Microsoft ©, CDLA-Permissive-2.0 | ✅ verified 2026-08-13 refresh: 349 300 footprints, 4 quadkeys, ~28 MB | ❌ none (all `height = -1`) |
| BD TOPO export (GeoJSON via `ogr2ogr` / QGIS) | IGN, Licence Ouverte 2.0 | ✅ authoritative French DEM pair | ✅ real roof/ground altitudes |

## Honest status (2026-11-17)

- Converter implemented and roundtrip-tested on synthetic polygons and on
  **real Réunion GMLFP data** (349 300 footprints → 457 tiles, ~276 MB).
- **Browser-verified (2026-11-17, ODIN + puppeteer/Chrome 152, system Chrome)**:
  pilot tileset (100 buildings enriched with IGN RGE ALTI bases) streams,
  toggles ON/OFF cleanly in a real ODIN session (`layer local-buildings`),
  stats show `featureCount: 100` live from `tileset.json` extras,
  `scene.pick` returns a `Cesium3DTileFeature` at a known building pixel
  (attribution visible, `featureCount: 100`), disabling removes the
  primitive, zero local-buildings console errors. Plan IGN renders for
  Réunion (z 8/10/12 tiles 200 OK).
- Two format-level bugs found by rendering (not by unit tests) and fixed:
  `boundingVolume.region` must be in **radians**, and b3dm tables declare
  four back-to-back uint32 length fields (featureTableJSON/BINARY,
  batchTableJSON/BINARY) — both required by Cesium 1.138, silent
  misbehavior otherwise (zero tile requests, or JSON parse error at
  `"BATCH_LENGTH"` position 2).
- ODIN loads the tileset only when `VITE_LOCAL_BUILDINGS_URL` is set
  (`src/maps/localBuildings.js`, env-flagged like `VITE_OPENFREEMAP`).
  It is OFF by default; no tileset ships in the repo.
- Full-island tileset WITH IGN ground altitudes: enrichment in background;
  regeneration = same command as above with `--base-height-field groundAltitude`.
- **Resolution (2026-11-18)**: the background enrichment was interrupted by the
  2026-11-17 19:38 shutdown (machine rebooted 2026-11-18 06:45). No complete
  enriched quadkey exists; the operator decided to finalize Phase E with the
  already-validated **100-building pilot**. The durable master now carries a
  manifest (`scope: pilot-100`, tileset generation date, IGN stats, 6 m default
  height), `checksums.sha256` (135 verified entries), `source/` + `enriched/` +
  `tiles/`, and `dist/odin-local-buildings/` is a disposable serving mirror.
  Full report: `docs/PHASE_E_GMLFP_LOCAL_BUILDINGS.md`.

## Usage

```sh
# GMLFP Réunion (4 files, after downloading from dataset-links.csv)
python3 -m tools.buildings.gmlfp_to_tiles \\
  301023330.csv.gz 301023331.csv.gz 301023332.csv.gz 301023333.csv.gz \\
  --out out/gmlfp-974 --cell-deg 0.02 --default-height 6

# BD TOPO Réunion → GeoJSONL, with real measured heights
# (verify the column names against YOUR delivery — BD TOPO 3.x typical)
ogr2ogr -f GeoJSONL -t_srs EPSG:4326 bdtopo974_batiment.geojsonl BATIMENT.GPKG \\
  -sql "SELECT cleabs AS id, (altitude_maximale_toit - altitude_minimale_sol) AS height,
               1 AS confidence, geometrie AS geometry FROM batiment
        WHERE altitude_maximale_toit IS NOT NULL AND altitude_minimale_sol IS NOT NULL"
python3 -m tools.buildings.gmlfp_to_tiles bdtopo974_batiment.geojsonl \\
  --out out/bdtopo-974 --cell-deg 0.005 --height-field height
```

Then serve `out/gmlfp-974/` (or `out/bdtopo-974/`) over HTTP and set
`VITE_LOCAL_BUILDINGS_URL=http://localhost:8080/gmlfp-974/tileset.json`
before building ODIN. The batch table records per building:

```json
{ "id": "b-<n>", "height": 6.0, "heightSource": "default" | "measured", "confidence": 0.9 }
```

**`heightSource: "default"` means the constant from `--default-height` was
applied — a visual placeholder, not a measurement.** ODIN must not treat
those as measured heights.

## Format notes (verified against CesiumJS 1.138)

- `asset.gltfUpAxis = "Z"` — Cesium would otherwise rotate the embedded
  glTF from Y-up to Z-up and destroy absolute ECEF positions.
- Vertices are ECEF **relative to the per-tile `RTC_CENTER`** (feature
  table), so float32 deltas stay ~1 mm accurate at Réunion's ECEF magnitude.
- `_BATCHID` (UNSIGNED_SHORT, per-vertex) + `BATCH_LENGTH` → one
  `Cesium3DTileFeature` per building; batch table is object-of-arrays.
- `boundingVolume.region` in WGS84 degrees + metres (min/max height).
- Batch ids are tile-local (uint16); a tile with > 65 535 buildings fails
  loudly instead of corrupting picking.

## Explicit limits

- No holes (multi-ring polygons) — GMLFP Réunion has zero; holed BD TOPO
  polygons are **skipped and counted** (`skipped (unsupported/invalid input)`).
- ear-clip triangulation is O(n²) — fine for ≤ ~40-pt footprints, which is
  what both datasets ship.
- Degenerate/self-touching rings are **skipped entirely**, never exported
  as partial roofs.
- Single LOD per tile; `REPLACE` refinement is emitted but there is no LOD
  pyramid yet. For 349k Réunion buildings this is deliberate: 457 tiles,
  ~276 MB, batchable in ~79 s.

## Ground altitudes (IGN RGE ALTI) — mandatory for buildings to sit on the terrain

GMLFP has no ground altitude; entries extruded from the ellipsoid sea level are
buried under terrain. `tools/buildings/enrich_gmlfp_altitudes.py` samples, for
every building, the **MAX of its four bbox corners** from the IGN Géoplateforme
altimetry API (Licence Ouverte 2.0) and writes `groundAltitude` (NGF-IGN69
orthometric, **not** ellipsoidal — ODIN's height chain converts with the bundled
EGM96 geoid; the ~1–2 m geoid offset is NOT silently corrected in the tiles) and
`groundSource` (`ign` | `no-data`).

```sh
# Réunion: territoires answers -99999 everywhere — use wld directly
python3 -m tools.buildings.enrich_gmlfp_altitudes INPUT.jsonl.gz \
  --out INPUT.enriched.jsonl --primary wld
```

IGN's `elevation.json` is GET-only and trips HTTP 414 above ~6 KB of URL with
7-decimal coordinates; batches are pinned at 250 positions (≈ 5.9 KB). The whole
island is ~1.4 M points / ~5 600 calls at ~1 req/s — hours of background work,
free, keyless. Result plumbed into the converter with
`--base-height-field groundAltitude`; buildings with `groundSource: no-data`
keep base 0 m and are counted in the run report.

## Durable local storage (master copy) — 2026-11-17

The complete tileset and its inputs are kept **outside the repository**, in the
user data directory — `dist/` is a materialized copy for serving, never the
storage of record:

```
~/.local/share/odin/buildings-974/
  source/                  # raw GMLFP quadkeys (read-only inputs)
  enriched/                # ground-altitude-enriched GeoJSONL (output of
                           # enrich_gmlfp_altitudes.py — never overwrites source/)
  tiles/                   # final 3D Tiles (tileset.json + tiles/cell_*.b3dm)
  pilot/                   # the 100-building enriched pilot set, for rollback
  manifest.json            # provenance, licence, params, counts, IGN stats
  checksums.sha256         # SHA-256 of every regular file (except the two above)
```

`ODIN_BUILDINGS_MASTER` overrides the location. The 3D Tiles master is copied
into `dist/odin-local-buildings/` with `node tools/deploy-local-buildings.mjs`
— re-run it after every `npm run build` (Vite wipes `dist/`). `dist/` is in
`.gitignore` (`dist`); the master lives outside the repo and is therefore
never tracked. `node tools/deploy-local-buildings.mjs --pilot` deploys the
pilot instead.

Manifest + checksums are produced by `tools/buildings/make_manifest.py`:

```sh
python3 tools/buildings/make_manifest.py ~/.local/share/odin/buildings-974
cd ~/.local/share/odin/buildings-974 && sha256sum -c checksums.sha256
```

For a subset (e.g. the finalized 100-building pilot), pass the scope so the
manifest never presents a pilot as the full 349 300-building dataset:

```sh
python3 tools/buildings/make_manifest.py ~/.local/share/odin/buildings-974 \
  --scope pilot-100 --scope-note "subset: full enrichment not generated"
```

`tilesGeneratedAt` is derived from the tileset file mtime, not from the moment
the manifest is regenerated. `tools/buildings/test_make_manifest.py` covers it.

Browser QA for this layer: `scripts/qa-buildings.mjs` (load/pick/toggle),
`scripts/qa-buildings-terrain-perf.mjs` (terrain seating + frame pacing),
`scripts/qa-buildings-off-default.mjs` (no data configured → layer stays OFF).
