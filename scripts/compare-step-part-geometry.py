#!/usr/bin/env python3
"""Compare one product's BREP geometry between two assembly STEP files.

Given a product name (e.g. "BMT65 Turret"), this collects every CARTESIAN_POINT
transitively referenced by that product's shape representation and reports a
frame-invariant geometric signature: point count, local-frame bounding box, and
a rounded-point-set hash. Comparing the signature between two STEP files tells us
whether the part is geometrically identical (same drum + same radial seat facets)
or was re-modelled.

Read-only: opens the two files given as positional CLI args (validated for
.step/.stp suffix + existence). No shell, eval, or network. (Workspace Python
rules #1/#3/#6.)

Usage:
    python3 scripts/compare-step-part-geometry.py A.step B.step --product "BMT65 Turret"
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path


def load_entities(text: str) -> dict[int, tuple[str, str]]:
    data = text.split("DATA;", 1)[1] if "DATA;" in text else text
    data = data.split("ENDSEC;", 1)[0]
    entities: dict[int, tuple[str, str]] = {}
    head = re.compile(r"#(\d+)\s*=\s*(.*)$", re.DOTALL)
    simple = re.compile(r"#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)\s*$", re.DOTALL)
    for record in data.split(";"):
        record = record.strip()
        if not record.startswith("#"):
            continue
        h = head.match(record)
        if not h:
            continue
        eid = int(h.group(1))
        body = h.group(2).strip()
        s = simple.match(record)
        if body.startswith("(") or s is None:
            entities[eid] = ("*COMPLEX*", body)
        else:
            entities[eid] = (s.group(2), s.group(3))
    return entities


def refs(args: str) -> list[int]:
    return [int(x) for x in re.findall(r"#(\d+)", args)]


def floats(args: str) -> list[float]:
    return [float(x) for x in re.findall(r"[-+]?\d*\.\d+(?:[eE][-+]?\d+)?|[-+]?\d+\.", args)]


def product_name_of(entities, eid) -> str:
    _, args = entities[eid]
    names = re.findall(r"'([^']*)'", args)
    return names[1] if len(names) > 1 else (names[0] if names else "")


def shape_rep_for_product(entities, product: str) -> int | None:
    """Resolve product name -> its (top) shape representation id."""
    # product name -> PRODUCT id
    prod_ids = [e for e, (t, a) in entities.items()
                if t == "PRODUCT" and product_name_of(entities, e) == product]
    if not prod_ids:
        return None
    prod_ids = set(prod_ids)
    # PRODUCT_DEFINITION_FORMATION -> PRODUCT
    formations = {e for e, (t, a) in entities.items()
                  if t == "PRODUCT_DEFINITION_FORMATION" and (set(refs(a)) & prod_ids)}
    # PRODUCT_DEFINITION -> formation
    pdefs = {e for e, (t, a) in entities.items()
             if t == "PRODUCT_DEFINITION" and (set(refs(a)) & formations)}
    # PRODUCT_DEFINITION_SHAPE -> product_definition
    pdshapes = {e for e, (t, a) in entities.items()
                if t == "PRODUCT_DEFINITION_SHAPE" and (set(refs(a)) & pdefs)}
    # SHAPE_DEFINITION_REPRESENTATION(#PDS, #SR) -> shape rep
    reps: list[int] = []
    for e, (t, a) in entities.items():
        if t in ("SHAPE_DEFINITION_REPRESENTATION", "PROPERTY_DEFINITION_REPRESENTATION"):
            r = refs(a)
            if r and r[0] in pdshapes and len(r) >= 2:
                reps.append(r[1])
    return reps[0] if reps else None


def collect_points(entities, root: int) -> list[tuple[float, float, float]]:
    """BFS all CARTESIAN_POINTs transitively referenced from `root`."""
    seen: set[int] = set()
    stack = [root]
    pts: list[tuple[float, float, float]] = []
    while stack:
        eid = stack.pop()
        if eid in seen or eid not in entities:
            continue
        seen.add(eid)
        typ, args = entities[eid]
        if typ == "CARTESIAN_POINT":
            xyz = floats(args)
            while len(xyz) < 3:
                xyz.append(0.0)
            pts.append((xyz[0], xyz[1], xyz[2]))
        stack.extend(refs(args))
    return pts


def signature(pts, ndigits=4):
    if not pts:
        return {"count": 0}
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    zs = [p[2] for p in pts]
    rounded = sorted((round(x, ndigits), round(y, ndigits), round(z, ndigits)) for x, y, z in pts)
    h = hashlib.sha256(repr(rounded).encode()).hexdigest()[:16]
    span = lambda v: (round(min(v), 4), round(max(v), 4), round(max(v) - min(v), 4))
    return {
        "count": len(pts),
        "unique": len(set(rounded)),
        "bbox_x": span(xs),
        "bbox_y": span(ys),
        "bbox_z": span(zs),
        "hash": h,
        "_rounded": set(rounded),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("a")
    ap.add_argument("b")
    ap.add_argument("--product", default="BMT65 Turret")
    args = ap.parse_args()

    sigs = []
    for label in (args.a, args.b):
        path = Path(label).expanduser()
        if path.suffix.lower() not in (".step", ".stp") or not path.is_file():
            print(f"not a STEP file: {path}", file=sys.stderr)
            return 2
        ents = load_entities(path.read_text(errors="ignore"))
        rep = shape_rep_for_product(ents, args.product)
        if rep is None:
            print(f"product {args.product!r} not found in {path.name}", file=sys.stderr)
            return 3
        sig = signature(collect_points(ents, rep))
        sig["file"] = path.name
        sigs.append(sig)

    a, b = sigs
    print(f"Product: {args.product!r}\n")
    for s in (a, b):
        print(f"  {s['file']}")
        print(f"    points={s['count']}  unique={s['unique']}  hash={s['hash']}")
        print(f"    bbox X {s['bbox_x']}\n    bbox Y {s['bbox_y']}\n    bbox Z {s['bbox_z']}\n")

    same_hash = a["hash"] == b["hash"]
    inter = len(a["_rounded"] & b["_rounded"])
    union = len(a["_rounded"] | b["_rounded"])
    jac = inter / union if union else 0.0
    only_a = len(a["_rounded"] - b["_rounded"])
    only_b = len(b["_rounded"] - a["_rounded"])
    print("Comparison:")
    print(f"  identical point-set hash : {same_hash}")
    print(f"  shared points            : {inter}")
    print(f"  only in A                : {only_a}")
    print(f"  only in B                : {only_b}")
    print(f"  Jaccard similarity       : {jac:.4f}")
    if same_hash:
        print("\n=> GEOMETRICALLY IDENTICAL (same drum + same radial seat facets).")
    elif jac > 0.99:
        print("\n=> Effectively identical (>99% shared); differences are rounding/tessellation noise.")
    elif jac > 0.8:
        print("\n=> MOSTLY the same but with real local differences — inspect the facets.")
    else:
        print("\n=> DIFFERENT geometry — the turret was re-modelled.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
