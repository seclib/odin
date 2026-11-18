"""
Provenance manifest tests for the durable local buildings store.

The manifest is the record ODIN relies on to tell a pilot subset from a full
island build, and a tileset generation date from the day the manifest was
regenerated. Both must be derived from the files on disk, never guessed.
"""
import calendar
import hashlib
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, REPO)

from tools.buildings import make_manifest as m  # noqa: E402


def _fixture(tmp_path):
    master = tmp_path / "buildings-974"
    (master / "source").mkdir(parents=True)
    (master / "enriched").mkdir()
    (master / "tiles" / "tiles").mkdir(parents=True)
    (master / "source" / "301023330.csv.gz").write_bytes(b"\x1f\x8bfake")
    (master / "enriched" / "pilot-100-enriched.jsonl").write_text(
        json.dumps(
            {
                "type": "Feature",
                "properties": {"groundAltitude": 14.0, "groundSource": "ign"},
                "geometry": {"type": "Polygon", "coordinates": [[[55.5, -21.3]]]},
            }
        )
        + "\n"
    )
    tile = master / "tiles" / "tiles" / "cell_0_0.b3dm"
    tile.write_bytes(b"b3dm-test")
    tileset = master / "tiles" / "tileset.json"
    tileset.write_text(
        json.dumps(
            {
                "extras": {"featureCount": 100},
                "root": {"boundingVolume": {"region": [0.96, -0.37, 0.97, -0.36, 14.0, 1135.2]}},
            }
        )
    )
    # FIXTURE_DATE: 2026-11-17 19:34:00 UTC — the tileset generation time.
    stamp = calendar.timegm(time.strptime("2026-11-17 19:34:00", "%Y-%m-%d %H:%M:%S"))
    os.utime(tileset, (stamp, stamp))
    return master


def test_manifest_records_tileset_date_and_pilot_scope(tmp_path):
    master = _fixture(tmp_path)
    rc = subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.buildings.make_manifest",
            str(master),
            "--scope",
            "pilot-100",
            "--scope-note",
            "subset: full 349300-building enrichment not generated",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    assert rc.returncode == 0, rc.stderr

    manifest = json.loads((master / "manifest.json").read_text())
    assert manifest["tilesGeneratedAt"] == "2026-11-17T19:34:00Z"
    assert manifest["createdAt"] > manifest["tilesGeneratedAt"]
    assert manifest["schemaVersion"] == 1
    assert manifest["versions"]["manifest"] == 1
    assert manifest["versions"]["tilesetSpec"] == "3D Tiles 1.0 / glTF 2.0"
    assert len(manifest["versions"]["converter"]["sha256"]) == 64
    assert manifest["result"]["scope"] == "pilot-100"
    assert "subset" in manifest["result"]["scopeNote"]
    assert manifest["result"]["featuresProcessed"] == 100
    assert manifest["bases"]["validIgnCount"] == 1
    assert manifest["bases"]["groundAltitudeMinM"] == 14.0
    assert manifest["heights"]["defaultHeightM"] == 6.0
    assert manifest["source"]["license"] == "CDLA-Permissive-2.0"

    lines = (master / "checksums.sha256").read_text().splitlines()
    covered = {line.split("  ", 1)[1] for line in lines}
    assert "source/301023330.csv.gz" in covered
    assert "enriched/pilot-100-enriched.jsonl" in covered
    assert "tiles/tileset.json" in covered
    assert "manifest.json" not in covered
    assert "checksums.sha256" not in covered
    for line in lines:
        digest, rel = line.split("  ", 1)
        assert digest == hashlib.sha256((master / rel).read_bytes()).hexdigest()


if __name__ == "__main__":
    import pathlib
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        test_manifest_records_tileset_date_and_pilot_scope(pathlib.Path(td))
    print("make_manifest tests passed")
