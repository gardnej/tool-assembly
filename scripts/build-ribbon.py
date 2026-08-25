"""Generate the Manufacture ribbon from Fusion's own source.

The ribbon in the product is data-driven: `TabToolbars.xml` declares each tab's
panels in order, and inside a panel which buttons are promoted onto the bar
(`Controls`) as against the full list behind the chevron (`PanelDropdown`).
Everything else is a lookup — panel captions live in a C++ switch, command
captions in a generated translation map, icons in a folder per command.

Reading all four rather than transcribing them by hand is what keeps the
prototype honest: rerun this after a sync and the ribbon follows the product.

    python3 scripts/build-ribbon.py [--fusion <path to client-delivery>]

Writes `src/data/ribbonManufacture.ts` and the icons it references into
`src/assets/ribbon-icons/`. Nothing under the Fusion tree is modified.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

DEFAULT_FUSION = Path("/Users/jasongardner/Cursor/client-delivery")

NEUCAM = Path("Make/NeuCAM/UI/NeuCAMUI")
TOOLBAR_XML = NEUCAM / "Resources/Toolbar/TabToolbars.xml"
NEUCAM_UI_CPP = NEUCAM / "NeuCAMUI.cpp"
ICON_ROOT = NEUCAM / "Resources/Icons"
STRATEGIES_PY = Path("Make/IronLib/core/parameters/Strategies.py")
TRANSLATION_MAP = Path("Core/Build/Common/TranslationMap/cmdID_TransID_map.json")

OUT_CONFIG = Path("src/data/ribbonManufacture.ts")

# Kept apart from `ribbon-icons`, which is hand-curated for the other
# workspaces: this directory is rebuilt wholesale on every run.
OUT_ICONS = Path("src/assets/manufacture-icons")

# Tabs the prototype shows, in the product's order. The contextual tabs
# (simulation, part alignment, debug) only appear during a mode, so they are not
# part of the resting ribbon and are left out.
TABS = ["MillingTab", "TurningTab", "AdditiveTab", "FabricationTab", "ProbingTab", "UtilitiesTab"]

# Tabs carrying their full command set. The rest keep the product's panels but
# show only the promoted buttons, which is enough to read the shape of the tab.
FULL_TABS = {"MillingTab", "TurningTab"}

# Preferred artwork, best first. The chrome is dark, so the dark variants are
# the ones that match. Newer icons are drawn to Weave and named for it, older
# ones only exist as PNG, so both conventions have to be tried.
ICON_FILES = [
    "32x32-weave_dark.svg",
    "24x24-weave_dark.svg",
    "32x32-dark.svg",
    "24x24-dark.svg",
    "16x16-weave_dark.svg",
    "16x16-dark.svg",
    "32x32-dark.png",
    "24x24-dark.png",
    "32x32-weave_dark.png",
    "32x32.svg",
    "32x32.png",
]

# Commands shared with the rest of Fusion keep their artwork outside the CAM
# module, under a folder named for the command rather than for an icon.
SHARED_ICON_ROOTS = [
    Path("Core/Neutron/UI/Commands/Resources"),
    Path("Core/Neutron/UI/Components/Resources/Icons"),
]

# A few commands build their caption from a variable, so no amount of reading
# the source will yield it. Only put something here after checking the code.
CAPTION_OVERRIDES = {
    # Core/Neutron/Client/Commands/Commands/Select/SelectCmd.cpp: _LCLZ(n, "Select")
    "SelectCommand": "Select",
}


def strip_entities(text: str) -> str:
    """Drop the DOCTYPE and its entity references, which pull in debug panels."""
    text = re.sub(r"<!DOCTYPE.*?\]>", "", text, flags=re.DOTALL)
    return re.sub(r"&\w+;", "", text)


def parse_labels(cpp: str) -> dict[str, str]:
    """Tab and panel captions from `CAMToolbarPersister::getItemDisplayText`."""
    body = cpp.split("getItemDisplayText", 1)[-1]
    labels: dict[str, str] = {}

    # Each caption covers one or more ids: `if (a || b) { return LOCALIZE("X"); }`
    pattern = re.compile(
        r"if\s*\((?P<ids>(?:\s*itemId\s*==\s*L\"[^\"]+\"\s*\|?\|?)+)\)\s*\{\s*"
        r"return\s+LOCALIZE\(\"(?P<label>[^\"]*)\"\)",
        re.DOTALL,
    )
    for match in pattern.finditer(body):
        for item in re.findall(r"L\"([^\"]+)\"", match.group("ids")):
            labels.setdefault(item, match.group("label"))

    return labels


def parse_dropdown_labels(cpp: str) -> dict[str, str]:
    """Captions for split buttons, e.g. the Manage panel's Solid Holder."""
    body = cpp.split("localizeDropdownButtons", 1)[-1].split("}", 1)[0]
    return {
        button: label
        for _, button, label in re.findall(
            r"\{L\"([^\"]+)\",\s*L\"([^\"]+)\",\s*LOCALIZE\(\"([^\"]+)\"\)\}", body
        )
    }


