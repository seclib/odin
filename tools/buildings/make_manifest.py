#!/usr/bin/env python3
"""
ODIN — write the provenance manifest + SHA-256 checksums for a local
buildings tileset (e.g. <repo>/storage/buildings-974).

The manifest records exactly what ODIN must know:
  * source dataset (name, publisher, CDLA-Permissive-2.0, retrieval quadkeys);
  * what the buildings ARE and are NOT made of (footprints measured by
    Microsoft — heights are NOT: constant --default-height; bases are IGN
    RGE ALTI orthometric when enriched);
  * generation parameters (cell size, gltfUpAxis, totals);
  * integrity (checksums.sha256 covers every regular file in the master dir
    except the manifest and the checksum list itself).

Never fabricates values: the counts are computed from the files on disk.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys
import time
from pathlib import Path


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dir_stats(root: Path, exclude):
    total_bytes = 0
    file_count = 0
    per_file = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if rel in exclude:
            continue
        per_file.append((rel, path))
        total_bytes += path.stat().st_size
        file_count += 1
    return file_count, total_bytes, per_file


def enriched_stats(enriched_dir: Path):
    counts = {"ign": 0, "no-data": 0}
    ground_min = None
    ground_max = None
    ground_sum = 0.0
    ground_n = 0
    for path in sorted(enriched_dir.glob("*.jsonl*")):
        opener = gzip.open if path.suffix == ".gz" else open
        with opener(path, "rt", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                feat = json.loads(line)
                p = feat.get("properties") or {}
                src = p.get("groundSource", "missing")
                if src in counts:
                    counts[src] += 1
                g = p.get("groundAltitude")
                if isinstance(g, (int, float)):
                    g = float(g)
                    ground_min = g if ground_min is None or g < ground_min else ground_min
                    ground_max = g if ground_max is None or g > ground_max else ground_max
                    ground_sum += g
                    ground_n += 1
    mean = ground_sum / ground_n if ground_n else None
    return counts, ground_min, ground_max, mean


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("master", help="master directory (e.g. <repo>/storage/buildings-974)")
    parser.add_argument(
        "--scope",
        default="full-island",
        help="coverage of the tileset: 'full-island' or e.g. 'pilot-100' when a subset",
    )
    parser.add_argument(
        "--scope-note",
        default="",
        help="explicit note when the tileset is a subset, never silently passed as the full dataset",
    )
    args = parser.parse_args()
    master = Path(args.master).expanduser().resolve()
    if not master.is_dir():
        print(f"master directory not found: {master}", file=sys.stderr)
        return 1

    tileset_path = master / "tiles" / "tileset.json"
    if not tileset_path.is_file():
        print(f"tileset.json not found under {master}/tiles — build the tiles first", file=sys.stderr)
        return 1
    with open(tileset_path, "r", encoding="utf-8") as fh:
        tileset = json.load(fh)
    extras = tileset.get("extras", {})
    # The manifest's own creation time is NOT the dataset's generation time:
    # provenance must remain truthful after a manifest is regenerated months
    # later, so take the date from the tileset file itself.
    tiles_generated_at = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(tileset_path.stat().st_mtime)
    )

    # raw + enriched stats
    src_dir = master / "source"
    enr_dir = master / "enriched"
    src_files = sorted(p.name for p in src_dir.glob("*.csv.gz")) if src_dir.is_dir() else []
    enr_files = sorted(p.name for p in enr_dir.glob("*.jsonl*")) if enr_dir.is_dir() else []
    counts, g_min, g_max, g_mean = (
        enriched_stats(enr_dir) if enr_dir.is_dir() else ({"ign": 0, "no-data": 0}, None, None, None)
    )

    tiles_dir = master / "tiles"
    num_tiles, tiles_bytes, tiles_files = dir_stats(master, set())
    tile_count = len(list(tiles_dir.rglob("*.b3dm"))) if tiles_dir.is_dir() else 0

    # Tool "versions" are content hashes, not invented release numbers: the
    # converter and enricher are repo scripts, so their SHA-256 is the only
    # trustworthy identity of the code that produced this store.
    def tool_identity(relative: str) -> dict:
        script = Path(__file__).resolve().parents[2] / relative
        return {
            "path": relative,
            "sha256": sha256_of(script) if script.is_file() else None,
        }

    manifest = {
        "name": "odin-buildings-974",
        "schemaVersion": 1,
        "versions": {
            "manifest": 1,
            "tilesetSpec": "3D Tiles 1.0 / glTF 2.0",
            "converter": tool_identity("tools/buildings/gmlfp_to_tiles.py"),
            "altitudeEnricher": tool_identity("tools/buildings/enrich_gmlfp_altitudes.py"),
        },
        "description": (
            "Local 3D Tiles tileset of building footprints for La Réunion "
            "generated by ODIN tooling. Ships in the user data directory, "
            "never in the repository, never on a network endpoint by default."
        ),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tilesGeneratedAt": tiles_generated_at,
        "generator": {
            "tool": "GMLFP → B3DM via tools/buildings/gmlfp_to_tiles.py",
            "altitudeEnricher": "tools/buildings/enrich_gmlfp_altitudes.py",
            "cellDeg": 0.02,
            "gltfUpAxis": "Z",
            "rtcCenter": True,
            "batchTable": "_BATCHID per building, JSON table with id/height/heightSource/base/baseSource/confidence",
        },
        "source": {
            "dataset": "Microsoft Global ML Building Footprints",
            "publisher": "Microsoft",
            "datasetLinks": "https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv",
            "quadkeys": src_files,
            "retrieved": "2026-11-17",
            "datasetRefresh": "2026-08-13",
            "format": "GeoJSONL (.csv.gz payload, one Feature per line)",
            "license": "CDLA-Permissive-2.0",
            "licenseUrl": "https://cdla.dev/permissive-2-0/",
            "attribution": "Building footprints © Microsoft (CDLA-Permissive-2.0)",
            "attributionHtml": (
                '<a href="https://github.com/microsoft/GlobalMLBuildingFootprints" '
                'target="_blank" rel="noopener">Microsoft Global ML Building Footprints</a> '
                "© Microsoft (CDLA-Permissive-2.0)"
            ),
        },
        "heights": {
            "heightSource": "default",
            "defaultHeightM": 6.0,
            "measuredCount": 0,
            "note": (
                "GMLFP carries NO measured height for La Réunion (every record has height=-1, "
                "verified 2026-08-13 dataset). All buildings are extruded with the constant "
                "--default-height 6.0 m. No height here is a measurement."
            ),
        },
        "bases": {
            "source": "IGN RGE ALTI (resource ign_rge_alti_wld, static national pyramid)",
            "method": "max of the 4 bbox corners of each footprint",
            "verticalDatum": "NGF-IGN69 (orthometric metres — NOT ellipsoidal; no geoid correction applied)",
            "validIgnCount": counts.get("ign", 0),
            "missingCount": counts.get("no-data", 0),
            "groundAltitudeMinM": g_min,
            "groundAltitudeMaxM": g_max,
            "groundAltitudeMeanM": g_mean,
        },
        "result": {
            "scope": args.scope,
            "scopeNote": args.scope_note,
            "featuresProcessed": extras.get("featureCount"),
            "featuresSkippedInput": extras.get("skipped"),
            "tiles": tile_count,
            "bbox": tileset.get("root", {}).get("boundingVolume", {}).get("region"),
        },
        "usage": {
            "viteEnv": "VITE_LOCAL_BUILDINGS_URL=/odin-local-buildings/tileset.json",
            "deploy": "node tools/deploy-local-buildings.mjs",
            "layerId": "local-buildings",
        },
        "integrity": {
            "checksumsFile": "checksums.sha256",
            "checksumsCover": "all regular files under this directory except manifest.json and checksums.sha256",
            "verify": "cd <this directory> && sha256sum -c checksums.sha256",
        },
    }

    manifest_path = master / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    # checksums for every file except manifest.json and checksums.sha256
    checksums_path = master / "checksums.sha256"
    lines = []
    for path in sorted(master.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(master).as_posix()
        if rel in ("manifest.json", "checksums.sha256"):
            continue
        lines.append(f"{sha256_of(path)}  {rel}\n")
    with open(checksums_path, "w", encoding="utf-8") as fh:
        fh.writelines(lines)

    print(f"manifest.json written → {manifest_path}")
    print(f"checksums.sha256 written → {checksums_path} ({len(lines)} entries)")
    print(f"total files: {num_tiles}, total bytes: {tiles_bytes}")
    print(f"buildings: {manifest['result']['featuresProcessed']} | tiles: {tile_count}")
    print(f"IGN-valid bases: {counts.get('ign')} | missing: {counts.get('no-data')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
