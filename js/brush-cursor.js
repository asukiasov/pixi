// Brush cursor: the outline of exactly the pixels the next dab would
// paint, shown under a hovering mouse or Apple Pencil. DOM-free so it's
// unit-testable (test/brush-cursor.test.js); js/workspace.js picks the
// footprint and js/canvas-view.js draws the path in its SVG overlay.

import { circleOffsets } from '../lib/pixel-engine/engine.js';

const SINGLE_PIXEL_TOOLS = new Set(['line', 'rectangle', 'ellipse', 'bucket', 'eyedropper']);

/**
 * The [dx, dy] cells, relative to the pointer's pixel, that `tool` would
 * paint next, or null for tools that don't paint (Move, Select, Hand).
 * Pencil/Eraser use their circular tip; Brush its pattern, centred as
 * placeBrush centres it, at the first dab's angle (0).
 */
export function cursorFootprint(tool, { pencilSize = 1, brush = null } = {}) {
  if (tool === 'pencil' || tool === 'eraser') return circleOffsets(pencilSize);
  if (tool === 'brush' && brush) {
    const left = Math.floor(brush.width / 2);
    const top = Math.floor(brush.height / 2);
    return brush.pixels.map(([x, y]) => [x - left, y - top]);
  }
  if (tool === 'brush' || SINGLE_PIXEL_TOOLS.has(tool)) return [[0, 0]];
  return null;
}

/**
 * An SVG path (`d`, in pixel units) tracing the boundary of `cells`: one
 * closed loop per outline - the outside, plus one per hole - with
 * collinear edges joined, so a stroke along it joins cleanly at corners.
 */
export function footprintOutlinePath(cells) {
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  const inSet = (x, y) => has.has(`${x},${y}`);

  // Boundary edges, clockwise around each cell (y grows downward), keyed
  // by start vertex. Cells in reading order, so the first loop starts at
  // the top-left corner of the topmost-leftmost cell.
  const order = [...cells].sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  const edges = new Map();
  const addEdge = (x0, y0, x1, y1) => {
    const key = `${x0},${y0}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([x1, y1]);
  };
  for (const [x, y] of order) {
    if (!inSet(x, y - 1)) addEdge(x, y, x + 1, y);
    if (!inSet(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
    if (!inSet(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
    if (!inSet(x - 1, y)) addEdge(x, y + 1, x, y);
  }

  let d = '';
  for (const [startKey, outs] of edges) {
    while (outs.length) {
      const loop = [startKey.split(',').map(Number)];
      let [x, y] = outs.shift();
      while (`${x},${y}` !== startKey) {
        loop.push([x, y]);
        const next = edges.get(`${x},${y}`);
        [x, y] = next.shift();
      }
      d += loopPath(loop);
    }
  }
  return d;
}

/** `M…H…V…Z` for a closed loop of axis-aligned vertices, dropping collinear ones. */
function loopPath(vertices) {
  const n = vertices.length;
  const corners = vertices.filter((cur, i) => {
    const prev = vertices[(i + n - 1) % n];
    const next = vertices[(i + 1) % n];
    return !((prev[0] === cur[0] && cur[0] === next[0]) || (prev[1] === cur[1] && cur[1] === next[1]));
  });
  let path = `M${corners[0][0]} ${corners[0][1]}`;
  for (let i = 1; i < corners.length; i++) {
    const [x, y] = corners[i];
    path += x !== corners[i - 1][0] ? `H${x}` : `V${y}`;
  }
  return `${path}Z`;
}
