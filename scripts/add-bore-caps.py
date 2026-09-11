#!/usr/bin/env python3
"""Bake a thin "bore cap" cylinder into each seat hole of the preview GLB.

The viewer highlights a selected position by colouring a seat body, but the only
body it can reveal is the full-length adaptor, which stands proud of the block
like a peg. This appends a short, near-flush cylinder that plugs each bore mouth
on its own material (``cap_0``…), so the viewer can colour just that disc and it
reads as the lit bore rather than a protruding tool.

Pure standard library: it parses the GLB container and re-emits it with extra
bufferViews, accessors, materials, meshes and nodes for the caps. No third-party
deps (the sandbox has no numpy/pygltflib and PyPI is unreachable).

    python3 scripts/add-bore-caps.py \
        src/assets/models/3x-spot-drill-tap.glb \
        src/assets/models/3x-spot-drill-tap-caps.glb

Hole centres and the face plane are the ones recognised by hole-rings.py.
"""

from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path

# Seat hole centres (y, z) on the +X face, from scripts/hole-rings.py.
SEATS = [
    (0.0, -8.5),
    (0.0, -3.81),
    (-6.341, -7.665),
]
FACE_X = 5.25          # block's +X face
CAP_RADIUS = 1.05      # just under the ⌀2.2 bore so it fills without z-fighting
CAP_INSET = 0.15       # how far the disc sits back into the bore
CAP_PROUD = 0.02       # how far it stands proud of the face (~a few tenths mm)
SEGMENTS = 64          # facets around the disc

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path: Path):
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC:
        raise SystemExit(f"Not a GLB: {path}")
    offset, gltf, binary = 12, None, b""
    while offset < len(data):
        clen, ctype = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + clen]
        offset += clen
        if ctype == CHUNK_JSON:
            gltf = json.loads(chunk.decode("utf-8"))
        elif ctype == CHUNK_BIN:
            binary = chunk
    if gltf is None:
        raise SystemExit("GLB has no JSON chunk")
    return gltf, bytearray(binary)


def cap_mesh(cy: float, cz: float):
    """Vertices, normals and triangle indices for one bore-cap cylinder.

    A short cylinder along +X, capped at both ends so it reads solid: side wall,
    a front disc (proud of the face) and a back disc.
    """
    x0 = FACE_X - CAP_INSET   # back, inside the bore
    x1 = FACE_X + CAP_PROUD   # front, just proud of the face
    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    indices: list[int] = []

    def add(p, n) -> int:
        positions.append(p)
        normals.append(n)
        return len(positions) - 1

    # Side wall: a quad per segment between the back and front rings.
    for i in range(SEGMENTS):
        t0 = (i / SEGMENTS) * 2 * math.pi
        t1 = ((i + 1) / SEGMENTS) * 2 * math.pi
        for t in (t0, t1):
            ny, nz = math.cos(t), math.sin(t)
            y, z = cy + CAP_RADIUS * ny, cz + CAP_RADIUS * nz
            b = add((x0, y, z), (0.0, ny, nz))
            f = add((x1, y, z), (0.0, ny, nz))
            if t is t0:
                b0, f0 = b, f
            else:
                b1, f1 = b, f
        indices += [b0, f0, f1, b0, f1, b1]

    # Front disc (normal +X), the face the eye reads.
    cf = add((x1, cy, cz), (1.0, 0.0, 0.0))
    front = [
        add(
            (
                x1,
                cy + CAP_RADIUS * math.cos((i / SEGMENTS) * 2 * math.pi),
                cz + CAP_RADIUS * math.sin((i / SEGMENTS) * 2 * math.pi),
            ),
            (1.0, 0.0, 0.0),
        )
        for i in range(SEGMENTS)
    ]
    for i in range(SEGMENTS):
        indices += [cf, front[i], front[(i + 1) % SEGMENTS]]

    # Back disc (normal -X).
    cb = add((x0, cy, cz), (-1.0, 0.0, 0.0))
    back = [
        add(
            (
                x0,
                cy + CAP_RADIUS * math.cos((i / SEGMENTS) * 2 * math.pi),
                cz + CAP_RADIUS * math.sin((i / SEGMENTS) * 2 * math.pi),
            ),
            (-1.0, 0.0, 0.0),
        )
        for i in range(SEGMENTS)
    ]
    for i in range(SEGMENTS):
        indices += [cb, back[(i + 1) % SEGMENTS], back[i]]

    return positions, normals, indices


