#!/usr/bin/env python3
"""Bake a translucent "position ghost" box into the OD/ID preview GLBs.

model-viewer can paint materials but cannot add geometry at runtime, so to show
a plain *rectangular* ghost sized to a position's tool volume we bake one box
mesh per position into the GLB, named ``PositionGhost_1``, ``PositionGhost_2``,
… Each box is the world-space bounding box of that position's tool meshes; the
assembly viewer paints its material (colour + alpha) per state at runtime.

Reproducible + idempotent: on first run a pristine ``*.base.glb`` copy is kept,
and the preview GLB is always rebuilt from that base, so re-running never stacks
duplicate boxes and box sizes can be tweaked freely.

Only fixed, in-repo paths are read/written (per repo Python security rules); no
external input is used in any file path.
"""

from __future__ import annotations

import json
import shutil
import struct
from pathlib import Path

# Fixed, in-repo stems only — never derived from user input. Each stem maps to
# the block-body mesh names and the tool-mesh names per position ordinal (index
# 0 == Position 1). These match ``OD_BLOCK_PREVIEWS[…]`` in AssemblyViewer.tsx.
JOBS: dict[str, dict[str, object]] = {
    "src/assets/models/od-20mm-dual-id-preview": {
        "body": ["Tool Block", "End Cap_1", "End Cap_2"],
        "positions": [
            ["12mm CNMG", "12mm CNMG_1", "20 x 12"],
            ["16mm CNMG", "16mm CNMG_1", "20 x 16"],
        ],
    },
    "src/assets/models/od-25mm-dual-od-preview": {
        "body": ["SOLID"],
        "positions": [
            ["3602034-DDJNL 2525M-15 - Basic-mm", "3602034-DDJNL 2525M-15 - Basic-mm_1"],
            ["3800006-SER 2525 M16 - Basic-mm", "3800006-SER 2525 M16 - Basic-mm_1"],
        ],
    },
}

# A neutral grey; the app repaints per state at runtime, this is just the baked
# default so the GLB reads sensibly on its own.
GHOST_GREY = [0.62, 0.66, 0.72, 1.0]

# Pull the box a few millimetres inside the block on every side, so the ghost
# reads as sitting *within* the block rather than flush with (or proud of) its
# faces — this also keeps it clear of the block surface so it never z-fights.
GHOST_INSET_M = 0.003


# ---- tiny 4x4 (column-major, glTF order) matrix helpers -----------------------

Mat4 = list[float]
IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def mat_mul(a: Mat4, b: Mat4) -> Mat4:
    """a · b, both column-major."""
    out = [0.0] * 16
    for col in range(4):
        for row in range(4):
            out[col * 4 + row] = sum(
                a[k * 4 + row] * b[col * 4 + k] for k in range(4)
            )
    return out


def trs_matrix(node: dict) -> Mat4:
    if "matrix" in node and node["matrix"] is not None:
        return list(node["matrix"])
    t = node.get("translation") or [0, 0, 0]
    r = node.get("rotation") or [0, 0, 0, 1]
    s = node.get("scale") or [1, 1, 1]
    x, y, z, w = r
    # Rotation (column-major) from quaternion, then scaled columns + translation.
    rot = [
        1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
        2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
        2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
        0, 0, 0, 1,
    ]
    for i in range(3):
        rot[i] *= s[0]
        rot[4 + i] *= s[1]
        rot[8 + i] *= s[2]
    rot[12], rot[13], rot[14] = t
    return rot


def transform_point(m: Mat4, p: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = p
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


# ---- GLB read/write -----------------------------------------------------------

def load_glb(path: Path) -> tuple[dict, bytearray]:
    data = path.read_bytes()
    _, _, length = struct.unpack("<III", data[:12])
    off, js, binv = 12, None, bytearray()
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:  # "JSON"
            js = json.loads(chunk)
        elif ctype == 0x004E4942:  # "BIN\0"
            binv = bytearray(chunk)
    assert js is not None, "GLB has no JSON chunk"
    return js, binv


def save_glb(path: Path, js: dict, binv: bytearray) -> None:
    json_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)  # pad with spaces
    bin_bytes = bytes(binv) + b"\x00" * ((4 - len(binv) % 4) % 4)  # pad with 0
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    with path.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))  # "glTF", v2
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_bytes), 0x004E4942))
        f.write(bin_bytes)


# ---- geometry -----------------------------------------------------------------

def world_matrices_by_mesh(js: dict) -> list[tuple[int, Mat4]]:
    """(mesh index, world matrix) for every node that draws a mesh."""
    out: list[tuple[int, Mat4]] = []
    nodes = js.get("nodes", [])

    def walk(index: int, parent: Mat4) -> None:
        node = nodes[index]
        world = mat_mul(parent, trs_matrix(node))
        if node.get("mesh") is not None:
            out.append((node["mesh"], world))
        for child in node.get("children") or []:
            walk(child, world)

    for scene in js.get("scenes", []):
        for root in scene.get("nodes", []):
            walk(root, IDENTITY)
    return out


