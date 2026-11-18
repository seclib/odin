# ODIN — Terrain offline tiler (Phase D)

Converter for high-resolution IGN DEM data (RGE ALTI®, LiDAR HD MNT) into
Cesium-compatible **quantized-mesh-1.0** tiles plus a `layer.json`.

This is **infrastructure code only**. It does not download anything. Real D974
inputs are dropped in by the operator after explicit authorization (a full
RGE ALTI 1 m Réunion pyramide is ~5 GB).

## Layout

| File | Role |
|------|------|
| `gridio.py` | Readers for ESRI ASCII Grid (.asc) and SRTM .hgt (both IGN/SRTM deliver open formats) |
| `qmesh.py` | quantized-mesh-1.0 writer — ECEF math, horizon occlusion point, `layer.json` writer |
| `cli.py` | `python3 -m tools.terrain.cli input.asc --out out/ [--min-zoom N] [--max-zoom N] [--res 24] [--bounds W S E N]` |
| `test_tiler.py` | Roundtrip tests with a mirrored decoder that implements the Cesium decode exactly (bounded uint16/uint32 stores, unbounded `highest`) |

## Format facts (verified against CesiumJS 1.138 source)

- Vertices ordered **south → north**, indices counter-clockwise seen from outside.
- `u = 0` on the western edge, `u = 32767` on the eastern edge; same for `v` (southern → northern).
- Triangle indices: “high water mark” encoding; Cesium stores `indices[i] = highest − code` into a typed array (wraps mod 2^bits) and advances `highest` on `code == 0`. The writer reproduces that arithmetic exactly (Python ints, explicit mod).
- **Edge indices are stored RAW** — no high-water-mark encoding.
- `vertexCount ≥ 65536` ⇒ 32-bit indices, else 16-bit. Padding before `IndexData{16,32}` keeps alignment.
- `layer.json` with `"projection": "EPSG:3857"` and `"scheme": "tms"` — tiles are addressed with **TMS y** (counted from the south).
- The horizon occlusion point is computed with the same possibly-shrunk-ellipsoid math as `EllipsoidalOccluder.computeHorizonCullingPointFromVertices` in Cesium.

## Status (2026-11-18)

- Code implemented and roundtrip-tested (`python3 tools/terrain/test_tiler.py` → OK).
- CLI smoke-tested on a synthetic grid (writes real `.terrain` files + `layer.json`; sample tiles re-parsed successfully).
- **NOT yet validated inside CesiumJS in a browser** (no browser MCP available this session) and **no real IGN D974 tile** generated (5 GB download not authorized).

## Using real RGE ALTI data (once authorized)

1. Download the Réunion mosaic from the IGN Géoplateforme data portal (DÉPARTEMENT 974, RGE ALTI® pyramide 1 m, ASC format) into `tools/terrain/data/`.
2. Run:
   ```sh
   python3 -m tools.terrain.cli tools/terrain/data/974.asc \
     --out tools/terrain/out-974 --min-zoom 0 --max-zoom 12 --res 32
   ```
3. Serve `tools/terrain/out-974/` over HTTP with `Accept-Ranges` and correct MIME; point ODIN's local terrain provider at it (`VITE_LOCAL_TERRAIN_URL=http://…/layer.json`, once that ODIN-side flag ships).

## Honest limitations

- EPSG:4326 sources are fine (grid sampling is in WGS84 degrees); the emitted tiles are EPSG:3857 tiles — height attribution is unaffected by the reprojection because heights are stored as heights, not coordinates.
- Tiles whose bounds only *partially* overlap the grid clamp out-of-range samples to the grid edge (keeps coverage seams visible but seamless).
- No water/land classification — the watermask extension is not emitted.
