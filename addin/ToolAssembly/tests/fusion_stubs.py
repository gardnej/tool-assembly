"""Minimal stand-ins for the Fusion API so the add-in can be tested off-host.

Only the members the add-in actually touches are provided. Enum values and
property-versus-method shapes mirror the generated Fusion API definitions, so a
mismatch here shows up as a test failure rather than a runtime error in Fusion.
"""

from __future__ import annotations

import sys
import types
from typing import Dict, List, Optional


class Matrix3D:
    def __init__(self) -> None:
        self.cells: List[float] = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ]

    @staticmethod
    def create() -> "Matrix3D":
        return Matrix3D()

    def setWithArray(self, cells) -> bool:
        if len(cells) != 16:
            return False
        self.cells = list(cells)
        return True


class ToolJointType:
    CuttingSideJoint = 0
    MachineSideJoint = 1
    ToolHolderJoint = 2


class LibraryLocations:
    LocalLibraryLocation = 0
    CloudLibraryLocation = 1
    NetworkLibraryLocation = 2
    OnlineSamplesLibraryLocation = 3
    ExternalLibraryLocation = 4
    Fusion360LibraryLocation = 5
    HubLibraryLocation = 6


class DropDownStyles:
    TextListDropDownStyle = 0


class DialogResults:
    DialogOK = 0


class FakeAssemblyComponentGeometry:
    """Mirrors Fusion's actual behaviour, not its documentation.

    ``isValidGeometry`` only reports whether a solid is present: the shipping
    implementation returns ``geometry != nullptr`` and does not check joints,
    even though the API docstring says both end joints are required.
    ``setJointOrigin`` raises, matching the stub in Fusion, so any code path that
    calls it fails the tests instead of failing in front of a user.
    """

    def __init__(self) -> None:
        self.step: Optional[str] = None
        self.joints: Dict[int, Matrix3D] = {}

    def setStepGeometry(self, step_file_contents: str) -> None:
        self.step = step_file_contents or None

    def setJointOrigin(self, joint_type: int, joint_origin: Matrix3D) -> None:
        raise RuntimeError(
            "setJointOrigin() is not yet implemented. Please set joint origins in "
            "your STEP file and use use_joints=true in setGeometry()."
        )

    @property
    def isValidGeometry(self) -> bool:
        return self.step is not None


class _CastByFlag:
    """Base for the API's ``cast`` type-test helpers."""

    _flag = ""

    @classmethod
    def cast(cls, arg):
        return arg if getattr(arg, cls._flag, False) else None


class ToolBlock(_CastByFlag):
    _flag = "_is_block"


class TurningTool(_CastByFlag):
    _flag = "_is_turning"


class _Handler:
    """Stand-in for the API's event handler base classes."""


def install() -> None:
    """Register stub ``adsk`` modules in ``sys.modules``."""
    if "adsk" in sys.modules and getattr(sys.modules["adsk"], "_is_stub", False):
        return

    adsk = types.ModuleType("adsk")
    adsk._is_stub = True

    core = types.ModuleType("adsk.core")
    core.Matrix3D = Matrix3D
    core.DropDownStyles = DropDownStyles
    core.DialogResults = DialogResults
    for name in (
        "EventHandler",
        "CommandCreatedEventHandler",
        "InputChangedEventHandler",
        "ValidateInputsEventHandler",
        "CommandEventHandler",
    ):
        setattr(core, name, type(name, (_Handler,), {}))

    cam = types.ModuleType("adsk.cam")
    cam.ToolJointType = ToolJointType
    cam.LibraryLocations = LibraryLocations
    cam.ToolBlock = ToolBlock
    cam.TurningTool = TurningTool
    cam.AssemblyComponentGeometry = FakeAssemblyComponentGeometry

    adsk.core = core
    adsk.cam = cam

    sys.modules["adsk"] = adsk
    sys.modules["adsk.core"] = core
    sys.modules["adsk.cam"] = cam
