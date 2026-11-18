"""
qmesh — quantized-mesh-1.0 terrain tile writer (CesiumJS-compatible).

Format (little-endian) — mirror of Cesium's decoder
(`createQuantizedMeshTerrainData`, verified against Cesium 1.138):

  center                       3 × float64   ECEF of the tile's relative origin
  minimumHeight / maximumHeight 2 × float32   metres above WGS84 ellipsoid
  boundingSphere.center        3 × float64
  boundingSphere.radius        1 × float64
  horizonOcclusionPoint        3 × float64
  vertexCount                  1 × uint32
  quantizedVertices            3 × vertexCount × uint16  (u…, v…, h… blocks,
                               zigZag-delta elements)
  triangleCount                1 × uint32
  indices                      triangleCount × 3 × uint16|uint32  (zigZag-delta,
                               "highest - code")
  westVertexCount + westIndices, south…, east…, north…  (uint32 + indices)
  extensions                   (none emitted)

The writer emits EPSG:3857 tiles (unit metres) but the vertices are encoded in
relative lat/lng, so any tiling scheme Cesium supports can be used. ODIN
consumes these through `Cesium.CesiumTerrainProvider` with an
`EPSG:3857` `layer.json`.
"""
from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass

import numpy as np

EARTH_A = 6378137.0
EARTH_F = 1.0 / 298.257223563
EARTH_B = EARTH_A * (1 - EARTH_F)
EARTH_E2 = 2 * EARTH_F - EARTH_F * EARTH_F

MERC_MAX = math.asinh(math.tan(math.radians(85.05112878)))


def mercator_lat_from_frac(frac: float) -> float:
    """frac ∈ [0, 1] from the NORTH edge downward; returns latitude (deg)."""
    return math.degrees(2.0 * math.atan(math.exp(MERC_MAX * (1.0 - 2.0 * frac))) - math.pi / 2.0)


def web_mercator_tile_bounds(x: int, y: int, level: int):
    """OSM/Cesium Web Mercator tile → (west, south, east, north) in degrees."""
    n = 1 << level
    lon_w = x / n * 360.0 - 180.0
    lon_e = (x + 1) / n * 360.0 - 180.0
    lat_n = mercator_lat_from_frac(y / n)
    lat_s = mercator_lat_from_frac((y + 1) / n)
    return lon_w, lat_s, lon_e, lat_n


def ecef_from_geodetic(lat_deg: float, lon_deg: float, h: float) -> tuple[float, float, float]:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    sin_lat, cos_lat = math.sin(lat), math.cos(lat)
    s2 = sin_lat * sin_lat
    n = EARTH_A / math.sqrt(1.0 - EARTH_E2 * s2)
    x = (n + h) * cos_lat * math.cos(lon)
    y = (n + h) * cos_lat * math.sin(lon)
    z = (n * (1.0 - EARTH_E2) + h) * sin_lat
    return x, y, z


def horizon_occlusion_point(
    positions: np.ndarray,
    center: np.ndarray,
    minimum_height: float,
) -> tuple[float, float, float]:
    """
    ECEF-scaled-space point below which the tile is guaranteed invisible.

    Mirrors EllipsoidalOccluder.computeHorizonCullingPointFromVertices in
    CesiumJS: work in the ellipsoid-scaled space, take the direction
    ellipsoid-center → tile-center, and find the farthest magnitude along
    that direction at which any vertex still grazes the limb. If any vertex
    ends up negative (buried under the shrunk ellipsoid), Cesium itself
    returns void; we mirror with the unit limb point instead of culling the
    tile by accident.
    """
    radii = np.array([EARTH_A, EARTH_A, EARTH_B], dtype=np.float64)
    if minimum_height < 0 and radii.min() > -minimum_height:
        radii = radii + minimum_height

    direction = center.astype(np.float64) / radii
    norm = np.linalg.norm(direction)
    if norm == 0.0:
        direction = np.array([0.0, 0.0, 1.0])
        norm = 1.0
    direction = direction / norm

    result_mag = 0.0
    for p in positions:
        sp = p / radii
        mag = np.linalg.norm(sp)
        d = sp / mag
        mag = max(1.0, mag)
        cos_a = float(np.dot(d, direction))
        sin_a = float(np.linalg.norm(np.cross(d, direction)))
        cos_b = 1.0 / mag
        sin_b = math.sqrt(mag * mag - 1.0) * cos_b
        candidate = 1.0 / (cos_a * cos_b - sin_a * sin_b)
        if candidate < 0.0:
            # Cesium returns void; the tile will only be hidden when its
            # occlusion point is hidden, so a unit limb point is the
            # least-aggressive conservative answer.
            return (float(direction[0]), float(direction[1]), float(direction[2]))
        if candidate > result_mag:
            result_mag = candidate
    if result_mag <= 0.0 or not math.isfinite(result_mag):
        return (float(direction[0]), float(direction[1]), float(direction[2]))
    point = direction * result_mag
    return (float(point[0]), float(point[1]), float(point[2]))


