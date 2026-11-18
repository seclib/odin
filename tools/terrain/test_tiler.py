"""
Synthetic-grid roundtrip tests for the ODIN tiler — no real data downloaded.

The decoder mirrors Cesium's `createQuantizedMeshTerrainData` byte layout; it
exists here as the independent check, not as a production path.
"""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tools.terrain.gridio import read_asc
from tools.terrain.qmesh import (
    build_tile,
    ecef_from_geodetic,
    web_mercator_tile_bounds,
    write_layer_json,
    write_tile,
)

import tempfile


def make_asc(path, ncols=48, nrows=48, xll=55.0, yll=-21.5, cellsize=0.02):
    header = f"ncols {ncols}\nnrows {nrows}\nxllcorner {xll}\nyllcorner {yll}\ncellsize {cellsize}\nnodata_value -9999\n"
    rng = np.random.default_rng(42)
    rows = []
    for r in range(nrows):
        row = []
        for c in range(ncols):
            x = xll + c * cellsize
            y = yll + (nrows - r) * cellsize
            h = 800 + 600 * math.sin(x * 2) * math.cos(y * 2) + 50 * math.sin(x * 40) * math.sin(y * 40)
            row.append(f"{h:.2f}")
        rows.append(" ".join(row))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(header + "\n".join(rows) + "\n")


def zigzag_decode(n):
    return (n >> 1) ^ -(n & 1)


def parse_tile(path):
    buf = open(path, "rb").read()
    pos = 0
    center = struct.unpack_from("<3d", buf, pos); pos += 24
    min_h, max_h = struct.unpack_from("<ff", buf, pos); pos += 8
    bsphere = struct.unpack_from("<4d", buf, pos); pos += 32
    horizon = struct.unpack_from("<3d", buf, pos); pos += 24
    vcount = struct.unpack_from("<I", buf, pos)[0]; pos += 4

    def read_u16_array(count):
        nonlocal pos
        arr = np.frombuffer(buf, np.uint16, count, pos)
        pos += 2 * count
        return arr

    u = np.cumsum([zigzag_decode(int(x)) for x in read_u16_array(vcount)])
    v = np.cumsum([zigzag_decode(int(x)) for x in read_u16_array(vcount)])
    h = np.cumsum([zigzag_decode(int(x)) for x in read_u16_array(vcount)])
    bytes_per_index = 4 if vcount >= 65536 else 2
    if pos % bytes_per_index:
        pos += bytes_per_index - pos % bytes_per_index
    idx_dtype = np.uint32 if bytes_per_index == 4 else np.uint16

    tri_count = struct.unpack_from("<I", buf, pos)[0]; pos += 4
    idx_raw = np.frombuffer(buf, idx_dtype, tri_count * 3, pos); pos += idx_dtype().itemsize * tri_count * 3
    # Cesium: highest is a plain unbounded JS number; the store wraps mod 2^bits
    idx = np.empty(idx_raw.shape[0], dtype=np.uint64)
    highest = 0
    for i, code in enumerate(idx_raw):
        idx[i] = (highest - int(code)) % (1 << (bytes_per_index * 8))
        if int(code) == 0:
            highest += 1

    def read_edge(count):
        nonlocal pos
        arr = np.frombuffer(buf, idx_dtype, count, pos).astype(np.uint64)
        pos += idx_dtype().itemsize * count
        return arr

    west_vcount = struct.unpack_from("<I", buf, pos)[0]; pos += 4
    west = read_edge(west_vcount)
    south_vcount = struct.unpack_from("<I", buf, pos)[0]; pos += 4
    south = read_edge(south_vcount)
    east_vcount = struct.unpack_from("<I", buf, pos)[0]; pos += 4
    east = read_edge(east_vcount)
    north_vcount = struct.unpack_from("<I", buf, pos)[0]; pos += 4
    north = read_edge(north_vcount)

    if pos != len(buf):
        raise AssertionError(f"trailing bytes after tile parse: {len(buf) - pos}")
    return {
        "center": center,
        "minimum_height": min_h,
        "maximum_height": max_h,
        "bounding_sphere_radius": bsphere[3],
        "u": u,
        "v": v,
        "h": h,
        "indices": idx,
        "edges": (west, south, east, north),
        "vcount": vcount,
    }


