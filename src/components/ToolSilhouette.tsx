import type { ReactNode } from "react";
import {
  displayName,
  isBlockType,
  isColletRecord,
  type HolderSegment,
  type LibraryToolRecord,
} from "../data/realLibrary";

/**
 * A library record drawn from its own geometry.
 *
 * The snapshot carries no solids — the real ones are Shape Manager B-rep that
 * nothing outside Autodesk reads — so a record is drawn as the side view its
 * numbers describe: a drill gets its diameter, flute length and point angle, a
 * collet its bore, a turning tool its insert. That makes the preview specific to
 * the record rather than one stand-in shape for the whole library, and it
 * follows an edit as soon as the value changes.
 */

interface ToolSilhouetteProps {
  record: LibraryToolRecord;
  /** The editor's working geometry, so the drawing follows unsaved changes. */
  geometry?: Record<string, number | string | boolean>;
  className?: string;
}

const STEEL = "#c9ced6";
const STEEL_EDGE = "#98a3b3";
const BODY = "#b7cddc";
const BODY_EDGE = "#8ba6b9";
const CUT = "#e8c15c";
const CUT_EDGE = "#b8912f";

/** Where the part is drawn: axis, tip on the origin line, and a stroke width. */
interface Frame {
  cx: number;
  tip: number;
  sw: number;
}

interface Drawing {
  /** Widest and longest the part gets, in millimetres. */
  width: number;
  length: number;
  /** Draw upside down, so a part's wide end reads at the bottom. */
  flipV?: boolean;
  render: (frame: Frame) => ReactNode;
}

export function ToolSilhouette({ record, geometry, className }: ToolSilhouetteProps) {
  const geo = geometry ?? record.geometry;
  const drawing = drawingFor(record, geo);

  const viewWidth = Math.max(drawing.width * 2.6, drawing.length * 0.9);
  const viewHeight = drawing.length * 1.3;
  const frame: Frame = {
    cx: viewWidth / 2,
    tip: viewHeight * 0.88,
    sw: Math.max(viewWidth, viewHeight) * 0.0035,
  };

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label={`${displayName(record)} drawn from its library geometry`}
    >
      <line
        x1={frame.cx}
        y1={0}
        x2={frame.cx}
        y2={viewHeight}
        stroke="#1a1a1a"
        strokeWidth={frame.sw}
      />
      <line
        x1={0}
        y1={frame.tip}
        x2={viewWidth}
        y2={frame.tip}
        stroke="#1a1a1a"
        strokeWidth={frame.sw}
      />
      {drawing.flipV === true ? (
        // Mirror about the part's own centre so the wide end reads at the
        // bottom while the drawing stays within the same vertical band.
        <g transform={`translate(0, ${2 * frame.tip - drawing.length}) scale(1, -1)`}>
          {drawing.render(frame)}
        </g>
      ) : (
        drawing.render(frame)
      )}
      <circle cx={frame.cx} cy={frame.tip} r={frame.sw * 2.5} fill="#1a1a1a" />
    </svg>
  );
}

