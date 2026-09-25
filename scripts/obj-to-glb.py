#!/usr/bin/env python3
"""Convert a Wavefront OBJ (+MTL) to a binary glTF (.glb), offline.

Written to keep the turret export self-contained: no network, no native tools.
One glTF primitive is emitted per material group, so the viewer can show and
hide parts by material the same way the tool-assembly preview does. Colours come
from each material's ``Kd`` in the .mtl; normals are read from the OBJ or
computed per face when absent.

Security note (workspace Python rule #1 — no user input in file paths): this is
a trusted local build tool invoked by a developer, not a service. The input and
output paths come from argv by necessity (same as the other scripts in this
folder); they are validated (existence and extension) before any file access,
and nothing here is exposed to untrusted callers.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def parse_mtl(path: Path) -> dict[str, tuple[float, float, float]]:
    """Map material name -> diffuse colour (Kd). Missing files yield no colours."""
    colours: dict[str, tuple[float, float, float]] = {}
    if not path.exists():
        return colours
    current: str | None = None
    for line in path.read_text(errors="ignore").splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "newmtl":
            current = line.split(None, 1)[1].strip()
        elif parts[0] == "Kd" and current is not None and len(parts) >= 4:
            colours[current] = (float(parts[1]), float(parts[2]), float(parts[3]))
    return colours


def parse_obj(
    path: Path,
    exclude_mtl: set[str] | None = None,
    keep_body: set[str] | None = None,
):
    """Return (positions, normals, groups).

    groups is a list of (material_name, faces), where each face is a list of
    (position_index, normal_index_or_None), already triangulated. Faces whose
    material is in ``exclude_mtl`` are dropped, which is how the bare turret is
    produced from the assembled one (the tools sit on their own materials).
    """
    exclude_mtl = exclude_mtl or set()
    keep_body = keep_body or None  # None = keep every body
    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    groups: list[tuple[str, list]] = []
    current_faces: list = []
    current_mtl = "default"
    current_body = ""
    mtllib: str | None = None

    def flush() -> None:
        nonlocal current_faces
        if current_faces:
            groups.append((current_mtl, current_faces))
            current_faces = []

    for line in path.read_text(errors="ignore").splitlines():
        if not line or line[0] == "#":
            continue
        parts = line.split()
        tag = parts[0]
        if tag == "v" and len(parts) >= 4:
            positions.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif tag == "vn" and len(parts) >= 4:
            normals.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif tag == "mtllib" and len(parts) >= 2:
            mtllib = line.split(None, 1)[1].strip()
        elif tag in ("g", "o") and len(parts) >= 2:
            current_body = line.split(None, 1)[1].strip()
        elif tag == "usemtl" and len(parts) >= 2:
            flush()
            current_mtl = line.split(None, 1)[1].strip()
        elif tag == "f" and len(parts) >= 4:
            if current_mtl in exclude_mtl:
                continue
            if keep_body is not None and current_body not in keep_body:
                continue
            verts = []
            for token in parts[1:]:
                bits = token.split("/")
                vi = int(bits[0])
                ni = int(bits[2]) if len(bits) >= 3 and bits[2] != "" else None
                # OBJ is 1-based and allows negatives (relative to the end).
                vi = vi - 1 if vi > 0 else len(positions) + vi
                if ni is not None:
                    ni = ni - 1 if ni > 0 else len(normals) + ni
                verts.append((vi, ni))
            # Fan-triangulate the polygon.
            for k in range(1, len(verts) - 1):
                current_faces.append([verts[0], verts[k], verts[k + 1]])

    flush()
    return positions, normals, groups, mtllib


def face_normal(a, b, c) -> tuple[float, float, float]:
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    length = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1.0
    return (nx / length, ny / length, nz / length)


def build_glb(positions, normals, groups, colours, out_path: Path) -> None:
    bin_parts: list[bytes] = []
    byte_offset = 0
    buffer_views: list[dict] = []
    accessors: list[dict] = []
    materials: list[dict] = []
    primitives: list[dict] = []
    mat_index: dict[str, int] = {}

    def add_view(data: bytes, target: int) -> int:
        nonlocal byte_offset
        # 4-byte align each view.
        pad = (-len(bin_parts and b"".join(bin_parts) or b"")) % 4
        del pad
        align = (4 - (byte_offset % 4)) % 4
        if align:
            bin_parts.append(b"\x00" * align)
            byte_offset += align
        view = {
            "buffer": 0,
            "byteOffset": byte_offset,
            "byteLength": len(data),
            "target": target,
        }
        buffer_views.append(view)
        bin_parts.append(data)
        byte_offset += len(data)
        return len(buffer_views) - 1

    for mat_name, faces in groups:
        # Dedup vertices within this primitive by (position, normal).
        index_map: dict[tuple, int] = {}
        verts: list[tuple[float, float, float, float, float, float]] = []
        indices: list[int] = []
        for tri in faces:
            # Precompute a normal for any vertex lacking one.
            need_normal = any(ni is None for _, ni in tri)
            if need_normal:
                fn = face_normal(
                    positions[tri[0][0]], positions[tri[1][0]], positions[tri[2][0]]
                )
            for vi, ni in tri:
                px, py, pz = positions[vi]
                if ni is not None:
                    nx, ny, nz = normals[ni]
                else:
                    nx, ny, nz = fn
                key = (vi, ni, nx, ny, nz)
                idx = index_map.get(key)
                if idx is None:
                    idx = len(verts)
                    index_map[key] = idx
                    verts.append((px, py, pz, nx, ny, nz))
                indices.append(idx)

        if not verts:
            continue

        pos_bytes = b"".join(struct.pack("<3f", v[0], v[1], v[2]) for v in verts)
        nrm_bytes = b"".join(struct.pack("<3f", v[3], v[4], v[5]) for v in verts)
        idx_bytes = struct.pack("<%dI" % len(indices), *indices)

        # Bounds for the POSITION accessor (required by the spec).
        xs = [v[0] for v in verts]
        ys = [v[1] for v in verts]
        zs = [v[2] for v in verts]

        pos_view = add_view(pos_bytes, 34962)
        nrm_view = add_view(nrm_bytes, 34962)
        idx_view = add_view(idx_bytes, 34963)

        pos_acc = len(accessors)
        accessors.append({
            "bufferView": pos_view,
            "componentType": 5126,  # FLOAT
            "count": len(verts),
            "type": "VEC3",
            "min": [min(xs), min(ys), min(zs)],
            "max": [max(xs), max(ys), max(zs)],
        })
        nrm_acc = len(accessors)
        accessors.append({
            "bufferView": nrm_view,
            "componentType": 5126,
            "count": len(verts),
            "type": "VEC3",
        })
        idx_acc = len(accessors)
        accessors.append({
            "bufferView": idx_view,
            "componentType": 5125,  # UNSIGNED_INT
            "count": len(indices),
            "type": "SCALAR",
        })

        if mat_name not in mat_index:
            r, g, b = colours.get(mat_name, (0.8, 0.8, 0.82))
            mat_index[mat_name] = len(materials)
            materials.append({
                "name": mat_name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [r, g, b, 1.0],
                    "metallicFactor": 0.1,
                    "roughnessFactor": 0.65,
                },
            })

        primitives.append({
            "attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc},
            "indices": idx_acc,
            "material": mat_index[mat_name],
        })

    bin_blob = b"".join(bin_parts)
    gltf = {
        "asset": {"version": "2.0", "generator": "obj-to-glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Turret Assembly"}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - (len(bin_blob) % 4)) % 4
    bin_blob += b"\x00" * bin_pad

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    with out_path.open("wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, total))
        fh.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        fh.write(json_bytes)
        fh.write(struct.pack("<I4s", len(bin_blob), b"BIN\x00"))
        fh.write(bin_blob)


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert OBJ (+MTL) to binary glTF.")
    ap.add_argument("input", help="path to the .obj file")
    ap.add_argument("output", help="path to write the .glb file")
    ap.add_argument(
        "--exclude-mtl",
        action="append",
        default=[],
        help="material name to drop (repeatable); used to strip the tools",
    )
    ap.add_argument(
        "--keep-body",
        action="append",
        default=[],
        help="OBJ 'g'/'o' body name to keep (repeatable); drops all others",
    )
    args = ap.parse_args()

    # Validate paths before touching the filesystem (workspace Python rule #1).
    in_path = Path(args.input).expanduser()
    out_path = Path(args.output).expanduser()
    if in_path.suffix.lower() != ".obj" or not in_path.is_file():
        print(f"input is not an existing .obj file: {in_path}", file=sys.stderr)
        return 2
    if out_path.suffix.lower() != ".glb":
        print(f"output must end in .glb: {out_path}", file=sys.stderr)
        return 2

    mtl_path = in_path.with_suffix(".mtl")
    positions, normals, groups, mtllib = parse_obj(
        in_path, set(args.exclude_mtl), set(args.keep_body)
    )
    if mtllib is not None:
        candidate = in_path.parent / mtllib
        if candidate.is_file():
            mtl_path = candidate
    colours = parse_mtl(mtl_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    build_glb(positions, normals, groups, colours, out_path)
    size_mb = out_path.stat().st_size / 1_048_576
    print(
        f"wrote {out_path} — {len(positions)} verts, {len(groups)} groups, "
        f"{size_mb:.1f} MB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