def pad4(buf: bytearray, fill: int = 0) -> None:
    while len(buf) % 4 != 0:
        buf.append(fill)


def append_bufferview(gltf, binary, blob: bytes, target: int) -> int:
    pad4(binary)
    offset = len(binary)
    binary.extend(blob)
    gltf["bufferViews"].append(
        {"buffer": 0, "byteOffset": offset, "byteLength": len(blob), "target": target}
    )
    return len(gltf["bufferViews"]) - 1


def add_accessor(gltf, view, ctype, count, atype, mn=None, mx=None) -> int:
    acc = {"bufferView": view, "componentType": ctype, "count": count, "type": atype}
    if mn is not None:
        acc["min"], acc["max"] = mn, mx
    gltf["accessors"].append(acc)
    return len(gltf["accessors"]) - 1


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    gltf, binary = read_glb(src)

    gltf.setdefault("bufferViews", [])
    gltf.setdefault("accessors", [])
    gltf.setdefault("materials", [])
    gltf.setdefault("meshes", [])
    gltf.setdefault("nodes", [])

    scene = gltf.get("scene", 0)
    scene_nodes = gltf["scenes"][scene].setdefault("nodes", [])

    for seat_index, (cy, cz) in enumerate(SEATS):
        positions, normals, indices = cap_mesh(cy, cz)

        pos_blob = b"".join(struct.pack("<fff", *p) for p in positions)
        nrm_blob = b"".join(struct.pack("<fff", *n) for n in normals)
        idx_blob = b"".join(struct.pack("<H", i) for i in indices)

        xs = [p[0] for p in positions]
        ys = [p[1] for p in positions]
        zs = [p[2] for p in positions]

        pos_view = append_bufferview(gltf, binary, pos_blob, 34962)
        nrm_view = append_bufferview(gltf, binary, nrm_blob, 34962)
        idx_view = append_bufferview(gltf, binary, idx_blob, 34963)

        pos_acc = add_accessor(
            gltf, pos_view, 5126, len(positions), "VEC3",
            [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)],
        )
        nrm_acc = add_accessor(gltf, nrm_view, 5126, len(normals), "VEC3")
        idx_acc = add_accessor(gltf, idx_view, 5123, len(indices), "SCALAR")

        gltf["materials"].append(
            {
                "name": f"cap_{seat_index}",
                # Starts fully transparent: the viewer paints it opaque blue only
                # for the selected empty seat, so nothing shows before that.
                "alphaMode": "BLEND",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.23, 0.60, 0.85, 0.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.5,
                },
                "doubleSided": True,
            }
        )
        mat = len(gltf["materials"]) - 1

        gltf["meshes"].append(
            {
                "name": f"cap_{seat_index}",
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc},
                        "indices": idx_acc,
                        "material": mat,
                    }
                ],
            }
        )
        mesh = len(gltf["meshes"]) - 1

        gltf["nodes"].append({"name": f"cap_{seat_index}", "mesh": mesh})
        scene_nodes.append(len(gltf["nodes"]) - 1)

    gltf["buffers"][0]["byteLength"] = len(binary)

    # Re-emit the GLB: JSON chunk padded with spaces, BIN chunk padded with 0s.
    json_blob = bytearray(json.dumps(gltf, separators=(",", ":")).encode("utf-8"))
    while len(json_blob) % 4 != 0:
        json_blob.append(0x20)
    pad4(binary)

    total = 12 + 8 + len(json_blob) + 8 + len(binary)
    out = bytearray()
    out += struct.pack("<III", GLB_MAGIC, 2, total)
    out += struct.pack("<II", len(json_blob), CHUNK_JSON)
    out += json_blob
    out += struct.pack("<II", len(binary), CHUNK_BIN)
    out += binary
    dst.write_bytes(out)

    print(f"Wrote {dst} ({total} bytes) with {len(SEATS)} bore caps.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
