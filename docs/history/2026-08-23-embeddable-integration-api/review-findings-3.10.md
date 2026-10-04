# Review findings — task 3.10 (`lib/pixi-embed-example.html`)

Consolidated record of every finding from the two review passes run on
`lib/pixi-embed-example.html` before task 3.10/3.11 were checked off:
a general code review (sonnet), and two passes of the `web-design-guidelines`
skill (the first wasn't exhaustive; the second went rule-by-rule against the
full Web Interface Guidelines list). Summary versions of this already live in
`tasks.md`'s 3.10 note — this file is the fuller, itemized record.

## Code review (sonnet, scoped to this file)

| # | Finding | Severity | Outcome |
|---|---|---|---|
| 1 | `URL.createObjectURL()` result from each "Get Image" click was never revoked, leaking one blob URL per click for the page's lifetime | Minor | **Fixed** — tracks and revokes the previous object URL before each replacement |
| 2 | Material Symbols `icon_names` list copied wholesale from `index.html` rather than trimmed to only glyphs `WORKSPACE_MARKUP` renders on this page | Minor | Left as-is — trimming means hand-tracking a second, narrower glyph list by hand against `lib/pixi.js`'s markup; not worth the maintenance cost for a font-payload nicety |
| 3 | Sample checkerboard PNG's alpha channel is fully opaque throughout, so the example doesn't exercise alpha-channel round-tripping through `loadImage()`/`getImage()` | Nit | Left as-is — not required by 3.10's task wording; `getImage()`'s own doc comment already documents background/reference-layer handling in full |

No correctness bugs found in the mount API usage itself (event names, argument
shapes, async/await, `destroy()`'s guard-driven button disabling — all
verified against `lib/pixi.js`'s real doc-commented contract), and the
embedded PNG's `IHDR`/`IDAT`/`IEND` structure was confirmed valid.

## `web-design-guidelines` — pass 1 (not exhaustive)

| # | Finding | Outcome |
|---|---|---|
| 4 | `#status-line` updates on every `'change'`/`'error'` event but had no `aria-live="polite"` | **Fixed** |
| 5 | `#captured-preview` had no explicit `width`/`height`, risking layout shift when a captured PNG first loads | **Fixed** — added `220`/`220`, matching its CSS `max-width` |
| 6 | Button rule had no `:hover` state | **Fixed** |
| 7 | Straight quotes used in visible copy instead of curly quotes | **Fixed** |

## `web-design-guidelines` — pass 2 (rule-by-rule against the full list)

Triggered by being asked "only these 4 findings?" — pass 1 turned out not to
have been exhaustive.

| # | Finding | Outcome |
|---|---|---|
| 8 | `#captured-preview`'s `alt` text stayed `"(nothing captured yet)"` forever, even after `getImage()` set a real `src` | **Fixed** — `alt` now updates alongside `src`, e.g. `"Captured PNG, 126 bytes"` |
| 9 | `#captured-caption` also updates asynchronously (on `getImage()`) but had no `aria-live` region, same gap as #4 | **Fixed** |
| 10 | No `<meta name="theme-color">` matching this page's light background, unlike `index.html` which sets one for its dark background | **Fixed** — added `content="#f4f4f5"` |
| 11 | `new Date().toLocaleTimeString()` used instead of `Intl.DateTimeFormat`, the guideline's explicitly named anti-pattern | **Left as deliberate decision** — matches `js/app.js`'s own existing `toLocaleString()` convention elsewhere in this codebase; introducing a second date-formatting style just in this one new file would be the inconsistency, not the fix |
| 12 | Headings/buttons not consistently Title Case (`"Load sample image"`, `"Get image"`, `"Pixi embed example"`) | **Fixed** — `"Load Sample Image"`, `"Get Image"`, `"Pixi Embed Example"` |
| 13 | Error status messages stated only the failure, no suggested fix/next step | **Fixed** — appended `" - reload this page and try again."` |
| 14 | Buttons had no `touch-action: manipulation`, risking a ~300ms double-tap-zoom delay on mobile | **Fixed** |
| 15 | "Destroy" button fires `instance.destroy()` immediately with no confirmation — the guidelines' destructive-action rule flags unconfirmed destructive actions | **Left as deliberate decision, confirmed with the user** — `lib/pixi.js`'s own design note establishes nothing is actually at risk (autosave already persisted everything before `destroy()` can run); a confirmation step would work against the point of a fast, full-lifecycle API demo |

## Verification after fixes

`npm test`: 260/260 after every round of fixes (unchanged from 3.9 — no
`lib/pixi.js` changes). Playwright smoke pass (standalone Node script,
Playwright MCP browser was locked by a concurrent session) re-run after each
round: zero console/page errors on the example page throughout the full
mount → stroke → `loadImage()` → `getImage()` → `destroy()` flow; standalone
app (`index.html`) confirmed unaffected, its only console message a
pre-existing/unrelated `favicon.ico` 404 (confirmed via `curl`, not caused by
this task).
