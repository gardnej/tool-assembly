"""Rigid-transform math for tool assembly joint origins.

Fusion's ``AssemblyComponentGeometry.setJointOrigin`` takes a 4x4 ``Matrix3D``.
This module keeps the maths in plain Python so the stack-up can be reasoned
about and unit tested outside Fusion; conversion to ``Matrix3D`` happens only
at the API boundary in :mod:`assembly`.

Conventions
-----------
* Matrices are row-major, 16 floats, points treated as column vectors, so the
  translation lives at indices 3, 7 and 11. This matches ``Matrix3D.asArray``.
* All lengths are centimetres, because that is the Fusion API's internal length
  unit. Tool libraries are authored in millimetres or inches, so convert at the
  edges with :func:`mm` / :func:`inch`.
"""

from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple

Matrix = List[float]
Vector = Tuple[float, float, float]

IDENTITY: Matrix = [
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]


def mm(value: float) -> float:
    """Millimetres to Fusion's internal centimetres."""
    return value / 10.0


def inch(value: float) -> float:
    """Inches to Fusion's internal centimetres."""
    return value * 2.54


def to_mm(value: float) -> float:
    """Fusion's internal centimetres back to millimetres."""
    return value * 10.0


def identity() -> Matrix:
    return list(IDENTITY)


def from_axes(origin: Vector, x_axis: Vector, y_axis: Vector, z_axis: Vector) -> Matrix:
    """Build a joint origin from a position and three orthonormal axes."""
    ox, oy, oz = origin
    return [
        x_axis[0], y_axis[0], z_axis[0], ox,
        x_axis[1], y_axis[1], z_axis[1], oy,
        x_axis[2], y_axis[2], z_axis[2], oz,
        0.0, 0.0, 0.0, 1.0,
    ]


def translation(offset: Vector) -> Matrix:
    """A joint origin displaced from the component origin, axes unrotated."""
    return from_axes(offset, (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def along_z(distance: float) -> Matrix:
    """Joint origin offset along +Z, the usual tool axis direction."""
    return translation((0.0, 0.0, distance))


def flip_z() -> Matrix:
    """Rotate 180 degrees about X so +Z points back toward the machine.

    A downstream component's machine-side joint faces the upstream component's
    cutting-side joint, so one of the pair must be reversed for the axes to
    oppose rather than coincide.
    """
    return from_axes(
        (0.0, 0.0, 0.0),
        (1.0, 0.0, 0.0),
        (0.0, -1.0, 0.0),
        (0.0, 0.0, -1.0),
    )


def span_joints(distance: float, reversed_solid: bool = False) -> Tuple[Matrix, Matrix]:
    """Machine-side and cutting-side joints for a straight span along the axis.

    By default the solid is assumed to run from the machine side toward the
    cutting edge along +Z. When ``reversed_solid`` is set, the solid's +Z points
    back into the machine, so both joints are rotated 180 degrees and the
    cutting-side joint sits at -Z in the solid's own coordinates.

    Both joints have to be flipped, not just the machine-side one. Placement
    aligns the machine-side joint to the running frame, so a flip there rotates
    the whole component; if the cutting-side frame did not carry the same flip,
    it would hand a reversed frame to the next component and the rest of the
    chain would stack backwards.
    """
    if reversed_solid:
        # Translate first, then flip about that point, so the joint keeps its
        # position at -Z while its axes oppose the solid's.
        return flip_z(), multiply(along_z(-distance), flip_z())
    return identity(), along_z(distance)


def multiply(a: Sequence[float], b: Sequence[float]) -> Matrix:
    """Matrix product ``a * b`` (apply ``b`` first, then ``a``)."""
    out = [0.0] * 16
    for row in range(4):
        for col in range(4):
            out[row * 4 + col] = sum(a[row * 4 + k] * b[k * 4 + col] for k in range(4))
    return out


def invert_rigid(m: Sequence[float]) -> Matrix:
    """Inverse of a rigid transform (rotation plus translation).

    Uses the transpose of the rotation block rather than a general inverse,
    which is exact and cheap. Joint origins are always rigid.
    """
    r = [[m[row * 4 + col] for col in range(3)] for row in range(3)]
    t = (m[3], m[7], m[11])

    # Transposed rotation, and the negated translation carried through it.
    inv_t = tuple(-sum(r[k][i] * t[k] for k in range(3)) for i in range(3))
    return [
        r[0][0], r[1][0], r[2][0], inv_t[0],
        r[0][1], r[1][1], r[2][1], inv_t[1],
        r[0][2], r[1][2], r[2][2], inv_t[2],
        0.0, 0.0, 0.0, 1.0,
    ]


def origin_of(m: Sequence[float]) -> Vector:
    return (m[3], m[7], m[11])


def z_axis_of(m: Sequence[float]) -> Vector:
    return (m[2], m[6], m[10])


def chain_placements(
    joints: Iterable[Tuple[Sequence[float], Sequence[float]]],
) -> List[Matrix]:
    """Place a machine-to-cutting-edge chain of components.

    Each entry is a component's ``(machine_side, cutting_side)`` joint origin,
    expressed in that component's own coordinate system. The first component's
    machine-side joint defines the assembly datum, typically the turret face.

    Returns each component's placement in assembly space, such that a
    component's machine-side joint lands on its predecessor's cutting-side
    joint.
    """
    placements: List[Matrix] = []
    # Where the next component's machine-side joint has to land.
    frontier = identity()

    for machine_side, cutting_side in joints:
        placement = multiply(frontier, invert_rigid(machine_side))
        placements.append(placement)
        frontier = multiply(placement, cutting_side)

    return placements


def assembly_length(
    joints: Sequence[Tuple[Sequence[float], Sequence[float]]],
) -> float:
    """Distance from the assembly datum to the final cutting-side joint.

    This is the real stack-up: the gauge length that Fusion derives from
    geometry and joints, rather than a sum of nominal component lengths.
    """
    if not joints:
        return 0.0

    placements = chain_placements(joints)
    tip = multiply(placements[-1], joints[-1][1])
    x, y, z = origin_of(tip)
    return (x * x + y * y + z * z) ** 0.5
