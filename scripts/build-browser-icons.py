"""Copy the browser tree's artwork out of Fusion.

Unlike the ribbon, the browser has no layout file to read: the tree is built
from whatever the document contains. What can be taken from the product is the
artwork and the row metrics, so this script copies the icons the prototype's
tree needs and nothing else.

The mapping below is written out by hand because it is a judgement about which
node in our mock stands for which node in Fusion. Each entry names a real
resource folder, so an icon that moves or is renamed upstream fails loudly here
rather than quietly showing the wrong picture.

    python3 scripts/build-browser-icons.py [--fusion <path to client-delivery>]

Writes into `src/assets/browser-icons/`. Nothing in the Fusion tree is touched.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

DEFAULT_FUSION = Path("/Users/jasongardner/Cursor/client-delivery")

BROWSER = Path("Core/Neutron/UI/Base/Resources/Browser")
CAM_ICONS = Path("Make/NeuCAM/UI/NeuCAMUI/Resources/Icons")
FUSION_TOOLS = Path("Core/Fusion/UI/FusionUI/Resources/tools")

OUT = Path("src/assets/browser-icons")

# The chrome is dark, so dark variants first. Vector before raster where both
# exist, since these are drawn at 16px but may be scaled by the display.
PREFERRED = [
    "16x16-dark.svg",
    "16x16-weave_dark.svg",
    "16x16-dark_gray.svg",
    "16x16-dark.png",
    "16x16-weave_dark.png",
    "16x16.svg",
    "16x16.png",
]

# Our node kind -> the resource folder Fusion draws that node with.
ICONS: dict[str, Path] = {
    # Row controls
    "visible": BROWSER / "Eye",
    "hidden": BROWSER / "EyeOff",
    "expand": BROWSER / "Expand",
    "collapse": BROWSER / "Collapse",
    # Design tree
    "document": BROWSER / "Component",
    "component": BROWSER / "ComponentGroup",
    "folder": BROWSER / "Folder",
    "namedView": BROWSER / "NamedView",
    "plane": BROWSER / "WorkPlane",
    "axis": BROWSER / "WorkAxis",
    "point": BROWSER / "WorkPoint",
    "body": BROWSER / "SolidBody",
    "sketch": BROWSER / "Sketch",
    "units": FUSION_TOOLS / "units",
    # Manufacture tree
    "setup": CAM_ICONS / "Setup",
    "stock": CAM_ICONS / "Stock",
    "setupModel": CAM_ICONS / "Model",
    "ncProgram": CAM_ICONS / "NCProgram",
    "camFolder": CAM_ICONS / "Folder",
    # Operations, by the strategy each one runs
    "opFace": CAM_ICONS / "StrategyTurningFace",
    "opRough": CAM_ICONS / "StrategyTurningProfileRoughing",
    "opFinish": CAM_ICONS / "StrategyTurningProfileFinishing",
    "opGroove": CAM_ICONS / "StrategyTurningGroove",
    "opThread": CAM_ICONS / "StrategyTurningThread",
    "opTrace": CAM_ICONS / "StrategyTurningTrace",
    "opToolCall": CAM_ICONS / "StrategyTurningToolCall",
    "opAdaptive": CAM_ICONS / "StrategyAdaptive3D",
    "opMill": CAM_ICONS / "StrategyFlat",
    "opDrill": CAM_ICONS / "StrategyDrill",
    "opInspect": CAM_ICONS / "ManualInspect",
}


def pick(source_dir: Path) -> Path | None:
    """Best available artwork in a resource folder, or nothing."""
    if not source_dir.is_dir():
        return None

    # One folder spells it `16X16.png`, so match without regard to case.
    by_lower = {path.name.lower(): path for path in source_dir.iterdir() if path.is_file()}
    for candidate in PREFERRED:
        found = by_lower.get(candidate)
        if found is not None:
            return found
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fusion", type=Path, default=DEFAULT_FUSION)
    args = parser.parse_args()

    fusion: Path = args.fusion
    if not (fusion / BROWSER).is_dir():
        print(f"No browser resources under {fusion}")
        return 1

    out = Path(OUT)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    missing: list[str] = []
    manifest: list[str] = []

    for kind, folder in ICONS.items():
        source = pick(fusion / folder)
        if source is None:
            missing.append(f"{kind} ({folder})")
            continue
        destination = out / f"{kind}{source.suffix}"
        shutil.copyfile(source, destination)
        manifest.append(f"{kind}: {folder.name}/{source.name}")

    for line in manifest:
        print(f"  {line}")
    print(f"\n{len(manifest)} icons copied into {OUT}/")
    if missing:
        print("No artwork found for: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
