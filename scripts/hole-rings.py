#!/usr/bin/env python3
"""Recognise each seat hole's centre and diameter from the preview GLB.

The block's tool seats are cylindrical bores through the +X face. This reads the
mesh and reports, per seat:

  * the hole centre on the face (x at the face, y, z), and
  * the bore diameter, found two independent ways as a cross-check:
      - the seat plug body's cross-section (the adaptor filling the bore), and
      - a cylinder fit of the block body's own bore wall around that centre.

    python3 scripts/hole-rings.py src/assets/models/3x-spot-drill-tap.glb

No third-party deps: it parses the GLB container and float VEC3 POSITION
accessors by hand, the same way scripts/seat-hotspots.py does.
"""

from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path

# Seats, by material, in the order the app uses them (see previewGeometry.ts).
SEAT_PLUGS = [
    ("Position 1", "part_1"),
    ("Position 2", "part_3"),
    ("Position 3", "part_2"),
]
BLOCK_MATERIAL = "part_0"


def read_glb(path: Path):
    data = path.read_bytes()
    if struct.unpack_from("<I", data, 0)[0] != 0x46546C67:
        raise SystemExit(f"Not a GLB: {path}")
    offset, gltf, binary = 12, None, b""
    while offset < len(data):
        clen, ctype = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + clen]
        offset += clen
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binary = chunk
    if gltf is None:
        raise SystemExit("GLB has no JSON chunk")
    return gltf, binary


def positions_by_material(gltf, binary):
    out: dict[str, list[tuple[float, float, float]]] = {}
    mats = gltf.get("materials", [])
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            mi = prim.get("material")
            pos = prim.get("attributes", {}).get("POSITION")
            if mi is None or pos is None:
                continue
            name = mats[mi].get("name", f"#{mi}") if mi < len(mats) else f"#{mi}"
            acc = gltf["accessors"][pos]
            view = gltf["bufferViews"][acc["bufferView"]]
            start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
            stride = view.get("byteStride", 12)
            verts = out.setdefault(name, [])
            for i in range(acc["count"]):
                verts.append(struct.unpack_from("<fff", binary, start + i * stride))
    return out


def extent(verts, axis):
    lo = min(v[axis] for v in verts)
    hi = max(v[axis] for v in verts)
    return lo, hi, hi - lo


def fit_bore_radius(block_verts, cy, cz, face_x):
    """Median radius of block vertices that lie on the bore wall of a seat.

    Bore-wall vertices sit at a steady radius from the seat axis across a span
    of x behind the face, so gather block vertices near this centre and inside
    the face, and take the median of their radial distance.
    """
    radii = []
    for x, y, z in block_verts:
        if x > face_x + 0.1 or x < face_x - 6.0:
            continue
        r = math.hypot(y - cy, z - cz)
        if 0.3 < r < 2.5:  # ignore the axis itself and far-off face geometry
            radii.append(r)
    if not radii:
        return None
    radii.sort()
    return radii[len(radii) // 2]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    gltf, binary = read_glb(Path(sys.argv[1]))
    verts = positions_by_material(gltf, binary)

    block = verts.get(BLOCK_MATERIAL)
    if block is None:
        raise SystemExit(f"No {BLOCK_MATERIAL} in mesh")
    face_x = max(v[0] for v in block)  # the +X face the seats open on
    print(f"Block +X face at x = {face_x:.3f}\n")

    print(f"{'seat':11} {'centre (y, z)':>18}  {'plug ⌀':>8}  {'bore-fit ⌀':>11}")
    for label, plug in SEAT_PLUGS:
        p = verts.get(plug)
        if p is None:
            print(f"{label:11}  (no body {plug})")
            continue
        ylo, yhi, ysz = extent(p, 1)
        zlo, zhi, zsz = extent(p, 2)
        cy, cz = (ylo + yhi) / 2, (zlo + zhi) / 2
        plug_d = (ysz + zsz) / 2  # mean of the two cross-section extents
        bore_r = fit_bore_radius(block, cy, cz, face_x)
        bore_d = f"{2 * bore_r:8.3f}" if bore_r else "     n/a"
        print(f"{label:11}  ({cy:7.3f}, {cz:7.3f})  {plug_d:8.3f}  {bore_d:>11}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
