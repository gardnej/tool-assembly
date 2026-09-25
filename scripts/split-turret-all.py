#!/usr/bin/env python3
"""Split the *fully populated* turret assembly into per-block GLBs, world-frame.

Input: the ground-truth seated turret STEP with ALL toolblocks, converted to a
single GLB. Unlike `split-assembly-cad.py` (one block), this file carries three
seated blocks on three stations, so we:

  1. classify parts into TURRET (drum SOLID/SOLID_1, Faceplate*, Plug*) vs BLOCK,
  2. cluster the BLOCK parts by their angle around the drum axis (each physical
     block occupies one ~30 deg facet), and
  3. bake each cluster into a GLB in the SAME world frame as `cadAssembly.json` /
     `turret-cad.glb`, so it can seat by a pure drum rotation (`baseStation`).

For each cluster we also report the station number K it is modelled on, computed
with the app's OWN drum-rotation convention (axisRotationPlacement): station 1's
radial is `cadAssembly.blockRadialDir`, and station N's radial is that rotated by
(N-1)*30 deg about `drumAxis`. K is the N whose radial best matches the cluster.

Register each output GLB in turretSolids.ts ATTACH_POINTS as { baseStation: K }.

Paths are hard-coded constants (not runtime input), per repo security rules.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "src" / "assets" / "models"
SRC = ROOT / ".tmp-ingest" / "turret-all.glb"  # produced by cascadio from the STEP
CAD_META = json.loads((ROOT / "src" / "data" / "cadAssembly.json").read_text())

# Where each angular cluster's radial direction lands -> output GLB filename.
# Matched by which of the three modelled stations (radial directions) it hits.
OUT_20MM_ID = MODELS / "od-20mm-dual-id.glb"   # -Y facet (Tool Block + CNMG bars)
OUT_25MM_OD = MODELS / "od-25mm-dual-od.glb"   # +Y facet (SOLID_2 + DDJNL/SER)

TURRET_PREFIXES = ("Plug", "Faceplate")


def is_turret(name: str) -> bool:
    base = name.split("_")[0]
    if base in TURRET_PREFIXES or name.startswith(TURRET_PREFIXES):
        return True
    # The drum body is SOLID / SOLID_1; SOLID_2 is actually the 25mm OD block.
    return name in ("SOLID", "SOLID_1")


def world_transform(scene: trimesh.Scene, geom_name: str) -> np.ndarray:
    for node in scene.graph.nodes_geometry:
        T, g = scene.graph[node]
        if g == geom_name:
            return np.asarray(T, dtype=float)
    return np.eye(4)


def baked_copy(scene: trimesh.Scene, geom_name: str) -> trimesh.Trimesh:
    mesh = scene.geometry[geom_name].copy()
    mesh.apply_transform(world_transform(scene, geom_name))
    return mesh


def rodrigues(axis: np.ndarray, angle: float) -> np.ndarray:
    k = axis / np.linalg.norm(axis)
    c, s = math.cos(angle), math.sin(angle)
    kx, ky, kz = k
    t = 1 - c
    return np.array([
        [c + kx * kx * t, kx * ky * t - kz * s, kx * kz * t + ky * s],
        [ky * kx * t + kz * s, c + ky * ky * t, ky * kz * t - kx * s],
        [kz * kx * t - ky * s, kz * ky * t + kx * s, c + kz * kz * t],
    ])


def radial_of(point: np.ndarray, center: np.ndarray, axis: np.ndarray) -> np.ndarray:
    d = point - center
    d = d - axis * float(np.dot(d, axis))
    n = np.linalg.norm(d)
    return d / n if n else d


def station_of(radial: np.ndarray, center, axis, r1, step_deg=30.0) -> int:
    """Station N (1..12) whose radial best matches, using the app convention."""
    best_n, best_dot = 1, -2.0
    for n in range(1, 13):
        rot = rodrigues(axis, math.radians((n - 1) * step_deg))
        rn = rot @ r1
        d = float(np.dot(rn, radial))
        if d > best_dot:
            best_dot, best_n = d, n
    return best_n


def main() -> int:
    scene = trimesh.load(str(SRC))
    assert isinstance(scene, trimesh.Scene)

    center = np.asarray(CAD_META["drumCenter"], dtype=float)
    axis = np.asarray(CAD_META["drumAxis"], dtype=float)
    axis = axis / np.linalg.norm(axis)
    r1 = np.asarray(CAD_META["blockRadialDir"], dtype=float)
    r1 = r1 - axis * float(np.dot(r1, axis))
    r1 = r1 / np.linalg.norm(r1)

    block_names = [n for n in scene.geometry if not is_turret(n)]
    print("BLOCK parts:", block_names)

    # Cluster block parts by radial angle around the drum axis.
    angles = {}
    for n in block_names:
        c = baked_copy(scene, n).bounds.mean(axis=0)
        rad = radial_of(c, center, axis)
        ang = math.atan2(float(np.dot(np.cross(r1, rad), axis)), float(np.dot(r1, rad)))
        angles[n] = ang

    clusters: list[list[str]] = []
    for n in sorted(block_names, key=lambda x: angles[x]):
        placed = False
        for cl in clusters:
            if abs(angles[n] - angles[cl[0]]) < math.radians(18):
                cl.append(n)
                placed = True
                break
        if not placed:
            clusters.append([n])

    print(f"{len(clusters)} block clusters found")
    results = []
    for cl in clusters:
        pts = np.array([baked_copy(scene, n).bounds.mean(axis=0) for n in cl])
        c = pts.mean(axis=0)
        rad = radial_of(c, center, axis)
        st = station_of(rad, center, axis, r1)
        results.append((st, rad, cl))
        print(f"  station {st:2d}  radial {np.round(rad, 3)}  parts={cl}")

    # Map clusters to output files by radial direction (Y sign) and export.
    for st, rad, cl in results:
        mesh_map = {n: baked_copy(scene, n) for n in cl}
        out = None
        if rad[1] < -0.5:          # -Y facet
            out = OUT_20MM_ID
        elif rad[1] > 0.5:         # +Y facet
            out = OUT_25MM_OD
        if out is None:
            print(f"  (skipping cluster at station {st}; not an OD/ID block)")
            continue
        trimesh.Scene(mesh_map).export(str(out))
        print(f"  wrote {out.name} (station {st}) <- {len(cl)} parts")

    print("\nATTACH_POINTS baseStation values:")
    for st, rad, cl in results:
        if rad[1] < -0.5:
            print(f"  od-20mm-dual-id -> baseStation: {st}")
        elif rad[1] > 0.5:
            print(f"  od-25mm-dual-od -> baseStation: {st}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
