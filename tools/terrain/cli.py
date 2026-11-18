#!/usr/bin/env python3
"""
Command-line tiler: source grid → quantized-mesh-1.0 tiles + layer.json.

Usage:
  python3 -m tools.terrain.cli input.asc --out out/dir [options]

Input format: ESRI ASCII Grid (.asc) with WGS84-aligned header.
NO downloads happen here — the operator supplies the grid.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

from tools.terrain.gridio import read_asc
from tools.terrain.qmesh import build_tile, write_layer_json, write_tile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="ESRI ASCII Grid (.asc)")
    parser.add_argument("--out", required=True, help="output directory for tiles + layer.json")
    parser.add_argument("--min-zoom", type=int, default=0)
    parser.add_argument("--max-zoom", type=int, default=6)
    parser.add_argument("--res", type=int, default=24, help="vertices per tile side")
    parser.add_argument(
        "--bounds",
        nargs=4,
        type=float,
        default=None,
        metavar=("WEST", "SOUTH", "EAST", "NORTH"),
        help="restrict to bbox (default: grid extent)",
    )
    parser.add_argument("--attribution", default="IGN — RGE ALTI® / LiDAR HD MNT (Licence Ouverte 2.0)")
    args = parser.parse_args()

    grid = read_asc(args.input)
    bounds = tuple(args.bounds) if args.bounds else (grid.xll, grid.yll, grid.xur, grid.yun)

    out_dir = args.out
    os.makedirs(out_dir, exist_ok=True)

    written = 0
    t0 = time.time()
    for z in range(args.min_zoom, args.max_zoom + 1):
        n = 1 << z
        for x in range(n):
            for y in range(n):
                lon_w = x / n * 360.0 - 180.0
                lon_e = (x + 1) / n * 360.0 - 180.0
                lat_n = _lat_from_frac(y / n)
                lat_s = _lat_from_frac((y + 1) / n)
                if lon_e < bounds[0] or lon_w > bounds[2]:
                    continue
                if lat_s > bounds[3] or lat_n < bounds[1]:
                    continue
                tile = build_tile(grid, z, x, y, grid_res=args.res)
                path = os.path.join(out_dir, str(z), str(x))
                os.makedirs(path, exist_ok=True)
                # TMS scheme: the file y index is counted from the south edge
                y_tms = n - 1 - y
                with open(os.path.join(path, f"{y_tms}.terrain"), "wb") as fh:
                    fh.write(write_tile(tile))
                written += 1
        print(f"z={z} done ({time.time() - t0:.1f}s, {written} tiles)", flush=True)

    write_layer_json(
        os.path.join(out_dir, "layer.json"),
        bounds=bounds,
        min_zoom=args.min_zoom,
        max_zoom=args.max_zoom,
        attribution=args.attribution,
    )
    print(f"wrote {written} tiles + layer.json → {out_dir}")
    return 0


def _lat_from_frac(frac: float) -> float:
    import math

    merc = math.asinh(math.tan(math.radians(85.05112878)))
    return math.degrees(2.0 * math.atan(math.exp(merc * (1.0 - 2.0 * frac))) - math.pi / 2.0)


if __name__ == "__main__":
    sys.exit(main())
