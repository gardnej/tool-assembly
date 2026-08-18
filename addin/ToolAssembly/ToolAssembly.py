"""Fusion add-in entry point.

Adds a "Build Tool Assembly" command to the Manufacture workspace that joins a
tool block and holder from a real tool library using machine-side and
cutting-side joint origins.
"""

import os
import sys
import traceback

import adsk.core

_ADDIN_DIR = os.path.dirname(os.path.abspath(__file__))
if _ADDIN_DIR not in sys.path:
    sys.path.insert(0, _ADDIN_DIR)

from toolassembly import command  # noqa: E402


def run(context):
    try:
        command.register()
    except Exception:
        _report("Tool Assembly add-in failed to start")


def stop(context):
    try:
        command.unregister()
    except Exception:
        _report("Tool Assembly add-in failed to stop cleanly")
    finally:
        _forget_modules()
        if _ADDIN_DIR in sys.path:
            sys.path.remove(_ADDIN_DIR)


def _forget_modules():
    """Drop our modules so a reload after an edit picks up the new source.

    Fusion keeps the Python interpreter alive between add-in loads, so without
    this a stopped-and-restarted add-in would keep running the old code.
    """
    for name in [n for n in sys.modules if n == "toolassembly" or n.startswith("toolassembly.")]:
        del sys.modules[name]


def _report(heading):
    app = adsk.core.Application.get()
    if app is not None and app.userInterface is not None:
        app.userInterface.messageBox(f"{heading}:\n{traceback.format_exc()}")
