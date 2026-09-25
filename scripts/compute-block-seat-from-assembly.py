#!/usr/bin/env python3
"""Compute the block's per-station GLB placement from the seated assembly STEP.

Deterministic pipeline (no CAD kernel, no eyeballing):

  1. Read the block world placement ``t_block`` (block-local -> assembly root, mm)
     and the 12 ``Plug:N`` seat-frame origins (assembly root, mm) from the new
     "Turret Assembly" STEP.
  2. Refit the STEP->GLB similarity ``G`` (root mm -> GLB cm) by aligning those
     12 plug origins to ``turretStations.json`` (GLB cm) -- same Umeyama fit the
     turret joints already use, but on THIS file so it is consistent with
     ``t_block``.
  3. The block mesh (``toolblock-3x-clean*.glb``) is block-local, in cm, mesh
     origin == MCS (see ``blockMcs.json``). So the node matrix seating that mesh
     in GLB space is  M = G . t_block . diag(10,10,10,1)  (cm->mm on the mesh,
     t_block to root mm, G to GLB cm). This carries the authored joint pose
     exactly -- position AND orientation -- with no calibration.
  4. Identify the base station N0 the block was modelled on (nearest ring
     station to the seated block origin) and emit all 12 station matrices as
     R_drum(N-N0) . M, a rigid rotation about the GLB drum axis (12-fold sym).

Self-check: transforms the block body AABB corners by M and reports the seated
block origin, its nearest station, and the radius/axial gap to that station's
locating hole so seating can be judged numerically before rendering.

Read-only inputs; positional STEP path validated (suffix + existence). No shell,
eval, or network. (Workspace Python rules #1/#3/#6.)

Usage:
    python3 scripts/compute-block-seat-from-assembly.py \
        "/path/to/Turret Assembly.step" \
        --ring src/data/turretStations.json \
        --block-mcs src/data/blockMcs.json \
        [--out src/data/blockStationSeats.json]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
_seat = import_module("extract-step-seat")
_joints = import_module("extract-step-joints")

load_entities = _seat.load_entities
component_world_transforms = _seat.component_world_transforms
occurrence_frames = _joints.occurrence_frames
frame_origin = _joints.frame_origin
umeyama = _joints.umeyama


def sim_apply(scale, R, t, p):
    return [scale * sum(R[i][j] * p[j] for j in range(3)) + t[i] for i in range(3)]


def sim_mat4(scale, R, t):
    return [
        scale * R[0][0], scale * R[0][1], scale * R[0][2], t[0],
        scale * R[1][0], scale * R[1][1], scale * R[1][2], t[1],
        scale * R[2][0], scale * R[2][1], scale * R[2][2], t[2],
        0.0, 0.0, 0.0, 1.0,
    ]


def mat_mul(a, b):
    out = [0.0] * 16
    for r in range(4):
        for c in range(4):
            out[r * 4 + c] = sum(a[r * 4 + k] * b[k * 4 + c] for k in range(4))
    return out


def diag(s):
    return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]


def apply4(m, p):
    return [
        m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
        m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
        m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
    ]


def norm(v):
    m = math.sqrt(sum(c * c for c in v)) or 1.0
    return [c / m for c in v]


def dot(a, b):
    return sum(a[i] * b[i] for i in range(3))


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def rot_about_axis(axis, center, angle):
    """Column-major-agnostic 4x4 (row-major here) rotation about axis@center."""
    kx, ky, kz = norm(axis)
    c, s, t = math.cos(angle), math.sin(angle), 1 - math.cos(angle)
    R = [
        c + kx * kx * t, kx * ky * t - kz * s, kx * kz * t + ky * s,
        ky * kx * t + kz * s, c + ky * ky * t, ky * kz * t - kx * s,
        kz * kx * t - ky * s, kz * ky * t + kx * s, c + kz * kz * t,
    ]
    # translation = center - R*center
    rc = [R[0] * center[0] + R[1] * center[1] + R[2] * center[2],
          R[3] * center[0] + R[4] * center[1] + R[5] * center[2],
          R[6] * center[0] + R[7] * center[1] + R[8] * center[2]]
    tr = sub(center, rc)
    return [R[0], R[1], R[2], tr[0], R[3], R[4], R[5], tr[1], R[6], R[7], R[8], tr[2], 0, 0, 0, 1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("step")
    ap.add_argument("--ring", default="src/data/turretStations.json")
    ap.add_argument("--block-mcs", default="src/data/blockMcs.json")
    ap.add_argument("--block", default="3X Spot-Drill-Tap")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    path = Path(args.step).expanduser()
    if path.suffix.lower() not in (".step", ".stp") or not path.is_file():
        print(f"not a STEP file: {path}", file=sys.stderr)
        return 2

    ents = load_entities(path.read_text(errors="ignore"))

    comps = component_world_transforms(ents)
    if args.block not in comps:
        print(f"block {args.block!r} not found; saw {sorted(comps)}", file=sys.stderr)
        return 3
    t_block_rows = comps[args.block]["matrix"]  # row-major 4x4, block-local -> root (mm)

    frames = occurrence_frames(ents)
    plug_names = sorted((n for n in frames if n.startswith("Plug:")),
                        key=lambda n: int(n.split(":")[1]))
    plug_origins = [frame_origin(frames[n]["seatFrame"]) for n in plug_names]  # root mm

    ring = json.loads(Path(args.ring).read_text())
    glb_pos = [None] * 12
    for s in ring["stations"]:
        glb_pos[s["number"] - 1] = s["position"]

    # Refit STEP-root(mm) -> GLB(cm) over all (flip, shift) label alignments.
    best = None
    for flip in (False, True):
        src = list(reversed(plug_origins)) if flip else list(plug_origins)
        for shift in range(12):
            src_s = [src[(k + shift) % 12] for k in range(12)]
            scale, R, t, rms = umeyama(src_s, glb_pos)
            if best is None or rms < best[-1]:
                best = (scale, R, t, flip, shift, rms)
    scale, R, t, flip, shift, rms = best
    print(f"bridge refit: scale={scale:.6f}  rmsCm={rms:.4f}  flip={flip} shift={shift}",
          file=sys.stderr)

    G = sim_mat4(scale, R, t)  # root mm -> GLB cm

    # Block mesh (cm, local) -> GLB cm:  M = G . t_block . diag(10)
    M = mat_mul(G, mat_mul(t_block_rows, diag(10.0)))

    # Base station: nearest ring station to the seated block origin in GLB.
    block_origin_glb = [M[3], M[7], M[11]]
    dists = [(math.dist(block_origin_glb, glb_pos[i]), i + 1) for i in range(12)]
    dists.sort()
    base_station = dists[0][1]

    # Self-check against the block body AABB (blockMcs.json, cm, block-local).
    mcs = json.loads(Path(args.block_mcs).read_text())
    bmin = mcs["mesh"]["bodyAabbMinCm"]
    bmax = mcs["mesh"]["bodyAabbMaxCm"]
    center = ring["center"]
    axis = norm(ring["axis"])
    hole = glb_pos[base_station - 1]
    d = sub(hole, center)
    hole_axial = dot(d, axis)
    radial_out = norm(sub(d, [axis[i] * hole_axial for i in range(3)]))
    hole_radius = dot(sub(hole, center), radial_out)

    # +Z mounting-face centre of the body, in block-local cm.
    face_local = [(bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2, bmax[2]]
    face_glb = apply4(M, face_local)
    face_radius = dot(sub(face_glb, center), radial_out)
    face_axial = dot(sub(face_glb, center), axis)

    print("\n== Base station seat self-check ==", file=sys.stderr)
    print(f"  block origin (GLB cm)   : {[round(c,3) for c in block_origin_glb]}", file=sys.stderr)
    print(f"  nearest ring station    : #{base_station} (dist {dists[0][0]:.3f} cm)", file=sys.stderr)
    print(f"  station hole (GLB cm)    : {[round(c,3) for c in hole]}", file=sys.stderr)
    print(f"  hole radius (cm)         : {hole_radius:.3f}", file=sys.stderr)
    print(f"  block +Z face radius (cm): {face_radius:.3f}  -> mountFaceGap {(face_radius-hole_radius)*10:.2f} mm", file=sys.stderr)
    print(f"  block +Z face axial (cm) : {face_axial:.3f}  (hole axial {hole_axial:.3f})", file=sys.stderr)

    # Emit all 12 station matrices as column-major (glTF) node matrices.
    step_ang = ring["stationStep"]
    stations = []
    for n in range(1, 13):
        Rn = rot_about_axis(axis, center, (n - base_station) * step_ang)
        Mn = mat_mul(Rn, M)  # row-major
        col_major = [
            Mn[0], Mn[4], Mn[8], Mn[12],
            Mn[1], Mn[5], Mn[9], Mn[13],
            Mn[2], Mn[6], Mn[10], Mn[14],
            Mn[3], Mn[7], Mn[11], Mn[15],
        ]
        stations.append({"station": n, "matrixColMajor": [round(c, 6) for c in col_major]})

    out = {
        "source": path.name,
        "note": "Block per-station seat in GLB space (cm), carried from the Fusion "
                "rigid joint. matrixColMajor is a glTF node matrix mapping the "
                "block-local (cm) mesh into turret GLB space. Station N = "
                "R_drum(N-baseStation) . baseMatrix.",
        "baseStation": base_station,
        "bridge": {"scaleStepMmToGlbCm": round(scale, 8), "fitRmsCm": round(rms, 5)},
        "seatCheck": {
            "blockOriginGlbCm": [round(c, 4) for c in block_origin_glb],
            "mountFaceGapMm": round((face_radius - hole_radius) * 10, 3),
        },
        "stations": stations,
    }
    rendered = json.dumps(out, indent=2)
    print(rendered)
    if args.out:
        Path(args.out).expanduser().write_text(rendered + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
