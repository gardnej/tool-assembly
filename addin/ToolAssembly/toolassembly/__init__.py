"""Tool assembly on Fusion's tool library framework.

Modules:
    joints          Rigid-transform maths for joint origins (no Fusion imports).
    library_access  Reading and writing real Fusion tool libraries.
    assembly        Applying a joint chain, with STEP solids, to library items.
    command         The Manufacture workspace command dialog.
"""

__all__ = ["assembly", "command", "joints", "library_access"]
