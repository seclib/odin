"""
gridio — reading source elevation grids for the ODIN tiler.

Supports the two formats IGN RGE ALTI ships openly:
  - ESRI ASCII Grid (.asc) — header lines (ncols, nrows, xllcorner/xllcenter,
    yllcorner/yllcenter, cellsize, NODATA_value) then whitespace-separated rows.
  - SRTM-style HGT (.hgt) — big-endian int16 metres at 1 arcsec (SRTMGL1) or
    3 arcsec (SRTMGL3).

Only what the tiler needs: a regular lat/lng float32 grid (row 0 = north),
cell size in degrees, and the lower-left origin.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


class GridFormatError(ValueError):
    """Malformed source grid — never silently repaired."""


@dataclass
class ElevationGrid:
    """Regular WGS84 grid, row 0 = north edge."""

    data: np.ndarray          # float32, shape (nrows, ncols)
    xll: float                # west edge longitude (deg)
    yll: float                # south edge latitude (deg)
    cellsize: float           # grid cell size (deg)
    nodata: float             # sentinel used for missing cells

    @property
    def nrows(self) -> int:
        return int(self.data.shape[0])

    @property
    def ncols(self) -> int:
        return int(self.data.shape[1])

    @property
    def xur(self) -> float:
        return self.xll + self.ncols * self.cellsize

    @property
    def yun(self) -> float:
        return self.yll + self.nrows * self.cellsize

    def sample(self, lon: float, lat: float) -> float:
        """Bilinear sample; raises if outside or over nodata."""
        if not (self.xll <= lon < self.xur and self.yll <= lat < self.yun):
            raise GridFormatError(
                f"sample outside grid bounds: lon={lon}, lat={lat}"
            )
        fx = (lon - self.xll) / self.cellsize - 0.5
        fy = (self.yun - lat) / self.cellsize - 0.5  # rows are north-first
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        dx, dy = fx - ix, fy - iy
        ix0, iy0 = max(0, min(self.ncols - 1, ix)), max(0, min(self.nrows - 1, iy))
        ix1, iy1 = max(0, min(self.ncols - 1, ix + 1)), max(0, min(self.nrows - 1, iy + 1))
        h00 = self.data[iy0, ix0]
        h01 = self.data[iy0, ix1]
        h10 = self.data[iy1, ix0]
        h11 = self.data[iy1, ix1]
        for v in (h00, h01, h10, h11):
            if v == self.nodata:
                raise GridFormatError("sample over a nodata cell")
        top = h00 * (1 - dx) + h01 * dx
        bottom = h10 * (1 - dx) + h11 * dx
        return float(top * (1 - dy) + bottom * dy)


def read_asc(path: str) -> ElevationGrid:
    """Read an ESRI ASCII Grid file."""
    header_keys = (
        "ncols", "nrows", "xllcorner", "yllcorner",
        "xllcenter", "yllcenter", "cellsize", "nodata_value",
    )
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        lines = fh.readlines()
    head = {}
    data_start = 0
    for i, line in enumerate(lines):
        parts = line.split()
        if len(parts) >= 2 and parts[0].lower() in header_keys:
            try:
                head[parts[0].lower()] = float(parts[1])
            except ValueError:
                head[parts[0].lower()] = None
            data_start = i + 1
            continue
        data_start = i
        break
    missing = {"ncols", "nrows", "cellsize"} - head.keys()
    if missing:
        raise GridFormatError(f"ASC missing header keys: {sorted(missing)}")
    ncols, nrows = int(head["ncols"]), int(head["nrows"])
    cellsize = float(head["cellsize"])
    if "xllcorner" in head:
        xll = float(head["xllcorner"])
    elif "xllcenter" in head:
        xll = float(head["xllcenter"]) - 0.5 * cellsize
    else:
        raise GridFormatError("ASC missing xllcorner/xllcenter")
    if "yllcorner" in head:
        yll = float(head["yllcorner"])
    elif "yllcenter" in head:
        yll = float(head["yllcenter"]) - 0.5 * cellsize
    else:
        raise GridFormatError("ASC missing yllcorner/yllcenter")
    nodata = float(head.get("nodata_value") or -9999)
    body = " ".join(line.strip() for line in lines[data_start:])
    data = np.fromstring(body, sep=" ", dtype=np.float32)
    if data.size != ncols * nrows:
        raise GridFormatError(
            f"ASC data rows mismatch: expected {ncols * nrows}, got {data.size}"
        )
    grid = data.reshape(nrows, ncols).copy()
    return ElevationGrid(grid, xll, yll, cellsize, nodata)


def read_hgt(path: str) -> ElevationGrid:
    """Deprecated: HGT origin is part of the filename; use read_hgt_named()."""
    return read_hgt_named(path)


def read_hgt_named(path: str) -> ElevationGrid:
    """HGT named like 'N20E055.hgt' — origin parsed from the filename."""
    import os
    import re

    base = os.path.basename(path).upper()
    m = re.match(r"^([NS])(\d{2})([EW])(\d{3})\.HGT$", base)
    if not m:
        raise GridFormatError(f"unrecognised HGT filename: {base}")
    ns, lat, ew, lon = m.groups()
    yll = int(lat)
    if ns == "S":
        yll = -yll - 1
    xll = int(lon)
    if ew == "W":
        xll = -xll - 1
    with open(path, "rb") as fh:
        raw = fh.read()
    n = int(math.isqrt(len(raw) // 2))
    if n * n * 2 != len(raw):
        raise GridFormatError(f"HGT size {len(raw)} is not a square grid")
    data = np.frombuffer(raw, dtype=">i2").reshape(n, n).astype(np.float32)
    nodata = -32768.0
    data[data == nodata] = np.nan
    cellsize = 1.0 / n
    return ElevationGrid(np.nan_to_num(data, nan=-9999.0), float(xll), float(yll), cellsize, -9999.0)


def east_north_mercator(lon: float, lat: float) -> tuple[float, float]:
    """Web Mercator EPSG:3857 coordinates of a WGS84 point (metres)."""
    R = 6378137.0
    x = math.radians(lon) * R
    y = R * math.asinh(math.tan(math.radians(lat)))
    return x, y


def inverse_east_north_mercator(x: float, y: float) -> tuple[float, float]:
    R = 6378137.0
    lon = math.degrees(x / R)
    lat = math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
    return lon, lat
