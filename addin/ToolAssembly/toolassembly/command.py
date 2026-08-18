"""Command dialog for assembling a tool from real library items."""

from __future__ import annotations

import traceback
from typing import Dict, List, Optional

import adsk.cam
import adsk.core

from . import assembly, geometry_store, joints, library_access

COMMAND_ID = "toolAssemblyBuildAssembly"
COMMAND_NAME = "Build Tool Assembly"
COMMAND_TOOLTIP = (
    "Assemble a tool block and holder from a real tool library, joining them "
    "with machine-side and cutting-side joint origins."
)

MANUFACTURE_WORKSPACE = "CAMEnvironment"
TARGET_PANELS = ("CAMManagePanel", "CAMActionPanel", "CAMToolLibraryPanel")

# Input ids.
IN_LIBRARY = "library"
IN_BLOCK = "block"
IN_TOOL = "tool"
IN_BLOCK_SPAN = "blockSpan"
IN_HOLDER_SPAN = "holderSpan"
IN_BLOCK_STEP = "blockStep"
IN_HOLDER_STEP = "holderStep"
IN_BLOCK_BROWSE = "blockBrowse"
IN_HOLDER_BROWSE = "holderBrowse"
IN_BLOCK_REVERSED = "blockReversed"
IN_HOLDER_REVERSED = "holderReversed"
IN_PREVIEW = "preview"

# Fusion releases handlers that are not referenced from Python.
_handlers: List[adsk.core.EventHandler] = []


class _State:
    """Cached library data for the life of one dialog session."""

    def __init__(self) -> None:
        self.libraries: List[library_access.LibraryRef] = []
        self.tools_by_library: Dict[str, List[library_access.ToolRef]] = {}

    def library_by_name(self, name: str) -> Optional[library_access.LibraryRef]:
        return next((ref for ref in self.libraries if ref.name == name), None)

    def tools_for(self, ref: library_access.LibraryRef) -> List[library_access.ToolRef]:
        key = ref.path
        if key not in self.tools_by_library:
            library = library_access.load_library(ref.url)
            self.tools_by_library[key] = library_access.read_tools(library)
        return self.tools_by_library[key]


_state = _State()


def _ui() -> adsk.core.UserInterface:
    return adsk.core.Application.get().userInterface


def _selected_library(
    inputs: adsk.core.CommandInputs,
) -> Optional[library_access.LibraryRef]:
    dropdown = inputs.itemById(IN_LIBRARY)
    if dropdown is None or dropdown.selectedItem is None:
        return None
    return _state.library_by_name(dropdown.selectedItem.name)


def _selected_tool(
    inputs: adsk.core.CommandInputs, input_id: str
) -> Optional[library_access.ToolRef]:
    library = _selected_library(inputs)
    dropdown = inputs.itemById(input_id)
    if library is None or dropdown is None or dropdown.selectedItem is None:
        return None

    label = dropdown.selectedItem.name
    return next(
        (ref for ref in _state.tools_for(library) if ref.label() == label), None
    )


def _fill_tool_dropdowns(inputs: adsk.core.CommandInputs) -> None:
    """Repopulate the block and tool lists for the selected library."""
    library = _selected_library(inputs)
    block_input = inputs.itemById(IN_BLOCK)
    tool_input = inputs.itemById(IN_TOOL)
    if library is None or block_input is None or tool_input is None:
        return

    refs = _state.tools_for(library)
    blocks = library_access.tool_blocks(refs)
    cutters = library_access.cutting_tools(refs)

    for dropdown, items in ((block_input, blocks), (tool_input, cutters)):
        dropdown.listItems.clear()
        if not items:
            dropdown.listItems.add("(none in this library)", True)
            dropdown.isEnabled = False
            continue
        dropdown.isEnabled = True
        for index, ref in enumerate(items):
            dropdown.listItems.add(ref.label(), index == 0)


