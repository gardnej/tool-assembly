"""Read the joint frames Fusion has already stored for a tool's 3D geometry.

Each solid in a tool library is kept as a ``.3DTool`` file next to the library
JSON. The file opens with a small JSON header followed by an ASM binary body,
and that header holds the joint frames the STEP importer extracted:

    {"csw": [[..4x4..]], "geometryFileName": "EWS_163950_DIN4003.stp",
     "mcs": [[..4x4..]]}

``mcs`` is the ISO-13399 mounting frame on the machine side and ``csw`` the
workpiece-side frame on the cutting side, both as row-major 4x4 matrices in
millimetres. Reading them is the only way to get at real joint origins, because
``setJointOrigin`` is an unimplemented stub in the API.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

from . import joints

GEOMETRY_SUFFIX = ".3DTool"

# The JSON header sits at the front of the file; the binary body follows.
_HEADER_READ_BYTES = 64 * 1024


@dataclass
class GeometryJoints:
    """Joint frames for one stored solid, in millimetres."""

    geometry_id: str
    step_file_name: Optional[str]
    machine_side: Optional[joints.Matrix]
    cutting_side: Optional[joints.Matrix]

    @property
    def is_complete(self) -> bool:
        return self.machine_side is not None and self.cutting_side is not None

    @property
    def span_mm(self) -> Optional[float]:
        """Machine-side to cutting-side distance for this solid alone."""
        if not self.is_complete:
            return None
        return joints.assembly_length([(self.machine_side, self.cutting_side)])

    def summary(self) -> str:
        name = self.step_file_name or self.geometry_id
        if not self.is_complete:
            missing = "MCS" if self.machine_side is None else "CSW"
            return f"{name}: incomplete, no {missing} frame."
        return f"{name}: span {self.span_mm:.3f} mm."


def _flatten(rows: Sequence[Sequence[float]]) -> Optional[joints.Matrix]:
    """Turn a 4x4 nested list into the flat row-major form used elsewhere."""
    if not isinstance(rows, (list, tuple)) or len(rows) != 4:
        return None
    flat: List[float] = []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) != 4:
            return None
        flat.extend(float(value) for value in row)
    return flat


def read_header(path: str) -> Optional[Dict]:
    """Parse the leading JSON object of a ``.3DTool`` file.

    The body is binary, so the header is found by tracking brace depth over the
    decoded prefix rather than handing the whole file to a JSON parser.
    """
    with open(path, "rb") as handle:
        prefix = handle.read(_HEADER_READ_BYTES).decode("latin-1")

    depth = 0
    for index, char in enumerate(prefix):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(prefix[: index + 1])
                except ValueError:
                    return None
    return None


def read_joints(path: str) -> Optional[GeometryJoints]:
    """Joint frames for one stored solid, or None if the header is unreadable."""
    header = read_header(path)
    if header is None:
        return None

    return GeometryJoints(
        geometry_id=os.path.basename(path)[: -len(GEOMETRY_SUFFIX)],
        step_file_name=header.get("geometryFileName"),
        machine_side=_flatten(header.get("mcs")) if header.get("mcs") else None,
        cutting_side=_flatten(header.get("csw")) if header.get("csw") else None,
    )


def load_library_geometry(library_json_path: str) -> Dict[str, GeometryJoints]:
    """Index every solid stored beside a library file, keyed by geometry id.

    The ids match the ``3DGeometry.id`` values in the library JSON, so a tool can
    be matched to the joint frames of its own solid.
    """
    folder = os.path.dirname(os.path.abspath(library_json_path))
    found: Dict[str, GeometryJoints] = {}

    try:
        entries = os.listdir(folder)
    except OSError:
        return found

    for name in entries:
        if not name.endswith(GEOMETRY_SUFFIX):
            continue
        stored = read_joints(os.path.join(folder, name))
        if stored is not None:
            found[stored.geometry_id] = stored

    return found


def chain_from_geometry(
    ordered: Sequence[GeometryJoints],
) -> Optional[float]:
    """Real stack-up in millimetres for a machine-to-cutting-edge chain.

    Returns None when any component is missing a frame, since a chain cannot be
    measured through a gap.
    """
    if not ordered or any(not item.is_complete for item in ordered):
        return None
    pairs = [(item.machine_side, item.cutting_side) for item in ordered]
    return joints.assembly_length(pairs)
