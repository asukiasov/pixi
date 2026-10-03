## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour. The user settled the visible choices before this
was written:

- no opt-out: the `layout` parameter is ignored and no UI switches
  layouts ("I don't care about the old design")
- floating at every width, with no docked fallback below tablet width
- in windows narrower than 600px, cards start closed on project open
- narrow-width fixes limited to reachability. Re-placing parts for
  phones stays the phone-layout follow-up

Current state that shapes the approach:

- **The switch.** `app.js` runs `resolveLayout(location.search)` once at
  boot, then `applyLayout(screens.workspace, layout)`. The same `layout`
  value gates, all in `app.js`:
  - `initFloatingTopbar`, `initToolOptionsBar` and `initPanelRail`
    (and `initSelectionBar` after 5f)
  - the `getClearInsets` option passed to `CanvasView`
- **Embeds.** `lib/pixi.js` imports `workspace.js`, `canvas-view.js` and
  `persistence.js`, but never `app.js` or `layout.js`. It never sets
  `data-layout`, so embeds are docked whatever the host URL is. Its own
  markup has none of the `.floating-only` elements.
- **Embeds crash today.** `Pixi.mount()` throws on mount because
  `lib/pixi.js`'s markup lacks `#record-toggle`, which `workspace.js`
  reads unconditionally (5d task 5.9, left open).
- **Measured in the current floating layout, 2026-10-03** (headless
  Chromium, new 32×32 canvas):
  - **1180×820 and 768×1024:** everything fits.
  - **390×844, cards:** the card column (15rem) spans x 68–308, over the
    tool rail (x 12–74). With Colors and Layers open, Fit leaves the
    canvas 32px wide, behind the cards.
  - **390×844, options bar:** `.slot-options`' `max-width` is 226px. The
    Pencil bar's Size and Opacity slider group doesn't wrap or shrink,
    so the sliders run past both edges of the bar and the screen.
  - **390×844, palette:** `#palette-row` already has `overflow-x: auto`,
    but `.options-card` grows to its content, so the row overflows the
    card instead of scrolling.
  - **390×844, top bar and rail:** both fit (top bar `scrollWidth ==
    clientWidth`, and the rail ends at y 661).
- **Fit order on project open.** On the first open, `CanvasView`'s
  constructor runs `resetView()`, then once more a frame later. On every
  later open, `setLayerStack()` runs `resetView()` *before*
  `initWorkspace()` resets the cards to open. So Fit uses the previous
  project's open cards, which contradicts "Fit to the clear area" ("the
  floating cards visible at that moment") once the cards differ.
- **Card state paths (5e).** Colors closes by a click forwarded to
  `#color-library-header`, Layers by a click on `#layers-panel-toggle`,
  and Brushes through `setBrushesCardOpen(false)`. `initWorkspace()`
  resets all three to open.

## Goals / Non-Goals

**Goals:**
- One layout for the standalone app, and no dead switch code left
  behind.
- Embeds byte-for-byte unchanged, with `lib/pixi.js` untouched.
- Narrow windows usable, by changing constraints (widths, wrapping,
  scrolling) rather than adding a narrow layout.
- Fit at project open always sees the cards that are actually open.

**Non-Goals:**
- Deleting docked CSS or markup, the source controls behind the
  proxies, the top bar toggles, or `.floating-only` scoping. Embeds
  still use all of it.
- Syncing the specs that describe the docked placement. The modified
  "Layout switch" states that `floating-workspace` takes precedence in
  the meantime.
- Fixing the embed crash.
- A phone layout, re-ordering parts, or bottom sheets.
- A user-facing layout preference. 5g has none either.

## Decisions

### 1. Hard-code the standalone layout; delete `resolveLayout`

`app.js` calls `applyLayout(screens.workspace, 'floating')` directly. The
`layout` constant and every `layout === 'floating'` condition go. The
floating modules are always initialised, and `CanvasView` always gets
`getClearInsets`. `resolveLayout` and its tests are deleted, because
nothing reads `location.search` for layout any more. `applyLayout` stays:
it is the one place that sets `data-layout`, and keeping it keeps the
CSS hook intact for embeds, which never call it.

- **Alternative: keep `resolveLayout` and make it return `'floating'`
  for everything.** Rejected. A function that ignores its input is dead
  code that looks alive, and its tests would only assert a constant.
- **Alternative: keep `?layout=docked` as a per-load escape hatch.** The
  user rejected any opt-out. It would also keep the standalone app tied
  to the docked CSS, which blocks deleting it later.
- **Alternative: drop the `data-layout` attribute and make the floating
  CSS unconditional.** Rejected. Embeds share `style.css`, and the
  attribute is what keeps them docked until the deletion change.

### 2. Narrow defaults: a pure decision plus the existing close paths

- `openCardDefaults(viewportWidth)` in `panel-rail.js` returns
  `{ colors, brushes, layers }`:
  - `true` for all three at 600px and wider
  - `false` for all three below 600px

  It is unit-tested at 599, 600, 390 and 1180.
- `applyOpenCardDefaults()` (exported, floating only) reads
  `window.innerWidth`, calls the helper, and closes each card that should
  be closed through the same forwarding paths the rail and the close
  buttons use. It never opens anything, because `initWorkspace()` has
  just opened all three.
- **Why 600px.** Portrait phones are under 600 CSS pixels. The smallest
  current iPad in portrait (744) and 768 keep 5e's defaults, which were
  verified there. The 600px value lives in one exported constant
  (`NARROW_MAX_WIDTH`), so the phone-layout follow-up can reuse it.
- **Width at open, not live.** Resizing never opens or closes cards
  (spec). A media-query listener would close a card the user just opened
  when they rotate the device.
