#!/usr/bin/env python3
"""Extract the block-on-turret seat transform from an assembly STEP.

The turret + tool block STEP (authored in Fusion with a rigid joint seating the
block on the turret) encodes the correct relative pose as STEP assembly
transforms: each component's ``REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION``
carries an ``ITEM_DEFINED_TRANSFORMATION`` mapping the component's local frame
into the assembly root. Reading those two placements gives, exactly and without
any CAD kernel, the transform that seats the block flush on the turret.

This is the deterministic replacement for the hand-tuned ``Calibration`` in
``src/data/turretSolids.ts``: instead of eyeballing offsets against the pin
holes, we read the seat the designer built.

Output (JSON on stdout): the block-local -> turret-local rigid transform as a
row-major 4x4, plus the two component world transforms it derives from.

Security note (workspace Python rule #1): the STEP path is a positional CLI arg,
validated (suffix + existence) before it is opened; nothing here is exposed to
an untrusted caller and no shell/eval is used.

Usage:
    python3 scripts/extract-step-seat.py "/path/to/Turret Assembly.step"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Minimal STEP (ISO-10303-21) instance reader: id -> (type, raw-args).
# ---------------------------------------------------------------------------

_SIMPLE = re.compile(r"#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)\s*$", re.DOTALL)
_HEAD = re.compile(r"#(\d+)\s*=\s*(.*)$", re.DOTALL)


def load_entities(text: str) -> dict[int, tuple[str, str]]:
    """Map every ``#id = TYPE(args);`` instance to ``(TYPE, args)``.

    STEP statements can wrap across lines, so we join the DATA section and split
    it into ``#id = ... ;`` records. Two shapes occur:
      * simple  ``#id = TYPE(args)``            -> stored as ``(TYPE, args)``
      * complex ``#id = (T1(..) T2(..) ..)``    -> stored as ``("*COMPLEX*", body)``
    Complex (multi-type) instances are where AP214 keeps the assembly
    transforms, so they must be preserved rather than skipped.
    """
    data = text.split("DATA;", 1)[1] if "DATA;" in text else text
    data = data.split("ENDSEC;", 1)[0]
    entities: dict[int, tuple[str, str]] = {}
    # Split into records on the ';' that terminates each instance.
    for record in data.split(";"):
        record = record.strip()
        if not record or not record.startswith("#"):
            continue
        head = _HEAD.match(record)
        if head is None:
            continue
        ent_id = int(head.group(1))
        body = head.group(2).strip()
        simple = _SIMPLE.match(record)
        if body.startswith("(") or simple is None:
            entities[ent_id] = ("*COMPLEX*", body)
        else:
            entities[ent_id] = (simple.group(2), simple.group(3))
    return entities


def refs(args: str) -> list[int]:
    """Entity ids (#n) referenced in an argument string, in order."""
    return [int(x) for x in re.findall(r"#(\d+)", args)]


def floats(args: str) -> list[float]:
    """Floating-point literals in an argument string, in order."""
    return [float(x) for x in re.findall(r"[-+]?\d*\.\d+(?:[eE][-+]?\d+)?|[-+]?\d+\.", args)]


# ---------------------------------------------------------------------------
# Geometry helpers (row-major 4x4, points as columns; no numpy dependency).
# ---------------------------------------------------------------------------

Vec = list[float]
Mat = list[float]


def _cross(a: Vec, b: Vec) -> Vec:
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def _norm(a: Vec) -> Vec:
    m = (a[0] ** 2 + a[1] ** 2 + a[2] ** 2) ** 0.5 or 1.0
    return [a[0] / m, a[1] / m, a[2] / m]


def _dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cartesian_point(entities: dict[int, tuple[str, str]], eid: int) -> Vec:
    _, args = entities[eid]
    xyz = floats(args)
    while len(xyz) < 3:
        xyz.append(0.0)
    return xyz[:3]


def direction(entities: dict[int, tuple[str, str]], eid: int) -> Vec:
    _, args = entities[eid]
    return _norm(floats(args)[:3])


def axis2placement(entities: dict[int, tuple[str, str]], eid: int) -> Mat:
    """AXIS2_PLACEMENT_3D -> row-major 4x4 (origin, +Z = axis, +X = ref_dir).

    Per ISO-10303-42, the second ref is the local Z (``axis``) and the third is
    the reference direction that fixes local X; Y is Z x X. Missing refs default
    to the global axes, exactly as STEP specifies.
    """
    typ, args = entities[eid]
    assert typ == "AXIS2_PLACEMENT_3D", f"#{eid} is {typ}, not AXIS2_PLACEMENT_3D"
    r = refs(args)
    origin = cartesian_point(entities, r[0])
    z = direction(entities, r[1]) if len(r) > 1 else [0.0, 0.0, 1.0]
    x_ref = direction(entities, r[2]) if len(r) > 2 else [1.0, 0.0, 0.0]
    # Gram-Schmidt X against Z so the frame is orthonormal even if the ref_dir
    # is not exactly perpendicular (STEP allows a non-orthogonal ref_direction).
    x = _norm([x_ref[i] - _dot(x_ref, z) * z[i] for i in range(3)])
    y = _cross(z, x)
    # Columns are the images of local x, y, z; translation is the origin.
    return [
        x[0], y[0], z[0], origin[0],
        x[1], y[1], z[1], origin[1],
        x[2], y[2], z[2], origin[2],
        0.0, 0.0, 0.0, 1.0,
    ]


def mat_mul(a: Mat, b: Mat) -> Mat:
    out = [0.0] * 16
    for row in range(4):
        for col in range(4):
            out[row * 4 + col] = sum(a[row * 4 + k] * b[k * 4 + col] for k in range(4))
    return out


def invert_rigid(m: Mat) -> Mat:
    """Inverse of a rigid transform via the transpose of its rotation block."""
    r = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]
    t = [m[3], m[7], m[11]]
    inv_t = [-(r[0][i] * t[0] + r[1][i] * t[1] + r[2][i] * t[2]) for i in range(3)]
    return [
        r[0][0], r[1][0], r[2][0], inv_t[0],
        r[0][1], r[1][1], r[2][1], inv_t[1],
        r[0][2], r[1][2], r[2][2], inv_t[2],
        0.0, 0.0, 0.0, 1.0,
    ]


