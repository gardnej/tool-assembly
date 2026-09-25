"""Report each body in an OBJ: size, position, and extent along each axis.

The exports name every body `Body1`, `Body1:1` and so on, which says nothing
about what a body is. Sizes and positions do: seats cluster by position across
the block, and within a seat the parts stack along the tool axis, so a body's
place in that stack is what tells block from extension from cutting tool.

    python3 scripts/inspect-obj.py "<path to .obj>"
"""

from __future__ import annotations

import sys
from pathlib import Path


def bodies(path: Path) -> list[tuple[str, list[tuple[float, float, float]]]]:
    """Vertices grouped by the body they were listed under."""
    groups: list[tuple[str, list[tuple[float, float, float]]]] = []
    current: list[tuple[float, float, float]] = []
    name = "(unnamed)"

    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("g "):
            if current:
                groups.append((name, current))
            name = line[2:].strip()
            current = []
        elif line.startswith("v "):
            x, y, z = (float(part) for part in line.split()[1:4])
            current.append((x, y, z))

    if current:
        groups.append((name, current))
    return groups


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"No such file: {path}")
        return 1

    print(f"{'body':12} {'verts':>7}  {'centre (x, y, z)':>26}  {'size (x, y, z)':>24}")
    for name, verts in bodies(path):
        if not verts:
            continue
        lo = [min(v[axis] for v in verts) for axis in range(3)]
        hi = [max(v[axis] for v in verts) for axis in range(3)]
        centre = [(lo[axis] + hi[axis]) / 2 for axis in range(3)]
        size = [hi[axis] - lo[axis] for axis in range(3)]
        centre_text = ", ".join(f"{value:7.2f}" for value in centre)
        size_text = ", ".join(f"{value:6.2f}" for value in size)
        print(f"{name:12} {len(verts):>7}  ({centre_text})  ({size_text})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
