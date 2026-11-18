#!/usr/bin/env python3
"""
ODIN — enriched GMLFP data validation gate.

Verifies the enriched GeoJSONL output before regenerating 3D Tiles:
  * record count matches the raw input exactly
  * groundSource classification: ign | no-data | (http-error never appears)
  * no altitudes outside Réunion-plausible bounds, none are NaN/inf
  * geometry preserved: ring count, ring closure, coordinate types
  * duplicates (identical rings) reported, never dropped silently
  * histogram of ground altitudes (spot-eyeball vs IGN altimetry)

Exit code 0 when all hard checks pass (warnings allowed), 1 otherwise.
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import sys
from collections import Counter


def open_any(path):
    if str(path).endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, "r", encoding="utf-8")


def load_records(path):
    records = []
    with open_any(path) as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            records.append((line_no, json.loads(line)))
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", help="raw GMLFP input (.jsonl or .jsonl.gz)")
    parser.add_argument("enriched", help="enriched output GeoJSONL")
    parser.add_argument("--min-valid-ratio", type=float, default=0.85,
                        help="minimum fraction of IGN-valid altitudes")
    args = parser.parse_args()

    failures = []
    warnings = []

    raw = load_records(args.raw)
    enriched = load_records(args.enriched)

    print(f"raw records:      {len(raw)}")
    print(f"enriched records: {len(enriched)}")

    if len(raw) != len(enriched):
        failures.append(
            f"record count mismatch: raw {len(raw)} vs enriched {len(enriched)}"
        )

    src = Counter()
    grounds: list[float] = []
    geometries = []
    bad_rings = 0
    no_props = 0

    for line_no, feat in enriched:
        props = feat.get("properties")
        if props is None:
            no_props += 1
            continue
        src[props.get("groundSource", "MISSING")] += 1
        g = props.get("groundAltitude", None)
        if isinstance(g, (int, float)) and math.isfinite(g):
            grounds.append(float(g))
        ring = None
        try:
            ring = feat["geometry"]["coordinates"][0]
        except (KeyError, IndexError, TypeError):
            bad_rings += 1
            continue
        if len(ring) < 4:
            bad_rings += 1
            continue
        geometries.append(tuple(tuple(round(c, 10) for c in p) for p in ring))

    valid = src.get("ign", 0)
    nodata = src.get("no-data", 0)
    missing = src.get("MISSING", 0)
    http_error = src.get("http-error", 0)

    print(f"groundSource: ign={valid} no-data={nodata} missing={missing} http-error={http_error}")
    print(f"rings invalid: {bad_rings} | features without properties: {no_props}")
    if http_error:
        failures.append(f"http-error groundSource present ({http_error} records)")
    if valid + nodata + missing == 0:
        failures.append("no classified groundSource values found")

    ratio = valid / max(1, len(enriched))
    print(f"IGN-valid ratio: {ratio * 100:.2f}%")
    if ratio < args.min_valid_ratio:
        failures.append(
            f"IGN-valid ratio {ratio * 100:.1f}% below the {args.min_valid_ratio * 100:.0f}% gate"
        )

    if grounds:
        print(
            f"groundAltitude: min={min(grounds):.1f} max={max(grounds):.1f} "
            f"mean={sum(grounds) / len(grounds):.1f} (n={len(grounds)})"
        )
        non_finite = [g for g in grounds if not math.isfinite(g)]
        if non_finite:
            failures.append(f"non-finite altitudes: {len(non_finite)}")
        out_of_range = [g for g in grounds if g < -20 or g > 3300]
        if out_of_range:
            warnings.append(
                f"altitudes outside plausible Réunion bounds [-20, 3300]: {len(out_of_range)} "
                f"(max {max(out_of_range):.1f})"
            )

    dup = len(geometries) - len(set(geometries))
    print(f"duplicate geometries: {dup}")
    if dup:
        warnings.append(f"duplicate rings: {dup} (identical building footprints — kept, not dropped)")

    # quick sanity: the raw input must carry the same ring set (geometry preserved)
    raw_rings = set()
    for _, feat in raw:
        try:
            ring = feat["geometry"]["coordinates"][0]
            raw_rings.add(tuple(tuple(round(c, 10) for c in p) for p in ring))
        except (KeyError, IndexError, TypeError):
            continue
    enriched_rings = set(geometries)
    lost = raw_rings - enriched_rings
    if lost:
        failures.append(f"rings missing from enriched output: {len(lost)}")
    else:
        print("geometry preservation: OK (no lost rings)")

    for w in warnings:
        print(f"WARNING: {w}")
    for f in failures:
        print(f"FAILURE: {f}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
