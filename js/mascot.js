// Mascot bubble - Pixi's axolotl pops up top-centre for a few seconds
// when the user picks a tool, playing that tool's short sprite loop.
// Pencil only for now; each tool gets its own strip in assets/mascot/
// (256 x 256 frames side by side - specs in docs/mascot/README.md).
//
// Purely decorative: aria-hidden, never takes pointer input (so it can't
// block drawing), and lives inside #screen-workspace so hide-all-UI hides
// it with everything else.
//
// Split like js/toast.js: createMascotController() is the pure show/hide
// timing, unit-tested in test/mascot.test.js; initMascot() renders it.

export const MASCOT_DURATION = 3000;
// Tool id -> frame count of assets/mascot/<tool>.png.
export const MASCOT_SPRITES = { pencil: { frames: 5 } };
export const MASCOT_TOOLS = Object.keys(MASCOT_SPRITES);

/**
 * Pure mascot lifetime. toolPicked(tool, previousTool) shows the bubble
 * for `tool` if it has a mascot and isn't already the active tool, and
 * hides it MASCOT_DURATION later; picking any other tool hides it at once.
 */
export function createMascotController({
  tools = MASCOT_TOOLS,
  onShow = () => {},
  onHide = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let timer = null;
  let showing = false;

  function hide() {
    if (timer != null) clearTimer(timer);
    timer = null;
    if (!showing) return;
    showing = false;
    onHide();
  }

  function toolPicked(tool, previousTool) {
    if (tool === previousTool) return;
    hide();
    if (!tools.includes(tool)) return;
    showing = true;
    onShow(tool);
    timer = setTimer(hide, MASCOT_DURATION);
  }

  return { toolPicked, hide };
}

let controller = null;

/** Builds the bubble inside `screen` and returns the controller. */
export function initMascot(screen) {
  const bubble = document.createElement('div');
  bubble.className = 'mascot-bubble glass';
  bubble.setAttribute('aria-hidden', 'true');
  // A window one frame wide; the strip inside it slides frame by frame.
  const sprite = document.createElement('div');
  sprite.className = 'mascot-sprite';
  const strip = document.createElement('img');
  strip.className = 'mascot-strip';
  strip.alt = '';
  sprite.append(strip);
  bubble.append(sprite);
  screen.append(bubble);

  controller = createMascotController({
    onShow(tool) {
      strip.src = `assets/mascot/${tool}.png`;
      sprite.style.setProperty('--mascot-frames', MASCOT_SPRITES[tool].frames);
      // Restart the frame loop and the pop-in from frame 1.
      bubble.classList.remove('is-visible');
      void bubble.offsetWidth;
      bubble.classList.add('is-visible');
    },
    onHide() {
      bubble.classList.remove('is-visible');
    },
  });
  return controller;
}

/** Called from the tool buttons' click handler (js/workspace.js). */
export function mascotToolPicked(tool, previousTool) {
  controller?.toolPicked(tool, previousTool);
}
