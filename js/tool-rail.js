// Tool rail selection state (5c-floating-tool-rail) and which tools it
// shows (Customize Tools, js/rail-tools.js). Kept free of DOM
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

/**
 * Puts the tool buttons in `rail` order before `anchor` (the ⋯ button,
 * or the end when null), then the rest with the `off-rail` class, which
 * hides them. Moving the nodes keeps their listeners. `.hidden` and
 * `disabled` belong to the embed's enabledTools (js/workspace.js) and
 * are left alone. A hidden button still works: the bare-letter shortcuts
 * call its .click(), and the ⋯ menu forwards to it.
 */
export function applyRailTools(container, rail, anchor = null) {
  const buttons = [...container.querySelectorAll('.tool-button[data-tool]')];
  const onRail = (button) => rail.includes(button.dataset.tool);
  const ordered = [
    ...rail.map((id) => buttons.find((b) => b.dataset.tool === id)).filter(Boolean),
    ...buttons.filter((b) => !onRail(b)),
  ];
  for (const button of ordered) {
    container.insertBefore(button, anchor);
    button.classList.toggle('off-rail', !onRail(button));
  }
}
