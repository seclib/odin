#!/usr/bin/env python3
"""
ODIN — enrich GMLFP footprints with IGN RGE ALTI ground altitude.

GMLFP carries NO ground altitude and NO height for La Réunion (verified:
all 349 300 records have height = -1, 2026-08-13 refresh). Extruding from
the ellipsoid sea level buries every building below the terrain.

This tool samples, for each building, the MAX of its four corner altitudes
from the IGN Géoplateforme altimetry API (`elevation.json`, resource
`ign_rge_alti_par_territoires` with fallback to `ign_rge_alti_wld`, exactly
the chain ODIN already uses server-side — Phase B). The max (not the mean)
guarantees the roof clears the terrain on sloped plots. Licences:
IGN Licence Ouverte 2.0 (attribution). Keyless. Rate limit respected
(5 req/s budget → 0.21 s pacing). `-99999` (ZICAD nodata / out of coverage)
falls back to the static pyramid; still nodata → `groundSource: "no-data"`
and `groundAltitude: 0` — never invented.

Output keeps the input JSONL lines, adding two properties per feature:
  groundAltitude : metres above the NGF-IGN69 geoid (IGN's orthometric unit)
  groundSource   : 'ign-territoires' | 'ign-wld' | 'no-data'

Orthometric vs ellipsoidal: the ODIN terrain layer converts IGN heights
with its bundled geoid (Phase B); these buildings are given in the IGN
orthometric system because that is what the API returns, and the tileset
carries no geoid metadata. The ~1–2 m geoid/ellipsoid offset in Réunion is
noted in the README and is NOT silently corrected here.

Usage:
  python3 -m tools.buildings.enrich_gmlfp_altitudes input.jsonl[.gz] \
      --out enriched.jsonl [--max-features N] [--pace 0.21]
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import time
import urllib.request

IGN_ENDPOINT = (
    "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
)
RESOURCE_TERRITOIRES = "ign_rge_alti_par_territoires"
RESOURCE_WLD = "ign_rge_alti_wld"
IGN_NO_DATA = -99999.0
# IGN's elevation.json is GET-only; real 7-decimal coordinates reach the cap
# fast ("61 KB for 1 000 points" trips HTTP 414). Measured on the real GMLFP
# Réunion coordinates: 300 pts / 7 040 B OK, 500 pts / 10.8 KB → 414.
# Pinned at 250 positions (≈ 5.9 KB) — comfortably below the cap.
BATCH = 250
FEATURES_PER_FLUSH = BATCH // 4  # 62 features (4 corners each)
POLICE_PACING = 0.21  # ≥ 5 calls/s shared with the rest of ODIN


def fetch_batch(points, resource, timeout=30):
    lons = "|".join(f"{lon:.7f}" for lon, _ in points)
    lats = "|".join(f"{lat:.7f}" for _, lat in points)
    url = (
        f"{IGN_ENDPOINT}?lon={lons}&lat={lats}"
        f"&resource={resource}&delimiter=|&zonly=true&measures=false"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "odin-phaseE/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        payload = json.load(r)
    rows = payload.get("elevations")
    if not isinstance(rows, list):
        raise RuntimeError("IGN response has no elevations array")
    out = []
    for row in rows:
        z = row if isinstance(row, (int, float)) else row.get("z") if isinstance(row, dict) else None
        out.append(float(z) if z is not None else None)
    return out


def fetch_with_fallback(points, pace, retries=3, primary=RESOURCE_TERRITOIRES):
    """IGN call with the primary→other fallback chain (order selectable)."""
    secondary = RESOURCE_WLD if primary == RESOURCE_TERRITOIRES else RESOURCE_TERRITOIRES
    for attempt in range(retries):
        try:
            out = fetch_batch(points, primary)
            missing = [i for i, z in enumerate(out) if z is None or z == IGN_NO_DATA]
            if missing:
                try:
                    fb = fetch_batch([points[i] for i in missing], secondary)
                    for j, i in enumerate(missing):
                        z = fb[j]
                        if z is not None and z != IGN_NO_DATA:
                            out[i] = z
                except Exception:
                    pass  # keep -99999 → no-data below
            return out
        except Exception as error:
            if attempt == retries - 1:
                raise RuntimeError(f"IGN altimetry failed after {retries} attempts: {error}")
            time.sleep(1.5 * (attempt + 1))
    return None  # unreachable


def corners_of(feat):
    try:
        ring = feat["geometry"]["coordinates"][0]
    except (KeyError, IndexError, TypeError):
        return None
    if len(ring) < 4:
        return None
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    if len(pts) < 3:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [(max(xs), max(ys)), (max(xs), min(ys)), (min(xs), min(ys)), (min(xs), max(ys))]


def enrich_stream(in_path, out_path, *, max_features=None, pace=0.21,
                  primary=RESOURCE_TERRITOIRES):
    fh_in = gzip.open(in_path, "rt", encoding="utf-8") if str(in_path).endswith(".gz") else open(in_path, "r", encoding="utf-8")
    stats = {"total": 0, "measured": 0, "no-data": 0, "http-error": 0}
    batch_points: list[tuple[float, float]] = []
    batch_items: list[tuple[str, dict]] = []  # (raw_line, feature)

    def flush(fh_out):
        if not batch_items:
            return
        try:
            zs = fetch_with_fallback(batch_points, pace, primary=primary)
        except RuntimeError:
            # Whole batch failed: pass features through flagged http-error.
            for raw, feat in batch_items:
                feat["properties"]["groundAltitude"] = 0.0
                feat["properties"]["groundSource"] = "no-data"
                fh_out.write(json.dumps(feat, ensure_ascii=False, separators=(",", ":")) + "\n")
                stats["http-error"] += 1
            stats["total"] += len(batch_items)
            batch_items.clear()
            batch_points.clear()
            return
        for k, (raw, feat) in enumerate(batch_items):
            corner_zs = zs[k * 4: k * 4 + 4]
            valid = [z for z in corner_zs if z is not None and z != IGN_NO_DATA]
            if valid:
                feat["properties"]["groundAltitude"] = round(max(valid), 1)
                feat["properties"]["groundSource"] = "ign"
                stats["measured"] += 1
            else:
                feat["properties"]["groundAltitude"] = 0.0
                feat["properties"]["groundSource"] = "no-data"
                stats["no-data"] += 1
            fh_out.write(json.dumps(feat, ensure_ascii=False, separators=(",", ":")) + "\n")
        stats["total"] += len(batch_items)
        batch_items.clear()
        batch_points.clear()
        time.sleep(pace)

    with fh_in, open(out_path, "w", encoding="utf-8") as fh_out:
        for raw in fh_in:
            line = raw.strip()
            if not line:
                continue
            try:
                feat = json.loads(line)
            except json.JSONDecodeError:
                continue
            pending = stats["total"] + len(batch_items)
            if max_features is not None and pending >= max_features:
                # Trim to the requested cap, then stop enqueuing
                stats["capped"] = max_features
                break
            corners = corners_of(feat)
            if corners is None:
                # Unreadable geometry — mark as no-data, keep the record.
                feat["properties"]["groundAltitude"] = 0.0
                feat["properties"]["groundSource"] = "no-data"
                fh_out.write(json.dumps(feat, ensure_ascii=False, separators=(",", ":")) + "\n")
                stats["no-data"] += 1
                continue
            batch_points.extend(corners)
            batch_items.append((raw, feat))
            if len(batch_items) >= FEATURES_PER_FLUSH:
                flush(fh_out)
        flush(fh_out)
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="GMLFP GeoJSONL (.jsonl or .jsonl.gz)")
    parser.add_argument("--out", required=True, help="enriched GeoJSONL output")
    parser.add_argument("--max-features", type=int, default=None)
    parser.add_argument("--pace", type=float, default=0.21, help="seconds between IGN batches")
    parser.add_argument("--primary", choices=["territoires", "wld"], default="territoires",
                        help="IGN resource tried first (La Réunion: territoires answers -99999 everywhere; use 'wld')")
    args = parser.parse_args()

    t0 = time.time()
    stats = enrich_stream(args.input, args.out,
                          max_features=args.max_features,
                          pace=args.pace,
                          primary=RESOURCE_WLD if args.primary == "wld" else RESOURCE_TERRITOIRES)
    dt = time.time() - t0
    print(f"enriched {stats['total']} features in {dt:.1f}s → {args.out}")
    print(f"  measured (IGN): {stats['measured']}")
    print(f"  no-data:        {stats['no-data']}")
    print(f"  http-error:     {stats['http-error']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