@dataclass
class TileData:
    quantized: np.ndarray            # (vertexCount, 3) uint16 (u, v, h)
    indices: np.ndarray              # uint64 indices (triangle list)
    west_indices: np.ndarray
    south_indices: np.ndarray
    east_indices: np.ndarray
    north_indices: np.ndarray
    minimum_height: float
    maximum_height: float
    center: tuple[float, float, float]
    bounding_radius: float
    horizon_occlusion_point: tuple[float, float, float]
    ecef_positions: np.ndarray


def zigzag_delta_encode(values: np.ndarray) -> np.ndarray:
    """ZigZag + delta, matching AttributeCompression.zigZagDeltaDecode."""
    values = values.astype(np.int64)
    deltas = np.empty_like(values)
    deltas[0] = values[0]
    deltas[1:] = values[1:] - values[:-1]
    out = np.where(deltas >= 0, deltas * 2, -deltas * 2 - 1)
    return out.astype(np.uint16)


def zigzag_delta_encode_indices(values: np.ndarray, width_bytes: int = 2) -> np.ndarray:
    """
    Encode the triangle/edge indices as Cesium expects.

    Cesium decodes with a running `highest` (plain JS number, unbounded) and
    does `indices[i] = highest - code` storing into a Uint16Array/Uint32Array,
    i.e. the subtraction wraps modulo 2^bits. The encoder mirrors that:
    `code = (highest - value) mod 2^bits`; when code == 0 both sides advance
    `highest`. Python ints are used so there is no fixed-width wrap surprise;
    the mod is explicit.
    """
    mask = (1 << (width_bytes * 8)) - 1
    out = np.empty(values.shape[0], dtype=np.uint16 if width_bytes == 2 else np.uint32)
    highest = 0
    for i in range(values.shape[0]):
        code = (highest - int(values[i])) & mask
        out[i] = code
        if code == 0:
            highest += 1
    return out


def raw_indices(values: np.ndarray, width_bytes: int = 2) -> np.ndarray:
    """Edge indices are stored raw (no transform) per the spec."""
    return values.astype(np.uint16 if width_bytes == 2 else np.uint32)


def _build_regular_grid(grid_res: int):
    """
    Vertices are ordered south → north, west → east (row 0 = south, v = 0).
    Triangle winding is counter-clockwise seen from outside the ellipsoid.
    Edge index lists follow the spec:
      west   — south → north
      south  — east → west
      east   — north → south
      north  — west → east
    """
    g = grid_res
    indices = []
    for r in range(g - 1):
        for c in range(g - 1):
            i = r * g + c          # south-west corner of the cell
            a, b, d, e = i, i + 1, i + g, i + g + 1
            indices += [a, b, d, b, e, d]
    idx = np.asarray(indices, dtype=np.uint64)
    west = np.arange(0, g * g, g, dtype=np.uint64)               # S → N
    south = np.arange(g - 1, -1, -1, dtype=np.uint64)             # E → W
    east = np.arange(g * g - 1, g - 2, -g, dtype=np.uint64)       # N → S
    north = np.arange((g - 1) * g, g * g, dtype=np.uint64)        # W → E
    return idx, west, south, east, north


