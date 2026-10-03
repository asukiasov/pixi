// Tool rail selection state (5c-floating-tool-rail). Kept free of DOM
// globals so it can be unit-tested without a browser (see
// test/tool-rail.test.js).

/**
 * Marks the button for `currentTool` as the selected tool - the `.active`
 * class for the visual state and `aria-pressed` for assistive technology -
 * and every other button as not selected. A disabled button (a tool an
 * embed has restricted away) is never marked selected.
 */
export function syncToolButtons(buttons, currentTool) {
  for (const button of buttons) {
    const selected = !button.disabled && button.dataset.tool === currentTool;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}
