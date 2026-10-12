// Palm rejection ("Draw Only With Apple Pencil", js/prefs.js pencilOnly).
// DOM-free so it's unit-testable (test/pointer-policy.test.js);
// js/canvas-view.js acts on the result.

/**
 * What a new pointer on the canvas may do:
 * - 'normal': today's rules (first pointer draws or pans, a second
 *   one starts a pinch).
 * - 'pen': the Apple Pencil. It draws, and the caller drops any touch
 *   pointers already down - a palm that landed before the Pencil.
 * - 'gesture': a finger once a Pencil has been used. Never draws; one
 *   finger only pans with the Hand tool, two fingers pinch and pan.
 * - 'ignore': a touch while the Pencil is down (a palm). Can't draw,
 *   pinch or cancel the stroke.
 * A mouse, and every pointer with the pref off, is 'normal'. Until a
 * Pencil has touched the canvas, fingers are 'normal' too, so devices
 * without a Pencil never change.
 */
export function pointerDownAction({ pointerType, pencilOnly, penSeen, penDown }) {
  if (!pencilOnly || pointerType === 'mouse') return 'normal';
  if (pointerType === 'pen') return 'pen';
  if (!penSeen) return 'normal';
  return penDown ? 'ignore' : 'gesture';
}
