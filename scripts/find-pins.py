"""Locate protruding features on a body, e.g. the block's locating pins.

The pins are part of the block body rather than bodies of their own, so they
cannot be found by name. They can be found by shape: they stick out past the
bulk of the block, so the far end of one axis holds only their vertices, which
then cluster into one group per pin.

    python3 scripts/find-pins.py "<path to .obj>" <body name>
"""

from __future__ import annotations

import sys
from pathlib import Path

Vertex = tuple[float, float, float]

AXES = ("x", "y", "z")


def body_vertices(path: Path, wanted: str) -> list[Vertex]:
    verts: list[Vertex] = []
    name = "(unnamed)"

    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("g "):
            name = line[2:].strip()
        elif line.startswith("v ") and name == wanted:
            x, y, z = (float(part) for part in line.split()[1:4])
            verts.append((x, y, z))

    return verts


def histogram(verts: list[Vertex], axis: int, bins: int = 24) -> None:
    """Vertex counts along one axis, to show where the body thins out."""
    lo = min(v[axis] for v in verts)
    hi = max(v[axis] for v in verts)
    width = (hi - lo) / bins or 1.0

    counts = [0] * bins
    for vertex in verts:
        index = min(int((vertex[axis] - lo) / width), bins - 1)
        counts[index] += 1

    peak = max(counts) or 1
    print(f"\n  along {AXES[axis]}: {lo:.2f} to {hi:.2f}")
    for index, count in enumerate(counts):
        start = lo + index * width
        bar = "#" * round(40 * count / peak)
        print(f"    {start:7.2f}  {count:5}  {bar}")


def clusters(points: list[tuple[float, float]], gap: float) -> list[tuple[float, float, int]]:
    """Group points that lie within `gap` of one another, one group per pin."""
    groups: list[list[tuple[float, float]]] = []

    for point in points:
        for group in groups:
            if any(abs(point[0] - o[0]) <= gap and abs(point[1] - o[1]) <= gap for o in group):
                group.append(point)
                break
        else:
            groups.append([point])

    return [
        (
            sum(p[0] for p in group) / len(group),
            sum(p[1] for p in group) / len(group),
            len(group),
        )
        for group in groups
    ]


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"No such file: {path}")
        return 1

    verts = body_vertices(path, sys.argv[2])
    if not verts:
        print(f"No vertices for body {sys.argv[2]!r}")
        return 1

    print(f"{len(verts)} vertices in {sys.argv[2]}")
    for axis in range(3):
        histogram(verts, axis)

    # The thin tail at either end of an axis is where a protrusion lives, so
    # take the outermost tenth of each axis and see how it groups up.
    for axis in range(3):
        lo = min(v[axis] for v in verts)
        hi = max(v[axis] for v in verts)
        span = hi - lo
        others = [i for i in range(3) if i != axis]

        for label, keep in (
            (f"-{AXES[axis]}", lambda v, a=axis, lo=lo, s=span: v[a] <= lo + 0.1 * s),
            (f"+{AXES[axis]}", lambda v, a=axis, hi=hi, s=span: v[a] >= hi - 0.1 * s),
        ):
            tail = [v for v in verts if keep(v)]
            if not tail:
                continue
            found = clusters([(v[others[0]], v[others[1]]) for v in tail], gap=1.0)
            print(f"\n  {label} end: {len(found)} clusters from {len(tail)} vertices")
            for a, b, count in sorted(found, key=lambda group: -group[2])[:8]:
                print(
                    f"    {AXES[others[0]]}={a:7.2f}  "
                    f"{AXES[others[1]]}={b:7.2f}  ({count} verts)"
                )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
