#!/usr/bin/env python3
"""Compute per-material bounds of a GLB, for anchoring viewer hotspots.

`<model-viewer>` can pin a marker to a point in model space (a "hotspot"). To
put a numbered marker on each seat's hole of the tool-block preview, we need the
3D position of that hole. The preview mesh puts every body on its own material
(see ``prepare-preview-model.py``), so this reads the GLB, groups vertex
positions by material, and prints each material's centre, min and max.

    python3 scripts/seat-hotspots.py src/assets/models/3x-spot-drill-tap.glb

No third-party deps: it parses the GLB container and the accessors it needs by
hand. Only float VEC3 POSITION accessors are read, which is all a hole centre
needs.
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

_COMPONENT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise SystemExit(f"Not a GLB: {path}")
    offset = 12
    gltf: dict | None = None
    binary = b""
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:  # JSON
            gltf = json.loads(chunk.decode("utf-8"))
        elif chunk_type == 0x004E4942:  # BIN
            binary = chunk
    if gltf is None:
        raise SystemExit("GLB has no JSON chunk")
    return gltf, binary


def accessor_vec3(gltf: dict, binary: bytes, index: int) -> list[tuple[float, float, float]]:
    accessor = gltf["accessors"][index]
    if accessor["type"] != "VEC3" or accessor["componentType"] != 5126:
        raise SystemExit("POSITION accessor is not float VEC3")
    view = gltf["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"]
    stride = view.get("byteStride", 12)
    out: list[tuple[float, float, float]] = []
    for i in range(count):
        base = start + i * stride
        out.append(struct.unpack_from("<fff", binary, base))
    return out


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = Path(sys.argv[1])
    gltf, binary = read_glb(path)
    materials = gltf.get("materials", [])

    # Group vertex positions by the material each primitive draws with.
    by_material: dict[int, list[tuple[float, float, float]]] = {}
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            mat = prim.get("material")
            pos = prim.get("attributes", {}).get("POSITION")
            if mat is None or pos is None:
                continue
            by_material.setdefault(mat, []).extend(accessor_vec3(gltf, binary, pos))

    print(f"{'material':10} {'verts':>7}  {'centre (x,y,z)':>26}  {'min':>26}  {'max':>26}")
    for mat in sorted(by_material):
        verts = by_material[mat]
        name = materials[mat].get("name", f"#{mat}") if mat < len(materials) else f"#{mat}"
        lo = [min(v[a] for v in verts) for a in range(3)]
        hi = [max(v[a] for v in verts) for a in range(3)]
        centre = [(lo[a] + hi[a]) / 2 for a in range(3)]
        fmt = lambda t: "(" + ", ".join(f"{x:7.3f}" for x in t) + ")"
        print(f"{name:10} {len(verts):>7}  {fmt(centre)}  {fmt(lo)}  {fmt(hi)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
