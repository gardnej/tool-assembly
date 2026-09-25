#!/usr/bin/env python3
"""Compute turret station positions for the 3D station-number labels.

The turret is a 12-station BMT drum; stations sit evenly around its axis. This
reads the assembled turret OBJ, uses the mounted tools (the teal/gold materials)
as evidence of where stations are, fits the axis and station ring, and writes 12
positions in the model's own coordinate space (the same coordinates the .glb
keeps) so <model-viewer> hotspots land on the turret.

Pure Python (no numpy): a small Jacobi eigensolver gives the ring's plane.

Security note (workspace Python rule #1): trusted local build tool; argv paths
are validated before use and nothing is exposed to untrusted callers.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

TOOL_MATERIALS = {"Opaque(93,148,165)", "Opaque(243,203,124)"}
DRUM_BODY = "Body1:33"
STATION_COUNT = 12


def parse(path: Path):
    positions: list[tuple[float, float, float]] = []
    bodies: dict[str, list[int]] = {}
    tool_bodies: set[str] = set()
    current_body = "Body"
    current_mtl = ""

    for line in path.read_text(errors="ignore").splitlines():
        if not line:
            continue
        if line[0] == "v" and line[1] == " ":
            p = line.split()
            positions.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith("g "):
            current_body = line[2:].strip()
            bodies.setdefault(current_body, [])
        elif line.startswith("usemtl "):
            current_mtl = line[7:].strip()
            if current_mtl in TOOL_MATERIALS:
                tool_bodies.add(current_body)
        elif line[0] == "f" and line[1] == " ":
            idxs = []
            for tok in line.split()[1:]:
                vi = int(tok.split("/")[0])
                vi = vi - 1 if vi > 0 else len(positions) + vi
                idxs.append(vi)
            bodies.setdefault(current_body, []).extend(idxs)

    return positions, bodies, tool_bodies


def centroid(points):
    n = len(points)
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sz = sum(p[2] for p in points)
    return (sx / n, sy / n, sz / n)


def jacobi_eigen(a):
    """Eigen-decompose a symmetric 3x3 matrix. Returns (values, vectors)."""
    a = [row[:] for row in a]
    v = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    for _ in range(100):
        # Largest off-diagonal.
        p, q, off = 0, 1, abs(a[0][1])
        if abs(a[0][2]) > off:
            p, q, off = 0, 2, abs(a[0][2])
        if abs(a[1][2]) > off:
            p, q, off = 1, 2, abs(a[1][2])
        if off < 1e-12:
            break
        app, aqq, apq = a[p][p], a[q][q], a[p][q]
        phi = 0.5 * math.atan2(2 * apq, aqq - app)
        c, s = math.cos(phi), math.sin(phi)
        for k in range(3):
            akp, akq = a[k][p], a[k][q]
            a[k][p] = c * akp - s * akq
            a[k][q] = s * akp + c * akq
        for k in range(3):
            apk, aqk = a[p][k], a[q][k]
            a[p][k] = c * apk - s * aqk
            a[q][k] = s * apk + c * aqk
        for k in range(3):
            vkp, vkq = v[k][p], v[k][q]
            v[k][p] = c * vkp - s * vkq
            v[k][q] = s * vkp + c * vkq
    values = [a[0][0], a[1][1], a[2][2]]
    vectors = [[v[i][j] for i in range(3)] for j in range(3)]  # column j
    return values, vectors


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    args = ap.parse_args()

    in_path = Path(args.input).expanduser()
    out_path = Path(args.output).expanduser()
    if in_path.suffix.lower() != ".obj" or not in_path.is_file():
        print(f"not an .obj: {in_path}", file=sys.stderr)
        return 2

    positions, bodies, tool_bodies = parse(in_path)

    # --- Ring geometry comes from the DRUM body, not the tools. -------------
    # The source OBJ only carried tools on some stations, so the tool cloud is
    # not symmetric about the drum axis; fitting the ring to it put the centre
    # ~11 mm off and the radius out at the tool tips. The drum itself is a clean
    # 12-sided disc, so we take its centroid as the ring centre and its thin
    # PCA axis as the turret axis.
    drum_pts = [positions[i] for i in set(bodies.get(DRUM_BODY) or [])
                if 0 <= i < len(positions)]
    if len(drum_pts) < 8:
        print(f"drum body {DRUM_BODY!r} not found / too small", file=sys.stderr)
        return 3

    c = centroid(drum_pts)
    cov = [[0.0] * 3 for _ in range(3)]
    for p in drum_pts:
        d = sub(p, c)
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    values, vectors = jacobi_eigen(cov)
    axis = norm(vectors[values.index(min(values))])  # thin direction = axis
    # Orient axis toward the operator-facing front (the +X-ish, camera side).
    if axis[0] < 0:
        axis = tuple(-a for a in axis)

    # In-plane basis.
    seed = (1.0, 0.0, 0.0)
    if abs(dot(axis, seed)) > 0.9:
        seed = (0.0, 1.0, 0.0)
    u = norm(sub(seed, tuple(axis[i] * dot(seed, axis) for i in range(3))))
    w = norm(cross(axis, u))

    # Drum extents: front-face plane (max axial) and rim radius (in-plane).
    axials = [dot(sub(p, c), axis) for p in drum_pts]
    front_axial = max(axials)
    plane_r = sorted(math.hypot(dot(sub(p, c), u), dot(sub(p, c), w))
                     for p in drum_pts)
    rim = plane_r[int(len(plane_r) * 0.98)]
    # Seat the numbers on the front face, inboard of the rim, and a hair proud
    # of the surface so they occlude cleanly when a station turns away.
    label_r = rim * 0.82
    label_axial = front_axial + 1.0

    # Phase: align the 12-slot grid to the real tool/flat angles (measured about
    # the *correct* centre now), so number N sits on the same flat as tool N.
    step = 2 * math.pi / STATION_COUNT
    tool_angles = []
    for name in tool_bodies:
        idxs = set(bodies.get(name) or [])
        pts = [positions[i] for i in idxs if 0 <= i < len(positions)]
        if not pts:
            continue
        d = sub(centroid(pts), c)
        tool_angles.append(math.atan2(dot(d, w), dot(d, u)))
    if tool_angles:
        offsets = [((a % step) + step) % step for a in tool_angles]
        sin_s = sum(math.sin(o / step * 2 * math.pi) for o in offsets)
        cos_s = sum(math.cos(o / step * 2 * math.pi) for o in offsets)
        phase = math.atan2(sin_s, cos_s) / (2 * math.pi) * step
    else:
        phase = 0.0

    stations = []
    for k in range(STATION_COUNT):
        theta = phase + k * step
        rd = tuple(math.cos(theta) * u[i] + math.sin(theta) * w[i]
                   for i in range(3))
        pos = tuple(c[i] + axis[i] * label_axial + rd[i] * label_r
                    for i in range(3))
        stations.append({
            "number": k + 1,
            "position": [round(pos[i], 3) for i in range(3)],
            "normal": [round(axis[i], 4) for i in range(3)],
        })

    out = {
        "count": STATION_COUNT,
        "axis": [round(a, 4) for a in axis],
        "center": [round(c[i], 3) for i in range(3)],
        "radius": round(rim, 3),
        "labelRadius": round(label_r, 3),
        "frontAxial": round(front_axial, 3),
        "toolBodies": len(tool_bodies),
        "stations": stations,
    }
    out_path.write_text(json.dumps(out, indent=2))
    print(
        f"wrote {out_path} — drum-based ring, centre {out['center']}, "
        f"rim {rim:.1f}, labelR {label_r:.1f}, axis {out['axis']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
