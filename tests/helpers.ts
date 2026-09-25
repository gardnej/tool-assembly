import assert from "node:assert/strict";

/** Assert two floats agree to `digits` decimal places. */
export function closeTo(actual: number, expected: number, digits = 9): void {
  const tolerance = 0.5 * 10 ** -digits;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to equal ${expected} within ${tolerance}`,
  );
}
