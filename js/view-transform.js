// View rotation math for js/canvas-view.js. The canvas wrapper is drawn
// with `translate(pan) rotate(rotation) scale(scale)` from origin 0 0, so
// a point in the wrapper's own (unscaled CSS px) space maps to the
// container as pan + R(rotation) * (scale * local). Every screen <-> canvas
// conversion goes through these instead of getBoundingClientRect() ratios,
// which stop working once the canvas is turned. DOM-free, unit-tested in
// test/view-transform.test.js. Angles are degrees, clockwise on screen.

const SNAP_DEGREES = 6;

function rotate({ x, y }, degrees) {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** A wrapper-local point to container coordinates under `view` ({ panX, panY, scale, rotation }). */
export function localToContainer(local, view) {
  const turned = rotate({ x: local.x * view.scale, y: local.y * view.scale }, view.rotation);
  return { x: view.panX + turned.x, y: view.panY + turned.y };
}

/** A container point to wrapper-local coordinates - the inverse of localToContainer. */
export function containerToLocal(point, view) {
  const unturned = rotate({ x: point.x - view.panX, y: point.y - view.panY }, -view.rotation);
  return { x: unturned.x / view.scale, y: unturned.y / view.scale };
}

/**
 * The view after zooming to `scale` and turning by `deltaDegrees`, such
 * that the local point under container point `from` ends up under `to`
 * (the same point for a plain zoom/rotate; a pinch's old and new
 * midpoints to pan in the same gesture).
 */
export function transformAround(view, from, to, scale, deltaDegrees) {
  const anchor = containerToLocal(from, view);
  const rotation = view.rotation + deltaDegrees;
  const turned = rotate({ x: anchor.x * scale, y: anchor.y * scale }, rotation);
  return { panX: to.x - turned.x, panY: to.y - turned.y, scale, rotation };
}

/** `degrees` in [0, 360), pulled to the nearest right angle when within 6 degrees of it. */
export function snapAngle(degrees) {
  const normal = ((degrees % 360) + 360) % 360;
  const nearest = Math.round(normal / 90) * 90;
  return Math.abs(normal - nearest) <= SNAP_DEGREES ? nearest % 360 : normal;
}

/** The signed turn from angle `from` to angle `to`, in (-180, 180]. */
export function angleDelta(from, to) {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** The bounding box of a width x height rectangle turned by `degrees`. */
export function rotatedSize(width, height, degrees) {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

/**
 * The pan that centres a width x height (wrapper-local) box, at `scale`
 * and `rotation`, on the middle of `area` ({ x, y, width, height }).
 */
export function centredPan(area, width, height, scale, rotation) {
  const turned = rotate({ x: (width / 2) * scale, y: (height / 2) * scale }, rotation);
  return { panX: area.x + area.width / 2 - turned.x, panY: area.y + area.height / 2 - turned.y };
}