# ---------------------------------------------------------------------------
# Assembly walk: component-local -> assembly-root for each top-level part.
# ---------------------------------------------------------------------------


def component_world_transforms(
    entities: dict[int, tuple[str, str]],
) -> dict[str, dict]:
    """For every REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION, the mapping
    ``rep_1 (child) -> rep_2 (parent)`` as a 4x4, keyed by child product name.

    The ITEM_DEFINED_TRANSFORMATION holds ``(item_1 in rep_1, item_2 in rep_2)``;
    a point of the child maps into the parent by ``M(item_2) . inv(M(item_1))``.
    We resolve the child's product name through the shape-rep -> product chain
    so callers can ask for "BMT65-DEF" or "3X Spot-Drill-Tap" by name.
    """
    # Product name for each PRODUCT_DEFINITION, via PRODUCT_DEFINITION -> PRODUCT.
    pd_name: dict[int, str] = {}
    prod_name: dict[int, str] = {}
    for eid, (typ, args) in entities.items():
        if typ == "PRODUCT":
            # PRODUCT('id','name',...) -> take the first quoted string as id/name.
            names = re.findall(r"'([^']*)'", args)
            prod_name[eid] = names[1] if len(names) > 1 else (names[0] if names else str(eid))
    for eid, (typ, args) in entities.items():
        if typ == "PRODUCT_DEFINITION":
            r = refs(args)
            # PRODUCT_DEFINITION(..., #formation, #context); formation -> product.
            if r:
                form = r[0]
                # PRODUCT_DEFINITION_FORMATION -> PRODUCT.
                ftyp, fargs = entities.get(form, ("", ""))
                for pid in refs(fargs):
                    if pid in prod_name:
                        pd_name[eid] = prod_name[pid]
                        break

    # SHAPE_REPRESENTATION / rep id -> product name, via PRODUCT_DEFINITION_SHAPE
    # -> SHAPE_DEFINITION_REPRESENTATION.  We build rep_id -> product name by
    # scanning SHAPE_DEFINITION_REPRESENTATION and PROPERTY_DEFINITION chains,
    # but the robust-enough path here is: rep is named on its own SR label, and
    # each component SR is referenced by exactly one RRWT as rep_1.
    rep_product: dict[int, str] = {}
    # PRODUCT_DEFINITION_SHAPE(name, def=#PD); its representation appears in a
    # SHAPE_DEFINITION_REPRESENTATION(#PDS, #SR).
    pds_pd: dict[int, int] = {}
    for eid, (typ, args) in entities.items():
        if typ == "PRODUCT_DEFINITION_SHAPE":
            r = refs(args)
            if r:
                pds_pd[eid] = r[-1]
    for eid, (typ, args) in entities.items():
        if typ in ("SHAPE_DEFINITION_REPRESENTATION", "PROPERTY_DEFINITION_REPRESENTATION"):
            r = refs(args)
            if len(r) >= 2 and r[0] in pds_pd:
                pd = pds_pd[r[0]]
                if pd in pd_name:
                    rep_product[r[1]] = pd_name[pd]

    results: dict[str, dict] = {}
    for eid, (typ, args) in entities.items():
        if typ != "*COMPLEX*":
            continue
        if "REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION" not in args:
            continue
        rr = re.search(r"REPRESENTATION_RELATIONSHIP\s*\(([^)]*)\)", args)
        idt_ref = re.search(r"REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION\s*\(\s*#(\d+)", args)
        if rr is None or idt_ref is None:
            continue
        rr_refs = refs(rr.group(1))
        if len(rr_refs) < 2:
            continue
        child_rep, parent_rep = rr_refs[0], rr_refs[1]
        idt = int(idt_ref.group(1))
        _, idt_args = entities[idt]
        idt_placements = refs(idt_args)
        if len(idt_placements) < 2:
            continue
        item1, item2 = idt_placements[0], idt_placements[1]
        m1 = axis2placement(entities, item1)
        m2 = axis2placement(entities, item2)
        child_to_parent = mat_mul(m2, invert_rigid(m1))
        name = rep_product.get(child_rep, f"rep#{child_rep}")
        results[name] = {
            "childRep": child_rep,
            "parentRep": parent_rep,
            "matrix": child_to_parent,
        }
    return results