def position_bounds(
    js: dict, world_by_mesh: list[tuple[int, Mat4]], mesh_names: list[str]
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """World-space AABB of the named meshes, from their POSITION min/max."""
    meshes = js["meshes"]
    accessors = js["accessors"]
    wanted = set(mesh_names)
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for mesh_index, world in world_by_mesh:
        if meshes[mesh_index].get("name") not in wanted:
            continue
        pos_accessor = accessors[meshes[mesh_index]["primitives"][0]["attributes"]["POSITION"]]
        mn, mx = pos_accessor["min"], pos_accessor["max"]
        # Transform all 8 corners of the local AABB into world space.
        for cx in (mn[0], mx[0]):
            for cy in (mn[1], mx[1]):
                for cz in (mn[2], mx[2]):
                    wx, wy, wz = transform_point(world, (cx, cy, cz))
                    lo[0], lo[1], lo[2] = min(lo[0], wx), min(lo[1], wy), min(lo[2], wz)
                    hi[0], hi[1], hi[2] = max(hi[0], wx), max(hi[1], wy), max(hi[2], wz)
    if lo[0] == float("inf"):
        raise ValueError(f"no meshes matched {mesh_names}")
    return (lo[0], lo[1], lo[2]), (hi[0], hi[1], hi[2])


def box_geometry(
    lo: tuple[float, float, float], hi: tuple[float, float, float]
) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]], list[int]]:
    """24 verts (4 per face) with per-face normals + 36 indices for an AABB."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    # (normal, four corners CCW when viewed from outside)
    faces = [
        ((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),   # +Z
        ((0, 0, -1), [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)]),  # -Z
        ((1, 0, 0), [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)]),   # +X
        ((-1, 0, 0), [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)]),  # -X
        ((0, 1, 0), [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)]),   # +Y
        ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]),  # -Y
    ]
    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    indices: list[int] = []
    for normal, corners in faces:
        base = len(positions)
        positions.extend(corners)
        normals.extend([normal] * 4)
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return positions, normals, indices


def append_accessor(
    js: dict, binv: bytearray, values: list, comp_type: int, acc_type: str,
    target: int,
) -> int:
    """Append tightly-packed data, add a bufferView + accessor, return its index."""
    while len(binv) % 4:  # keep 4-byte alignment for every view
        binv.append(0)
    byte_offset = len(binv)
    flat: list[float] = []
    for v in values:
        if isinstance(v, (tuple, list)):
            flat.extend(v)
        else:
            flat.append(v)
    if comp_type == 5126:      # FLOAT
        binv.extend(struct.pack("<%df" % len(flat), *flat))
    elif comp_type == 5123:    # UNSIGNED_SHORT
        binv.extend(struct.pack("<%dH" % len(flat), *(int(x) for x in flat)))
    else:
        raise ValueError(comp_type)

    bv_index = len(js.setdefault("bufferViews", []))
    js["bufferViews"].append({
        "buffer": 0,
        "byteOffset": byte_offset,
        "byteLength": len(binv) - byte_offset,
        "target": target,
    })
    accessor = {
        "bufferView": bv_index,
        "componentType": comp_type,
        "count": len(values),
        "type": acc_type,
    }
    if acc_type == "VEC3":
        cols = list(zip(*values))
        accessor["min"] = [min(c) for c in cols]
        accessor["max"] = [max(c) for c in cols]
    js.setdefault("accessors", []).append(accessor)
    return len(js["accessors"]) - 1


def bake(stem: str, body_names: list[str], positions: list[list[str]]) -> None:
    preview = Path(stem + ".glb")
    base = Path(stem + ".base.glb")
    # Keep a pristine, ghost-free source so rebuilds never stack boxes.
    if not base.exists():
        shutil.copyfile(preview, base)

    js, binv = load_glb(base)
    world_by_mesh = world_matrices_by_mesh(js)

    # The block body's world AABB. Each ghost is clamped to this so it never
    # protrudes beyond the block's sides — it reads as a plain rectangle sitting
    # within the block's footprint rather than a tool poking out of it.
    body_lo, body_hi = position_bounds(js, world_by_mesh, body_names)

    for ordinal, mesh_names in enumerate(positions, start=1):
        tool_lo, tool_hi = position_bounds(js, world_by_mesh, mesh_names)
        lo = tuple(max(tool_lo[i], body_lo[i]) + GHOST_INSET_M for i in range(3))
        hi = tuple(min(tool_hi[i], body_hi[i]) - GHOST_INSET_M for i in range(3))
        pos, nrm, idx = box_geometry(lo, hi)
        pos_acc = append_accessor(js, binv, pos, 5126, "VEC3", 34962)
        nrm_acc = append_accessor(js, binv, nrm, 5126, "VEC3", 34962)
        idx_acc = append_accessor(js, binv, idx, 5123, "SCALAR", 34963)

        name = f"PositionGhost_{ordinal}"
        mat_index = len(js.setdefault("materials", []))
        js["materials"].append({
            "name": name,
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": GHOST_GREY,
                "metallicFactor": 0.0,
                "roughnessFactor": 0.6,
            },
        })
        mesh_index = len(js.setdefault("meshes", []))
        js["meshes"].append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc},
                "indices": idx_acc,
                "material": mat_index,
            }],
        })
        node_index = len(js.setdefault("nodes", []))
        js["nodes"].append({"name": name, "mesh": mesh_index})
        js["scenes"][js.get("scene", 0)]["nodes"].append(node_index)

        size = tuple(round(hi[i] - lo[i], 4) for i in range(3))
        print(f"  {name}: size={size}")

    js["buffers"][0]["byteLength"] = len(binv)
    save_glb(preview, js, binv)
    print(f"{preview.name}: baked {len(positions)} position ghost(s)")


if __name__ == "__main__":
    for stem, cfg in JOBS.items():
        print(f"== {stem.split('/')[-1]} ==")
        bake(stem, cfg["body"], cfg["positions"])
