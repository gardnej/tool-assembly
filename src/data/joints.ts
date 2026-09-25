/**
 * Rigid-transform maths for tool assembly joint origins.
 *
 * A tool assembly is a chain of components running from the machine datum (the
 * turret face) out to the cutting edge. Each component declares two frames —
 * `MCS` on the machine side and `CSW` on the cutting side, per ISO-13399 — and
 * consecutive components are joined by seating one component's machine-side
 * frame onto its predecessor's cutting-side frame.
 *
 * Conventions:
 * - Matrices are row-major, 16 numbers, points treated as column vectors, so
 *   translation lives at indices 3, 7 and 11. This matches both Fusion's
 *   `Matrix3D.asArray` and the `mcs`/`csw` matrices stored in `.3DTool` files.
 * - Lengths are millimetres, matching the snapshot. Fusion's own API works in
 *   centimetres, so convert at that boundary rather than here.
 *
 * This is a port of `addin/ToolAssembly/toolassembly/joints.py`; the two are
 * kept in step so the prototype and the add-in agree on stack-up.
 */

export type Matrix = number[];
export type Vector = [number, number, number];

export const IDENTITY: Matrix = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export function identity(): Matrix {
  return [...IDENTITY];
}

export function fromAxes(
  origin: Vector,
  xAxis: Vector,
  yAxis: Vector,
  zAxis: Vector,
): Matrix {
  return [
    xAxis[0], yAxis[0], zAxis[0], origin[0],
    xAxis[1], yAxis[1], zAxis[1], origin[1],
    xAxis[2], yAxis[2], zAxis[2], origin[2],
    0, 0, 0, 1,
  ];
}

/** A joint origin displaced from the component origin, axes unrotated. */
export function translation(offset: Vector): Matrix {
  return fromAxes(offset, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
}

/** Joint origin offset along +Z, the usual tool axis direction. */
export function alongZ(distance: number): Matrix {
  return translation([0, 0, distance]);
}

/**
 * Rotate 180 degrees about X so +Z points back toward the machine, for solids
 * modelled facing the other way.
 */
export function flipZ(): Matrix {
  return fromAxes([0, 0, 0], [1, 0, 0], [0, -1, 0], [0, 0, -1]);
}

/** Matrix product `a * b` (apply `b` first, then `a`). */
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out: Matrix = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[row * 4 + k] * b[k * 4 + col];
      }
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

/**
 * Inverse of a rigid transform, using the transpose of the rotation block
 * rather than a general inverse. Exact and cheap; joint origins are rigid.
 */
export function invertRigid(m: Matrix): Matrix {
  const r = [
    [m[0], m[1], m[2]],
    [m[4], m[5], m[6]],
    [m[8], m[9], m[10]],
  ];
  const t: Vector = [m[3], m[7], m[11]];

  const inverseTranslation = [0, 1, 2].map(
    (i) => -(r[0][i] * t[0] + r[1][i] * t[1] + r[2][i] * t[2]),
  );

  return [
    r[0][0], r[1][0], r[2][0], inverseTranslation[0],
    r[0][1], r[1][1], r[2][1], inverseTranslation[1],
    r[0][2], r[1][2], r[2][2], inverseTranslation[2],
    0, 0, 0, 1,
  ];
}

export function originOf(m: Matrix): Vector {
  return [m[3], m[7], m[11]];
}

export function zAxisOf(m: Matrix): Vector {
  return [m[2], m[6], m[10]];
}

/** A component's `[machineSide, cuttingSide]` joint frames. */
export type JointPair = readonly [Matrix, Matrix];

/**
 * Machine-side and cutting-side joints for a straight span along the axis.
 *
 * By default the solid runs from the machine side toward the cutting edge along
 * +Z. When `reversedSolid` is set, the solid's +Z points back into the machine,
 * so both joints are flipped and the cutting-side joint sits at -Z.
 *
 * Both joints have to be flipped, not just the machine-side one: placement
 * aligns the machine-side joint to the running frame, so a flip there rotates
 * the whole component. If the cutting-side frame did not carry the same flip it
 * would hand a reversed frame onward and the rest of the chain would stack
 * backwards.
 */
export function spanJoints(distance: number, reversedSolid = false): JointPair {
  if (reversedSolid) {
    return [flipZ(), multiply(alongZ(-distance), flipZ())];
  }
  return [identity(), alongZ(distance)];
}

/**
 * Place a machine-to-cutting-edge chain of components.
 *
 * The first component's machine-side joint defines the assembly datum, normally
 * the turret face. Returns each component's placement in assembly space, such
 * that a component's machine-side joint lands on its predecessor's cutting-side
 * joint.
 */
export function chainPlacements(chain: readonly JointPair[]): Matrix[] {
  const placements: Matrix[] = [];
  // Where the next component's machine-side joint has to land.
  let frontier = identity();

  for (const [machineSide, cuttingSide] of chain) {
    const placement = multiply(frontier, invertRigid(machineSide));
    placements.push(placement);
    frontier = multiply(placement, cuttingSide);
  }

  return placements;
}

/**
 * Distance from the assembly datum to the final cutting-side joint.
 *
 * This is the real stack-up: the gauge length implied by geometry and joints,
 * rather than a sum of nominal component lengths.
 */
export function assemblyLength(chain: readonly JointPair[]): number {
  if (chain.length === 0) return 0;

  const placements = chainPlacements(chain);
  const last = chain[chain.length - 1];
  const tip = multiply(placements[placements.length - 1], last[1]);
  const [x, y, z] = originOf(tip);
  return Math.sqrt(x * x + y * y + z * z);
}
