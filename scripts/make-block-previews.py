#!/usr/bin/env python3
"""Give each part of the OD/ID preview GLBs its own material.

The per-assembly STEPs convert (via cascadio) to GLBs whose parts share three
materials (mat_0/1/2). model-viewer can paint materials but not nodes, so shared
materials make it impossible to highlight a single position on the block. This
script rewrites the design-frame preview GLBs so every part (node/mesh) owns a
uniquely named material, letting the assembly viewer light up one position at a
time and pick individual parts.

Only the small allow-listed input paths below are read/written; no external
input is used in any file path (per repo Python security rules).
"""

from __future__ import annotations

import trimesh
from trimesh.visual.material import PBRMaterial

# Fixed, in-repo paths only — never derived from user input.
JOBS = [
    "src/assets/models/od-20mm-dual-id-preview.glb",
    "src/assets/models/od-25mm-dual-od-preview.glb",
]

# A neutral block grey; the app repaints per part at runtime, this is just the
# baked default so the GLB reads sensibly on its own.
BASE_GREY = [0.62, 0.66, 0.72, 1.0]


def rematerialize(path: str) -> None:
    scene = trimesh.load(path)
    for name, geom in scene.geometry.items():
        geom.visual = trimesh.visual.TextureVisuals(
            material=PBRMaterial(
                name=name,
                baseColorFactor=BASE_GREY,
                metallicFactor=0.35,
                roughnessFactor=0.5,
            )
        )
    scene.export(path)
    reloaded = trimesh.load(path)
    mats = sorted({g.visual.material.name for g in reloaded.geometry.values()})
    print(f"{path.split('/')[-1]}: {len(reloaded.geometry)} parts, materials={mats}")


if __name__ == "__main__":
    for job in JOBS:
        rematerialize(job)
