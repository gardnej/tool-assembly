"""Build a tool assembly on Fusion's tool library framework.

An assembly is a chain of components running from the machine datum (the turret
face) out to the cutting edge, joined cutting-side to machine-side.

Joint origins cannot be pushed through the API: ``setJointOrigin`` is a stub in
Fusion that raises "not yet implemented", so calling it would fail every time.
The joint frames come from the STEP file instead, as coordinate systems labelled
``MCS`` and ``CSW``. This module therefore sets the solid geometry, which does
work, and reports whether each STEP carries the frames the importer needs. The
joint maths in :mod:`joints` still drives the nominal stack-up shown to the user.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Sequence, Tuple

import adsk.cam
import adsk.core

from . import joints, step_inspect
from .library_access import ToolRef

# STEP payloads are read from disk; cap the size so a mis-picked file cannot
# stall Fusion's UI thread while it is parsed.
MAX_STEP_BYTES = 64 * 1024 * 1024
STEP_SUFFIXES = (".stp", ".step")


class ComponentRole(Enum):
    """Which geometry slot on the library item a component maps to."""

    BLOCK = "block"
    HOLDER = "holder"


@dataclass
class ComponentSpec:
    """One item in the assembly stack, with joints in its own coordinates."""

    role: ComponentRole
    name: str
    machine_side: joints.Matrix
    cutting_side: joints.Matrix
    step_contents: Optional[str] = None
    tool_holder: Optional[joints.Matrix] = None

    @property
    def span_mm(self) -> float:
        """Machine-side to cutting-side distance for this component alone."""
        return joints.to_mm(
            joints.assembly_length([(self.machine_side, self.cutting_side)])
        )


@dataclass
class AssemblyPlan:
    """An ordered chain, machine side first."""

    components: List[ComponentSpec]

    def joint_pairs(self) -> List[Tuple[joints.Matrix, joints.Matrix]]:
        return [(c.machine_side, c.cutting_side) for c in self.components]

    def placements(self) -> List[joints.Matrix]:
        return joints.chain_placements(self.joint_pairs())

    @property
    def stack_up_mm(self) -> float:
        """The assembly's real gauge length, derived from the joint chain."""
        return joints.to_mm(joints.assembly_length(self.joint_pairs()))

    def describe(self) -> str:
        """Human-readable stack-up for the command dialog."""
        if not self.components:
            return "No components in the assembly."

        lines = []
        placements = self.placements()
        for component, placement in zip(self.components, placements):
            _, _, z = joints.origin_of(placement)
            lines.append(
                f"{component.role.value}: {component.name} "
                f"— span {component.span_mm:.3f} mm, "
                f"seated at {joints.to_mm(z):.3f} mm"
            )
        lines.append(f"Total stack-up: {self.stack_up_mm:.3f} mm")
        return "\n".join(lines)


