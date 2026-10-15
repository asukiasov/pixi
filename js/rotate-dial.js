// The Rotate popover's dial (bezel), js/transform-ui.js. Dragged around
// its centre or stepped with the arrow keys; the angle is whole degrees
// in (-180, 180], positive clockwise, and sticks to every 15° mark from
// 3° away. The pure helpers are unit-tested (test/rotate-dial.test.js);
// initRotateDial wires them to the [role=slider] element.

const SNAP_STEP = 15;
const SNAP_WITHIN = 3;

/** `deg` wrapped into (-180, 180]. */
export function wrapAngle(deg) {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a + 0; // + 0 turns -0 into 0
}

/** `deg` moved onto the nearest 15° mark if it's within 3° of it. */
export function snapAngle(deg) {
  const mark = Math.round(deg / SNAP_STEP) * SNAP_STEP;
  return Math.abs(deg - mark) <= SNAP_WITHIN ? wrapAngle(mark) : deg;
}

/** The angle of (x, y) around (cx, cy) in degrees - 0 right, 90 down. */
export function pointerAngle(cx, cy, x, y) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** How far `to` is from `from`, the short way round. */
export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

/**
 * Wires the dial. `onInput(deg)` fires on every drag move that changes
 * the angle (for a cheap preview), `onChange(deg)` when a drag ends and
 * on each key step (for the real one). `set(deg)` updates the dial
 * without firing either. Ignores input while aria-disabled="true".
 */
export function initRotateDial(el, { onInput, onChange }) {
  const readout = el.querySelector('.rotate-dial-value');
  let value = 0;
  // Unsnapped, unrounded angle while dragging, so snapping never sticks.
  let raw = 0;
  let lastPointer = null;
  let centre = null;

  function show() {
    el.style.setProperty('--dial-angle', `${value}deg`);
    readout.textContent = `${value}°`;
    el.setAttribute('aria-valuenow', String(value));
    el.setAttribute('aria-valuetext', `${value} degrees`);
  }

  function setValue(next) {
    if (next === value) return false;
    value = next;
    show();
    return true;
  }

  const disabled = () => el.getAttribute('aria-disabled') === 'true';

  el.addEventListener('pointerdown', (e) => {
    if (disabled()) return;
    const r = el.getBoundingClientRect();
    centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lastPointer = pointerAngle(centre.x, centre.y, e.clientX, e.clientY);
    raw = value;
    el.setPointerCapture(e.pointerId);
    el.focus();
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (lastPointer === null) return;
    const now = pointerAngle(centre.x, centre.y, e.clientX, e.clientY);
    raw = wrapAngle(raw + angleDelta(lastPointer, now));
    lastPointer = now;
    if (setValue(snapAngle(Math.round(raw)))) onInput(value);
  });

  const endDrag = () => {
    if (lastPointer === null) return;
    lastPointer = null;
    onChange(value);
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('keydown', (e) => {
    if (disabled()) return;
    const step = e.shiftKey ? SNAP_STEP : 1;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    let next;
    if (delta !== undefined) next = wrapAngle(value + delta);
    else if (e.key === 'Home') next = 0;
    else return;
    e.preventDefault();
    if (setValue(next)) onChange(value);
  });

  show();
  return {
    get value() {
      return value;
    },
    set(deg) {
      setValue(wrapAngle(deg));
    },
  };
}