- **Alternative: a CSS media query that hides cards below 600px.**
  Rejected. The mini-rail would show cards as open when they aren't
  shown, and the user couldn't open one on a narrow window. Open/closed
  must stay the cards' own state (5e decision 3).
- **Alternative: change `initWorkspace()`'s resets to read the width.**
  Rejected. `workspace.js` is shared with embeds, whose panels are docked
  sections with no open/closed semantics.

### 3. Fit after the resets

`openWorkspace()` in `app.js`, after `initWorkspace()` returns, calls
`applyOpenCardDefaults()` and then `canvasView.resetView();
canvasView.render()`.

- The earlier `resetView()` inside `setLayerStack()` and the constructor
  stay. They are harmless (the same canvas fitted twice, with no frame
  painted in between), and removing them would change `CanvasView`'s
  contract for embeds.
- The first-open one-frame-later re-fit stays too. It runs after this one
  and sees the same cards.
- This also fixes the existing wide-window case, where Fit used the
  previous project's cards.
- **Alternative: have `initWorkspace()` call `resetView()` at its end.**
  Rejected. `initWorkspace()` runs in embeds too, where the extra call
  would be the only behaviour change. Keeping it in `app.js` keeps embeds
  untouched.

### 4. Constraint fixes for narrow windows (CSS only, floating only)

- **Card column width.** `.right-sidebar`'s `width: 15rem` becomes
  `width: min(15rem, var(--slot-cards-room))`, where `--slot-cards-room`
  is `100%` minus the tool rail's reach (`--slot-tools-start +
  --slot-rail-width + --float-gap`), minus `--slot-cards-end`, minus
  `--float-gap`.
  - It is built from the same start/end variables, so 5g's handedness
    swap keeps it correct.
  - The collapsed-state rule's `15rem` gets the same treatment.
  - At 390px this gives about 226px, enough for Layers' blend select
    and opacity button side by side. If the browser check finds Layers'
    toolbar row wrapping awkwardly, the row may wrap. Its controls stay
    44px either way.
- **Tool-options bar.**
  - `#tool-options-bar` and its groups get `flex-wrap: wrap`, plus
    `min-width: 0` and `max-width: 100%`.
  - The size/opacity and spacing/rotation groups also wrap, so their two
    sliders stack when they don't fit side by side.
  - The range input becomes `flex: 1 1 7rem; min-width: 4rem` instead of
    a fixed `7rem`, keeping its 44px hit height.
  - At 1180 and 768 nothing changes, because there is room for 7rem.
- **Palette card.** `.options-card` gets `max-width: 100%` and
  `min-width: 0` in floating, so `#palette-row`'s existing
  `overflow-x: auto` scrolls inside it.
- **Alternatives considered:**
  - **A `@media (max-width: 599px)` block with phone-specific sizes.**
    Rejected. These are constraint bugs at any width where space runs
    out (a narrow desktop window too). The phone layout follow-up is
    where width-specific placement belongs.
  - **Hiding the tool-options bar labels on narrow windows.** Rejected
    for 5h. The labels are the sliders' only visible name, and wrapping
    is enough.

### 5. The embed crash: not a dependency, but schedule it before deletion

The switch-on does not depend on the fix:

- Embeds don't load `app.js`.
- `lib/pixi.js` is not touched.
- Nothing in this change runs in an embed.

After the switch-on, though, the broken embed is the only place the
docked layout runs. That has three consequences:

- From then on, the docked CSS has no working consumer. Nobody can
  check a docked regression by hand.
- The later docked-deletion change has to prove that embeds still look
  and work right after it removes code. It can't do that while embeds
  can't mount.
- 5f's "docked unchanged" check runs in the standalone app without the
  parameter. That works only while 5f is built before this change, which
  is the planned order.

The roadmap therefore lists the embed fix as its own bug fix, ordered
before the docked-deletion change and recommended right after this one.

## Risks / Trade-offs

- **[Users lose the docked layout with no way back]** The user's
  decision. → The proposal marks it BREAKING. Rollback is reverting the
  change.
- **[Floating is verified only in Chromium]** The roadmap's 5a note asks
  for a real iPad check before 5h. → Task 5.10: the user checks on an
  iPad (Safari, landscape and portrait, Pencil and touch) before merge.
  WebKit under Playwright is a partial substitute, run first.
- **[Phone layout is only "usable"]** The rail and mini-rail still take
  about 150px of a 390px width, and a phone in landscape (844×390) gets
  open cards in a short window. → Spec'd as reachability only. The
  phone-layout follow-up stays on the roadmap. Landscape phone is
  checked in verification and noted, not fixed, unless a control is
  unreachable.
- **[Specs out of date for the standalone app]** `hide-interface` says
  the control is "in its top bar", `canvas-navigation` describes the
  bottom zoom bar, and `layers`/`color-library` describe
  collapse-to-header. → They remain true for embeds. The modified
  "Layout switch" states that `floating-workspace` takes precedence in
  the floating layout, and the docked-deletion change syncs them.
- **[Scenario name "Default stays docked" now describes floating]** The
  validator requires a MODIFIED block to keep every existing scenario
  name. → The scenario text says the default is no longer docked. The
  docked-deletion change (or a manual edit after archive) can rename it.
- **[Extra `resetView()` per open]** → One synchronous fit, with no
  paint in between, so it isn't visible.

## Migration Plan

- Build after 5f is merged and archived, on its own branch.
- Deploys as a normal GitHub Pages update. There is no stored state to
  migrate: the layout was never persisted, and old `?layout=floating`
  bookmarks keep working.
- Rollback is reverting the merge.
- Follow-ups, in order: the embed mount fix, 5g (Prefs), then the
  docked-deletion change (the rest of the roadmap's 5h).
