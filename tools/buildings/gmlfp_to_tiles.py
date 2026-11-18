#!/usr/bin/env python3
"""
ODIN — GMLFP → Cesium 3D Tiles (B3DM) converter.

Consumes Microsoft Global ML Building Footprints files (GeoJSONL, one
Feature per line — the exact format of the Réunion quadkeys of the
2026-08-13 dataset refresh) and produces a 3D Tiles explicit quadtree:

    <out>/tileset.json
    <out>/tiles/cell_<i>_<j>.b3dm

Verified against CesiumJS 1.138 sources in this repository:

  * `asset.gltfUpAxis = "Z"` in tileset.json — Cesium's default for embedded
    glTF is Y, which applies a y-up→z-up correction and would throw every
    absolute ECEF position away. With Z declared, positions are consumed as-is.
  * Vertices are ECEF relative to the per-tile `RTC_CENTER` (feature table),
    keeping float32 precision (~1 mm) for buildings.
  * `_BATCHID` (UNSIGNED_SHORT, per-vertex) + `BATCH_LENGTH` give one
    Cesium3DTileFeature per building, with `id`, `height`, `heightSource` and
    `confidence` in a JSON batch table (object-of-arrays form).
  * `boundingVolume.region` ([west, south, east, north, minH, maxH]).

Height honesty: GMLFP carries `height: -1` when the estimator found nothing
(all Réunion records, as of 2026-08-13). In that case the building is
extruded by `--default-height` and the batch table records
`heightSource: "default"`. Real heights (BD TOPO or `--height-field`) are recorded as `"measured"`.

Scope limits on purpose: no hole handling (GMLFP Réunion — verified — has
zero holed polygons), one LOD per tile (REPLACE refinement is emitted; no
decimation pyramid yet), no CRS reprojection (input must be WGS84 lon/lat),
batch ids are tile-local uint16 (tiles with > 65535 buildings fail loudly).
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tools.terrain.qmesh import ecef_from_geodetic


# ───────────────────────────── polygon helpers ─────────────────────────────
def ring_signed_area(ring2d):
    area = 0.0
    n = len(ring2d)
    for i in range(n):
        x1, y1 = ring2d[i]
        x2, y2 = ring2d[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return 0.5 * area


def ensure_ccw(ring2d):
    return list(ring2d) if ring_signed_area(ring2d) >= 0 else list(reversed(ring2d))


def earclip(ring2d):
    """Triangulate a simple (no-hole) CCW 2D polygon. O(n²); rings are ≤ ~37 pts."""
    pts = ensure_ccw(list(ring2d))
    if pts and pts[0] == pts[-1]:
        pts = pts[:-1]
    # Drop consecutive duplicates and collinear runs — GMLFP ships both.
    cleaned = []
    for p in pts:
        if cleaned and (abs(p[0] - cleaned[-1][0]) < 1e-12 and abs(p[1] - cleaned[-1][1]) < 1e-12):
            continue
        cleaned.append((float(p[0]), float(p[1])))
    pts = cleaned
    if len(pts) >= 3 and (abs(pts[0][0] - pts[-1][0]) < 1e-12 and abs(pts[0][1] - pts[-1][1]) < 1e-12):
        pts = pts[:-1]
    changed = True
    while changed and len(pts) > 3:
        changed = False
        out = [pts[0]]
        for i in range(1, len(pts) - 1):
            a, b, c = out[-1], pts[i], pts[i + 1]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if abs(cross) < 1e-15:  # collinear — drop b
                changed = True
                continue
            out.append(b)
        out.append(pts[-1])
        pts = out
    n = len(pts)
    if n < 3:
        return [], pts

    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def point_in_tri(p, a, b, c):
        d1 = orient(p, a, b)
        d2 = orient(p, b, c)
        d3 = orient(p, c, a)
        has_neg = d1 < 0 or d2 < 0 or d3 < 0
        has_pos = d1 > 0 or d2 > 0 or d3 > 0
        return not (has_neg and has_pos)

    indices = list(range(n))
    triangles = []
    guard = 0
    while len(indices) > 3:
        guard += 1
        if guard > n * n:
            return [], pts  # degenerate ring — refuse partial roofs
        m = len(indices)
        clipped = False
        for k in range(m):
            i_prev, i_cur, i_next = indices[k - 1], indices[k], indices[(k + 1) % m]
            a, b, c = pts[i_prev], pts[i_cur], pts[i_next]
            if orient(a, b, c) <= 0:
                continue  # reflex vertex
            if any(
                point_in_tri(pts[j], a, b, c)
                for j in indices
                if j not in (i_prev, i_cur, i_next)
            ):
                continue
            triangles.append((i_prev, i_cur, i_next))
            del indices[k]
            clipped = True
            break
        if not clipped:
            # Degenerate ring — refuse to emit a partial roof on top of full walls.
            return [], pts
    if len(indices) == 3:
        triangles.append(tuple(indices))
    if not triangles:
        return [], pts
    return [(pts[i], pts[j], pts[k]) for i, j, k in triangles], pts


# ───────────────────────────── mesh building ───────────────────────────────
def building_mesh(ring, height, origin_ecef_vec, base_height: float = 0.0):
    """
    ring: [(lon, lat)] simple ring (GMLFP). All positions are ECEF metres
    relative to `origin_ecef_vec`. Normals are ECEF direction vectors
    (origin offset does not affect them).
    """
    ring2d = [(float(p[0]), float(p[1])) for p in ring]
    if ring2d[0] == ring2d[-1]:
        ring2d = ring2d[:-1]
    if len(ring2d) < 3:
        return None
    lat0 = float(np.mean([p[1] for p in ring2d]))
    lon0 = float(np.mean([p[0] for p in ring2d]))
    sin_lat = math.sin(math.radians(lat0))
    cos_lat = math.cos(math.radians(lat0))
    sin_lon = math.sin(math.radians(lon0))
    cos_lon = math.cos(math.radians(lon0))
    up = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])
    east = np.array([-sin_lon, cos_lon, 0.0])
    north = np.cross(up, east)
    centroid_ecef = np.array(ecef_from_geodetic(lat0, lon0, 0.0), dtype=np.float64)
    cen = np.array([
        np.dot(centroid_ecef - origin_ecef_vec, east),
        np.dot(centroid_ecef - origin_ecef_vec, north),
    ])

    o = origin_ecef_vec

    def to_local(p, z):
        return np.array(ecef_from_geodetic(p[1], p[0], z), dtype=np.float64) - o

    ring_base = [to_local(p, base_height) for p in ring2d]
    ring_top = [to_local(p, base_height + height) for p in ring2d]
    ring_h = [(float(np.dot(b, east)), float(np.dot(b, north))) for b in ring_base]

    positions: list[float] = []
    normals: list[float] = []
    indices: list[tuple[int, int, int]] = []

    for i in range(len(ring2d)):
        b0, b1 = ring_base[i], ring_base[(i + 1) % len(ring2d)]
        t0, t1 = ring_top[i], ring_top[(i + 1) % len(ring2d)]
        e0 = np.array([np.dot(b0, east), np.dot(b0, north)])
        e1 = np.array([np.dot(b1, east), np.dot(b1, north)])
        edge = e1 - e0
        edge_len = float(np.linalg.norm(edge))
        if edge_len < 1e-9:
            continue
        n2 = np.array([edge[1], -edge[0]]) / edge_len
        mid = (e0 + e1) / 2.0
        if np.dot(n2, mid - cen) < 0:
            n2 = -n2
        n_ecef = n2[0] * east + n2[1] * north
        base = len(positions) // 3
        for v in (b0, b1, t1, t0):
            positions.extend(float(x) for x in v)
            normals.extend(float(x) for x in n_ecef)
        indices.extend([(base, base + 1, base + 2), (base, base + 2, base + 3)])

    roof_base = len(positions) // 3
    for rt in ring_top:
        positions.extend(float(x) for x in rt)
        normals.extend(float(x) for x in up)
    tris, _ = earclip(ring_h)
    if not tris:
        return None  # untriangulable roof — skip the building entirely
    for a, b, c in tris:
        ia = ring_h.index(a)
        ib = ring_h.index(b)
        ic = ring_h.index(c)
        s = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if s < 0:
            ib, ic = ic, ib
        indices.append((roof_base + ia, roof_base + ib, roof_base + ic))

    pos = np.asarray(positions, dtype=np.float32).reshape(-1, 3) if positions else np.zeros((0, 3), dtype=np.float32)
    nrm = np.asarray(normals, dtype=np.float32).reshape(-1, 3) if normals else np.zeros((0, 3), dtype=np.float32)
    ind = np.asarray(indices, dtype=np.uint32).reshape(-1, 3) if indices else np.zeros((0, 3), dtype=np.uint32)
    return pos, nrm, ind


# ───────────────────────────── GLB / B3DM writers ──────────────────────────
def _pad(buf: bytes, pad: bytes = b" ", to: int = 4) -> bytes:
    return buf + pad * ((-len(buf)) % to)


def pack_glb(position: np.ndarray, normal: np.ndarray, batch_ids: np.ndarray,
             indices: np.ndarray) -> bytes:
    """glTF 2.0 binary, single scene/mesh/primitive. Z-up is declared on tileset.json."""
    if indices.dtype != np.uint32:
        indices = indices.astype(np.uint32)
    pos_bytes = position.astype(np.float32).tobytes()
    nrm_bytes = normal.astype(np.float32).tobytes()
    bid_bytes = batch_ids.astype(np.uint16).tobytes()
    idx_bytes = indices.astype(np.uint32).tobytes()

    bin_blob = b""
    views = []
    for data, target in ((pos_bytes, 34962), (nrm_bytes, 34962), (bid_bytes, 34962), (idx_bytes, 34963)):
        offset = len(bin_blob)
        bin_blob += data
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})

    pmin, pmax = position.min(axis=0), position.max(axis=0)
    gltf = {
        "asset": {"version": "2.0", "generator": "odin-gmlfp-to-tiles"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "buildings"}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0, "NORMAL": 1, "_BATCHID": 2},
                "indices": 3,
                "material": 0,
            }],
        }],
        "materials": [{
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.62, 0.60, 0.58, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.95,
            },
            "doubleSided": True,
            "extensions": {
                "KHR_materials_unlit": {},
            },
        }],
        "extensionsUsed": ["KHR_materials_unlit"],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": int(position.shape[0]),
             "type": "VEC3", "min": [float(x) for x in pmin], "max": [float(x) for x in pmax]},
            {"bufferView": 1, "componentType": 5126, "count": int(normal.shape[0]), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": int(batch_ids.shape[0]),
             "type": "SCALAR", "min": [int(batch_ids.min())], "max": [int(batch_ids.max())]},
            {"bufferView": 3, "componentType": 5125, "count": int(indices.size), "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(_pad(bin_blob, b"\x00", 4))}],
    }
    json_bytes = _pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ", 8)
    bin_chunk = _pad(bin_blob, b"\x00", 4)

    glb = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(json_bytes) + 8 + len(bin_chunk))
    glb += struct.pack("<I", len(json_bytes)) + b"JSON" + json_bytes
    glb += struct.pack("<I", len(bin_chunk)) + b"BIN\x00" + bin_chunk
    return glb


def pack_b3dm(glb: bytes, rtc_center: tuple[float, float, float],
               batch_table: list[dict]) -> bytes:
    feature_table = {"BATCH_LENGTH": len(batch_table), "RTC_CENTER": [float(x) for x in rtc_center]}
    # 3D Tiles batch table: object mapping property → array (one value per feature)
    keys = batch_table[0].keys() if batch_table else []
    bt_obj = {k: [entry.get(k) for entry in batch_table] for k in keys}
    ft_json = _pad(json.dumps(feature_table, separators=(",", ":")).encode("utf-8"), b" ", 8)
    bt_json = _pad(json.dumps(bt_obj, separators=(",", ":")).encode("utf-8"), b" ", 8)
    # b3dm header layout (Cesium 1.138): magic + version + byteLength, then
    # ALL FOUR uint32 length fields BACK-TO-BACK — featureTableJSON,
    # featureTableBINARY, batchTableJSON, batchTableBINARY — THEN the two
    # JSON bodies. Binary segments are empty (0).
    header = struct.pack("<4sII", b"b3dm", 1, 0)
    payload = struct.pack("<IIII", len(ft_json), 0, len(bt_json), 0)
    payload += ft_json + bt_json + glb
    return struct.pack("<4sII", b"b3dm", 1, len(header) + len(payload)) + payload


# ───────────────────────────── feature handling ────────────────────────────
def iter_features(path: Path):
    fh = gzip.open(path, "rt", encoding="utf-8") if str(path).endswith(".gz") else open(path, "r", encoding="utf-8")
    with fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


def building_from_feature(feat, default_height: float, height_field: str = "height",
                          base_height_field: str | None = None):
    geom = feat.get("geometry") or {}
    if geom.get("type") != "Polygon":
        return None
    coords = geom.get("coordinates") or []
    if len(coords) != 1:
        return None  # holed polygons intentionally unsupported
    ring = coords[0]
    if len(ring) < 4:
        return None
    props = feat.get("properties") or {}
    try:
        h = float(props.get(height_field, -1))
    except (TypeError, ValueError):
        h = -1.0
    try:
        confidence = float(props.get("confidence", -1))
    except (TypeError, ValueError):
        confidence = -1.0
    base = 0.0
    base_source = "ellipsoid-0"
    if base_height_field:
        try:
            base = float(props.get(base_height_field) or 0.0)
        except (TypeError, ValueError):
            base = 0.0
        source = props.get("groundSource")
        base_source = "ign" if source == "ign" else ("no-data" if source else "provided")
    return {
        "ring": ring,
        "height": h if h > 0 else float(default_height),
        "heightSource": "measured" if h > 0 else "default",
        "base": base,
        "baseSource": base_source,
        "confidence": confidence,
    }


def process_file(path: Path, *, default_height: float, cell_deg: float,
                 max_features: int | None, bbox: tuple[float, float, float, float] | None,
                 height_field: str = "height", base_height_field: str | None = None):
    cells: dict[tuple[int, int], list[dict]] = {}
    lon_min, lat_min = math.inf, math.inf
    lon_max, lat_max = -math.inf, -math.inf
    skipped = 0
    n = 0
    for feat in iter_features(path):
        b = building_from_feature(feat, default_height, height_field, base_height_field)
        if b is None:
            skipped += 1
            continue
        xs = [p[0] for p in b["ring"]]
        ys = [p[1] for p in b["ring"]]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if bbox and not (bbox[0] <= cx <= bbox[2] and bbox[1] <= cy <= bbox[3]):
            continue
        key = (int(math.floor(cx / cell_deg)), int(math.floor(cy / cell_deg)))
        cells.setdefault(key, []).append(b)
        lon_min = min(lon_min, min(xs)); lon_max = max(lon_max, max(xs))
        lat_min = min(lat_min, min(ys)); lat_max = max(lat_max, max(ys))
        n += 1
        if max_features and n >= max_features:
            break
    return cells, (lon_min, lat_min, lon_max, lat_max), skipped, n


def write_tile(features, origin_ecef, out_path: Path):
    """Build one tile against one shared ECEF origin (required for RTC)."""
    o = np.array(origin_ecef, dtype=np.float64)
    all_pos, all_nrm, indices = [], [], []
    batch_ids = []
    batch_table = []
    base_vertex = 0
    skipped_buildings = 0
    for i, feat in enumerate(features):
        mesh = building_mesh(feat["ring"], feat["height"], o, feat.get("base", 0.0))
        if mesh is None:
            skipped_buildings += 1
            continue
        pos, nrm, ind = mesh
        # Batch id = the building's index within the tile's batch table (never
        # the raw input index, which may have gaps if some meshes are skipped)
        bid = np.full(pos.shape[0], len(batch_table), dtype=np.uint16)
        all_pos.append(pos.astype(np.float64))
        all_nrm.append(nrm.astype(np.float64))
        batch_ids.append(bid)
        indices.append(ind + base_vertex)
        base_vertex += pos.shape[0]
        batch_table.append({
            "id": f"b-{i}",
            "height": feat["height"],
            "heightSource": feat["heightSource"],
            "base": feat.get("base", 0.0),
            "baseSource": feat.get("baseSource", "ellipsoid-0"),
            "confidence": feat["confidence"],
        })
    if not all_pos:
        return None
    if len(batch_table) > 0xFFFF:
        raise ValueError(f"tile exceeds 65535 buildings ({len(batch_table)})")
    position = np.concatenate(all_pos, axis=0).astype(np.float32)
    normal = np.concatenate(all_nrm, axis=0).astype(np.float32)
    bid = np.concatenate(batch_ids, axis=0).astype(np.uint16)
    idx = np.concatenate(indices, axis=0).astype(np.uint32)
    glb = pack_glb(position, normal, bid, idx)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(pack_b3dm(glb, origin_ecef, batch_table))
    grounded = sum(
        1 for f in features
        if f.get("baseSource") == "ign" or float(f.get("base", 0.0)) > 0.0
    )
    return {
        "batch_length": len(batch_table),
        "skipped_buildings": skipped_buildings,
        "grounded": grounded,
        "vertex_count": int(position.shape[0]),
        "triangle_count": int(idx.shape[0]),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="+", help="GeoJSONL / GeoJSONL.gz (GMLFP format)")
    parser.add_argument("--out", required=True)
    parser.add_argument("--default-height", type=float, default=6.0)
    parser.add_argument("--cell-deg", type=float, default=0.02,
                        help="tile cell size in degrees (~2.2 km at the equator)")
    parser.add_argument("--max-features", type=int, default=None)
    parser.add_argument("--bbox", nargs=4, type=float, default=None,
                        metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--height-field", default="height",
                        help="per-feature height property (BD TOPO: use ogr2ogr SQL to emit 'height')")
    parser.add_argument("--base-height-field", default=None,
                        help="per-feature ground altitude property ('groundAltitude' from enrich_gmlfp_altitudes.py)")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    all_cells: dict[tuple[int, int], list[dict]] = {}
    lon_min, lat_min, lon_max, lat_max = math.inf, math.inf, -math.inf, -math.inf
    skipped = total = 0

    for in_path in args.input:
        cells, extent, skip, count = process_file(
            Path(in_path),
            default_height=args.default_height,
            cell_deg=args.cell_deg,
            max_features=args.max_features,
            bbox=tuple(args.bbox) if args.bbox else None,
            height_field=args.height_field,
            base_height_field=args.base_height_field,
        )
        skipped += skip
        total += count
        if math.isinf(extent[0]):
            continue
        lon_min = min(lon_min, extent[0]); lat_min = min(lat_min, extent[1])
        lon_max = max(lon_max, extent[2]); lat_max = max(lat_max, extent[3])
        for key, feats in cells.items():
            all_cells.setdefault(key, []).extend(feats)

    if not all_cells:
        print("no features processed — check input/bbox", file=sys.stderr)
        return 1

    import math as _math

    def rad(deg):
        return _math.radians(deg)

    tiles_dir = out_dir / "tiles"
    children = []
    max_h = 0.0
    min_h = math.inf
    tile_count = 0
    skipped_in_tiles = 0
    grounded_in_tiles = 0
    for key in sorted(all_cells):
        feats = all_cells[key]
        # The region bounding volume must span the REAL altitudes: the
        # vertices sit at IGN ground + extrusion (~600-1100 m in Réunion),
        # so a sea-level region breaks frustum/horizon culling and forces
        # Cesium to pick tiles with a nonsense sphere.
        bases = [f.get("base", 0.0) for f in feats]
        tops = [b + f["height"] for b, f in zip(bases, feats)]
        cell_min_h = min(bases)
        cell_max_h = max(tops)
        min_h = min(min_h, cell_min_h)
        max_h = max(max_h, cell_max_h)
        cx = (key[0] + 0.5) * args.cell_deg
        cy = (key[1] + 0.5) * args.cell_deg
        cell_west = key[0] * args.cell_deg
        cell_south = key[1] * args.cell_deg
        cell_east = cell_west + args.cell_deg
        cell_north = cell_south + args.cell_deg
        origin_ecef = ecef_from_geodetic(cy, cx, 0.0)
        tile_path = tiles_dir / f"cell_{key[0]}_{key[1]}.b3dm"
        info = write_tile(feats, origin_ecef, tile_path)
        if info is None:
            continue
        tile_count += 1
        skipped_in_tiles += info.get("skipped_buildings", 0)
        grounded_in_tiles += info.get("grounded", 0)
        children.append({
            "boundingVolume": {
                "region": [rad(cell_west), rad(cell_south), rad(cell_east), rad(cell_north), cell_min_h, cell_max_h],
            },
            "geometricError": 200.0,
            "refine": "REPLACE",
            "content": {"uri": f"tiles/cell_{key[0]}_{key[1]}.b3dm"},
        })

    # Cesium reads credits ONLY from tileset.json asset.extras.cesium.credits.
    # The client-side `credit` option is silently ignored by Cesium 1.138 —
    # keep this string identical to LOCAL_BUILDINGS_ATTRIBUTION_HTML in
    # src/maps/localBuildings.js (a test in src/maps/localBuildings.test.mjs
    # pins both).
    attribution_html = (
        '<a href="https://github.com/microsoft/GlobalMLBuildingFootprints" target="_blank" rel="noopener">Microsoft Global ML Building Footprints</a> © Microsoft (CDLA-Permissive-2.0) · '
        'heights: constant default, not measured'
    )
    tileset = {
        "asset": {
            "version": "1.0",
            "gltfUpAxis": "Z",
            "generator": "odin-gmlfp-to-tiles",
            "extras": {
                "cesium": {
                    "credits": [{"html": attribution_html}],
                },
            },
        },
        "geometricError": 1000.0,
        "refine": "ADD",
        "root": {
            "boundingVolume": {
                "region": [
                rad(float(lon_min)),
                rad(float(lat_min)),
                rad(float(lon_max)),
                rad(float(lat_max)),
                min_h if min_h != math.inf else 0.0,
                max_h,
            ],
            },
            "geometricError": 1000.0,
            "refine": "ADD",
            "children": children,
        },
        "extras": {
            "attribution": (
                "Building footprints © Microsoft (CDLA-Permissive-2.0). "
                "Heights: --default-height constant, NOT measured, unless "
                "heightSource == 'measured' in the batch table. "
                "Bases: IGN RGE ALTI orthometric when the input was enriched "
                "(baseSource == 'ign'), else ellipsoid 0 m."
            ),
            "featureCount": total,
            "skipped": skipped,
            "tileCount": tile_count,
        },
    }
    with open(out_dir / "tileset.json", "w", encoding="utf-8") as fh:
        json.dump(tileset, fh, indent=2)
    print(f"processed {total} features → {tile_count} tiles in {tiles_dir}")
    print(f"skipped (unsupported/invalid input): {skipped}")
    print(f"skipped (untriangulable buildings): {skipped_in_tiles}")
    print(f"buildings with IGN ground altitude: {grounded_in_tiles}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
