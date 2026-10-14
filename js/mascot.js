// Mascot bubble - Pixi's axolotl pops up top-centre for a few seconds
// when the user picks a tool, playing that tool's short sprite loop.
// Not every tool has one yet; each tool gets its own strip in assets/mascot/
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
export const MASCOT_SPRITES = {
  pencil: { frames: 5 },
  eraser: { frames: 5 },
  bucket: { frames: 5 },
  brush: { frames: 5 },
  rectangle: { frames: 5 },
  line: { frames: 5 },
};
export const MASCOT_TOOLS = Object.keys(MASCOT_SPRITES);

/**
 * Pure mascot lifetime. toolPicked(tool, previousTool) shows the bubble
 * for `tool` if it has a mascot and isn't already the active tool, and
 * hides it MASCOT_DURATION later; picking any other tool hides it at once.
 * While isEnabled() is false (the Show Mascot pref is off) a pick only
 * hides it.
 */
export function createMascotController({
  tools = MASCOT_TOOLS,
  isEnabled = () => true,
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
    if (!isEnabled() || !tools.includes(tool)) return;
    showing = true;
    onShow(tool);
    timer = setTimer(hide, MASCOT_DURATION);
  }

  return { toolPicked, hide };
}

let controller = null;

/**
 * Builds the bubble inside `screen` and returns the controller.
 * `isEnabled` is read on every pick (js/app.js passes the Show Mascot pref).
 */
export function initMascot(screen, { isEnabled } = {}) {
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
    isEnabled,
    onShow(tool) {
      bubble.classList.remove('is-visible');
      // Pops in once its sprite has loaded, so a first pick never flashes
      // the previous tool's frame.
      strip.onload = () => {
        strip.onload = null;
        sprite.style.setProperty('--mascot-frames', MASCOT_SPRITES[tool].frames);
        // Restart the frame loop and the pop-in from frame 1.
        void bubble.offsetWidth;
        bubble.classList.add('is-visible');
      };
      const src = `assets/mascot/${tool}.png`;
      if (strip.getAttribute('src') === src && strip.complete) strip.onload();
      else strip.src = src;
    },
    onHide() {
      strip.onload = null;
      bubble.classList.remove('is-visible');
    },
  });
  return controller;
}

/** Called from the tool buttons' click handler (js/workspace.js). */
export function mascotToolPicked(tool, previousTool) {
  controller?.toolPicked(tool, previousTool);
}
