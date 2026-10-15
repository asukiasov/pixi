# Show Mascot Pref Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Prefs switch that turns the tool mascot bubble off.

**Architecture:** New `showMascot` boolean in `js/prefs.js`; the pure
mascot controller takes an `isEnabled` callback; `js/app.js` wires it to
the pref and hides a showing bubble when the pref goes off.

**Tech Stack:** Vanilla ES modules, `node --test`.

Design: `docs/superpowers/specs/2026-10-14-mascot-pref-design.md`.

## Global Constraints

- Default on; invalid stored values fall back to `true`.
- Label "Show Mascot", note "Pixi's axolotl pops up for a few seconds when you pick a tool."
- Standalone app only (prefs are never loaded by `Pixi.mount()` embeds).

---

### Task 1: `showMascot` pref

**Files:** Modify `js/prefs.js`; Test `test/prefs.test.js`

**Produces:** `Prefs.showMascot: boolean`, `DEFAULT_PREFS.showMascot === true`.

- [ ] Add `showMascot: true` to the defaults test, `showMascot: false` to the round-trip prefs, and to "each field falls back on its own":
  `assert.equal(normalizePrefs({ showMascot: 'no' }).showMascot, true);`
  `assert.equal(normalizePrefs({ showMascot: false }).showMascot, false);`
- [ ] `npm test` → FAIL in prefs tests.
- [ ] Add to typedef, `DEFAULT_PREFS` (`showMascot: true`) and `normalizePrefs`
  (`showMascot: typeof source.showMascot === 'boolean' ? source.showMascot : DEFAULT_PREFS.showMascot`).
- [ ] `npm test` → PASS.

### Task 2: Controller `isEnabled`

**Files:** Modify `js/mascot.js`; Test `test/mascot.test.js`

**Produces:** `createMascotController({ isEnabled = () => true, ... })`;
`initMascot(screen, { isEnabled } = {})` returns the controller.

- [ ] Tests:
  - disabled: `toolPicked('pencil', 'eraser')` emits nothing;
  - showing, then disabled, then `toolPicked('pencil', 'eraser')`... (tool change) emits only `['hide']`;
  - re-enabled: next pick shows again.
- [ ] `npm test` → FAIL.
- [ ] In `toolPicked`, after `hide()`: `if (!isEnabled() || !tools.includes(tool)) return;`. Pass `isEnabled` through `initMascot`.
- [ ] `npm test` → PASS.

### Task 3: Prefs sheet switch + wiring + docs

**Files:** `index.html` (Tools section), `js/prefs-sheet.js`, `js/app.js`,
`docs/specs/tool-mascot/spec.md`, `docs/ui-reference.md`,
`docs/mascot/README.md`, `docs/roadmap.md`

- [ ] Markup after the Customize Tools row, in its own `.prefs-group`:
  `<label class="prefs-row"><span class="prefs-row-label">Show Mascot</span><input type="checkbox" role="switch" class="prefs-switch" id="prefs-show-mascot" name="showMascot" aria-describedby="prefs-show-mascot-note"></label>` + `<p id="prefs-show-mascot-note" class="prefs-note">…</p>`.
- [ ] `prefs-sheet.js`: sync `showMascot.checked`, include in `read()`.
- [ ] `app.js`: `const mascot = initMascot(screens.workspace, { isEnabled: () => prefs.showMascot });`
  and in `setPrefs`: `if (!prefs.showMascot) mascot?.hide();` (mascot is
  initialised later in the file, so `let mascot = null` declared before `setPrefs`).
- [ ] Docs: spec requirement "Can be turned off" with two scenarios; Prefs entry and mascot entry in ui-reference; one line in mascot README and roadmap.
- [ ] Manual check in the local server: toggle off → picks show nothing; off while showing → hides; on → next pick shows.
- [ ] `web-design-guidelines` pass on the markup; commit.