def build_tile(grid, z: int, x: int, y: int, grid_res: int = 24, max_h: float | None = None):
    """Build the TileData for one tile (z/x/y, slippy-map y orientation)."""
    west, south, east, north = web_mercator_tile_bounds(x, y, z)
    lon_min, lat_min, lon_max, lat_max = west, south, east, north
    # Vertex rows south → north (v = 0 at the southern edge per the spec).
    us = np.linspace(0.0, 1.0, grid_res, dtype=np.float32)
    vs = np.linspace(0.0, 1.0, grid_res, dtype=np.float32)

    qs = np.empty((grid_res, grid_res), dtype=np.float32)
    for j, v in enumerate(vs):
        lat = lat_min + (lat_max - lat_min) * float(v)
        for i, u in enumerate(us):
            lon = lon_min + (lon_max - lon_min) * float(u)
            lon = float(np.clip(lon, grid.xll, grid.xur - 1e-9))
            lat = float(np.clip(lat, grid.yll, grid.yun - 1e-9))
            qs[j, i] = grid.sample(lon, lat)

    h_min = float(np.min(qs))
    h_max = float(np.max(qs)) if max_h is None else float(max_h)
    if h_max == h_min:
        h_max = h_min + 1.0

    u16 = (us * 32767).astype(np.uint16)
    v16 = (vs * 32767).astype(np.uint16)
    h_scaled = np.rint((qs - h_min) / (h_max - h_min) * 32767.0).astype(np.int32)
    h_scaled = np.clip(h_scaled, 0, 32767).astype(np.uint16)

    vertex_count = grid_res * grid_res
    quantized = np.empty((vertex_count, 3), dtype=np.uint16)
    quantized[:, 0] = np.tile(u16, grid_res)
    quantized[:, 1] = np.repeat(v16, grid_res)
    quantized[:, 2] = h_scaled.reshape(-1)

    idx, west_idx, south_idx, east_idx, north_idx = _build_regular_grid(grid_res)

    # ECEF positions of all vertices, same south → north order as qs
    positions = []
    for j in range(grid_res):
        lat = lat_min + (lat_max - lat_min) * float(vs[j])
        for i in range(grid_res):
            lon = lon_min + (lon_max - lon_min) * float(us[i])
            positions.append(ecef_from_geodetic(lat, lon, float(qs[j, i])))
    arr = np.asarray(positions, dtype=np.float64)
    center = (
        float(arr[:, 0].mean()),
        float(arr[:, 1].mean()),
        float(arr[:, 2].mean()),
    )
    c = np.asarray(center, dtype=np.float64)
    radius = float(np.sqrt(((arr - c) ** 2).sum(axis=1)).max())
    horizon = horizon_occlusion_point(arr, center=c, minimum_height=h_min)

    return TileData(
        quantized=quantized,
        indices=idx,
        west_indices=west_idx,
        south_indices=south_idx,
        east_indices=east_idx,
        north_indices=north_idx,
        minimum_height=h_min,
        maximum_height=h_max,
        center=center,
        bounding_radius=radius,
        horizon_occlusion_point=horizon,
        ecef_positions=arr,
    )


def write_tile(td: TileData) -> bytes:
    """Serialize a TileData to the quantized-mesh-1.0 byte layout."""
    vcount = td.quantized.shape[0]
    bytes_per_index = 4 if vcount >= 65536 else 2

    out = bytearray()
    out += struct.pack("<3d", *td.center)
    out += struct.pack("<f", td.minimum_height)
    out += struct.pack("<f", td.maximum_height)
    out += struct.pack("<3d", *td.center)  # bounding sphere centre
    out += struct.pack("<d", td.bounding_radius)
    out += struct.pack("<3d", *td.horizon_occlusion_point)
    out += struct.pack("<I", vcount)

    # Vertex arrays: u…, v…, h…, zigzag-delta each
    u = zigzag_delta_encode(td.quantized[:, 0].astype(np.int64))
    v = zigzag_delta_encode(td.quantized[:, 1].astype(np.int64))
    h = zigzag_delta_encode(td.quantized[:, 2].astype(np.int64))
    out += u.tobytes()
    out += v.tobytes()
    out += h.tobytes()

    # Padding so index data starts on a 2 / 4 byte boundary
    if len(out) % bytes_per_index:
        out += b"\0" * (bytes_per_index - len(out) % bytes_per_index)

    idx = zigzag_delta_encode_indices(td.indices, bytes_per_index)
    out += struct.pack("<I", idx.shape[0] // 3)
    out += idx.tobytes()

    for edge in (td.west_indices, td.south_indices, td.east_indices, td.north_indices):
        edge_raw = raw_indices(edge, bytes_per_index)
        out += struct.pack("<I", edge_raw.shape[0])
        out += edge_raw.tobytes()

    return bytes(out)


def write_layer_json(path: str, *,
                     bounds=(-180.0, -85.05112878, 180.0, 85.05112878),
                     min_zoom: int = 0,
                     max_zoom: int = 6,
                     attribution: str = "IGN — RGE ALTI® / LiDAR HD MNT (Licence Ouverte 2.0)",
                     ) -> None:
    """Write the layer.json Cesium consumes."""
    available = [
        [[0, 0, (1 << z) - 1, (1 << z) - 1]] for z in range(min_zoom, max_zoom + 1)
    ]
    doc = {
        "format": "quantized-mesh-1.0",
        "version": "1.0.0",
        "scheme": "tms",
        "tiles": ["{z}/{x}/{y}.terrain"],
        "minzoom": min_zoom,
        "maxzoom": max_zoom,
        "projection": "EPSG:3857",
        "bounds": list(bounds),
        "available": available,
        "attribution": attribution,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)
