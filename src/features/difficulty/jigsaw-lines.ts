/**
 * Generates the SVG path data for a realistic jigsaw-cut overlay over the
 * difficulty preview.
 *
 * The preview is divided into a `dim × dim` grid. Every internal boundary (a
 * vertical line at a column edge or a horizontal line at a row edge) is drawn
 * as a single continuous path whose knobs alternate between the two neighbour
 * cells, so the image reads as being cut into interlocking pieces. The outer
 * border stays a clean rectangle, and corner/edge pieces never grow knobs that
 * stick out of the frame.
 *
 * Coordinates are expressed in cell units (`0..dim`) and the host SVG uses a
 * `viewBox="0 0 dim dim"` with `preserveAspectRatio="none"`, so the strokes
 * stretch to fill whatever the preview happens to measure without the paths
 * needing pixel dimensions.
 */

/** How far a knob bulges out of its cell edge, in cell units. */
const KNOB = 0.26;
/** Flat run left at each corner of a cell so adjacent knobs never touch. */
const FLAT = 0.16;

/**
 * One vertical boundary at column `x` spanning the full height. Knob direction
 * alternates per cell and is phase-shifted per column so adjacent columns
 * interlock like real puzzle tabs.
 */
function verticalPath(x: number, dim: number): string {
  let d = `M ${x} 0`;
  for (let c = 0; c < dim; c++) {
    const y0 = c;
    const y1 = c + 1;
    const left = (x % 2 === 0 ? c : c + 1) % 2 === 0;
    d += ` L ${x} ${y0 + FLAT}`;
    d += left
      ? ` C ${x - KNOB} ${y0 + FLAT}, ${x - KNOB} ${y1 - FLAT}, ${x} ${y1 - FLAT}`
      : ` C ${x + KNOB} ${y0 + FLAT}, ${x + KNOB} ${y1 - FLAT}, ${x} ${y1 - FLAT}`;
  }
  d += ` L ${x} ${dim}`;
  return d;
}

/** One horizontal boundary at row `y` spanning the full width. */
function horizontalPath(y: number, dim: number): string {
  let d = `M 0 ${y}`;
  for (let c = 0; c < dim; c++) {
    const x0 = c;
    const x1 = c + 1;
    const up = (y % 2 === 0 ? c : c + 1) % 2 === 0;
    d += ` L ${x0 + FLAT} ${y}`;
    d += up
      ? ` C ${x0 + FLAT} ${y - KNOB}, ${x1 - FLAT} ${y - KNOB}, ${x1 - FLAT} ${y}`
      : ` C ${x0 + FLAT} ${y + KNOB}, ${x1 - FLAT} ${y + KNOB}, ${x1 - FLAT} ${y}`;
  }
  d += ` L ${dim} ${y}`;
  return d;
}

export interface JigsawLines {
  /** Cells per row/column, i.e. `√pieces` rounded to an integer. */
  dim: number;
  /** Internal vertical boundaries, one path string per column. */
  verticals: string[];
  /** Internal horizontal boundaries, one path string per row. */
  horizontals: string[];
  /** The clean rectangular outer frame. */
  outer: string;
}

/** Build the overlay paths for a `dim × dim` jigsaw cut. */
export function jigsawLines(dim: number): JigsawLines {
  const verticals: string[] = [];
  const horizontals: string[] = [];
  for (let i = 1; i < dim; i++) {
    verticals.push(verticalPath(i, dim));
    horizontals.push(horizontalPath(i, dim));
  }
  const outer = `M 0 0 H ${dim} V ${dim} H 0 Z`;
  return { dim, verticals, horizontals, outer };
}