function num(
  geometry: Record<string, number | string | boolean>,
  key: string,
): number | null {
  const value = geometry[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * The size in the record's name, for records that carry no geometry.
 *
 * The prototype's own extensions and collets are named after the bore they take
 * — "Collet ⌀10" — which is the only size they state.
 */
function namedSize(record: LibraryToolRecord): number | null {
  const match = /[⌀ØøΦ]\s*(\d+(?:\.\d+)?)/.exec(displayName(record));
  return match === null ? null : Number(match[1]);
}

function drawingFor(
  record: LibraryToolRecord,
  geo: Record<string, number | string | boolean>,
): Drawing {
  const type = record.type;

  if (isBlockType(type)) return blockDrawing(geo);
  // Modern mill-drill adaptive items describe themselves as a stack of frusta
  // rather than as a fixed shape, so draw them exactly, machine side up.
  if (record.segments && record.segments.length > 0) {
    return segmentDrawing(record, record.segments);
  }
  // Collets and extensions can be typed either as their own kind or as a plain
  // "holder" that names itself in its description (e.g. "ER16 Collet"). Route
  // both to the dedicated drawing so they read as a collet or an extension
  // rather than as a generic holder.
  if (type === "collet" || isColletRecord(record)) return colletDrawing(record, geo);
  if (type === "extension" || /extension/i.test(displayName(record))) {
    // Extensions read machine-side down here, wide mounting end at the bottom.
    return { ...extensionDrawing(record, geo), flipV: true };
  }
  if (type === "holder") return holderDrawing(record.holder ?? geo);
  if (type.startsWith("turning") || "SC" in geo || "INSD" in geo) {
    return turningDrawing(record.holder ?? {}, geo);
  }
  if (type === "probe") return probeDrawing(geo);
  return rotatingDrawing(record, geo);
}

/* Adaptive items -------------------------------------------------------- */

/**
 * An adaptive item drawn from its exact profile.
 *
 * Fusion stores a mill-drill extension or collet as an ordered stack of frusta
 * (``segments`` on the record), machine side first and tip last. Each carries
 * its own height plus its upper (machine side) and lower (tip side) diameters,
 * so the whole part is a symmetric polygon around the tool axis. That gives a
 * silhouette that follows the real geometry rather than a stand-in shape.
 *
 * The bore is drawn on top only when the record calls itself a collet, since
 * an extension's own bore is where a collet drops into it and shows as a step
 * in the outer profile already.
 */
function segmentDrawing(
  record: LibraryToolRecord,
  segments: HolderSegment[],
): Drawing {
  const length = segments.reduce((sum, seg) => sum + Math.max(0, seg.height), 0);
  const width = segments.reduce(
    (widest, seg) =>
      Math.max(widest, Math.abs(seg["upper-diameter"]), Math.abs(seg["lower-diameter"])),
    0,
  );

  // Right-hand outline top-to-bottom (mount to nose), then mirrored back up.
  const rightSide: Array<[number, number]> = [];
  let y = 0;
  segments.forEach((seg) => {
    const top = Math.abs(seg["upper-diameter"]) / 2;
    const bottom = Math.abs(seg["lower-diameter"]) / 2;
    rightSide.push([top, y]);
    y += Math.max(0, seg.height);
    rightSide.push([bottom, y]);
  });

  const isCollet = isColletRecord(record);
  // Rough bore: the smallest diameter along the profile is what grips a tool.
  const bore = segments.reduce(
    (min, seg) =>
      Math.min(
        min,
        Math.abs(seg["upper-diameter"]) || Infinity,
        Math.abs(seg["lower-diameter"]) || Infinity,
      ),
    Infinity,
  );

  return {
    width,
    length: Math.max(length, width * 0.6),
    render: ({ cx, tip, sw }) => {
      const top = tip - length;
      const outline = [
        ...rightSide.map(([r, offset]) => `${cx + r},${top + offset}`),
        ...[...rightSide].reverse().map(([r, offset]) => `${cx - r},${top + offset}`),
      ].join(" ");

      // Slits on a real ER-style collet, so it reads differently from an
      // extension of similar profile.
      const slits =
        isCollet && Number.isFinite(bore) && bore > 0
          ? [0.25, 0.45, 0.65, 0.82].flatMap((at) => {
              const yLine = top + length * at;
              return [-1, 1].map((side) => (
                <line
                  key={`${at}-${side}`}
                  x1={cx + side * (bore / 2 + 0.4)}
                  y1={yLine}
                  x2={cx + side * (width / 2 - 0.4)}
                  y2={yLine}
                  stroke={BODY_EDGE}
                  strokeWidth={sw * 0.7}
                />
              ));
            })
          : null;

      return (
        <g>
          <polygon
            points={outline}
            fill={BODY}
            stroke={BODY_EDGE}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {isCollet && Number.isFinite(bore) && bore > 0 ? (
            <rect
              x={cx - bore / 2}
              y={top}
              width={bore}
              height={length}
              fill="#8fa3b3"
              stroke={BODY_EDGE}
              strokeWidth={sw}
            />
          ) : null}
          {slits}
        </g>
      );
    },
  };
}

/**
 * An ER-style collet, drawn to match its real silhouette: a short collar at the
 * top that flares to the collet's widest diameter, then a straight taper down to
 * a narrower nose, with the axial slots the collet closes on. No wide central
 * bore is drawn — the slots read the part as a collet on their own.
 */
function colletDrawing(
  record: LibraryToolRecord,
  geo: Record<string, number | string | boolean>,
): Drawing {
  const nominal = num(geo, "DC") ?? namedSize(record) ?? 12;
  const maxDia = Math.max(nominal * 2.0, nominal + 12);
  const length = num(geo, "OAL") ?? maxDia * 1.55;

  const collar = maxDia * 0.82; // top, just inside the widest point
  const flare = maxDia; // widest, a little below the top
  const nose = maxDia * 0.66; // bottom

  const flareY = 0.16; // where the widest point sits, from the top

  return {
    width: maxDia,
    length,
    render: ({ cx, tip, sw }) => {
      const top = tip - length;
      const flareLine = top + length * flareY;
      const half = (w: number) => w / 2;

      const outline = [
        `${cx - half(collar)},${top}`,
        `${cx + half(collar)},${top}`,
        `${cx + half(flare)},${flareLine}`,
        `${cx + half(nose)},${tip}`,
        `${cx - half(nose)},${tip}`,
        `${cx - half(flare)},${flareLine}`,
      ].join(" ");

      // Half of the outer edge at a given height, for clipping the slots.
      const edgeAt = (y: number): number => {
        if (y <= flareLine) {
          const t = (y - top) / (flareLine - top || 1);
          return (half(collar) + (half(flare) - half(collar)) * t) - sw * 1.5;
        }
        const t = (y - flareLine) / (tip - flareLine || 1);
        return (half(flare) + (half(nose) - half(flare)) * t) - sw * 1.5;
      };

      return (
        <g>
          <polygon
            points={outline}
            fill={BODY}
            stroke={BODY_EDGE}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* A groove near the top, where the nut bears on the collet. */}
          <line
            x1={cx - half(collar)}
            y1={top + length * 0.08}
            x2={cx + half(collar)}
            y2={top + length * 0.08}
            stroke={BODY_EDGE}
            strokeWidth={sw * 0.8}
          />
          {/* The axial slots the collet closes on, converging with the taper. */}
          {[-0.46, -0.15, 0.15, 0.46].map((frac) => {
            const yTop = top + length * 0.14;
            const yBot = tip - length * 0.06;
            const x = (y: number) => cx + frac * 2 * edgeAt(y);
            return (
              <line
                key={frac}
                x1={x(yTop)}
                y1={yTop}
                x2={x(yBot)}
                y2={yBot}
                stroke={BODY_EDGE}
                strokeWidth={sw * 0.8}
              />
            );
          })}
        </g>
      );
    },
  };
}

function extensionDrawing(
  record: LibraryToolRecord,
  geo: Record<string, number | string | boolean>,
): Drawing {
  const bore = num(geo, "DC") ?? namedSize(record) ?? 10;
  const length = num(geo, "OAL") ?? bore * 7;
  const flange = Math.max(bore * 3.2, bore + 20);
  const body = Math.max(bore * 2.2, bore + 10);
  const flangeLength = length * 0.18;

  return {
    width: flange,
    length,
    render: ({ cx, tip, sw }) => (
      <g>
        <rect
          x={cx - flange / 2}
          y={tip - length}
          width={flange}
          height={flangeLength}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        <rect
          x={cx - body / 2}
          y={tip - length + flangeLength}
          width={body}
          height={length - flangeLength}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        {/* The seat the collet drops into. */}
        <rect
          x={cx - bore / 2}
          y={tip - length * 0.55}
          width={bore}
          height={length * 0.55}
          fill="#8fa3b3"
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
      </g>
    ),
  };
}

/* Holders and turning tools --------------------------------------------- */

function holderDrawing(geo: Record<string, number | string | boolean>): Drawing {
  const length = num(geo, "OAL") ?? 90;
  const big = num(geo, "CW") ?? num(geo, "W") ?? length * 0.4;
  const nose = big * 0.5;
  const shoulder = length * 0.55;

  return {
    width: big,
    length,
    render: ({ cx, tip, sw }) => (
      <g>
        <rect
          x={cx - big / 2}
          y={tip - length}
          width={big}
          height={shoulder}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        <polygon
          points={[
            `${cx - big / 2},${tip - length + shoulder}`,
            `${cx + big / 2},${tip - length + shoulder}`,
            `${cx + nose / 2},${tip - length + shoulder + length * 0.12}`,
            `${cx - nose / 2},${tip - length + shoulder + length * 0.12}`,
          ].join(" ")}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        <rect
          x={cx - nose / 2}
          y={tip - length + shoulder + length * 0.12}
          width={nose}
          height={length - shoulder - length * 0.12}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
      </g>
    ),
  };
}

/**
 * A turning tool: the insert on the nose of its shank, seen from the front.
 *
 * The record's own `OAL` belongs to the insert, so the bar takes its length from
 * the holder the record carries.
 */
function turningDrawing(
  holder: Record<string, number | string | boolean>,
  geo: Record<string, number | string | boolean>,
): Drawing {
  const shank = num(holder, "H") ?? num(holder, "W") ?? 20;
  const insert = num(geo, "INSD") ?? num(geo, "S") ?? shank * 0.6;
  const length = num(holder, "OAL") ?? Math.max(num(geo, "OAL") ?? 0, insert * 6);

  return {
    width: Math.max(shank, insert * 1.4),
    length,
    render: ({ cx, tip, sw }) => (
      <g>
        <rect
          x={cx - shank / 2}
          y={tip - length}
          width={shank}
          height={length - insert}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        {/* The insert sits proud of the shank nose, its point on the origin. */}
        <polygon
          points={[
            `${cx},${tip}`,
            `${cx + insert * 0.7},${tip - insert}`,
            `${cx},${tip - insert * 2}`,
            `${cx - insert * 0.7},${tip - insert}`,
          ].join(" ")}
          fill={CUT}
          stroke={CUT_EDGE}
          strokeWidth={sw}
        />
      </g>
    ),
  };
}

/* Rotating tools --------------------------------------------------------- */

function probeDrawing(geo: Record<string, number | string | boolean>): Drawing {
  const length = num(geo, "OAL") ?? 100;
  const shaft = num(geo, "DC") ?? 6;
  const body = shaft * 3;
  const ball = shaft;

  return {
    width: body,
    length,
    render: ({ cx, tip, sw }) => (
      <g>
        <rect
          x={cx - body / 2}
          y={tip - length}
          width={body}
          height={length * 0.6}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        <rect
          x={cx - shaft / 4}
          y={tip - length * 0.4}
          width={shaft / 2}
          height={length * 0.4 - ball / 2}
          fill={STEEL}
          stroke={STEEL_EDGE}
          strokeWidth={sw}
        />
        <circle
          cx={cx}
          cy={tip - ball / 2}
          r={ball / 2}
          fill="#e2e8ef"
          stroke={STEEL_EDGE}
          strokeWidth={sw}
        />
      </g>
    ),
  };
}

/**
 * Drills, taps and mills: a shank above the cutting length, with the end shaped
 * by what the record is — a drill point, a ball nose, a chamfer or a flat.
 */
function rotatingDrawing(
  record: LibraryToolRecord,
  geo: Record<string, number | string | boolean>,
): Drawing {
  const type = record.type;
  const diameter = num(geo, "DC") ?? namedSize(record) ?? 10;
  const length = num(geo, "OAL") ?? diameter * 8;
  const cut = Math.min(num(geo, "LCF") ?? length * 0.45, length);
  const shaft = num(geo, "SFDM") ?? diameter;
  const corner = num(geo, "RE") ?? 0;
  const angle = num(geo, "SIG");
  const flutes = num(geo, "NOF") ?? 2;

  const isDrill = type === "drill" || type.startsWith("tap");
  const ball = type === "ball end mill" || corner >= diameter / 2 - 0.001;
  const chamfer = type === "chamfer mill";

  // A drill point is a cone of its point angle; 180° is flat.
  const point =
    isDrill && angle !== null && angle < 180
      ? diameter / 2 / Math.tan((angle / 2) * (Math.PI / 180))
      : 0;

  return {
    width: Math.max(diameter, shaft),
    length,
    render: ({ cx, tip, sw }) => {
      const cutTop = tip - cut;
      const end = ball ? (
        <path
          d={[
            `M ${cx - diameter / 2} ${cutTop}`,
            `L ${cx - diameter / 2} ${tip - diameter / 2}`,
            `A ${diameter / 2} ${diameter / 2} 0 0 0 ${cx + diameter / 2} ${tip - diameter / 2}`,
            `L ${cx + diameter / 2} ${cutTop}`,
            "Z",
          ].join(" ")}
          fill={CUT}
          stroke={CUT_EDGE}
          strokeWidth={sw}
        />
      ) : (
        <polygon
          points={[
            `${cx - diameter / 2},${cutTop}`,
            `${cx + diameter / 2},${cutTop}`,
            `${cx + diameter / 2},${tip - point - (chamfer ? cut * 0.25 : 0)}`,
            chamfer ? `${cx + diameter * 0.15},${tip}` : `${cx},${tip}`,
            chamfer ? `${cx - diameter * 0.15},${tip}` : `${cx},${tip}`,
            `${cx - diameter / 2},${tip - point - (chamfer ? cut * 0.25 : 0)}`,
          ].join(" ")}
          fill={CUT}
          stroke={CUT_EDGE}
          strokeWidth={sw}
        />
      );

      return (
        <g>
          <rect
            x={cx - shaft / 2}
            y={tip - length}
            width={shaft}
            height={length - cut}
            fill={STEEL}
            stroke={STEEL_EDGE}
            strokeWidth={sw}
          />
          {end}
          {fluteLines(cx, cutTop, tip - point, diameter, flutes, sw)}
        </g>
      );
    },
  };
}

/** Hints at the helix, so a three-flute tool reads differently from a two. */
function fluteLines(
  cx: number,
  top: number,
  bottom: number,
  diameter: number,
  flutes: number,
  sw: number,
): ReactNode {
  const span = bottom - top;
  if (span <= 0) return null;

  const steps = Math.max(2, Math.min(Math.round(flutes) + 2, 8));
  const rise = span / steps / 1.6;

  return (
    <g stroke={CUT_EDGE} strokeWidth={sw * 0.8} opacity="0.75">
      {Array.from({ length: steps }, (_, index) => {
        const at = top + (span * (index + 0.5)) / steps;
        // Cut the line where it would climb past the top of the flutes.
        const reach = Math.min(1, (at - top) / rise);
        return (
          <line
            key={index}
            x1={cx - diameter / 2}
            y1={at}
            x2={cx - diameter / 2 + diameter * reach}
            y2={at - rise * reach}
          />
        );
      })}
    </g>
  );
}

/** A tool block without a mesh: the body, with a seat for each tool it holds. */
function blockDrawing(geo: Record<string, number | string | boolean>): Drawing {
  const seats = Math.max(1, Math.round(num(geo, "numberOfTools") ?? 1));
  const width = 30 + seats * 22;
  const length = 60;

  return {
    width,
    length,
    render: ({ cx, tip, sw }) => (
      <g>
        <rect
          x={cx - width / 2}
          y={tip - length}
          width={width}
          height={length * 0.7}
          fill={BODY}
          stroke={BODY_EDGE}
          strokeWidth={sw}
        />
        {Array.from({ length: seats }, (_, index) => {
          const step = width / seats;
          const seatX = cx - width / 2 + step * (index + 0.5);
          return (
            <rect
              key={index}
              x={seatX - 7}
              y={tip - length * 0.3}
              width={14}
              height={length * 0.3}
              fill={STEEL}
              stroke={STEEL_EDGE}
              strokeWidth={sw}
            />
          );
        })}
      </g>
    ),
  };
}
