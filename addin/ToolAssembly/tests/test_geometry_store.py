"""Tests for reading stored joint frames out of .3DTool files."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from toolassembly import geometry_store  # noqa: E402

IDENTITY_ROWS = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def rows_with_translation(x, y, z):
    return [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]]


def write_geometry(folder, geometry_id, header):
    """Write a .3DTool file: JSON header followed by a binary body."""
    path = os.path.join(folder, f"{geometry_id}{geometry_store.GEOMETRY_SUFFIX}")
    with open(path, "wb") as handle:
        handle.write(json.dumps(header).encode("utf-8"))
        handle.write(b"ASM BinaryFile8\x00\x01\x02\xff\xfe")
    return path


class ReadJoints(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.folder, ignore_errors=True)

    def test_reads_both_frames_past_the_binary_body(self):
        path = write_geometry(
            self.folder,
            "abc",
            {
                "mcs": IDENTITY_ROWS,
                "csw": rows_with_translation(0, 0, 80),
                "geometryFileName": "holder.stp",
            },
        )
        stored = geometry_store.read_joints(path)

        self.assertEqual(stored.geometry_id, "abc")
        self.assertEqual(stored.step_file_name, "holder.stp")
        self.assertTrue(stored.is_complete)
        self.assertAlmostEqual(stored.span_mm, 80.0, places=6)

    def test_span_matches_an_off_axis_frame(self):
        path = write_geometry(
            self.folder,
            "ews",
            {"mcs": IDENTITY_ROWS, "csw": rows_with_translation(63, 0, -80)},
        )
        stored = geometry_store.read_joints(path)
        self.assertAlmostEqual(stored.span_mm, 101.828, places=3)

    def test_missing_mcs_is_reported_as_incomplete(self):
        path = write_geometry(
            self.folder, "partial", {"csw": rows_with_translation(0, 0, 30)}
        )
        stored = geometry_store.read_joints(path)

        self.assertFalse(stored.is_complete)
        self.assertIsNone(stored.span_mm)
        self.assertIn("no MCS frame", stored.summary())

    def test_malformed_matrix_is_ignored(self):
        path = write_geometry(self.folder, "bad", {"mcs": [[1, 0, 0]], "csw": IDENTITY_ROWS})
        stored = geometry_store.read_joints(path)
        self.assertIsNone(stored.machine_side)

    def test_unparseable_header_returns_none(self):
        path = os.path.join(self.folder, f"junk{geometry_store.GEOMETRY_SUFFIX}")
        with open(path, "wb") as handle:
            handle.write(b"\x00\x01not json at all")
        self.assertIsNone(geometry_store.read_joints(path))

    def test_indexes_every_solid_beside_a_library(self):
        library = os.path.join(self.folder, "Library.json")
        with open(library, "w", encoding="utf-8") as handle:
            handle.write("{}")
        write_geometry(self.folder, "one", {"mcs": IDENTITY_ROWS, "csw": IDENTITY_ROWS})
        write_geometry(self.folder, "two", {"mcs": IDENTITY_ROWS, "csw": IDENTITY_ROWS})

        store = geometry_store.load_library_geometry(library)
        self.assertEqual(sorted(store), ["one", "two"])

    def test_missing_folder_yields_an_empty_index(self):
        store = geometry_store.load_library_geometry("/nonexistent/Library.json")
        self.assertEqual(store, {})


class ChainFromGeometry(unittest.TestCase):
    def make(self, span_z, complete=True):
        return geometry_store.GeometryJoints(
            geometry_id="g",
            step_file_name="g.stp",
            machine_side=[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] if complete else None,
            cutting_side=[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, span_z, 0, 0, 0, 1],
        )

    def test_chains_two_complete_components(self):
        total = geometry_store.chain_from_geometry([self.make(40.0), self.make(125.0)])
        self.assertAlmostEqual(total, 165.0, places=6)

    def test_gap_in_the_chain_cannot_be_measured(self):
        total = geometry_store.chain_from_geometry(
            [self.make(40.0), self.make(125.0, complete=False)]
        )
        self.assertIsNone(total)

    def test_empty_chain_cannot_be_measured(self):
        self.assertIsNone(geometry_store.chain_from_geometry([]))


if __name__ == "__main__":
    unittest.main()
