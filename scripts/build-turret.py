#!/usr/bin/env python3
"""Build the interactive turret model: bare drum + one tool per station.

The Turret Setup workflow lets a user drop a saved tool assembly onto any of the
12 stations, and expects the 3D turret to show a tool appear there. <model-viewer>
loads a single glTF, so we bake every station's tool into one file, each as its
own material (``station-01`` .. ``station-12``). The app then shows or hides a
station's tool by toggling that material's alpha — no per-station model loading.

Source geometry is the assembled turret OBJ. We keep the drum body, take one
real mounted tool as a template, and rotate a copy of it onto each station using
the ring (axis/centre/positions) computed by ``turret-stations.py``. Rotating a
copy by the station spacing lands it exactly on each BMT coupling face.

Pure Python; reuses the glTF writer from ``obj-to-glb.py``.

Security note (workspace Python rule #1 & #9): trusted local build tool. The OBJ
and JSON paths come from argv and are validated (suffix + existence) before use;
the only dynamic import is a hardcoded sibling script path (not user input).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

# Reuse the glTF writer/helpers from the sibling converter. The path is a fixed
# constant (this script's own folder), never user input — satisfies rule #9.
_HELPER_PATH = Path(__file__).with_name("obj-to-glb.py")
_spec = importlib.util.spec_from_file_location("obj_to_glb", _HELPER_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"cannot load helper: {_HELPER_PATH}")
_obj_to_glb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_obj_to_glb)
build_glb = _obj_to_glb.build_glb
parse_mtl = _obj_to_glb.parse_mtl

TOOL_MATERIALS = {"Opaque(93,148,165)", "Opaque(243,203,124)"}
DRUM_BODY = "Body1:33"
TOOL_RGB = (0.365, 0.580, 0.647)  # teal, from Opaque(93,148,165)
DRUM_RGB = (0.82, 0.82, 0.84)


def parse_obj(path: Path):
    """positions, normals, triangles=[(body, mtl, [(vi,ni),(vi,ni),(vi,ni)])]."""
    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    triangles: list[tuple[str, str, list]] = []
    body = ""
    mtl = "default"
    for line in path.read_text(errors="ignore").splitlines():
        if not line or line[0] == "#":
            continue
        parts = line.split()
        tag = parts[0]
        if tag == "v" and len(parts) >= 4:
            positions.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif tag == "vn" and len(parts) >= 4:
            normals.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif tag in ("g", "o") and len(parts) >= 2:
            body = line.split(None, 1)[1].strip()
        elif tag == "usemtl" and len(parts) >= 2:
            mtl = line.split(None, 1)[1].strip()
        elif tag == "f" and len(parts) >= 4:
            verts = []
            for token in parts[1:]:
                bits = token.split("/")
                vi = int(bits[0])
                ni = int(bits[2]) if len(bits) >= 3 and bits[2] else None
                vi = vi - 1 if vi > 0 else len(positions) + vi
                if ni is not None:
                    ni = ni - 1 if ni > 0 else len(normals) + ni
                verts.append((vi, ni))
            for k in range(1, len(verts) - 1):
                triangles.append((body, mtl, [verts[0], verts[k], verts[k + 1]]))
    return positions, normals, triangles


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scale(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def norm(a):
    m = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / m, a[1] / m, a[2] / m)


def project_out_axis(v, axis):
    """Component of v perpendicular to (unit) axis."""
    return sub(v, scale(axis, dot(v, axis)))


def signed_angle(a, b, axis):
    """Signed angle from a to b about (unit) axis, both already in-plane."""
    return math.atan2(dot(cross(a, b), axis), dot(a, b))


def rotate_about_axis(p, center, axis, angle):
    """Rodrigues rotation of point p about axis through center by angle."""
    v = sub(p, center)
    c, s = math.cos(angle), math.sin(angle)
    term1 = scale(v, c)
    term2 = scale(cross(axis, v), s)
    term3 = scale(axis, dot(axis, v) * (1 - c))
    return add(center, add(term1, add(term2, term3)))


def rotate_dir(v, axis, angle):
    """Rotate a direction (normal) about axis, no translation."""
    c, s = math.cos(angle), math.sin(angle)
    term1 = scale(v, c)
    term2 = scale(cross(axis, v), s)
    term3 = scale(axis, dot(axis, v) * (1 - c))
    return add(term1, add(term2, term3))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="assembled turret .obj")
    ap.add_argument("stations", help="turretStations.json from turret-stations.py")
    ap.add_argument("output", help=".glb to write")
    args = ap.parse_args()

    in_path = Path(args.input).expanduser()
    stations_path = Path(args.stations).expanduser()
    out_path = Path(args.output).expanduser()
    if in_path.suffix.lower() != ".obj" or not in_path.is_file():
        print(f"not an .obj: {in_path}", file=sys.stderr)
        return 2
    if stations_path.suffix.lower() != ".json" or not stations_path.is_file():
        print(f"not a .json: {stations_path}", file=sys.stderr)
        return 2

    ring = json.loads(stations_path.read_text())
    axis = norm(tuple(ring["axis"]))
    center = tuple(ring["center"])
    station_positions = {s["number"]: tuple(s["position"]) for s in ring["stations"]}
    count = ring["count"]

    positions, normals, triangles = parse_obj(in_path)
    colours = parse_mtl(in_path.with_suffix(".mtl"))

    # Bodies that carry a cutting-tool material — the mounted tools.
    tool_bodies: set[str] = set()
    for body, mtl, _ in triangles:
        if mtl in TOOL_MATERIALS:
            tool_bodies.add(body)

    # Centroid of each tool body, and its nearest station by ring angle.
    def body_centroid(name: str):
        idx = set()
        for body, _, tri in triangles:
            if body == name:
                idx.update(vi for vi, _ in tri)
        pts = [positions[i] for i in idx]
        n = len(pts) or 1
        return (
            sum(p[0] for p in pts) / n,
            sum(p[1] for p in pts) / n,
            sum(p[2] for p in pts) / n,
        ), len(idx)

    station_angle = {
        num: project_out_axis(sub(pos, center), axis)
        for num, pos in station_positions.items()
    }

    def nearest_station(centroid):
        vec = project_out_axis(sub(centroid, center), axis)
        best, best_ang = None, 1e9
        for num, ref in station_angle.items():
            ang = abs(signed_angle(ref, vec, axis))
            if ang < best_ang:
                best, best_ang = num, ang
        return best

    # Group tool bodies by station; pick the richest as the template tool.
    per_station_bodies: dict[int, list[tuple[str, int]]] = {}
    for name in tool_bodies:
        centroid, nverts = body_centroid(name)
        st = nearest_station(centroid)
        per_station_bodies.setdefault(st, []).append((name, nverts))

    template_station = max(
        per_station_bodies,
        key=lambda st: sum(v for _, v in per_station_bodies[st]),
    )
    template_body_names = {n for n, _ in per_station_bodies[template_station]}
    print(
        f"template station {template_station} with bodies "
        f"{sorted(template_body_names)}"
    )

    template_tris = [t for t in triangles if t[0] in template_body_names]
    # Template cluster centroid, projected onto the ring plane.
    t_idx = set()
    for _, _, tri in template_tris:
        t_idx.update(vi for vi, _ in tri)
    tc = (
        sum(positions[i][0] for i in t_idx) / len(t_idx),
        sum(positions[i][1] for i in t_idx) / len(t_idx),
        sum(positions[i][2] for i in t_idx) / len(t_idx),
    )
    template_vec = project_out_axis(sub(tc, center), axis)

    groups: list[tuple[str, list]] = []
    out_colours: dict[str, tuple[float, float, float]] = {"drum": DRUM_RGB}

    # Drum: always-visible base.
    drum_faces = [tri for body, _, tri in triangles if body == DRUM_BODY]
    groups.append(("drum", drum_faces))

    # One tool per station: rotate a copy of the template onto each station.
    for num in range(1, count + 1):
        target_vec = station_angle[num]
        angle = signed_angle(template_vec, target_vec, axis)
        remap: dict[tuple, tuple] = {}
        faces = []
        for _, _, tri in template_tris:
            new_tri = []
            for vi, ni in tri:
                key = (vi, ni)
                mapped = remap.get(key)
                if mapped is None:
                    p = rotate_about_axis(positions[vi], center, axis, angle)
                    positions.append(p)
                    new_vi = len(positions) - 1
                    new_ni = None
                    if ni is not None:
                        normals.append(rotate_dir(normals[ni], axis, angle))
                        new_ni = len(normals) - 1
                    mapped = (new_vi, new_ni)
                    remap[key] = mapped
                new_tri.append(mapped)
            faces.append(new_tri)
        mat = f"station-{num:02d}"
        groups.append((mat, faces))
        out_colours[mat] = TOOL_RGB

    build_glb(positions, normals, groups, out_colours, out_path)
    kb = out_path.stat().st_size / 1024
    print(f"wrote {out_path} — {len(groups)} groups (drum + {count} stations), {kb:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
