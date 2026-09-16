#!/usr/bin/env python3
"""Extract the turret's 12 per-station joint frames from a Fusion STEP export.

The user seats a tool block on each turret station with a Fusion *joint*
(Joint N = Station N). Fusion does not export named datums/joints into the
AP214 STEP, but it *does* export one placeholder occurrence per station:
this "Just Turret" file carries 12 ``Plug:1..12`` assembly occurrences, each a
``NEXT_ASSEMBLY_USAGE_OCCURRENCE`` seated on its station by an
``ITEM_DEFINED_TRANSFORMATION``.  The IDT's *second* placement (``item2``) is
the joint mating frame expressed in the turret/parent representation — exactly
the per-station UCS the block's MCS must snap onto.

This script (no CAD kernel, pure STEP text parsing — reuses the helpers of
``extract-step-seat.py``):
  1. Resolves every ``Plug:N`` occurrence -> its IDT -> ``item2`` frame in STEP
     (mm) space: origin + Z (axis) + X (ref_direction), Y = Z x X.
  2. Fits the ring of the 12 joint origins (centre, axis, radius) in STEP space.
  3. Recovers the STEP->GLB similarity transform (scale + rotation + translation)
     by aligning that ring to ``src/data/turretStations.json`` (cm space).
  4. Emits ``src/data/turretJoints.json`` with each station's GLB-space frame
     (origin, intoFaceAxis, toolForwardAxis) plus the raw STEP frame, and the
     recovered transform + fit residual.

Security note (workspace Python rule #1): the STEP path is a positional CLI arg,
validated (suffix + existence) before opening; no untrusted input, shell, or
eval is used.

Usage:
    python3 scripts/extract-step-joints.py "/path/to/Just Turret.step" \
        --ring src/data/turretStations.json --out src/data/turretJoints.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

# Reuse the vetted STEP reader / geometry helpers from the sibling script.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

_seat = import_module("extract-step-seat")
load_entities = _seat.load_entities
refs = _seat.refs
axis2placement = _seat.axis2placement
mat_mul = _seat.mat_mul
invert_rigid = _seat.invert_rigid
_cross = _seat._cross
_norm = _seat._norm
_dot = _seat._dot

Vec = list[float]
Mat = list[float]


# ---------------------------------------------------------------------------
# Occurrence -> joint frame resolution.
# ---------------------------------------------------------------------------

def occurrence_frames(entities: dict[int, tuple[str, str]]) -> dict[str, dict]:
    """Map each assembly occurrence name (e.g. ``Plug:3``) to its seat frame.

    Chain: NAUO(name) <- PRODUCT_DEFINITION_SHAPE(def=NAUO) <-
    CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(rep_rel, PDS) -> the complex
    REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION -> ITEM_DEFINED_TRANSFORMATION
    (item1 in child rep, item2 in parent rep).  We return item2 (the mating
    frame in the parent/turret rep) *and* the child->parent placement
    M = item2 . inv(item1) for reference.
    """
    # NAUO id -> instance name.
    nauo_name: dict[int, str] = {}
    for eid, (typ, args) in entities.items():
        if typ == "NEXT_ASSEMBLY_USAGE_OCCURRENCE":
            names = re.findall(r"'([^']*)'", args)
            nauo_name[eid] = names[0] if names else str(eid)

    # PRODUCT_DEFINITION_SHAPE id -> defined NAUO id (last ref).
    pds_nauo: dict[int, int] = {}
    for eid, (typ, args) in entities.items():
        if typ == "PRODUCT_DEFINITION_SHAPE":
            r = refs(args)
            if r and r[-1] in nauo_name:
                pds_nauo[eid] = r[-1]

    # RRWT complex id -> IDT id.
    rrwt_idt: dict[int, int] = {}
    for eid, (typ, args) in entities.items():
        if typ != "*COMPLEX*":
            continue
        if "REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION" not in args:
            continue
        m = re.search(r"REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION\s*\(\s*#(\d+)", args)
        if m:
            rrwt_idt[eid] = int(m.group(1))

    out: dict[str, dict] = {}
    for eid, (typ, args) in entities.items():
        if typ != "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION":
            continue
        r = refs(args)
        if len(r) < 2:
            continue
        rrwt, pds = r[0], r[1]
        if pds not in pds_nauo or rrwt not in rrwt_idt:
            continue
        name = nauo_name[pds_nauo[pds]]
        idt = rrwt_idt[rrwt]
        _, idt_args = entities[idt]
        placements = refs(idt_args)
        if len(placements) < 2:
            continue
        item1, item2 = placements[0], placements[1]
        m1 = axis2placement(entities, item1)
        m2 = axis2placement(entities, item2)
        child_to_parent = mat_mul(m2, invert_rigid(m1))
        out[name] = {
            "item1": item1,
            "item2": item2,
            "seatFrame": m2,           # joint mating frame in parent rep (mm)
            "childToParent": child_to_parent,
        }
    return out


def frame_origin(m: Mat) -> Vec:
    return [m[3], m[7], m[11]]


def frame_axis_z(m: Mat) -> Vec:
    return _norm([m[2], m[6], m[10]])


def frame_axis_x(m: Mat) -> Vec:
    return _norm([m[0], m[4], m[8]])


# ---------------------------------------------------------------------------
# Ring fit in STEP space: centre, axis (best-fit plane normal), radius.
# ---------------------------------------------------------------------------

def _mean(pts: list[Vec]) -> Vec:
    n = len(pts)
    return [sum(p[i] for p in pts) / n for i in range(3)]


def _plane_normal(pts: list[Vec], centroid: Vec) -> Vec:
    """Best-fit plane normal via the smallest-eigenvector of the covariance,
    found with a few inverse-power / Jacobi-free deflation iterations."""
    # Build 3x3 covariance.
    cov = [[0.0] * 3 for _ in range(3)]
    for p in pts:
        d = [p[i] - centroid[i] for i in range(3)]
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    # Largest two eigenvectors via power iteration + deflation; normal = cross.
    def mat_vec(m, v):
        return [sum(m[i][j] * v[j] for j in range(3)) for i in range(3)]

    def power(m):
        v = [1.0, 0.3, -0.2]
        for _ in range(200):
            w = mat_vec(m, v)
            n = math.sqrt(sum(c * c for c in w)) or 1.0
            v = [c / n for c in w]
        lam = _dot(v, mat_vec(m, v))
        return v, lam

    v1, lam1 = power(cov)
    # Deflate the largest component out.
    cov2 = [[cov[i][j] - lam1 * v1[i] * v1[j] for j in range(3)] for i in range(3)]
    v2, _ = power(cov2)
    normal = _norm(_cross(v1, v2))
    return normal


def fit_ring(origins: list[Vec]) -> dict:
    centroid = _mean(origins)
    axis = _plane_normal(origins, centroid)
    # Project each origin to the plane through centroid to get radius.
    radii = []
    for p in origins:
        d = [p[i] - centroid[i] for i in range(3)]
        ax = _dot(d, axis)
        radial = [d[i] - ax * axis[i] for i in range(3)]
        radii.append(math.sqrt(sum(c * c for c in radial)))
    radius = sum(radii) / len(radii)
    return {"center": centroid, "axis": axis, "radius": radius, "radii": radii}


# ---------------------------------------------------------------------------
# Similarity transform STEP -> GLB from two corresponding point sets
# (Umeyama, with uniform scale).  Uses the 12 joint origins vs the 12 ring
# station positions, matched by best rotational offset around the axis.
# ---------------------------------------------------------------------------

def umeyama(src: list[Vec], dst: list[Vec]) -> tuple[float, list[list[float]], Vec, float]:
    """Return (scale, R(3x3), t, rms) mapping src->dst: dst ~= s*R*src + t."""
    n = len(src)
    mu_s = _mean(src)
    mu_d = _mean(dst)
    xs = [[p[i] - mu_s[i] for i in range(3)] for p in src]
    xd = [[p[i] - mu_d[i] for i in range(3)] for p in dst]
    # Covariance H = sum xd * xs^T / n  (3x3).
    H = [[sum(xd[k][i] * xs[k][j] for k in range(n)) / n for j in range(3)] for i in range(3)]
    U, S, Vt = _svd3(H)
    # R = U * diag(1,1,d) * Vt, d = sign(det(U*Vt)).
    UVt = _matmul3(U, Vt)
    d = 1.0 if _det3(UVt) > 0 else -1.0
    D = [[1.0, 0, 0], [0, 1.0, 0], [0, 0, d]]
    R = _matmul3(_matmul3(U, D), Vt)
    var_s = sum(sum(c * c for c in xs[k]) for k in range(n)) / n
    scale = (S[0] + S[1] + d * S[2]) / var_s if var_s else 1.0
    t = [mu_d[i] - scale * sum(R[i][j] * mu_s[j] for j in range(3)) for i in range(3)]
    # RMS residual.
    se = 0.0
    for k in range(n):
        pred = [scale * sum(R[i][j] * src[k][j] for j in range(3)) + t[i] for i in range(3)]
        se += sum((pred[i] - dst[k][i]) ** 2 for i in range(3))
    rms = math.sqrt(se / n)
    return scale, R, t, rms


# --- tiny 3x3 linear algebra (SVD via eigen of H^T H) ----------------------

def _matmul3(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def _transpose3(a):
    return [[a[j][i] for j in range(3)] for i in range(3)]


def _det3(m):
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )


def _jacobi_eigen(a):
    """Symmetric 3x3 Jacobi eigen-decomposition -> (eigvals, eigvecs cols)."""
    A = [row[:] for row in a]
    V = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    for _ in range(100):
        # Largest off-diagonal.
        p, q, mx = 0, 1, abs(A[0][1])
        for i in range(3):
            for j in range(i + 1, 3):
                if abs(A[i][j]) >= mx:
                    p, q, mx = i, j, abs(A[i][j])
        if mx < 1e-15:
            break
        app, aqq, apq = A[p][p], A[q][q], A[p][q]
        phi = 0.5 * math.atan2(2 * apq, aqq - app) if (aqq - app) != 0 else math.pi / 4
        c, s = math.cos(phi), math.sin(phi)
        for k in range(3):
            akp, akq = A[k][p], A[k][q]
            A[k][p] = c * akp - s * akq
            A[k][q] = s * akp + c * akq
        for k in range(3):
            akp, akq = A[p][k], A[q][k]
            A[p][k] = c * akp - s * akq
            A[q][k] = s * akp + c * akq
        for k in range(3):
            vkp, vkq = V[k][p], V[k][q]
            V[k][p] = c * vkp - s * vkq
            V[k][q] = s * vkp + c * vkq
    eigvals = [A[i][i] for i in range(3)]
    eigvecs = [[V[i][j] for i in range(3)] for j in range(3)]  # eigvecs[j] = column j
    return eigvals, eigvecs


def _svd3(H):
    """Minimal SVD of a 3x3: H = U S Vt.  Via eigen of HtH (V) and HHt (U)."""
    HtH = _matmul3(_transpose3(H), H)
    evals, evecs = _jacobi_eigen(HtH)
    order = sorted(range(3), key=lambda i: -evals[i])
    S = [math.sqrt(max(evals[i], 0.0)) for i in order]
    V = [[evecs[order[j]][i] for j in range(3)] for i in range(3)]  # columns = V vecs
    Vt = _transpose3(V)
    # U columns = H v_i / s_i.
    U = [[0.0] * 3 for _ in range(3)]
    for j in range(3):
        vj = [V[i][j] for i in range(3)]
        Hv = [sum(H[i][k] * vj[k] for k in range(3)) for i in range(3)]
        s = S[j] if S[j] > 1e-12 else 1.0
        for i in range(3):
            U[i][j] = Hv[i] / s
    return U, S, Vt


def apply_sim(scale: float, R, t: Vec, p: Vec) -> Vec:
    return [scale * sum(R[i][j] * p[j] for j in range(3)) + t[i] for i in range(3)]


def apply_sim_dir(scale: float, R, v: Vec) -> Vec:
    return _norm([sum(R[i][j] * v[j] for j in range(3)) for i in range(3)])


def sim_matrix(scale: float, R, t: Vec) -> list[float]:
    return [
        scale * R[0][0], scale * R[0][1], scale * R[0][2], t[0],
        scale * R[1][0], scale * R[1][1], scale * R[1][2], t[1],
        scale * R[2][0], scale * R[2][1], scale * R[2][2], t[2],
        0.0, 0.0, 0.0, 1.0,
    ]


def angle_around(axis: Vec, center: Vec, ref_x: Vec, ref_y: Vec, p: Vec) -> float:
    d = [p[i] - center[i] for i in range(3)]
    ax = _dot(d, axis)
    r = [d[i] - ax * axis[i] for i in range(3)]
    return math.atan2(_dot(r, ref_y), _dot(r, ref_x))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("step")
    ap.add_argument("--ring", default="src/data/turretStations.json")
    ap.add_argument("--prefix", default="Plug", help="occurrence name prefix for the station plugs")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    path = Path(args.step).expanduser()
    if path.suffix.lower() not in (".step", ".stp") or not path.is_file():
        print(f"not a STEP file: {path}", file=sys.stderr)
        return 2

    entities = load_entities(path.read_text(errors="ignore"))
    frames = occurrence_frames(entities)

    # Station plugs, ordered by numeric suffix.
    def suffix_num(name: str) -> int:
        m = re.search(r"(\d+)$", name)
        return int(m.group(1)) if m else 0

    plug_names = sorted(
        (n for n in frames if n.startswith(args.prefix + ":")),
        key=suffix_num,
    )
    other_names = [n for n in frames if not n.startswith(args.prefix + ":")]

    print(f"occurrences found: {len(frames)} -> {sorted(frames)}", file=sys.stderr)
    print(f"station plugs: {len(plug_names)} -> {plug_names}", file=sys.stderr)
    print(f"other occurrences: {other_names}", file=sys.stderr)

    step_origins = [frame_origin(frames[n]["seatFrame"]) for n in plug_names]
    step_z = [frame_axis_z(frames[n]["seatFrame"]) for n in plug_names]
    step_x = [frame_axis_x(frames[n]["seatFrame"]) for n in plug_names]

    step_ring = fit_ring(step_origins)
    print(
        f"STEP ring: center={[round(c,3) for c in step_ring['center']]} "
        f"axis={[round(c,4) for c in step_ring['axis']]} radius={step_ring['radius']:.4f} "
        f"radii_spread={max(step_ring['radii'])-min(step_ring['radii']):.4f}",
        file=sys.stderr,
    )

    ring = json.loads(Path(args.ring).read_text())
    glb_positions = [None] * 12
    for s in ring["stations"]:
        glb_positions[s["number"] - 1] = s["position"]

    # Match STEP plug i (Plug:i) -> GLB station i initially, then try rotational
    # offsets and both axis orientations to find the least-residual assignment.
    best = None
    for flip in (False, True):
        src = list(reversed(step_origins)) if flip else list(step_origins)
        for shift in range(12):
            src_shifted = [src[(k + shift) % 12] for k in range(12)]
            scale, R, t, rms = umeyama(src_shifted, glb_positions)
            if best is None or rms < best["rms"]:
                best = {
                    "rms": rms, "scale": scale, "R": R, "t": t,
                    "flip": flip, "shift": shift,
                }
    scale, R, t = best["scale"], best["R"], best["t"]
    print(
        f"best fit: scale={scale:.6f} rms={best['rms']:.4f} cm "
        f"flip={best['flip']} shift={best['shift']}",
        file=sys.stderr,
    )

    # Which STEP plug maps to GLB station 1?  After (flip, shift), GLB station k
    # (0-based) uses src_shifted[k] = src[(k+shift)%12].  For k=0 (station 1):
    idx = best["shift"] % 12
    src_names = list(reversed(plug_names)) if best["flip"] else plug_names
    station1_plug = src_names[idx]

    # Build per-station GLB frames.
    glb_axis = _norm(ring["axis"])
    glb_center = ring["center"]
    # Reference X/Y in the ring plane for angle checks.
    seed = [1.0, 0.0, 0.0]
    if abs(_dot(seed, glb_axis)) > 0.9:
        seed = [0.0, 1.0, 0.0]
    ref_x = _norm([seed[i] - _dot(seed, glb_axis) * glb_axis[i] for i in range(3)])
    ref_y = _cross(glb_axis, ref_x)

    stations_out = []
    for station in range(1, 13):
        k = station - 1
        step_idx_in_src = (k + best["shift"]) % 12
        # Map back to original plug index.
        if best["flip"]:
            plug_idx = len(plug_names) - 1 - step_idx_in_src
        else:
            plug_idx = step_idx_in_src
        name = plug_names[plug_idx]
        o_step = step_origins[plug_idx]
        z_step = step_z[plug_idx]
        x_step = step_x[plug_idx]

        o_glb = apply_sim(scale, R, t, o_step)
        z_glb = apply_sim_dir(scale, R, z_step)  # raw plug Z in GLB (unreliable)
        x_glb = apply_sim_dir(scale, R, x_step)

        # The 12 plug occurrences were inserted with varying roll, so their raw
        # joint Z/X axes are NOT consistent (some axial, some radial) and cannot
        # be used directly as a mounting normal.  Their ORIGINS, however, form a
        # clean ring.  So we derive the seating axes from the (consistent) ring
        # geometry instead:
        #   * intoFaceAxis  = radial inward (from the joint origin toward the
        #     drum axis) — the direction the block presses INTO the facet.
        #   * toolForwardAxis = drum axis pointing to the front (where the
        #     stations sit, forward of the drum centre) — where tools exit.
        d = [o_glb[i] - glb_center[i] for i in range(3)]
        ax = _dot(d, glb_axis)
        radial_out = _norm([d[i] - ax * glb_axis[i] for i in range(3)])
        into_face = [-c for c in radial_out]  # radial inward, toward drum axis
        front_sign = 1.0 if ax >= 0 else -1.0
        tool_forward = _norm([front_sign * glb_axis[i] for i in range(3)])
        # For traceability: is the raw plug Z closer to axial or radial here?
        raw_z_kind = "axial" if abs(_dot(z_glb, glb_axis)) > 0.5 else "radial/other"

        stations_out.append({
            "station": station,
            "stepOccurrence": name,
            "origin": [round(c, 4) for c in o_glb],
            "intoFaceAxis": [round(c, 6) for c in into_face],
            "intoFaceAxisSource": "ring-derived radial-inward (raw plug Z inconsistent)",
            "toolForwardAxis": [round(c, 6) for c in tool_forward],
            "toolForwardAxisSource": "ring-derived drum-axis-forward",
            "rawPlugZInGlb": [round(c, 6) for c in z_glb],
            "rawPlugZKind": raw_z_kind,
            "stepFrame": {
                "origin_mm": [round(c, 4) for c in o_step],
                "zAxis": [round(c, 6) for c in z_step],
                "xAxis": [round(c, 6) for c in x_step],
                "yAxis": [round(c, 6) for c in _norm(_cross(z_step, x_step))],
            },
        })

    # Sanity: angle of station 1 around the drum axis vs ring.station1Angle,
    # and 30-degree spacing.
    angles = [
        angle_around(glb_axis, glb_center, ref_x, ref_y, stations_out[k - 1]["origin"])
        for k in range(1, 13)
    ]
    deltas = []
    for k in range(12):
        d = angles[(k + 1) % 12] - angles[k]
        while d > math.pi:
            d -= 2 * math.pi
        while d < -math.pi:
            d += 2 * math.pi
        deltas.append(d)

    out = {
        "source": path.name,
        "units": "cm (GLB space)",
        "stepUnits": "mm",
        "stepToGlbScale": round(scale, 8),
        "stepToGlbMatrix": [round(c, 8) for c in sim_matrix(scale, R, t)],
        "fitResidual": {"rmsCm": round(best["rms"], 5), "note": "RMS of 12 joint origins vs ring positions"},
        "seatingAxesNote": (
            "The 12 Plug occurrences were inserted with varying roll, so their raw "
            "joint Z/X axes are inconsistent and are NOT used as the mounting normal. "
            "Only the joint ORIGINS are reliable (they form a clean ring). intoFaceAxis "
            "and toolForwardAxis are therefore derived from the ring geometry: "
            "intoFaceAxis = radial inward (toward drum axis), toolForwardAxis = drum axis "
            "forward. Raw plug frames are kept per-station (stepFrame, rawPlugZInGlb) for "
            "traceability."
        ),
        "station1StepOccurrence": station1_plug,
        "ringAxisGlb": [round(c, 6) for c in glb_axis],
        "ringCenterGlb": [round(c, 4) for c in glb_center],
        "stations": stations_out,
        "sanity": {
            "station1AngleRad": round(angles[0], 6),
            "ringStation1Angle": ring.get("station1Angle"),
            "station1AngleDeltaRad": round(angles[0] - ring.get("station1Angle", 0.0), 6),
            "stepMeanDegBetweenStations": round(sum(abs(d) for d in deltas) / len(deltas) * 180 / math.pi, 4),
            "stepStdDegBetweenStations": round(
                (sum((abs(d) - sum(abs(x) for x in deltas) / len(deltas)) ** 2 for d in deltas) / len(deltas)) ** 0.5 * 180 / math.pi,
                4,
            ),
        },
    }
    rendered = json.dumps(out, indent=2)
    print(rendered)
    if args.out:
        Path(args.out).expanduser().write_text(rendered + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
