"""Tests for the joint-chain maths.

Pure Python, no Fusion required: run with ``python3 -m unittest discover
addin/ToolAssembly/tests``.
"""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from toolassembly import joints  # noqa: E402


def chain(*spans):
    """Build a joint chain from ``(span_mm, reversed_solid)`` pairs."""
    return [joints.span_joints(joints.mm(s), reversed_solid=r) for s, r in spans]


class SpanConvention(unittest.TestCase):
    def test_single_span_is_positive_either_way(self):
        for reversed_solid in (False, True):
            length = joints.assembly_length(chain((125.0, reversed_solid)))
            self.assertAlmostEqual(joints.to_mm(length), 125.0, places=9)

    def test_stack_up_is_a_sum_for_every_flip_combination(self):
        for first in (False, True):
            for second in (False, True):
                length = joints.assembly_length(chain((40.0, first), (125.0, second)))
                self.assertAlmostEqual(
                    joints.to_mm(length),
                    165.0,
                    places=9,
                    msg=f"first reversed={first}, second reversed={second}",
                )

    def test_mixed_three_component_chain(self):
        length = joints.assembly_length(chain((40.0, True), (125.0, False), (30.0, True)))
        self.assertAlmostEqual(joints.to_mm(length), 195.0, places=9)

    def test_components_seat_progressively_forward(self):
        placements = joints.chain_placements(chain((40.0, True), (125.0, False)))
        seats = [joints.to_mm(joints.origin_of(p)[2]) for p in placements]
        self.assertAlmostEqual(seats[0], 0.0, places=9)
        self.assertAlmostEqual(seats[1], 40.0, places=9)

    def test_reversed_chain_keeps_frame_unrotated(self):
        """A reversed component must not hand a flipped frame onward."""
        pairs = chain((40.0, True))
        placement = joints.chain_placements(pairs)[0]
        frontier = joints.multiply(placement, pairs[0][1])
        self.assertAlmostEqual(joints.z_axis_of(frontier)[2], 1.0, places=9)


class JointOffsets(unittest.TestCase):
    def test_machine_side_offset_does_not_leak_into_stack_up(self):
        """Only the machine-to-cutting span counts, not where the joint sits."""
        pairs = [(joints.along_z(joints.mm(30.0)), joints.along_z(joints.mm(80.0)))]
        self.assertAlmostEqual(joints.to_mm(joints.assembly_length(pairs)), 50.0, places=9)

    def test_empty_chain_has_no_length(self):
        self.assertEqual(joints.assembly_length([]), 0.0)


class RigidMath(unittest.TestCase):
    def test_inverse_round_trip(self):
        m = joints.multiply(joints.along_z(joints.mm(25.0)), joints.flip_z())
        product = joints.multiply(m, joints.invert_rigid(m))
        for actual, expected in zip(product, joints.IDENTITY):
            self.assertAlmostEqual(actual, expected, places=12)

    def test_identity_is_multiplicative_unit(self):
        m = joints.from_axes((1.0, 2.0, 3.0), (0.0, 1.0, 0.0), (-1.0, 0.0, 0.0), (0.0, 0.0, 1.0))
        for actual, expected in zip(joints.multiply(joints.identity(), m), m):
            self.assertAlmostEqual(actual, expected, places=12)

    def test_unit_conversions(self):
        self.assertAlmostEqual(joints.mm(10.0), 1.0, places=12)
        self.assertAlmostEqual(joints.inch(1.0), 2.54, places=12)
        self.assertAlmostEqual(joints.to_mm(joints.mm(37.5)), 37.5, places=12)


if __name__ == "__main__":
    unittest.main()
