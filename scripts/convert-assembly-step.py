#!/usr/bin/env python3
"""Convert the seated Turret+ToolBlock assembly STEP to a GLB for the viewport.

The assembly STEP already carries the tool block seated on the turret via the
Fusion rigid joint (Plug:3), so the tessellated GLB shows the *exact* CAD seat
with no placement math. We tessellate the BREP with OpenCASCADE (via cascadio),
then load with trimesh to report units/bounds/part list so we can wire it in.

Paths are hard-coded constants (not runtime input), per the repo's Node/Python
security rules on file-path handling.
"""
from __future__ import annotations

import sys
from pathlib import Path

import cascadio
import trimesh

# Source assembly (read-only user file) and output inside the app assets.
SRC = Path(
    "/Users/gardnej/Library/CloudStorage/OneDrive-Autodesk/Desktop/"
    "Tools and Blocks/Haas ST-20Y-25 (Turret Assembly TBMCS).step"
)
OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "models" / "haas-assembly.glb"


def main() -> int:
    if not SRC.exists():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # tol in STEP units (mm). 0.15 mm deflection is smooth at this scale.
    cascadio.step_to_glb(
        str(SRC),
        str(OUT),
        tol_linear=0.15,
        tol_angular=0.3,
        merge_primitives=True,
        include_materials=True,
    )
    print(f"wrote {OUT} ({OUT.stat().st_size/1e6:.2f} MB)")

    scene = trimesh.load(str(OUT))
    print("type:", type(scene).__name__)
    if isinstance(scene, trimesh.Scene):
        print("units:", scene.units)
        print("parts:", len(scene.geometry))
        b = scene.bounds
        print("bounds min:", b[0])
        print("bounds max:", b[1])
        print("size:", b[1] - b[0])
        for name, geom in list(scene.geometry.items())[:40]:
            gb = geom.bounds
            print(f"  - {name}: verts={len(geom.vertices)} size={ (gb[1]-gb[0]).round(2) }")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
