#!/usr/bin/env python3
"""Fit the real BMT65 turret ring from the seated-assembly OBJ.

The prototype's turret viewport places 12 numbered hotspots and seats the tool
block by rotating it about the drum axis. Both need the real drum's axis, centre
and radius, in the same coordinate frame as the GLBs we split from the seated
OBJ (``turret-bmt65.glb`` / ``toolblock-3x-real.glb``). This reads the turret
body (``Body1``) to fit the ring, and the block cluster (every other body) to
find which angular position is station 1 — the facet the block is actually
seated on — so station numbering starts where the block sits.

Output: ``src/data/turretStations.json`` (same schema the app already consumes:
count, axis, center, radius, labelRadius, frontAxial, stations[number,position,
normal]) plus a ``station1`` angle so the seat rotation can be derived.

Security note (workspace Python rule #1): fixed in-repo paths, no user input;
validated for existence before read.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

OBJ = Path("geometry-source/Turret Assembly Clean (Mesh).obj")
OUT = Path("src/data/turretStations.json")
TURRET_BODY = "Body1"  # the 39.5 cm drum; every other body is the tool block
STATION_COUNT = 12


def parse(path: Path):
    verts: list[tuple[float, float, float]] = []
    body_idx: dict[str, set[int]] = {}
    cur = ""
    for line in path.read_text(errors="ignore").splitlines():
        if line.startswith("v "):
            p = line.split()
            verts.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith("g "):
            cur = line[2:].strip()
            body_idx.setdefault(cur, set())
        elif line.startswith("f "):
            for tok in line.split()[1:]:
                vi = int(tok.split("/")[0])
                vi = vi - 1 if vi > 0 else len(verts) + vi
                body_idx.setdefault(cur, set()).add(vi)
    return verts, body_idx


def centroid(pts):
    n = len(pts)
    return tuple(sum(p[i] for p in pts) / n for i in range(3))


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    m = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / m, a[1] / m, a[2] / m)


def jacobi_eigen(a):
    """Eigen-decompose a symmetric 3x3. Returns (values, column-vectors)."""
    a = [row[:] for row in a]
    v = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    for _ in range(100):
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


def main() -> int:
    if not OBJ.is_file():
        print(f"missing OBJ: {OBJ}", file=sys.stderr)
        return 2
    verts, body_idx = parse(OBJ)

    drum = [verts[i] for i in body_idx.get(TURRET_BODY, set()) if 0 <= i < len(verts)]
    block_idx: set[int] = set()
    for name, idxs in body_idx.items():
        if name != TURRET_BODY:
            block_idx |= idxs
    block = [verts[i] for i in block_idx if 0 <= i < len(verts)]
    if len(drum) < 100 or len(block) < 10:
        print("drum or block body not found", file=sys.stderr)
        return 3

    # Axis = thin PCA direction of the drum; centre = drum centroid (on axis).
    c = centroid(drum)
    cov = [[0.0] * 3 for _ in range(3)]
    for p in drum:
        d = sub(p, c)
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    values, vectors = jacobi_eigen(cov)
    axis = norm(vectors[values.index(min(values))])
    # Orient the axis toward the block/tools side (they project forward along it).
    if dot(sub(centroid(block), c), axis) < 0:
        axis = tuple(-a for a in axis)

    # In-plane basis.
    seed = (1.0, 0.0, 0.0)
    if abs(dot(axis, seed)) > 0.9:
        seed = (0.0, 1.0, 0.0)
    u = norm(sub(seed, tuple(axis[i] * dot(seed, axis) for i in range(3))))
    w = norm(cross(axis, u))

    # Drum extents.
    axials = [dot(sub(p, c), axis) for p in drum]
    front_axial = max(axials)
    plane_r = sorted(math.hypot(dot(sub(p, c), u), dot(sub(p, c), w)) for p in drum)
    rim = plane_r[int(len(plane_r) * 0.98)]
    label_r = rim * 0.82
    label_axial = front_axial + 1.0

    # Station 1 = the facet the block sits on: angle of the block centroid.
    bc = sub(centroid(block), c)
    theta1 = math.atan2(dot(bc, w), dot(bc, u))
    step = 2 * math.pi / STATION_COUNT

    stations = []
    for k in range(STATION_COUNT):
        theta = theta1 + k * step
        rd = tuple(math.cos(theta) * u[i] + math.sin(theta) * w[i] for i in range(3))
        pos = tuple(c[i] + axis[i] * label_axial + rd[i] * label_r for i in range(3))
        stations.append(
            {
                "number": k + 1,
                "position": [round(pos[i], 3) for i in range(3)],
                "normal": [round(axis[i], 4) for i in range(3)],
            }
        )

    out = {
        "count": STATION_COUNT,
        "axis": [round(a, 4) for a in axis],
        "center": [round(c[i], 3) for i in range(3)],
        "radius": round(rim, 3),
        "labelRadius": round(label_r, 3),
        "frontAxial": round(front_axial, 3),
        "station1Angle": round(theta1, 6),
        "stationStep": round(step, 6),
        "stations": stations,
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(
        f"wrote {OUT} — center {out['center']}, axis {out['axis']}, rim {rim:.1f}, "
        f"front {front_axial:.1f}, station1 {math.degrees(theta1):.1f} deg"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
