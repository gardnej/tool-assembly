"""Tests for applying an assembly plan to library items.

Runs against stubbed Fusion modules, so it verifies the add-in's own logic:
which geometry slot each component role writes to, that both end joints are
always set, and how STEP paths are validated.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fusion_stubs  # noqa: E402

fusion_stubs.install()

from toolassembly import assembly, joints  # noqa: E402
from toolassembly.library_access import ToolRef  # noqa: E402


class FakeTool:
    """A library item exposing the geometry slots the add-in writes to."""

    def __init__(self, is_turning: bool = True, is_block: bool = False) -> None:
        self._is_turning = is_turning
        self._is_block = is_block
        self.holderGeometry = fusion_stubs.FakeAssemblyComponentGeometry()
        self.toolBlockGeometry = fusion_stubs.FakeAssemblyComponentGeometry()
        self.geometry = fusion_stubs.FakeAssemblyComponentGeometry()


def plan(block_step="BLOCK-STEP", holder_step="HOLDER-STEP"):
    return assembly.plan_from_spans(
        block_name="EWS block",
        holder_name="DCLNR holder",
        block_span_mm=40.0,
        holder_span_mm=125.0,
        block_step=block_step,
        holder_step=holder_step,
    )


class GeometryRouting(unittest.TestCase):
    def test_block_writes_to_nested_block_geometry_on_a_cutting_tool(self):
        tool = FakeTool()
        target = assembly.geometry_for(tool, assembly.ComponentRole.BLOCK)
        self.assertIs(target, tool.toolBlockGeometry)

    def test_block_writes_to_own_geometry_on_a_tool_block_item(self):
        tool = FakeTool(is_turning=False, is_block=True)
        target = assembly.geometry_for(tool, assembly.ComponentRole.BLOCK)
        self.assertIs(target, tool.geometry)

    def test_holder_writes_to_holder_geometry(self):
        tool = FakeTool()
        target = assembly.geometry_for(tool, assembly.ComponentRole.HOLDER)
        self.assertIs(target, tool.holderGeometry)

    def test_non_turning_tool_has_no_holder_geometry(self):
        tool = FakeTool(is_turning=False)
        self.assertIsNone(assembly.geometry_for(tool, assembly.ComponentRole.HOLDER))


class ApplyPlan(unittest.TestCase):
    def test_attaches_solids_to_both_components(self):
        tool = FakeTool()
        report = assembly.apply_plan(tool, plan())

        self.assertEqual(tool.toolBlockGeometry.step, "BLOCK-STEP")
        self.assertEqual(tool.holderGeometry.step, "HOLDER-STEP")
        self.assertEqual(len(report), 2)
        self.assertTrue(all("solid attached" in line for line in report))

    def test_never_calls_the_unimplemented_joint_origin_api(self):
        """Calling setJointOrigin would raise in Fusion, so it must not be used."""
        tool = FakeTool()
        report = assembly.apply_plan(tool, plan())

        self.assertEqual(tool.holderGeometry.joints, {})
        self.assertFalse(any("not yet implemented" in line for line in report))

    def test_reports_missing_joint_frames_in_the_step(self):
        tool = FakeTool()
        report = assembly.apply_plan(tool, plan())
        self.assertTrue(any("missing" in line for line in report))

    def test_reports_step_that_carries_joint_frames(self):
        step = "AXIS2_PLACEMENT_3D('MCS',#1,#2,#3);\nAXIS2_PLACEMENT_3D('CSW',#4,#5,#6);"
        tool = FakeTool()
        report = assembly.apply_plan(tool, plan(block_step=step, holder_step=step))
        self.assertTrue(all("carries MCS and CSW" in line for line in report))

    def test_without_step_solid_geometry_is_left_alone(self):
        tool = FakeTool()
        report = assembly.apply_plan(tool, plan(block_step=None, holder_step=None))

        self.assertIsNone(tool.holderGeometry.step)
        self.assertFalse(tool.holderGeometry.isValidGeometry)
        self.assertTrue(any("left unchanged" in line for line in report))

    def test_missing_geometry_slot_is_reported_not_raised(self):
        tool = FakeTool(is_turning=False)
        report = assembly.apply_plan(tool, plan())
        self.assertTrue(any("skipped" in line for line in report))

    def test_joint_matrices_convert_to_sixteen_cells(self):
        matrix = assembly.to_matrix3d(joints.along_z(joints.mm(40.0)))
        self.assertEqual(len(matrix.cells), 16)

    def test_stack_up_is_the_sum_of_spans(self):
        self.assertAlmostEqual(plan().stack_up_mm, 165.0, places=9)

    def test_describe_mentions_every_component_and_the_total(self):
        text = plan().describe()
        self.assertIn("EWS block", text)
        self.assertIn("DCLNR holder", text)
        self.assertIn("165.000", text)


class StepFileValidation(unittest.TestCase):
    def test_rejects_empty_path(self):
        with self.assertRaises(ValueError):
            assembly.read_step_file("")

    def test_rejects_missing_file(self):
        with self.assertRaises(ValueError):
            assembly.read_step_file("/nonexistent/holder.stp")

    def test_rejects_wrong_suffix(self):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as handle:
            handle.write(b"ISO-10303-21;")
            path = handle.name
        try:
            with self.assertRaises(ValueError):
                assembly.read_step_file(path)
        finally:
            os.unlink(path)

    def test_rejects_empty_step_file(self):
        with tempfile.NamedTemporaryFile(suffix=".stp", delete=False) as handle:
            path = handle.name
        try:
            with self.assertRaises(ValueError):
                assembly.read_step_file(path)
        finally:
            os.unlink(path)

    def test_reads_a_valid_step_file(self):
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as handle:
            handle.write(b"ISO-10303-21;\nENDSEC;\n")
            path = handle.name
        try:
            self.assertIn("ISO-10303-21", assembly.read_step_file(path))
        finally:
            os.unlink(path)


class LibraryDefaults(unittest.TestCase):
    def test_spans_come_from_the_library_item(self):
        ref = ToolRef(
            index=0,
            tool=None,
            raw={
                "type": "turning general",
                "unit": "millimeters",
                "holder": {"OAL": 125.0},
                "tool-block": {"geometry": {"adaptiveItemSize": 40.0}},
            },
        )
        block_span, holder_span = assembly.default_spans_mm(ref)
        self.assertAlmostEqual(block_span, 40.0, places=9)
        self.assertAlmostEqual(holder_span, 125.0, places=9)

    def test_inch_libraries_are_converted_to_millimetres(self):
        ref = ToolRef(
            index=0,
            tool=None,
            raw={"type": "turning general", "unit": "inches", "holder": {"OAL": 5.0}},
        )
        _, holder_span = assembly.default_spans_mm(ref)
        self.assertAlmostEqual(holder_span, 127.0, places=9)

    def test_unit_scale_matches_the_authoring_unit(self):
        mm_ref = ToolRef(index=0, tool=None, raw={"unit": "millimeters"})
        inch_ref = ToolRef(index=0, tool=None, raw={"unit": "inches"})
        self.assertAlmostEqual(assembly.unit_scale(mm_ref), joints.mm(1.0), places=12)
        self.assertAlmostEqual(assembly.unit_scale(inch_ref), joints.inch(1.0), places=12)


class ToolRefFields(unittest.TestCase):
    def test_reads_station_and_half_index_from_the_block(self):
        ref = ToolRef(
            index=3,
            tool=None,
            raw={
                "type": "turning general",
                "tool-block": {"post-process": {"stationNumber": 2, "halfIndex": True}},
            },
        )
        self.assertEqual(ref.station_number, 2)
        self.assertTrue(ref.is_half_index)
        self.assertTrue(ref.has_block)

    def test_falls_back_to_the_tools_own_post_process(self):
        ref = ToolRef(
            index=0, tool=None, raw={"type": "tool block", "post-process": {"stationNumber": 7}}
        )
        self.assertEqual(ref.station_number, 7)
        self.assertTrue(ref.is_block)

    def test_label_includes_vendor_and_station(self):
        ref = ToolRef(
            index=0,
            tool=None,
            raw={
                "type": "tool block",
                "description": "BMT65 block",
                "vendor": "EWS",
                "post-process": {"stationNumber": 4},
            },
        )
        self.assertEqual(ref.label(), "BMT65 block (EWS) - station 4")

    def test_description_falls_back_to_type_and_index(self):
        ref = ToolRef(index=5, tool=None, raw={"type": "turning general"})
        self.assertEqual(ref.description, "turning general #5")


if __name__ == "__main__":
    unittest.main()
