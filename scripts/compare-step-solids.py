#!/usr/bin/env python3
"""Compare BREP solids between two STEP files by frame-invariant signature.

Each MANIFOLD_SOLID_BREP is one part body. We collect the CARTESIAN_POINTs
transitively referenced by each solid (its own local-frame geometry, invariant
to assembly placement), build a rounded-point-set signature per solid, then match
solids across the two files by signature.

This answers: "are the turret's solids (drum with radial seat facets, faceplate,
plugs) present unchanged in the new assembly file, or were they re-modelled?"
— independent of how the parts are placed by the assembly joint.

Read-only. Positional args validated for .step/.stp + existence. No shell/eval/
network. (Workspace Python rules #1/#3/#6.)

Usage:
    python3 scripts/compare-step-solids.py A.step B.step
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
        entities[eid] = ("*COMPLEX*", body) if (body.startswith("(") or s is None) else (s.group(2), s.group(3))
    return entities


def refs(args: str) -> list[int]:
    return [int(x) for x in re.findall(r"#(\d+)", args)]


def floats(args: str) -> list[float]:
    return [float(x) for x in re.findall(r"[-+]?\d*\.\d+(?:[eE][-+]?\d+)?|[-+]?\d+\.", args)]


def collect_points(entities, root: int):
    seen: set[int] = set()
    stack = [root]
    pts = []
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


def solid_sig(entities, eid, ndigits=3):
    pts = collect_points(entities, eid)
    rounded = sorted((round(x, ndigits), round(y, ndigits), round(z, ndigits)) for x, y, z in pts)
    h = hashlib.sha256(repr(rounded).encode()).hexdigest()[:16]
    if pts:
        span = lambda i: round(max(p[i] for p in pts) - min(p[i] for p in pts), 2)
        dims = (span(0), span(1), span(2))
    else:
        dims = (0, 0, 0)
    return {"id": eid, "n": len(pts), "hash": h, "dims": dims, "set": set(rounded)}


def solids(entities):
    out = []
    for eid, (typ, _a) in entities.items():
        if typ == "MANIFOLD_SOLID_BREP":
            out.append(solid_sig(entities, eid))
    out.sort(key=lambda s: -s["n"])
    return out


def best_match(s, others):
    best, bj = None, -1.0
    for o in others:
        u = len(s["set"] | o["set"]) or 1
        j = len(s["set"] & o["set"]) / u
        if j > bj:
            best, bj = o, j
    return best, bj


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("a")
    ap.add_argument("b")
    args = ap.parse_args()
    files = []
    for label in (args.a, args.b):
        p = Path(label).expanduser()
        if p.suffix.lower() not in (".step", ".stp") or not p.is_file():
            print(f"not a STEP file: {p}", file=sys.stderr)
            return 2
        files.append((p, solids(load_entities(p.read_text(errors="ignore")))))

    (pa, sa), (pb, sb) = files
    for p, s in files:
        print(f"{p.name}: {len(s)} solids")
        for x in s:
            print(f"    #{x['id']:<7} points={x['n']:<6} dims(mm)={x['dims']}  hash={x['hash']}")
        print()

    print("Matching each solid in A to its closest solid in B:")
    for s in sa:
        m, j = best_match(s, sb)
        tag = "IDENTICAL" if s["hash"] == m["hash"] else (f"~{j:.3f}" if j > 0.99 else f"DIFF j={j:.3f}")
        print(f"  A#{s['id']} (n={s['n']}, dims={s['dims']}) -> B#{m['id']} (n={m['n']}, dims={m['dims']})  [{tag}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