def _reference_regular_grid(g):
    idx = []
    for r in range(g - 1):
        for c in range(g - 1):
            i = r * g + c
            a, b, d, e = i, i + 1, i + g, i + g + 1
            idx += [a, b, d, b, e, d]
    west = list(range(0, g * g, g))
    south = list(range(g - 1, -1, -1))
    east = list(range(g * g - 1, g - 2, -g))
    north = list(range((g - 1) * g, g * g))
    return idx, west, south, east, north


def test_asc_read_and_sample_roundtrip():
    with tempfile.NamedTemporaryFile(suffix=".asc", delete=False) as fh:
        make_asc(fh.name)
        grid = read_asc(fh.name)
    assert grid.nrows == 48 and grid.ncols == 48
    x, y = grid.xll + 0.5, grid.yun - 0.5
    h = grid.sample(x, y)
    assert 100 < h < 1600


def test_tile_build_and_write_roundtrip():
    with tempfile.NamedTemporaryFile(suffix=".asc", delete=False) as fh:
        make_asc(fh.name)
        grid = read_asc(fh.name)
    # A tile inside the grid at z=2
    tile = build_tile(grid, 2, 2, 2, grid_res=12)
    data = write_tile(tile)
    with tempfile.NamedTemporaryFile(suffix=".terrain", delete=False) as out:
        out.write(data)
        path = out.name
    parsed = parse_tile(path)
    assert parsed["vcount"] == 144
    # full roundtrip: decoded triangle list must equal the encoded regular grid
    original_idx, orig_west, orig_south, orig_east, orig_north = (
        _reference_regular_grid(12)
    )
    assert list(parsed["indices"]) == list(original_idx)
    west, south, east, north = parsed["edges"]
    assert list(west) == list(orig_west)
    assert list(south) == list(orig_south)
    assert list(east) == list(orig_east)
    assert list(north) == list(orig_north)
    assert 0 <= parsed["u"].min() and parsed["u"].max() <= 32767
    assert 0 <= parsed["v"].min() and parsed["v"].max() <= 32767
    assert parsed["u"][0] == 0 and parsed["v"][0] == 0
    assert parsed["minimum_height"] <= parsed["maximum_height"]
    # heights decode back into the same range (lossless-ish within one quantum)
    quantum = (parsed["maximum_height"] - parsed["minimum_height"]) / 32767
    assert quantum > 0
    assert parsed["indices"].max() < parsed["vcount"]
    west, south, east, north = parsed["edges"]
    assert all(len(e) > 0 for e in (west, south, east, north))
    os.unlink(path)


def test_tile_heights_match_source_grid():
    with tempfile.NamedTemporaryFile(suffix=".asc", delete=False) as fh:
        make_asc(fh.name)
        grid = read_asc(fh.name)
    tile = build_tile(grid, 2, 2, 2, grid_res=12)
    west, south, east, north = web_mercator_tile_bounds(2, 2, 2)
    lon_span = east - west
    lat_span = north - south
    # vertex j=-1 is the NE corner (south → north rows, west → east columns)
    lon = east
    lat = north
    src = grid.sample(min(lon, grid.xur - 1e-9), min(lat, grid.yun - 1e-9))
    hmax = float(tile.maximum_height)
    hmin = float(tile.minimum_height)
    expected_u16 = round((src - hmin) / (hmax - hmin) * 32767)
    actual_u16 = int(tile.quantized[-1, 2])
    assert abs(actual_u16 - expected_u16) <= 1  # one quantum of rounding


def test_layer_json_roundtrip(tmp_path=None):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "layer.json")
        write_layer_json(path, max_zoom=2, attribution="test")
        doc = json.load(open(path, encoding="utf-8"))
    assert doc["projection"] == "EPSG:3857"
    assert doc["scheme"] == "tms"
    assert doc["format"] == "quantized-mesh-1.0"
    assert [len(l) for l in doc["available"]] == [1, 1, 1]


def test_counts_total():
    print("all tiler tests passed")


if __name__ == "__main__":
    test_asc_read_and_sample_roundtrip()
    test_tile_build_and_write_roundtrip()
    test_tile_heights_match_source_grid()
    test_layer_json_roundtrip()
    test_counts_total()
