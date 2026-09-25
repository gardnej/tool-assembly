#!/usr/bin/env python3
"""Split the seated assembly GLB into CAD-accurate turret + block meshes.

The interactive prototype was misplacing the block because it composed a
separately-reconstructed turret GLB with a bridged placement frame. Instead we
reuse the *ground-truth* CAD assembly (scripts/convert-assembly-step.py):
  * turret-cad.glb  = every turret part (drum SOLID, Faceplate, 12 Plugs)
  * block-cad.glb   = the tool block (EWS body, ER16 collets/springs, tools)
Both keep the assembly's world coordinates, so the block sits on its modelled
station with the identity transform; other stations are a pure rotation about
the drum axis. We also report the drum axis/centre (fit from the 12 plug ring
centres) and the block's station angle so the app can rotate correctly.

Paths are hard-coded constants (not runtime input), per repo security rules.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import trimesh

MODELS = Path(__file__).resolve().parent.parent / "src" / "assets" / "models"
SRC = MODELS / "haas-assembly.glb"
OUT_TURRET = MODELS / "turret-cad.glb"
OUT_BLOCK = MODELS / "block-cad.glb"
OUT_META = Path(__file__).resolve().parent.parent / "src" / "data" / "cadAssembly.json"

# A part belongs to the turret if its name matches these; everything else is
# treated as the tool block (body/collets/springs/tools).
TURRET_PREFIXES = ("Plug", "Faceplate", "SOLID")


def is_turret(name: str) -> bool:
    return any(name.split("_")[0] == p or name.startswith(p) for p in TURRET_PREFIXES)


def world_transform(scene: trimesh.Scene, geom_name: str) -> np.ndarray:
    # Find the graph node whose geometry is geom_name and return its world matrix.
    for node in scene.graph.nodes_geometry:
        T, g = scene.graph[node]
        if g == geom_name:
            return np.asarray(T, dtype=float)
    return np.eye(4)


def baked_copy(scene: trimesh.Scene, geom_name: str) -> trimesh.Trimesh:
    mesh = scene.geometry[geom_name].copy()
    mesh.apply_transform(world_transform(scene, geom_name))
    return mesh


def main() -> int:
    scene = trimesh.load(str(SRC))
    assert isinstance(scene, trimesh.Scene)

    turret_names, block_names = [], []
    for name in scene.geometry:
        (turret_names if is_turret(name) else block_names).append(name)

    print("TURRET parts:", turret_names)
    print("BLOCK parts:", block_names)

    turret_scene = trimesh.Scene(
        {n: baked_copy(scene, n) for n in turret_names}
    )
    block_scene = trimesh.Scene(
        {n: baked_copy(scene, n) for n in block_names}
    )

    turret_scene.export(str(OUT_TURRET))
    block_scene.export(str(OUT_BLOCK))
    print(f"wrote {OUT_TURRET.name} ({OUT_TURRET.stat().st_size/1e6:.2f} MB)")
    print(f"wrote {OUT_BLOCK.name} ({OUT_BLOCK.stat().st_size/1e6:.2f} MB)")

    # --- Drum axis + centre from the 12 Plug ring centres --------------------
    plug_centres = []
    for name in turret_names:
        if name.split("_")[0] != "Plug":
            continue
        m = baked_copy(scene, name)
        plug_centres.append(m.bounds.mean(axis=0))
    P = np.array(plug_centres)
    centroid = P.mean(axis=0)
    # Best-fit plane normal (drum axis) = smallest-singular-vector of centred pts.
    _, _, vh = np.linalg.svd(P - centroid)
    axis = vh[2]
    axis = axis / np.linalg.norm(axis)

    # Block centroid + its angle around the axis (station phase).
    block_centre = block_scene.bounds.mean(axis=0)
    # radial vector of block from drum centre, projected off the axis
    d = block_centre - centroid
    d_rad = d - axis * float(np.dot(d, axis))

    # Ring radius stats (sanity)
    radii = []
    for c in P:
        v = c - centroid
        v = v - axis * float(np.dot(v, axis))
        radii.append(float(np.linalg.norm(v)))

    meta = {
        "source": SRC.name,
        "units": "meters",
        "turretGlb": OUT_TURRET.name,
        "blockGlb": OUT_BLOCK.name,
        "note": (
            "Turret + block split from the ground-truth seated CAD assembly, "
            "same world frame. Block sits on its modelled station at identity; "
            "other stations = rotation about drumAxis through drumCenter by "
            "(N - baseStation)*30 deg. See scripts/split-assembly-cad.py."
        ),
        "drumCenter": [round(float(x), 6) for x in centroid],
        "drumAxis": [round(float(x), 6) for x in axis],
        "plugRingRadiusMean": round(float(np.mean(radii)), 6),
        "plugRingRadiusStd": round(float(np.std(radii)), 6),
        "blockCenter": [round(float(x), 6) for x in block_centre],
        "blockRadialDir": [round(float(x), 6) for x in (d_rad / (np.linalg.norm(d_rad) or 1))],
        "stationStepDeg": 30.0,
        "turretBounds": {
            "min": [round(float(x), 6) for x in turret_scene.bounds[0]],
            "max": [round(float(x), 6) for x in turret_scene.bounds[1]],
        },
    }
    OUT_META.write_text(json.dumps(meta, indent=2))
    print("drumCenter", meta["drumCenter"], "drumAxis", meta["drumAxis"])
    print("plugRingRadius mean/std", meta["plugRingRadiusMean"], meta["plugRingRadiusStd"])
    print("blockCenter", meta["blockCenter"], "blockRadialDir", meta["blockRadialDir"])
    print("wrote", OUT_META)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
