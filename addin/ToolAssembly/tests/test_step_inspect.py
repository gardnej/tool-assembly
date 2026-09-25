"""Tests for the STEP joint-frame pre-flight check."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from toolassembly import step_inspect  # noqa: E402

BOTH_FRAMES = (
    "ISO-10303-21;\n"
    "DATA;\n"
    "#10=AXIS2_PLACEMENT_3D('MCS',#1,#2,#3);\n"
    "#11=AXIS2_PLACEMENT_3D('CSW',#4,#5,#6);\n"
    "#12=PRODUCT('NOCUT','NOCUT','',(#7));\n"
    "#13=PRODUCT('CUT','CUT','',(#8));\n"
    "ENDSEC;\n"
)


class FrameDetection(unittest.TestCase):
    def test_detects_both_frames_and_parts(self):
        report = step_inspect.inspect_step(BOTH_FRAMES)
        self.assertTrue(report.has_machine_side)
        self.assertTrue(report.has_cutting_side)
        self.assertTrue(report.has_cut_part)
        self.assertTrue(report.has_nocut_part)
        self.assertTrue(report.is_assembly_ready)
        self.assertEqual(report.missing(), [])

    def test_reports_a_missing_cutting_side_frame(self):
        report = step_inspect.inspect_step("#10=AXIS2_PLACEMENT_3D('MCS',#1,#2,#3);")
        self.assertTrue(report.has_machine_side)
        self.assertFalse(report.has_cutting_side)
        self.assertFalse(report.is_assembly_ready)
        self.assertIn("CSW", report.missing()[0])

    def test_reports_both_frames_missing(self):
        report = step_inspect.inspect_step("#10=AXIS2_PLACEMENT_3D('',#1,#2,#3);")
        self.assertFalse(report.is_assembly_ready)
        self.assertEqual(len(report.missing()), 2)

    def test_empty_contents_is_not_ready(self):
        report = step_inspect.inspect_step("")
        self.assertFalse(report.is_assembly_ready)

    def test_accepts_the_no_cut_spelling(self):
        report = step_inspect.inspect_step("#1=PRODUCT('NO_CUT','NO_CUT','',(#2));")
        self.assertTrue(report.has_nocut_part)

    def test_labels_are_matched_case_insensitively(self):
        report = step_inspect.inspect_step("#10=AXIS2_PLACEMENT_3D('mcs',#1,#2,#3);")
        self.assertTrue(report.has_machine_side)

    def test_unquoted_occurrences_are_ignored(self):
        """A bare mention in a comment must not count as a labelled frame."""
        report = step_inspect.inspect_step("/* the MCS goes here */ #1=AXIS2_PLACEMENT_3D('',#2,#3,#4);")
        self.assertFalse(report.has_machine_side)

    def test_substring_labels_do_not_match(self):
        report = step_inspect.inspect_step("#1=AXIS2_PLACEMENT_3D('MCS_OLD',#2,#3,#4);")
        self.assertFalse(report.has_machine_side)


class Summaries(unittest.TestCase):
    def test_ready_summary_names_both_frames(self):
        summary = step_inspect.inspect_step(BOTH_FRAMES).summary()
        self.assertIn("MCS and CSW", summary)

    def test_missing_summary_lists_the_gap(self):
        summary = step_inspect.inspect_step("#1=AXIS2_PLACEMENT_3D('CSW',#2,#3,#4);").summary()
        self.assertIn("missing", summary)
        self.assertIn("MCS", summary)

    def test_summary_flags_absent_part_labels(self):
        summary = step_inspect.inspect_step(
            "#1=AXIS2_PLACEMENT_3D('MCS',#2,#3,#4);#5=AXIS2_PLACEMENT_3D('CSW',#6,#7,#8);"
        ).summary()
        self.assertIn("CUT/NOCUT", summary)


if __name__ == "__main__":
    unittest.main()