def _fmt(m: Mat) -> list[list[float]]:
    return [[round(m[r * 4 + c], 6) for c in range(4)] for r in range(4)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("step", help="assembly STEP file (turret + seated block)")
    ap.add_argument("--turret", default="BMT65-DEF", help="turret product name")
    ap.add_argument("--block", default="3X Spot-Drill-Tap", help="block product name")
    ap.add_argument("--out", default=None, help="also write the JSON to this path")
    args = ap.parse_args()

    path = Path(args.step).expanduser()
    if path.suffix.lower() not in (".step", ".stp") or not path.is_file():
        print(f"not a STEP file: {path}", file=sys.stderr)
        return 2

    entities = load_entities(path.read_text(errors="ignore"))
    comps = component_world_transforms(entities)

    if args.turret not in comps or args.block not in comps:
        print(
            f"could not find both components. saw: {sorted(comps)}",
            file=sys.stderr,
        )
        return 3

    t_turret = comps[args.turret]["matrix"]
    t_block = comps[args.block]["matrix"]
    seat = mat_mul(invert_rigid(t_turret), t_block)  # block-local -> turret-local
    tx, ty, tz = seat[3], seat[7], seat[11]

    out = {
        "source": path.name,
        "units": "mm",
        "turret": {"product": args.turret, "worldMatrix": _fmt(t_turret)},
        "block": {"product": args.block, "worldMatrix": _fmt(t_block)},
        "seat_block_in_turret": {
            "note": "row-major 4x4; maps block-local coords into turret-local coords",
            "matrix": _fmt(seat),
            "translation_mm": [round(tx, 4), round(ty, 4), round(tz, 4)],
            "translation_magnitude_mm": round((tx * tx + ty * ty + tz * tz) ** 0.5, 4),
        },
    }
    rendered = json.dumps(out, indent=2)
    print(rendered)
    if args.out:
        # Rule #1: --out is a trusted local path from the developer CLI, not an
        # untrusted request input; written verbatim beside the other data files.
        Path(args.out).expanduser().write_text(rendered + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