def read_step_file(path: str) -> str:
    """Load STEP contents after validating the path.

    The path comes from Fusion's file dialog rather than being trusted
    directly: it must be an existing regular file with a STEP suffix and a
    sane size before it is opened.
    """
    if not path:
        raise ValueError("No STEP file selected.")

    resolved = os.path.realpath(path)
    if not os.path.isfile(resolved):
        raise ValueError(f"Not a file: {path}")
    if not resolved.lower().endswith(STEP_SUFFIXES):
        raise ValueError("Expected a .stp or .step file.")

    size = os.path.getsize(resolved)
    if size == 0:
        raise ValueError("STEP file is empty.")
    if size > MAX_STEP_BYTES:
        raise ValueError(f"STEP file is too large ({size} bytes).")

    with open(resolved, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read()


def to_matrix3d(matrix: Sequence[float]) -> adsk.core.Matrix3D:
    result = adsk.core.Matrix3D.create()
    if not result.setWithArray(list(matrix)):
        raise RuntimeError("Could not build a Matrix3D for the joint origin.")
    return result


def unit_scale(ref: ToolRef) -> float:
    """Convert the library item's authoring unit to Fusion centimetres."""
    return joints.inch(1.0) if ref.raw.get("unit") == "inches" else joints.mm(1.0)


def default_spans_mm(ref: ToolRef) -> Tuple[float, float]:
    """Nominal block and holder spans taken from the library item itself.

    These seed the dialog so the starting stack-up reflects real library
    dimensions instead of zeros. ``adaptiveItemSize`` describes the block and
    ``holder.OAL`` the holder overall length.
    """
    scale = 25.4 if ref.raw.get("unit") == "inches" else 1.0

    block_geometry = ref.block_geometry
    block_span = float(block_geometry.get("adaptiveItemSize") or 0.0) * scale

    holder = ref.raw.get("holder") or {}
    holder_span = float(holder.get("OAL") or 0.0) * scale

    return block_span, holder_span


def component_from_span(
    role: ComponentRole,
    name: str,
    span_mm: float,
    step_contents: Optional[str] = None,
    reversed_solid: bool = False,
) -> ComponentSpec:
    """A component whose joints are a straight span along the tool axis.

    The default convention is that the solid is modelled with +Z running from
    the machine side toward the cutting edge, so the machine-side joint sits at
    the component origin and the cutting-side joint one span along +Z.

    Set ``reversed_solid`` when a STEP file is modelled the other way round,
    with +Z pointing back into the machine. The machine-side joint is then
    rotated 180 degrees and the cutting-side joint placed at -Z, which cancels
    out to the same forward stack-up once the component is seated.
    """
    machine_side, cutting_side = joints.span_joints(
        joints.mm(span_mm), reversed_solid=reversed_solid
    )
    return ComponentSpec(
        role=role,
        name=name,
        machine_side=machine_side,
        cutting_side=cutting_side,
        step_contents=step_contents,
    )


def plan_from_spans(
    block_name: str,
    holder_name: str,
    block_span_mm: float,
    holder_span_mm: float,
    block_step: Optional[str] = None,
    holder_step: Optional[str] = None,
) -> AssemblyPlan:
    """Build a block-then-holder plan from along-axis spans."""
    return AssemblyPlan(
        components=[
            component_from_span(
                ComponentRole.BLOCK, block_name, block_span_mm, block_step
            ),
            component_from_span(
                ComponentRole.HOLDER, holder_name, holder_span_mm, holder_step
            ),
        ]
    )


def geometry_for(
    tool: adsk.cam.Tool, role: ComponentRole
) -> Optional[adsk.cam.AssemblyComponentGeometry]:
    """Resolve the AssemblyComponentGeometry a component role writes to.

    A standalone ``tool block`` library item exposes ``ToolBlock.geometry``,
    while a cutting tool exposes the nested block as ``toolBlockGeometry`` and
    its holder as ``TurningTool.holderGeometry``.
    """
    if role is ComponentRole.BLOCK:
        block = adsk.cam.ToolBlock.cast(tool)
        if block is not None:
            return block.geometry
        return tool.toolBlockGeometry

    turning = adsk.cam.TurningTool.cast(tool)
    if turning is None:
        return None
    return turning.holderGeometry


def apply_component(
    geometry: adsk.cam.AssemblyComponentGeometry, component: ComponentSpec
) -> None:
    """Attach the component's solid geometry.

    Only the solid is written. Joint origins are deliberately not pushed through
    ``setJointOrigin``, which raises "not yet implemented" in Fusion; they have to
    be authored into the STEP file as MCS and CSW coordinate systems.
    """
    if component.step_contents is not None:
        geometry.setStepGeometry(component.step_contents)


def apply_plan(tool: adsk.cam.Tool, plan: AssemblyPlan) -> List[str]:
    """Apply every component in the plan to a tool, reporting per-component status."""
    report: List[str] = []

    for component in plan.components:
        geometry = geometry_for(tool, component.role)
        if geometry is None:
            report.append(
                f"{component.name}: no {component.role.value} geometry on this tool type — skipped."
            )
            continue

        if component.step_contents is None:
            report.append(
                f"{component.name}: no STEP solid given, geometry left unchanged."
            )
            continue

        try:
            apply_component(geometry, component)
        except Exception as error:
            report.append(f"{component.name}: failed to apply — {error}")
            continue

        state = "attached" if geometry.isValidGeometry else "not accepted by Fusion"
        joints_state = step_inspect.inspect_step(component.step_contents).summary()
        report.append(f"{component.name}: solid {state}. {joints_state}")

    return report
