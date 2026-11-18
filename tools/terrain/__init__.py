"""
ODIN — terrain preprocessing toolkit.

Offline conversion of high-resolution IGN RGE ALTI / LiDAR HD raster grids
into CesiumJS-compatible terrain tiles (quantized-mesh-1.0) plus a
`layer.json` Cesium can consume as a `Cesium.CesiumTerrainProvider`.

No downloaded data is required to run the unit tests — the synthetic
fixtures generate grids on the fly. Real IGN D974 inputs are consumed
exclusively through explicit operator action (see README.md).
"""

__all__ = ["qmesh", "gridio", "layerjson"]
