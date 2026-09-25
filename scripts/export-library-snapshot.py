#!/usr/bin/env python3
"""Export a snapshot of the real Fusion tool libraries for the prototype.

The prototype runs in a browser and cannot read the local Fusion libraries, so
this writes a snapshot of them into ``src/data/``. It keeps the real schema
rather than reshaping it: tool ``type`` strings, the nested ``tool-block``
object, ``post-process`` fields including ``stationNumber`` and ``halfIndex``,
and the MCS/CSW joint frames Fusion extracted from each STEP file.

    python3 scripts/export-library-snapshot.py

Huge vendor catalogues are skipped; the point is a faithful sample, not a copy
of every tool on the machine.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

LIBRARY_ROOT = os.path.expanduser(
    "~/Library/Application Support/Autodesk/CAM360/libraries/Local"
)
DEFAULT_OUTPUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src",
    "data",
    "realLibrarySnapshot.json",
)

# Libraries above this many tools are vendor catalogues rather than user work.
MAX_TOOLS_PER_LIBRARY = 200
GEOMETRY_SUFFIX = ".3DTool"
HEADER_READ_BYTES = 64 * 1024

# Geometry keys worth carrying through for display, per real library schema.
# assemblyGaugeLength / shoulder-length / SFDM come from the mill-drill libraries
# and are what Fusion itself measures gauge length with; the turning tools stay
# on the joint-frame chain but share the same key set.
GEOMETRY_KEYS = (
    "OAL", "RE", "SC", "SCTY", "TC", "INSD", "S", "EPSR", "RA", "LH",
    "DC", "LCF", "NOF", "TP", "SIG", "LB", "SFDM", "CSP", "HAND",
    "assemblyGaugeLength", "shoulder-length", "shoulder-diameter",
    "tip-diameter", "tip-length", "tip-offset",
    "adaptiveItemSize", "numberOfAttachmentPoints", "numberOfTools",
    "orientationType", "machineSideConnectionType",
)
HOLDER_KEYS = ("OAL", "CW", "H", "W", "LH", "HAND", "MTP", "THSC")

# Root-level fields that belong to the record itself (not to `geometry`) which
# extension-style holders and modern mill-drill records carry.
RECORD_TOP_KEYS = ("gaugeLength", "product-link", "segments")


def read_geometry_header(path: str) -> Optional[Dict[str, Any]]:
    """Parse the JSON header that precedes the binary body of a .3DTool file."""
    with open(path, "rb") as handle:
        prefix = handle.read(HEADER_READ_BYTES).decode("latin-1")

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


def flatten_matrix(rows: Any) -> Optional[List[float]]:
    """Row-major 16-float form of a nested 4x4, or None if malformed."""
    if not isinstance(rows, list) or len(rows) != 4:
        return None
    flat: List[float] = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 4:
            return None
        flat.extend(float(value) for value in row)
    return flat


def collect_joint_frames(root: str) -> Dict[str, Dict[str, Any]]:
    """Index every stored solid's joint frames by geometry id."""
    frames: Dict[str, Dict[str, Any]] = {}

    for path in glob.glob(os.path.join(root, "**", f"*{GEOMETRY_SUFFIX}"), recursive=True):
        header = read_geometry_header(path)
        if header is None:
            continue
        geometry_id = os.path.basename(path)[: -len(GEOMETRY_SUFFIX)]
        frames[geometry_id] = {
            "stepFileName": header.get("geometryFileName"),
            "mcs": flatten_matrix(header.get("mcs")),
            "csw": flatten_matrix(header.get("csw")),
        }

    return frames


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def pick(source: Any, keys) -> Dict[str, Any]:
    if not isinstance(source, dict):
        return {}
    return {key: source[key] for key in keys if key in source}


def geometry_id_of(container: Any) -> Optional[str]:
    if not isinstance(container, dict):
        return None
    geometry_3d = (container.get("geometry") or {}).get("3DGeometry") or {}
    found = geometry_3d.get("id")
    return str(found) if found else None


def convert_block(block: Any) -> Optional[Dict[str, Any]]:
    """The nested tool-block carried by a cutting tool."""
    if not isinstance(block, dict):
        return None

    geometry_3d = (block.get("geometry") or {}).get("3DGeometry") or {}
    post = block.get("post-process") or {}

    return {
        "guid": str(block.get("guid") or ""),
        "description": block.get("description") or "",
        "vendor": block.get("vendor") or "",
        "productId": str(block.get("product-id") or ""),
        "geometry": pick(block.get("geometry"), GEOMETRY_KEYS),
        "geometryId": geometry_id_of(block),
        "stepFileName": geometry_3d.get("fileName"),
        "transformOverride": geometry_3d.get("transformOverride"),
        "postProcess": {
            "stationNumber": post.get("stationNumber"),
            "halfIndex": post.get("halfIndex"),
            "live": post.get("live"),
            "maximumRotationalSpeed": post.get("maximumRotationalSpeed"),
        },
    }