def _build_plan(inputs: adsk.core.CommandInputs) -> assembly.AssemblyPlan:
    block_ref = _selected_tool(inputs, IN_BLOCK)
    tool_ref = _selected_tool(inputs, IN_TOOL)

    block_span = joints.to_mm(inputs.itemById(IN_BLOCK_SPAN).value)
    holder_span = joints.to_mm(inputs.itemById(IN_HOLDER_SPAN).value)

    block_step = _read_step(inputs.itemById(IN_BLOCK_STEP).value)
    holder_step = _read_step(inputs.itemById(IN_HOLDER_STEP).value)

    return assembly.AssemblyPlan(
        components=[
            assembly.component_from_span(
                assembly.ComponentRole.BLOCK,
                block_ref.description if block_ref else "Tool block",
                block_span,
                block_step,
                reversed_solid=inputs.itemById(IN_BLOCK_REVERSED).value,
            ),
            assembly.component_from_span(
                assembly.ComponentRole.HOLDER,
                tool_ref.description if tool_ref else "Holder",
                holder_span,
                holder_step,
                reversed_solid=inputs.itemById(IN_HOLDER_REVERSED).value,
            ),
        ]
    )


def _read_step(path: str) -> Optional[str]:
    """STEP contents for a chosen path, or None when nothing is selected."""
    if not path.strip():
        return None
    return assembly.read_step_file(path.strip())


def _refresh_preview(inputs: adsk.core.CommandInputs) -> None:
    preview = inputs.itemById(IN_PREVIEW)
    if preview is None:
        return

    try:
        plan = _build_plan(inputs)
    except Exception as error:
        preview.text = f"Cannot preview: {error}"
        return

    lines = [plan.describe()]

    tool_ref = _selected_tool(inputs, IN_TOOL)
    block_ref = _selected_tool(inputs, IN_BLOCK)
    if tool_ref is not None:
        lines.extend(_stored_joint_lines(inputs, tool_ref, block_ref))

        station = tool_ref.station_number
        if station is not None:
            half = " (half index)" if tool_ref.is_half_index else ""
            lines.append(f"Library station: {station}{half}")
        if not tool_ref.is_turning:
            lines.append(
                f"Note: '{tool_ref.type}' has no holder geometry; "
                "only the tool block component will be written."
            )

    missing = [
        component.name
        for component in plan.components
        if component.step_contents is None
    ]
    if missing:
        lines.append(
            "Without a STEP solid for "
            + ", ".join(missing)
            + ", joints will be written but Fusion will report the geometry invalid."
        )

    preview.text = "\n".join(lines)


def _stored_joint_lines(
    inputs: adsk.core.CommandInputs,
    tool_ref: library_access.ToolRef,
    block_ref: Optional[library_access.ToolRef],
) -> List[str]:
    """Report the joint frames Fusion already holds for the chosen items.

    These come from the ``.3DTool`` files beside the library, which is the only
    readable source of real joint origins. The measured chain is what Fusion has,
    as opposed to the nominal spans typed into this dialog.
    """
    library_ref = _selected_library(inputs)
    if library_ref is None:
        return []

    path = library_access.local_path(library_ref.url)
    if path is None:
        return ["Stored joint frames: unavailable (library is not on this machine)."]

    store = geometry_store.load_library_geometry(path)
    if not store:
        return ["Stored joint frames: none found beside this library."]

    lines: List[str] = []

    block_id = tool_ref.block_geometry_id or (
        block_ref.geometry_id if block_ref is not None else None
    )
    block_geometry = store.get(block_id) if block_id else None
    tool_geometry = store.get(tool_ref.geometry_id) if tool_ref.geometry_id else None

    for label, stored in (("Block", block_geometry), ("Tool", tool_geometry)):
        if stored is not None:
            lines.append(f"{label} solid — {stored.summary()}")

    if block_geometry is not None and tool_geometry is not None:
        measured = geometry_store.chain_from_geometry([block_geometry, tool_geometry])
        if measured is not None:
            lines.append(f"Measured stack-up from stored frames: {measured:.3f} mm")
        else:
            lines.append(
                "Measured stack-up unavailable: a component is missing an MCS or CSW frame."
            )

    override = tool_ref.block_transform_override
    if override is not None:
        translation = override.get("translation") or {}
        lines.append(
            "Block is manually placed by transformOverride "
            f"(x={translation.get('x', 0)}, y={translation.get('y', 0)}, "
            f"z={translation.get('z', 0)}), which overrides the joint chain."
        )

    return lines


