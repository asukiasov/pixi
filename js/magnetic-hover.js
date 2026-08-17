// iOS 26 / Apple Pencil-style "magnetic hover" for the top bar and tool
// rail buttons - trialed first with a plain mouse enabled on desktop
// (to evaluate without an iPad on hand), then restricted to iOS/iPadOS
// only once approved (openspec/changes/restrict-magnetic-hover-to-ios)
// - a desktop mouse produces no effect at all now.
//
// Mechanics: while the pointer is within ACTIVATION_RADIUS px of a
// registered button's center, the single nearest such button (see
// "Exclusive activation" in the spec - at most one button reacts at a
// time, even when two buttons' radii overlap) translates toward the
// pointer and scales up smoothly (1.0x at the radius edge, growing to
// 1.05x at dead-center/direct hover). Outside the radius, or once a
// closer button takes over, it eases back to rest via a CSS transition -
// this module only ever sets custom properties/classes, never animates
// directly. No glow, by design.

const ACTIVATION_RADIUS = 45; // px, from button center
const MAX_PULL = 4.5; // px, translation at the edge of the radius
const MAX_SCALE_BUMP = 0.05; // scale grows from 1.0x (edge) to 1 + this (center)

/**
 * Wires the magnetic-hover proximity effect to every element in `els`.
 * A single shared `pointermove` listener drives all of them - cheap
 * enough at toolbar scale (a handful of buttons) that looping per move
 * beats attaching one listener per button. Disabled elements (e.g.
 * Undo/Redo before there's history) are skipped on each move, so a
 * button that becomes enabled while the pointer is already nearby picks
 * up the effect on the very next move without needing the pointer to
 * re-enter the radius.
 */
export function initMagneticHover(els) {
  // iOS/iPadOS only - see js/app.js for how this class is computed
  // (UA + touch-points heuristic, the only reliable way to distinguish
  // Apple Pencil hover from a desktop mouse, since both report
  // `pointer: fine`). Checked once at init, not per-event: the class is
  // set once at boot and never changes during a session.
  if (!document.documentElement.classList.contains('ios-platform')) return;

  const elements = Array.from(els ?? []).filter(Boolean);
  if (elements.length === 0) return;

  // Raw pointermove events can fire far more often than the display
  // refreshes (especially for Apple Pencil hover input). The actual
  // read/write pass below - getBoundingClientRect() per button, then
  // style writes - only needs to happen once per rendered frame, so it's
  // coalesced through requestAnimationFrame: each pointermove just
  // records the latest coordinates (no layout work) and schedules a
  // single pending rAF; the rAF callback does the real pass using
  // whatever coordinates were most recent by the time it runs.
  let pendingX = 0;
  let pendingY = 0;
  let rafId = null;

  function runPass(x, y) {
    // Pass 1: find the nearest in-range, enabled button. Distances are
    // recorded per element so pass 2 doesn't recompute them.
    let closest = null;
    let closestDistance = Infinity;
    const distances = new Map();

    for (const el of elements) {
      if (el.disabled) continue;

      const rect = el.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance > ACTIVATION_RADIUS) continue;

      distances.set(el, { dx, dy, distance });
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = el;
      }
    }

    // Pass 2: only the closest button reacts; every other one is at rest.
    for (const el of elements) {
      if (el !== closest) {
        el.classList.remove('magnetic-active');
        continue;
      }

      const { dx, dy, distance } = distances.get(el);
      // 0 at dead-center, 1 at the radius edge.
      const pull = distance / ACTIVATION_RADIUS;
      const pullX = distance === 0 ? 0 : (dx / distance) * pull * MAX_PULL;
      const pullY = distance === 0 ? 0 : (dy / distance) * pull * MAX_PULL;
      const scale = 1 + MAX_SCALE_BUMP * (1 - pull);

      el.style.setProperty('--pull-x', `${pullX}px`);
      el.style.setProperty('--pull-y', `${pullY}px`);
      el.style.setProperty('--pull-scale', scale.toFixed(4));
      el.classList.add('magnetic-active');
    }
  }

  // Listens on document, not each button's own parent: proximity should
  // trigger from any direction (e.g. approaching from the canvas below
  // the topbar), and scoping to a container the pointer isn't
  // necessarily inside of would mean pointermove events over sibling
  // containers never bubble to the listener at all.
  document.addEventListener('pointermove', (e) => {
    pendingX = e.clientX;
    pendingY = e.clientY;

    if (rafId !== null) return; // a pass is already scheduled for this frame
    rafId = requestAnimationFrame(() => {
      rafId = null;
      runPass(pendingX, pendingY);
    });
  });

  document.addEventListener('pointerleave', () => {
    // Cancel any pass still waiting on the next frame so it can't run
    // after the leave and re-add `.magnetic-active` on top of this clear.
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    for (const el of elements) {
      el.classList.remove('magnetic-active');
    }
  });
}
