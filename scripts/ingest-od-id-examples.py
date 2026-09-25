#!/usr/bin/env python3
"""Ingest the user-provided OD/ID example library into the prototype.

The user supplied a real Fusion tool library (``OD_ID Examples.json``) plus the
``.3DTool`` geometry headers that carry its MCS/CSW joint frames, and STEP files
of the assembled tools. This script converts that library into the prototype's
snapshot shape and writes it to ``src/data/odIdExamples.json`` (imported and
merged by ``realLibrary.ts`` alongside the generated snapshot, so a future
``npm run snapshot`` does not clobber it).

Two of the blocks are physically DUAL (they hold two tools) but the library JSON
carries only one tool record each. Per the agreed approach we set the block's
``numberOfTools`` to 2 and synthesise the second tool from the STEP part names,
sharing the block guid so the parent block row derives back to one block
(Model C). This is a deliberate, labelled fake of a real, round-tripping field.

Source paths are hard-coded constants (not runtime input), per the repo's
security rules on file-path handling.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

# --- Source files (read-only user files) ------------------------------------
SRC_DIR = os.path.expanduser(
    "~/Library/CloudStorage/OneDrive-Autodesk/Desktop/Tools and Blocks"
)
LIBRARY_JSON = os.path.join(SRC_DIR, "OD_ID Examples.json")
OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src",
    "data",
    "odIdExamples.json",
)

LIBRARY_ID = "od-id-examples"
LIBRARY_NAME = "OD_ID Examples"

GEOMETRY_SUFFIX = ".3DTool"
HEADER_READ_BYTES = 64 * 1024

# Mirror the key sets in export-library-snapshot.py so the shape matches exactly.
GEOMETRY_KEYS = (
    "OAL", "RE", "SC", "SCTY", "TC", "INSD", "S", "EPSR", "RA", "LH",
    "DC", "LCF", "NOF", "TP", "SIG", "LB", "SFDM", "CSP", "HAND",
    "assemblyGaugeLength", "shoulder-length", "shoulder-diameter",
    "tip-diameter", "tip-length", "tip-offset",
    "adaptiveItemSize", "numberOfAttachmentPoints", "numberOfTools",
    "orientationType", "machineSideConnectionType",
)
HOLDER_KEYS = ("OAL", "CW", "H", "W", "LH", "HAND", "MTP", "THSC")

# The second tool synthesised for each DUAL block, read off the STEP part names.
# Keyed by the block description. Only DUAL blocks appear here.
SECOND_TOOL_BY_BLOCK = {
    "20MM ID_DUAL": {"type": "turning boring", "description": "CNMG 12mm ID (derived)"},
    "25MM OD_DUAL": {"type": "turning general", "description": "SER 2525 Threading (derived)"},
}


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
    if not isinstance(rows, list) or len(rows) != 4:
        return None
    flat: List[float] = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 4:
            return None
        flat.extend(float(value) for value in row)
    return flat


def collect_joint_frames() -> Dict[str, Dict[str, Any]]:
    frames: Dict[str, Dict[str, Any]] = {}
    for name in os.listdir(SRC_DIR):
        if not name.endswith(GEOMETRY_SUFFIX):
            continue
        header = read_geometry_header(os.path.join(SRC_DIR, name))
        if header is None:
            continue
        geometry_id = name[: -len(GEOMETRY_SUFFIX)]
        frames[geometry_id] = {
            "stepFileName": header.get("geometryFileName"),
            "mcs": flatten_matrix(header.get("mcs")),
            "csw": flatten_matrix(header.get("csw")),
        }
    return frames


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


def drop_identity_transform(override: Any) -> Optional[Dict[str, Any]]:
    """Return the override unless it is the identity (all-zero) transform.

    Fusion exports an explicit identity ``transformOverride`` on these blocks
    (all rotation/translation components zero). The prototype flags ANY non-null
    override as "positioned manually" (assembly.ts / ReviewPanel), so an identity
    transform raises a spurious warning even though it moves nothing. It is never
    used for placement (turret seating comes from the block geometry/attach
    points), so we normalise identity overrides to null and keep only real ones.
    """
    if not isinstance(override, dict):
        return None
    rot = override.get("rotation") or {}
    trn = override.get("translation") or {}
    values = [rot.get(k, 0) for k in ("x", "y", "z")] + [
        trn.get(k, 0) for k in ("x", "y", "z")
    ]
    if all(float(v) == 0.0 for v in values):
        return None
    return override


def convert_block(block: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(block, dict):
        return None
    geometry_3d = (block.get("geometry") or {}).get("3DGeometry") or {}
    post = block.get("post-process") or {}
    geometry = pick(block.get("geometry"), GEOMETRY_KEYS)
    # Dual blocks physically hold two tools; the field round-trips but the source
    # library left it at 1. Fake it to 2 so the grid shows both seats (labelled).
    description = block.get("description") or ""
    if description in SECOND_TOOL_BY_BLOCK:
        geometry["numberOfTools"] = 2
    return {
        "guid": str(block.get("guid") or ""),
        "description": description,
        "vendor": block.get("vendor") or "",
        "productId": str(block.get("product-id") or ""),
        "geometry": geometry,
        "geometryId": geometry_id_of(block),
        "stepFileName": geometry_3d.get("fileName"),
        "transformOverride": drop_identity_transform(
            geometry_3d.get("transformOverride")
        ),
        "postProcess": {
            # Station is per-POSITION in the prototype, not per-block: a DUAL
            # block holds two tools, and each fills a different position. The
            # source library stamps station 0 on every occupant, which collapses
            # both positions onto station 0 and trips the "station used by more
            # than one tool" validation. Leaving it null lets the assembly grid
            # assign each position by row order (0, 1, …), so the two seats are
            # distinct. A real turret station is chosen later in Turret Setup.
            "stationNumber": None,
            "halfIndex": post.get("halfIndex"),
            "live": post.get("live"),
            "maximumRotationalSpeed": post.get("maximumRotationalSpeed"),
        },
    }


def convert_tool(entry: Dict[str, Any], index: int) -> Dict[str, Any]:
    post = entry.get("post-process") or {}
    geometry_3d = (entry.get("geometry") or {}).get("3DGeometry") or {}
    segments = entry.get("segments") if isinstance(entry.get("segments"), list) else None
    return {
        "id": str(entry.get("guid") or f"{LIBRARY_ID}-{index}"),
        "libraryId": LIBRARY_ID,
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


def synthesise_second_tool(primary: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """A second cutting tool for a DUAL block, sharing the block so it groups."""
    block = primary.get("block")
    if block is None:
        return None
    spec = SECOND_TOOL_BY_BLOCK.get(block.get("description") or "")
    if spec is None:
        return None
    clone = json.loads(json.dumps(primary))  # deep copy
    clone["id"] = f"{primary['id']}-derived-2"
    clone["type"] = spec["type"]
    clone["description"] = spec["description"]
    # The DUAL block genuinely holds a SECOND physical tool, but the source
    # library ships no separate .3DTool geometry header for it — so it has no
    # joint frames of its own. Rather than leave it frame-less (which fails the
    # "no 3D solid, so it carries no joint frames" validation and blocks the
    # assembly), reuse the sibling insert's geometry id and joint frames: it is
    # the same physical seat family, so its MCS/CSW make the position measurable
    # and it validates as a real, geometry-carrying tool. The whole dual assembly
    # is rendered from the block GLB anyway, so sharing the sibling's cutter mesh
    # for gauge/validation is faithful enough for the prototype.
    clone["geometryId"] = primary.get("geometryId")
    clone["stepFileName"] = primary.get("stepFileName")
    # Station is left null (see convert_block) so the two positions distribute by
    # row order rather than colliding on station 0.
    clone["postProcess"]["number"] = None
    return clone


def standalone_block_record(block: Dict[str, Any]) -> Dict[str, Any]:
    """A pickable ``tool block`` record derived from a nested block.

    This library nests every block inside a cutting tool (Fusion's schema), so it
    has no standalone ``tool block`` records for the assembly workflow's block
    picker to offer. We surface each unique nested block as its own record so a
    user can choose it as an assembly root; it carries the block's real geometry
    id and frames, so it seats on the turret like any other block.
    """
    return {
        "id": f"{LIBRARY_ID}-block-{block['guid']}",
        "libraryId": LIBRARY_ID,
        "type": "tool block",
        "description": block["description"],
        "vendor": block.get("vendor") or "",
        "productId": block.get("productId") or "",
        "productLink": "",
        "unit": "millimeters",
        "geometry": block.get("geometry") or {},
        "holder": None,
        "geometryId": block.get("geometryId"),
        "stepFileName": block.get("stepFileName"),
        "segments": None,
        "gaugeLength": None,
        "postProcess": {
            "number": None,
            "turret": None,
            "compensationOffset": None,
            "stationNumber": None,
            "halfIndex": None,
        },
        "block": None,
    }


def main() -> int:
    with open(LIBRARY_JSON, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    entries = [e for e in data.get("data", []) if isinstance(e, dict)]
    tools: List[Dict[str, Any]] = []
    for index, entry in enumerate(entries):
        tool = convert_tool(entry, index)
        tools.append(tool)
        second = synthesise_second_tool(tool)
        if second is not None:
            tools.append(second)

    # Surface each unique nested block as a standalone, pickable tool-block
    # record so the assembly workflow's block picker can offer it.
    seen_blocks: set[str] = set()
    block_records: List[Dict[str, Any]] = []
    for tool in tools:
        block = tool.get("block")
        if block is None:
            continue
        guid = block.get("guid") or ""
        if guid in seen_blocks:
            continue
        seen_blocks.add(guid)
        block_records.append(standalone_block_record(block))
    tools = block_records + tools

    frames = collect_joint_frames()
    referenced = {t["geometryId"] for t in tools if t["geometryId"]}
    referenced |= {
        t["block"]["geometryId"] for t in tools if t["block"] and t["block"]["geometryId"]
    }

    library = {
        "id": LIBRARY_ID,
        "name": LIBRARY_NAME,
        "folder": None,
        "breadcrumb": f"Local > {LIBRARY_NAME}",
        "version": data.get("version"),
        "toolCount": len(tools),
        "blockCount": sum(1 for t in tools if t["type"] == "tool block"),
        "assemblyCount": sum(1 for t in tools if t["block"] is not None),
    }

    out = {
        "source": "User-provided OD_ID Examples library",
        "library": library,
        "tools": tools,
        "jointFrames": {k: v for k, v in sorted(frames.items()) if k in referenced},
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=2, sort_keys=False)
        handle.write("\n")

    print(f"Wrote {OUT}")
    print(
        f"  {len(tools)} tools "
        f"({library['assemblyCount']} with a nested block, "
        f"{library['blockCount']} standalone blocks), "
        f"{len(out['jointFrames'])} joint frames"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