def convert_tool(entry: Dict[str, Any], library_id: str, index: int) -> Dict[str, Any]:
    post = entry.get("post-process") or {}
    geometry_3d = (entry.get("geometry") or {}).get("3DGeometry") or {}
    segments = entry.get("segments") if isinstance(entry.get("segments"), list) else None

    return {
        "id": str(entry.get("guid") or f"{library_id}-{index}"),
        "libraryId": library_id,
        "type": entry.get("type") or "",
        "description": entry.get("description") or "",
        "vendor": entry.get("vendor") or "",
        "productId": str(entry.get("product-id") or ""),
        "productLink": str(entry.get("product-link") or ""),
        "unit": entry.get("unit") or "millimeters",
        "geometry": pick(entry.get("geometry"), GEOMETRY_KEYS),
        "holder": pick(entry.get("holder"), HOLDER_KEYS) or None,
        "geometryId": geometry_id_of(entry),
        "stepFileName": geometry_3d.get("fileName"),
        # Extension-style holders describe themselves as a stack of frusta rather
        # than through the cutter-holder split, so segments come off the record
        # rather than out of `geometry`.
        "segments": segments,
        "gaugeLength": entry.get("gaugeLength"),
        "postProcess": {
            "number": post.get("number"),
            "turret": post.get("turret"),
            "compensationOffset": post.get("compensation-offset"),
            "stationNumber": post.get("stationNumber"),
            "halfIndex": post.get("halfIndex"),
        },
        "block": convert_block(entry.get("tool-block")),
    }


def build_snapshot(root: str) -> Dict[str, Any]:
    frames = collect_joint_frames(root)
    libraries: List[Dict[str, Any]] = []
    tools: List[Dict[str, Any]] = []

    for path in sorted(glob.glob(os.path.join(root, "**", "*.json"), recursive=True)):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (ValueError, OSError):
            continue

        entries = data.get("data")
        if not isinstance(entries, list) or not entries:
            continue
        if len(entries) > MAX_TOOLS_PER_LIBRARY:
            continue

        relative = os.path.relpath(path, root)
        name = os.path.splitext(os.path.basename(path))[0]
        folder = os.path.dirname(relative)
        library_id = slugify(os.path.splitext(relative)[0]) or slugify(name)

        library_tools = [
            convert_tool(entry, library_id, index)
            for index, entry in enumerate(entries)
            if isinstance(entry, dict)
        ]
        if not library_tools:
            continue

        libraries.append(
            {
                "id": library_id,
                "name": name,
                "folder": folder or None,
                "breadcrumb": " > ".join(["Local", *([folder] if folder else []), name]),
                "version": data.get("version"),
                "toolCount": len(library_tools),
                "blockCount": sum(1 for t in library_tools if t["type"] == "tool block"),
                "assemblyCount": sum(1 for t in library_tools if t["block"] is not None),
            }
        )
        tools.extend(library_tools)

    # Only keep frames that a snapshotted tool actually refers to.
    referenced = {tool["geometryId"] for tool in tools if tool["geometryId"]}
    referenced |= {
        tool["block"]["geometryId"]
        for tool in tools
        if tool["block"] and tool["block"]["geometryId"]
    }

    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Fusion local tool libraries",
        "libraries": sorted(libraries, key=lambda lib: lib["name"].lower()),
        "tools": tools,
        "jointFrames": {
            key: value for key, value in sorted(frames.items()) if key in referenced
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=LIBRARY_ROOT, help="Fusion local library folder")
    parser.add_argument("--out", default=DEFAULT_OUTPUT, help="snapshot destination")
    args = parser.parse_args()

    if not os.path.isdir(args.root):
        print(f"Library folder not found: {args.root}")
        return 1

    snapshot = build_snapshot(args.root)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, indent=2, sort_keys=False)
        handle.write("\n")

    assemblies = sum(1 for tool in snapshot["tools"] if tool["block"])
    print(f"Wrote {args.out}")
    print(
        f"  {len(snapshot['libraries'])} libraries, {len(snapshot['tools'])} tools, "
        f"{assemblies} with a nested tool block, "
        f"{len(snapshot['jointFrames'])} stored joint frames"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
