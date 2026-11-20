"""
Roundtrip tests for the GMLFP → 3D Tiles converter.

Mirrored readers parse the emitted .b3dm files back and validate every byte
class Cesium will touch: magic/version/byteLength, feature table, batch
table, GLB chunks, accessor bookkeeping. No Cesium runtime is used.
"""
import json
import os
import struct
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tools.buildings import gmlfp_to_tiles as g


SQUARE = [[55.45, -20.88], [55.4503, -20.88], [55.4503, -20.8803], [55.45, -20.8803], [55.45, -20.88]]
L_SHAPE = [[55.46, -20.89], [55.4603, -20.89], [55.4603, -20.8901], [55.4601, -20.8901], [55.4601, -20.8903], [55.46, -20.8903], [55.46, -20.89]]
TRI = [[55.47, -20.87], [55.4704, -20.8704], [55.47, -20.8704], [55.47, -20.87]]


def make_feature(ring, height=-1.0, confidence=0.9):
    return {
        "type": "Feature",
        "properties": {"height": height, "confidence": confidence},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def test_earclip_triangle_square_L():
    tris_tri, _ = g.earclip(TRI[:-1])
    assert len(tris_tri) == 1
    tris_sq, _ = g.earclip(SQUARE[:-1])
    assert len(tris_sq) == 2
    tris_L, _ = g.earclip(L_SHAPE[:-1])
    assert len(tris_L) == 4  # 6-point simple L → n-2 triangles


def test_building_from_feature_defaults_height():
    f = g.building_from_feature(make_feature(SQUARE), 6.0)
    assert f["height"] == 6.0
    assert f["heightSource"] == "default"
    f2 = g.building_from_feature(make_feature(SQUARE, height=12.5), 6.0)
    assert f2["height"] == 12.5
    assert f2["heightSource"] == "measured"


def test_glb_b3dm_roundtrip():
    ring = SQUARE
    f = g.building_from_feature(make_feature(SQUARE), 6.0)
    from tools.terrain.qmesh import ecef_from_geodetic
    o = np.array(ecef_from_geodetic(-20.8802, 55.4502, 0.0), dtype=np.float64)
    mesh = g.building_mesh(f["ring"], f["height"], o)
    pos, nrm, ind = mesh
    bid = np.full(pos.shape[0], 0, dtype=np.uint16)
    glb = g.pack_glb(pos, nrm, bid, ind)
    assert glb[:4] == b"glTF"
    glb_len = struct.unpack_from("<I", glb, 8)[0]
    assert glb_len == len(glb)
    b3dm = g.pack_b3dm(glb, tuple(float(x) for x in o), [
        {"id": "b-0", "height": 6.0, "heightSource": "default", "confidence": 0.9},
    ])
    assert b3dm[:4] == b"b3dm"
    version, byte_length = struct.unpack_from("<II", b3dm, 4)
    assert version == 1
    assert byte_length == len(b3dm)
    # b3dm: magic + version + byteLength, then FOUR back-to-back uint32
    # length fields (featureTableJSON, featureTableBINARY,
    # batchTableJSON, batchTableBINARY), then the two JSON bodies.
    ft_len, ft_bin, bt_len, bt_bin = struct.unpack_from("<IIII", b3dm, 12)
    assert ft_bin == 0 and bt_bin == 0
    ft_off = 28
    ft = json.loads(b3dm[ft_off: ft_off + ft_len])
    assert ft["BATCH_LENGTH"] == 1
    assert len(ft["RTC_CENTER"]) == 3
    bt_off = ft_off + ft_len
    bt = json.loads(b3dm[bt_off: bt_off + bt_len])
    assert bt["id"] == ["b-0"]
    assert bt["heightSource"] == ["default"]
    glb_off = bt_off + bt_len
    glb2 = b3dm[glb_off:]
    assert glb2[:4] == b"glTF"
    # parse GLB JSON chunk
    jlen = struct.unpack_from("<I", glb2, 12)[0]
    gltf = json.loads(glb2[20:20 + jlen])
    assert gltf["asset"]["version"] == "2.0"
    prim = gltf["meshes"][0]["primitives"][0]
    assert prim["attributes"]["_BATCHID"] == 2
    acc = gltf["accessors"][0]
    assert acc["count"] == pos.shape[0]
    idx_acc = gltf["accessors"][3]
    assert idx_acc["count"] == ind.size
    assert ind.max() < pos.shape[0]
    # wall normals are horizontal & roof cap normal is up: no NaNs anywhere
    assert np.isfinite(pos).all()
    assert np.isfinite(nrm).all()


def test_pack_glb_buffer_views_are_4_byte_aligned():
    """Cesium rejects an index accessor whose bufferView offset is not 4-byte
    aligned ('The index array is not aligned to a 4-byte boundary'). An odd
    number of uint16 batch ids makes the following uint32 index view land on
    offset 2 mod 4 unless each view is padded before the next one starts."""
    pos = np.zeros((5, 3), dtype=np.float32)
    nrm = np.tile(np.array([0.0, 0.0, 1.0], dtype=np.float32), (5, 1))
    bid = np.arange(5, dtype=np.uint16)  # 10 bytes -> misaligns the next view
    ind = np.arange(12, dtype=np.uint32)
    glb = g.pack_glb(pos, nrm, bid, ind)
    jlen = struct.unpack_from("<I", glb, 12)[0]
    gltf = json.loads(glb[20:20 + jlen])
    offsets = [v["byteOffset"] for v in gltf["bufferViews"]]
    assert all(o % 4 == 0 for o in offsets), offsets
    assert [v["byteLength"] for v in gltf["bufferViews"]] == [60, 60, 10, 48]


def test_full_pipeline_synthetic():
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as fh:
        for ring in (SQUARE, L_SHAPE, TRI):
            fh.write(json.dumps(make_feature(ring)) + "\n")
        path = fh.name
    with tempfile.TemporaryDirectory() as out:
        rc = g.main.__wrapped__() if hasattr(g.main, "__wrapped__") else None
        # invoke via sys.argv to exercise the CLI exactly
        old_argv = sys.argv
        sys.argv = ["gmlfp_to_tiles", path, "--out", out, "--cell-deg", "0.01"]
        try:
            g.main()
        finally:
            sys.argv = old_argv
        tileset = json.load(open(os.path.join(out, "tileset.json")))
        assert tileset["asset"]["gltfUpAxis"] == "Z"
        assert tileset["root"]["children"], "expected at least one tile"
        region = tileset["root"]["boundingVolume"]["region"]
        assert region[0] < region[2] and region[1] < region[3]
        n_b3dm = sum(1 for _, _, files in os.walk(out) for f in files if f.endswith(".b3dm"))
        assert n_b3dm == len(tileset["root"]["children"])


if __name__ == "__main__":
    test_earclip_triangle_square_L()
    test_building_from_feature_defaults_height()
    test_glb_b3dm_roundtrip()
    test_full_pipeline_synthetic()
    print("buildings pipeline tests passed")
