"""Pre-flight check for the joint frames a tool STEP file must carry.

Fusion does not accept joint origins through the API: ``setJointOrigin`` is a
stub that raises "not yet implemented". Joint frames are instead read out of the
STEP file itself, so whether an assembly works is decided by how the STEP was
authored.

The importer looks for coordinate systems labelled exactly ``MCS`` and ``CSW``
(ISO-13399: the mounting frame on the machine side and the workpiece-side frame
on the cutting side) and ignores unlabelled ones. It also groups them by parts
labelled ``CUT`` and ``NOCUT``, taking the machine-side frame from the non-cut
part. This module reports which of those labels a STEP file actually contains so
a missing one can be fixed in CAD rather than debugged in Fusion.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Set

MACHINE_SIDE_LABEL = "MCS"
CUTTING_SIDE_LABEL = "CSW"
CUT_PART_LABELS = ("CUT",)
NOCUT_PART_LABELS = ("NOCUT", "NO_CUT")

# STEP stores names as single-quoted strings, so a label is looked for as a
# whole quoted token rather than as a bare substring.
_QUOTED = re.compile(r"'([^']*)'")


@dataclass
class StepJointReport:
    labels: Set[str]

    @property
    def has_machine_side(self) -> bool:
        return MACHINE_SIDE_LABEL in self.labels

    @property
    def has_cutting_side(self) -> bool:
        return CUTTING_SIDE_LABEL in self.labels

    @property
    def has_cut_part(self) -> bool:
        return any(label in self.labels for label in CUT_PART_LABELS)

    @property
    def has_nocut_part(self) -> bool:
        return any(label in self.labels for label in NOCUT_PART_LABELS)

    @property
    def is_assembly_ready(self) -> bool:
        """Both end frames present, which is what the importer needs."""
        return self.has_machine_side and self.has_cutting_side

    def missing(self) -> List[str]:
        gaps: List[str] = []
        if not self.has_machine_side:
            gaps.append(f"{MACHINE_SIDE_LABEL} (machine-side mounting frame)")
        if not self.has_cutting_side:
            gaps.append(f"{CUTTING_SIDE_LABEL} (cutting-side frame)")
        return gaps

    def summary(self) -> str:
        if self.is_assembly_ready:
            text = f"STEP carries {MACHINE_SIDE_LABEL} and {CUTTING_SIDE_LABEL} joint frames."
        else:
            text = "STEP is missing " + ", ".join(self.missing()) + "."

        if not (self.has_cut_part or self.has_nocut_part):
            text += (
                " No CUT/NOCUT part labels found, so the importer cannot tell the"
                " holder from the insert."
            )
        return text


def inspect_step(contents: str) -> StepJointReport:
    """Collect the quoted labels in a STEP file that matter for assembly."""
    if not contents:
        return StepJointReport(labels=set())

    wanted = {
        MACHINE_SIDE_LABEL,
        CUTTING_SIDE_LABEL,
        *CUT_PART_LABELS,
        *NOCUT_PART_LABELS,
    }
    found = {
        token.strip().upper()
        for token in _QUOTED.findall(contents)
        if token.strip().upper() in wanted
    }
    return StepJointReport(labels=found)