class _InputChangedHandler(adsk.core.InputChangedEventHandler):
    def notify(self, args):
        try:
            event = adsk.core.InputChangedEventArgs.cast(args)
            inputs = event.inputs
            changed = event.input

            if changed.id == IN_LIBRARY:
                _fill_tool_dropdowns(inputs)
                _seed_spans(inputs)
            elif changed.id in (IN_BLOCK, IN_TOOL):
                _seed_spans(inputs)
            elif changed.id in (IN_BLOCK_BROWSE, IN_HOLDER_BROWSE):
                target = (
                    IN_BLOCK_STEP if changed.id == IN_BLOCK_BROWSE else IN_HOLDER_STEP
                )
                path = _browse_for_step()
                if path:
                    inputs.itemById(target).value = path

            _refresh_preview(inputs)
        except Exception:
            _ui().messageBox(f"Input handling failed:\n{traceback.format_exc()}")


def _browse_for_step() -> Optional[str]:
    dialog = _ui().createFileDialog()
    dialog.title = "Select a STEP solid for this component"
    dialog.filter = "STEP files (*.stp;*.step)"
    dialog.isMultiSelectEnabled = False
    if dialog.showOpen() != adsk.core.DialogResults.DialogOK:
        return None
    return dialog.filename


def _seed_spans(inputs: adsk.core.CommandInputs) -> None:
    """Seed spans from the selected library items' own dimensions."""
    block_ref = _selected_tool(inputs, IN_BLOCK)
    tool_ref = _selected_tool(inputs, IN_TOOL)

    if block_ref is not None:
        block_span, _ = assembly.default_spans_mm(block_ref)
        if block_span > 0:
            inputs.itemById(IN_BLOCK_SPAN).value = joints.mm(block_span)

    if tool_ref is not None:
        _, holder_span = assembly.default_spans_mm(tool_ref)
        if holder_span > 0:
            inputs.itemById(IN_HOLDER_SPAN).value = joints.mm(holder_span)


class _ValidateHandler(adsk.core.ValidateInputsEventHandler):
    def notify(self, args):
        try:
            event = adsk.core.ValidateInputsEventArgs.cast(args)
            inputs = event.inputs

            has_tool = _selected_tool(inputs, IN_TOOL) is not None
            spans_positive = (
                inputs.itemById(IN_BLOCK_SPAN).value > 0
                and inputs.itemById(IN_HOLDER_SPAN).value > 0
            )
            event.areInputsValid = has_tool and spans_positive
        except Exception:
            event.areInputsValid = False


class _ExecuteHandler(adsk.core.CommandEventHandler):
    def notify(self, args):
        try:
            inputs = adsk.core.CommandEventArgs.cast(args).command.commandInputs

            library_ref = _selected_library(inputs)
            tool_ref = _selected_tool(inputs, IN_TOOL)
            if library_ref is None or tool_ref is None:
                _ui().messageBox("Select a library and a tool first.")
                return

            plan = _build_plan(inputs)

            # Reload so the tool object written back belongs to a fresh library
            # instance rather than one cached from an earlier session.
            library = library_access.load_library(library_ref.url)
            tool = library.item(tool_ref.index)
            if tool is None:
                _ui().messageBox("That tool is no longer in the library.")
                return

            report = assembly.apply_plan(tool, plan)

            try:
                library_access.save_tool(library_ref.url, library, tool)
                saved = f"Saved to {library_ref.name}."
            except Exception as error:
                saved = f"Not saved: {error}"

            # Drop the cache so a re-run reads the values actually persisted.
            _state.tools_by_library.pop(library_ref.path, None)

            _ui().messageBox(
                "Tool assembly\n\n"
                + plan.describe()
                + "\n\n"
                + "\n".join(report)
                + "\n\n"
                + saved,
                "Build Tool Assembly",
            )
        except Exception:
            _ui().messageBox(f"Assembly failed:\n{traceback.format_exc()}")


