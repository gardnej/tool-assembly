"""Read and write real Fusion tool libraries.

Everything here goes through ``CAMManager -> libraryManager -> toolLibraries``,
so the add-in operates on the same libraries the Tool Library dialog shows.
There is no mock data.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import adsk.cam
import adsk.core

# Library item types that can act as the machine-side root of an assembly.
BLOCK_TYPE = "tool block"

# Turning types carry a holder that participates in the joint chain.
TURNING_TYPES = frozenset(
    {
        "turning general",
        "turning threading",
        "turning grooving",
        "turning boring",
        "turning drill",
        "turning tap",
    }
)


@dataclass
class LibraryRef:
    """A tool library, addressable by URL."""

    url: adsk.core.URL
    name: str
    location: int

    @property
    def path(self) -> str:
        return self.url.toString()


@dataclass
class ToolRef:
    """A tool inside a library, with its parsed library JSON.

    The JSON is kept because several assembly-relevant fields (type, the nested
    ``tool-block`` object, ``post-process.stationNumber``) are only exposed
    there, not as typed API properties.
    """

    index: int
    tool: adsk.cam.Tool
    raw: Dict[str, Any] = field(repr=False)

    @property
    def type(self) -> str:
        return str(self.raw.get("type", ""))

    @property
    def description(self) -> str:
        desc = self.raw.get("description") or ""
        return str(desc) if desc else f"{self.type} #{self.index}"

    @property
    def vendor(self) -> str:
        return str(self.raw.get("vendor") or "")

    @property
    def is_block(self) -> bool:
        return self.type == BLOCK_TYPE

    @property
    def is_turning(self) -> bool:
        return self.type in TURNING_TYPES

    @property
    def has_block(self) -> bool:
        """True when this cutting tool already carries a nested tool block."""
        return isinstance(self.raw.get("tool-block"), dict)

    @property
    def block_geometry(self) -> Dict[str, Any]:
        block = self.raw.get("tool-block") or {}
        return block.get("geometry") or {}

    @property
    def geometry_id(self) -> Optional[str]:
        """Id of this tool's own stored solid, if it has one."""
        geometry_3d = (self.raw.get("geometry") or {}).get("3DGeometry") or {}
        found = geometry_3d.get("id")
        return str(found) if found else None

    @property
    def block_geometry_id(self) -> Optional[str]:
        """Id of the stored solid for the nested tool block, if there is one."""
        geometry_3d = self.block_geometry.get("3DGeometry") or {}
        found = geometry_3d.get("id")
        return str(found) if found else None

    @property
    def block_transform_override(self) -> Optional[Dict[str, Any]]:
        """Manual placement applied to the nested block, if the UI set one.

        This is the mechanism Fusion's own UI uses to position a block relative
        to its tool. It is not exposed through the public API.
        """
        geometry_3d = self.block_geometry.get("3DGeometry") or {}
        override = geometry_3d.get("transformOverride")
        return override if isinstance(override, dict) else None

    @property
    def station_number(self) -> Optional[int]:
        """Turret station, read from whichever post-process block defines it."""
        for source in (self.raw.get("tool-block") or {}, self.raw):
            post = source.get("post-process") or {}
            if "stationNumber" in post:
                return int(post["stationNumber"])
        return None

    @property
    def is_half_index(self) -> bool:
        block = self.raw.get("tool-block") or {}
        return bool((block.get("post-process") or {}).get("halfIndex", False))

    def label(self) -> str:
        parts = [self.description]
        if self.vendor:
            parts.append(f"({self.vendor})")
        station = self.station_number
        if station is not None:
            parts.append(f"- station {station}")
        return " ".join(parts)


def local_path(url: adsk.core.URL) -> Optional[str]:
    """Filesystem path for a local library URL, or None if it is not on disk.

    Stored joint frames live in ``.3DTool`` files beside the library, so a real
    path is needed to read them; cloud libraries have none.
    """
    try:
        path = url.pathName
    except Exception:
        return None
    if not path:
        return None
    return path if os.path.exists(path) else None


def tool_libraries() -> adsk.cam.ToolLibraries:
    """The live ToolLibraries object."""
    cam_manager = adsk.cam.CAMManager.get()
    if cam_manager is None:
        raise RuntimeError("CAM is unavailable; open the Manufacture workspace first.")
    return cam_manager.libraryManager.toolLibraries


def list_libraries(
    location: int = adsk.cam.LibraryLocations.LocalLibraryLocation,
    max_depth: int = 4,
) -> List[LibraryRef]:
    """Enumerate libraries under a location, descending through folders.

    ``childAssetURLs`` returns both folders and libraries with no flag to tell
    them apart, so a URL is treated as a library when it loads as one.
    """
    libraries = tool_libraries()
    root = libraries.urlByLocation(location)
    if root is None:
        return []

    found: List[LibraryRef] = []
    seen: set[str] = set()

    def walk(url: adsk.core.URL, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            children = libraries.childAssetURLs(url) or []
        except Exception:
            return

        for child in children:
            key = child.toString()
            if key in seen:
                continue
            seen.add(key)

            try:
                library = libraries.toolLibraryAtURL(child)
            except Exception:
                library = None

            if library is not None:
                found.append(
                    LibraryRef(url=child, name=child.leafName or key, location=location)
                )
            else:
                walk(child, depth + 1)

    walk(root, 0)
    found.sort(key=lambda ref: ref.name.lower())
    return found


def load_library(url: adsk.core.URL) -> adsk.cam.ToolLibrary:
    library = tool_libraries().toolLibraryAtURL(url)
    if library is None:
        raise RuntimeError(f"No tool library at {url.toString()}")
    return library


def read_tools(library: adsk.cam.ToolLibrary) -> List[ToolRef]:
    """Wrap every tool in a library with its parsed JSON."""
    refs: List[ToolRef] = []
    for index in range(library.count):
        tool = library.item(index)
        if tool is None:
            continue
        try:
            raw = json.loads(tool.toJson())
        except (ValueError, RuntimeError):
            raw = {}
        # A single tool serialises as the bare object, but be tolerant of a
        # library-shaped payload.
        if isinstance(raw, dict) and isinstance(raw.get("data"), list) and raw["data"]:
            raw = raw["data"][0]
        refs.append(ToolRef(index=index, tool=tool, raw=raw if isinstance(raw, dict) else {}))
    return refs


def tool_blocks(refs: List[ToolRef]) -> List[ToolRef]:
    return [ref for ref in refs if ref.is_block]

def cutting_tools(refs: List[ToolRef]) -> List[ToolRef]:
    return [ref for ref in refs if not ref.is_block]


def save_tool(
    url: adsk.core.URL, library: adsk.cam.ToolLibrary, tool: adsk.cam.Tool
) -> None:
    """Persist one modified tool back to its library on disk."""
    if not library.updateTool(tool):
        raise RuntimeError("updateTool failed; the library may be read-only.")
    if not tool_libraries().updateToolLibrary(url, library):
        raise RuntimeError(f"Could not write library at {url.toString()}.")
