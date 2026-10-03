// Floating layout's tool-options bar (5d-tool-options-bar). Wired once
// from js/app.js, only in the floating layout.
//
// Every bar control is a proxy for an existing control (data-forward="<id>"):
// buttons forward their click, sliders forward their value. State is read
// back from the source, never stored here, so each setting keeps the one
// code path it has in the docked layout. Which groups show for which tool
// is CSS-only (data-tools on each group, data-current-tool on the
// workspace screen). 5h deletes the sources and can make these the real
// controls.

/** Parses a group's `data-tools` value into the set of tool names it shows for. */
export function toolsShowing(attr) {
  return new Set((attr ?? '').split(/\s+/).filter(Boolean));
}

/**
 * Copies a proxy slider's value to its source and dispatches the event the
 * source's listener expects. The source's own clamping runs in that
 * listener, so its result is read back into the proxy.
 */
export function forwardValue(proxy, source, eventType) {
  source.value = proxy.value;
  source.dispatchEvent(new Event(eventType, { bubbles: true }));
  proxy.value = source.value;
}

const MIRRORED_ATTRIBUTES = ['aria-label', 'data-tooltip', 'data-symmetry-mode'];

/** Copies a source toggle's on/off state, label and symmetry mode onto its proxy. */
export function mirrorToggle(source, proxy) {
  proxy.setAttribute('aria-pressed', String(source.classList.contains('active')));
  for (const name of MIRRORED_ATTRIBUTES) {
    if (source.hasAttribute(name)) proxy.setAttribute(name, source.getAttribute(name));
    else proxy.removeAttribute(name);
  }
}

/**
 * @param {{ root?: ParentNode, bindSliderWheel: (slider: HTMLInputElement) => void }} options
 *   `bindSliderWheel` is js/workspace.js's, passed in so this module stays
 *   importable by its unit tests (workspace.js needs a DOM at load).
 */
export function initToolOptionsBar({ root = document, bindSliderWheel }) {
  const bar = root.querySelector('#tool-options-bar');
  const screen = root.querySelector('.workspace-screen');
  if (!bar || !screen) return;
  const sourceOf = (proxy) => root.querySelector(`#${proxy.dataset.forward}`);

  for (const proxy of bar.querySelectorAll('button[data-forward]')) {
    const source = sourceOf(proxy);
    if (!source) continue;
    proxy.addEventListener('click', () => source.click());
    const mirror = () => mirrorToggle(source, proxy);
    new MutationObserver(mirror).observe(source, {
      attributes: true,
      attributeFilter: ['class', ...MIRRORED_ATTRIBUTES],
    });
    mirror();
  }

  const sliders = [];
  for (const proxy of bar.querySelectorAll('input[type="range"][data-forward]')) {
    const source = sourceOf(proxy);
    if (!source) continue;
    // Size/Opacity have a readout next to the source; Spacing/Rotation
    // (number fields) don't, so their unit lives on the proxy.
    const sourceReadout = source.parentElement.querySelector('.pencil-options-readout');
    const readout = proxy.parentElement.querySelector('.tool-options-readout');
    for (const name of ['min', 'max', 'step']) {
      if (source.hasAttribute(name)) proxy.setAttribute(name, source.getAttribute(name));
    }
    const slider = { proxy, source, readout, sourceReadout };
    sliders.push(slider);
    proxy.addEventListener('input', () => {
      forwardValue(proxy, source, proxy.dataset.forwardEvent);
      showReadout(slider);
    });
    if (sourceReadout) bindSliderWheel?.(proxy);
  }

  function showReadout({ proxy, source, readout, sourceReadout }) {
    const text = sourceReadout ? sourceReadout.textContent : `${source.value}${proxy.dataset.unit ?? ''}`;
    readout.textContent = text;
    proxy.setAttribute('aria-valuetext', text);
  }

  // A plain .value assignment on a source (initWorkspace()'s reset on
  // project open) fires no event, so values are re-read whenever the
  // current tool is recorded. initWorkspace() records it before resetting
  // the values; this observer's callback is a microtask, so it runs after
  // the whole synchronous initWorkspace() call.
  const refresh = () => {
    for (const slider of sliders) {
      slider.proxy.value = slider.source.value;
      showReadout(slider);
    }
  };
  new MutationObserver(refresh).observe(screen, { attributes: true, attributeFilter: ['data-current-tool'] });
  refresh();
}