class _CommandCreatedHandler(adsk.core.CommandCreatedEventHandler):
    def notify(self, args):
        try:
            command = adsk.core.CommandCreatedEventArgs.cast(args).command
            inputs = command.commandInputs

            _state.libraries = library_access.list_libraries()
            _state.tools_by_library.clear()

            library_input = inputs.addDropDownCommandInput(
                IN_LIBRARY,
                "Tool library",
                adsk.core.DropDownStyles.TextListDropDownStyle,
            )
            if not _state.libraries:
                library_input.listItems.add("(no local libraries found)", True)
                library_input.isEnabled = False
            else:
                for index, ref in enumerate(_state.libraries):
                    library_input.listItems.add(ref.name, index == 0)

            inputs.addDropDownCommandInput(
                IN_BLOCK,
                "Tool block",
                adsk.core.DropDownStyles.TextListDropDownStyle,
            )
            inputs.addDropDownCommandInput(
                IN_TOOL,
                "Cutting tool",
                adsk.core.DropDownStyles.TextListDropDownStyle,
            )

            inputs.addValueInput(
                IN_BLOCK_SPAN,
                "Block span",
                "mm",
                adsk.core.ValueInput.createByReal(joints.mm(40.0)),
            )
            inputs.addValueInput(
                IN_HOLDER_SPAN,
                "Holder span",
                "mm",
                adsk.core.ValueInput.createByReal(joints.mm(125.0)),
            )

            inputs.addStringValueInput(IN_BLOCK_STEP, "Block STEP", "")
            inputs.addBoolValueInput(IN_BLOCK_BROWSE, "Browse block STEP…", False)
            inputs.addStringValueInput(IN_HOLDER_STEP, "Holder STEP", "")
            inputs.addBoolValueInput(IN_HOLDER_BROWSE, "Browse holder STEP…", False)

            inputs.addBoolValueInput(
                IN_BLOCK_REVERSED, "Block solid faces machine", True, "", False
            )
            inputs.addBoolValueInput(
                IN_HOLDER_REVERSED, "Holder solid faces machine", True, "", False
            )

            preview = inputs.addTextBoxCommandInput(IN_PREVIEW, "Stack-up", "", 8, True)
            preview.isFullWidth = True

            if _state.libraries:
                _fill_tool_dropdowns(inputs)
                _seed_spans(inputs)
            _refresh_preview(inputs)

            input_changed = _InputChangedHandler()
            command.inputChanged.add(input_changed)
            _handlers.append(input_changed)

            validate = _ValidateHandler()
            command.validateInputs.add(validate)
            _handlers.append(validate)

            execute = _ExecuteHandler()
            command.execute.add(execute)
            _handlers.append(execute)
        except Exception:
            _ui().messageBox(f"Could not open the dialog:\n{traceback.format_exc()}")


def register() -> None:
    """Create the command definition and add it to the Manufacture workspace."""
    ui = _ui()

    definition = ui.commandDefinitions.itemById(COMMAND_ID)
    if definition is None:
        definition = ui.commandDefinitions.addButtonDefinition(
            COMMAND_ID, COMMAND_NAME, COMMAND_TOOLTIP
        )

    created = _CommandCreatedHandler()
    definition.commandCreated.add(created)
    _handlers.append(created)

    workspace = ui.workspaces.itemById(MANUFACTURE_WORKSPACE)
    if workspace is None:
        return

    for panel_id in TARGET_PANELS:
        panel = workspace.toolbarPanels.itemById(panel_id)
        if panel is None:
            continue
        if panel.controls.itemById(COMMAND_ID) is None:
            panel.controls.addCommand(definition)
        return


def unregister() -> None:
    """Remove the button and definition so the add-in can be reloaded cleanly."""
    ui = _ui()

    workspace = ui.workspaces.itemById(MANUFACTURE_WORKSPACE)
    if workspace is not None:
        for panel_id in TARGET_PANELS:
            panel = workspace.toolbarPanels.itemById(panel_id)
            if panel is None:
                continue
            control = panel.controls.itemById(COMMAND_ID)
            if control is not None:
                control.deleteMe()

    definition = ui.commandDefinitions.itemById(COMMAND_ID)
    if definition is not None:
        definition.deleteMe()

    _handlers.clear()