def parse_strategies(source: str) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    """Strategy metadata, keyed both by id and by the name the C++ refers to."""
    by_id: dict[str, dict[str, str]] = {}
    by_hsm: dict[str, dict[str, str]] = {}

    for block in source.split("\nclass ")[1:]:
        fields = {
            key: value
            for key, value in re.findall(r"^\t(\w+)\s*=\s*\"([^\"]*)\"", block, re.MULTILINE)
        }
        if "id" in fields:
            by_id[fields["id"]] = fields
        if "hsmName" in fields:
            by_hsm[fields["hsmName"]] = fields

    return by_id, by_hsm


def parse_translations(entries: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    """Command id to its English caption and the file that defines it."""
    return {
        entry["commandID"]: entry
        for entry in entries
        if entry.get("commandID") and entry.get("translationID")
    }


class Ribbon:
    def __init__(self, fusion: Path) -> None:
        self.fusion = fusion
        cpp = (fusion / NEUCAM_UI_CPP).read_text(errors="replace")
        self.labels = parse_labels(cpp)
        self.dropdown_labels = parse_dropdown_labels(cpp)
        self.strategies, self.strategies_by_hsm = parse_strategies(
            (fusion / STRATEGIES_PY).read_text(errors="replace")
        )
        self.translations = parse_translations(
            json.loads((fusion / TRANSLATION_MAP).read_text())
        )
        self.icon_cache: dict[str, str | None] = {}
        self.wanted_icons: dict[str, Path] = {}

    # -- captions ---------------------------------------------------------

    def command_label(self, command: str) -> str:
        if command in CAPTION_OVERRIDES:
            return CAPTION_OVERRIDES[command]

        entry = self.translations.get(command)
        if entry is not None and entry["translationID"] != command:
            return entry["translationID"]

        # Commands from the rest of Fusion are keyed by id rather than caption,
        # so the caption is the second argument where the id is declared.
        if entry is not None and entry.get("file"):
            source = self.fusion / entry["file"]
            if source.is_file():
                found = re.search(
                    rf'_LCLZ\(\s*"{re.escape(command)}"\s*,\s*"([^"]+)"',
                    source.read_text(errors="replace"),
                )
                if found is not None:
                    return found.group(1)

        strategy = self.strategies.get(self.strategy_id(command) or "")
        if strategy is not None and "title" in strategy:
            return strategy["title"]

        # Better a readable stand-in than a raw id: these are commands whose
        # caption is built at runtime rather than declared. Split on the start
        # of each word, so runs of capitals stay together as the acronyms
        # they are.
        stem = re.sub(r"(Command|Cmd)$", "", command.removeprefix("Iron"))
        return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", stem).strip()

    @staticmethod
    def strategy_id(command: str) -> str | None:
        if not command.startswith("IronStrategy_"):
            return None
        return command.removeprefix("IronStrategy_").removesuffix("_derived")

    # -- artwork ----------------------------------------------------------

    def icon_folder(self, command: str) -> str | None:
        """Folder of artwork for a command, by the rule its own code uses."""
        strategy = self.strategy_id(command)
        if strategy is not None:
            resource = self.strategies.get(strategy, {}).get("iconResourceInv")
            return resource.removesuffix(".ico") if resource else None

        # Everything else names its icon inline, in the same call that declares
        # the command — sometimes passed to a loader, sometimes as a bare path —
        # so the nearest reference in the defining file is it.
        entry = self.translations.get(command)
        if entry is None or not entry.get("file"):
            return None

        source = self.fusion / entry["file"]
        if not source.is_file():
            return None

        text = source.read_text(errors="replace")
        anchor = text.find(f'L"{command}"')

        found = [
            (abs(match.start() - anchor), match.group(1))
            for match in re.finditer(r'L"Icons/([^"]+)"', text)
        ]
        if found:
            return min(found)[1]

        # A few borrow a strategy's icon rather than naming their own.
        borrowed = [
            (abs(match.start() - anchor), match.group(1))
            for match in re.finditer(r"getIconPath\(Strategy::(\w+)\)", text)
        ]
        if borrowed:
            resource = self.strategies_by_hsm.get(min(borrowed)[1], {}).get("iconResourceInv")
            if resource:
                return resource.removesuffix(".ico")

        return None

    def candidate_dirs(self, command: str) -> list[Path]:
        """Where a command's artwork might live, likeliest first.

        Most are named outright in the code, but some inherit an icon or are
        owned by the wider product, so fall back to the naming convention.
        """
        candidates: list[Path] = []

        folder = self.icon_folder(command)
        if folder is not None:
            candidates.append(self.fusion / ICON_ROOT / folder)

        names = [
            command,
            re.sub(r"(Command|Cmd)$", "", command),
            re.sub(r"(Command|Cmd)$", "", command.removeprefix("Iron")),
        ]
        for name in dict.fromkeys(n for n in names if n):
            candidates.append(self.fusion / ICON_ROOT / name)
            for root in SHARED_ICON_ROOTS:
                # Some are nested one deeper under a folder of the same name.
                candidates.append(self.fusion / root / name)
                candidates.append(self.fusion / root / name / name)

        return candidates

    def icon(self, command: str) -> str | None:
        """Copy the artwork for a command, returning the file name to import."""
        if command in self.icon_cache:
            return self.icon_cache[command]

        result: str | None = None
        for source_dir in self.candidate_dirs(command):
            if not source_dir.is_dir():
                continue
            for candidate in ICON_FILES:
                source = source_dir / candidate
                if source.is_file():
                    result = f"{source_dir.name}{source.suffix}"
                    self.wanted_icons[result] = source
                    break
            if result is not None:
                break

        self.icon_cache[command] = result
        return result

    # -- layout -----------------------------------------------------------

    def buttons(self, node, seen_separator: bool = False) -> list[dict]:
        """Buttons of a panel section, keeping split buttons as one entry."""
        items: list[dict] = []

        for child in node:
            if child.tag == "Button":
                command = child.get("Id", "")
                items.append(
                    {
                        "id": command,
                        "label": self.command_label(command),
                        "icon": self.icon(command),
                    }
                )
            elif child.tag == "DropDownButton":
                command = child.get("Id", "")
                items.append(
                    {
                        "id": command,
                        "label": self.dropdown_labels.get(command)
                        or self.command_label(command),
                        "icon": self.icon(command),
                        "items": self.buttons(child),
                    }
                )

        return items


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fusion", type=Path, default=DEFAULT_FUSION)
    args = parser.parse_args()

    fusion: Path = args.fusion
    if not (fusion / TOOLBAR_XML).is_file():
        print(f"No toolbar XML under {fusion}")
        return 1

    import xml.etree.ElementTree as ElementTree

    root = ElementTree.fromstring(
        strip_entities((fusion / TOOLBAR_XML).read_text(errors="replace"))
    )
    toolbar = root.find('.//CommandToolbar[@Id="CAMAssetType"]')
    if toolbar is None:
        print("No CAMAssetType toolbar in the XML")
        return 1

    ribbon = Ribbon(fusion)
    panels_by_id = {panel.get("Id"): panel for panel in toolbar.findall("Panel")}

    tabs = []
    for tab_id in TABS:
        tab = toolbar.find(f'Tab[@Id="{tab_id}"]')
        if tab is None:
            print(f"  skipped {tab_id}: not in the XML")
            continue

        panels = []
        for panel_id in (tab.get("Panels") or "").split(";"):
            panel = panels_by_id.get(panel_id)
            if panel is None:
                continue

            controls = panel.find("Controls")
            dropdown = panel.find("PanelDropdown")
            promoted = ribbon.buttons(controls) if controls is not None else []
            overflow = (
                ribbon.buttons(dropdown)
                if dropdown is not None and tab_id in FULL_TABS
                else []
            )
            if not promoted and not overflow:
                continue

            panels.append(
                {
                    "id": panel_id,
                    "label": ribbon.labels.get(panel_id, panel_id),
                    "promoted": promoted,
                    "overflow": overflow,
                }
            )

        tabs.append(
            {
                "id": tab_id,
                "label": ribbon.labels.get(tab_id, tab.get("Text", tab_id)),
                "panels": panels,
            }
        )
        print(f"  {tab_id}: {len(panels)} panels")

    # Artwork, copied rather than referenced: the prototype has to build without
    # the Fusion tree on disk.
    icons_dir = Path(OUT_ICONS)
    if icons_dir.exists():
        shutil.rmtree(icons_dir)
    icons_dir.mkdir(parents=True)
    for name, source in sorted(ribbon.wanted_icons.items()):
        shutil.copyfile(source, icons_dir / name)

    missing = sum(
        1
        for tab in tabs
        for panel in tab["panels"]
        for item in panel["promoted"] + panel["overflow"]
        if item["icon"] is None
    )

    header = f'''/**
 * The Manufacture ribbon, generated from Fusion's own source.
 *
 * Do not edit by hand: `scripts/build-ribbon.py` reads the layout from
 * `TabToolbars.xml`, the captions from the translation map and the C++ that
 * names the panels, and the artwork from the icon resources. Rerun it after a
 * sync rather than patching this file, or the ribbon stops matching the
 * product it is imitating.
 *
 * `promoted` is what the product puts on the bar; `overflow` is the full list
 * behind the panel's chevron. Panels are in the order the product shows them.
 */

export interface RibbonCommand {{
  /** Fusion's own command id, e.g. `IronToolLibrary`. */
  id: string;
  label: string;
  /** File name under `src/assets/ribbon-icons`, or null where none was found. */
  icon: string | null;
  /** Present on split buttons, e.g. Manage's Solid Holder. */
  items?: RibbonCommand[];
}}

export interface RibbonPanel {{
  id: string;
  label: string;
  promoted: RibbonCommand[];
  overflow: RibbonCommand[];
}}

export interface RibbonTab {{
  id: string;
  label: string;
  panels: RibbonPanel[];
}}

export const MANUFACTURE_TABS: RibbonTab[] = {json.dumps(tabs, indent=2, ensure_ascii=False)};
'''

    Path(OUT_CONFIG).write_text(header)

    total = sum(
        len(panel["promoted"]) + len(panel["overflow"])
        for tab in tabs
        for panel in tab["panels"]
    )
    print(f"\n{len(tabs)} tabs, {total} buttons, {len(ribbon.wanted_icons)} icons copied")
    if missing:
        print(f"{missing} buttons have no artwork and will fall back to a glyph")
    print(f"Wrote {OUT_CONFIG} and {OUT_ICONS}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
