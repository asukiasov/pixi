// Align and Rotate popovers (2026-10-15 align-rotate-popovers). Static,
// like test/export-markup.test.js: reads the files, renders nothing.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const css = read('../style.css').replace(/\/\*[\s\S]*?\*\//g, '');
const panel = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('<!--', html.indexOf(`id="${id}"`)));

describe('Align and Rotate popovers', () => {
  test('the top bar has Align and Rotate instead of Transform', () => {
    assert.doesNotMatch(html, /id="transform-toggle"|id="transform-panel"/);
    const group = html.slice(html.indexOf('class="topbar-group"'), html.indexOf('id="undo-button"'));
    assert.match(group, /id="align-toggle"[^>]*aria-label="Align"[^>]*aria-controls="align-panel"/);
    assert.match(group, /id="rotate-toggle"[^>]*aria-label="Rotate"[^>]*aria-controls="rotate-panel"/);
  });

  test('Align has its six actions', () => {
    const align = panel('align-panel');
    assert.match(align, /role="dialog"[^>]*aria-labelledby="align-title"/);
    for (const edge of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
      assert.match(align, new RegExp(`data-transform="align-${edge}"`));
    }
  });

  test('Rotate has the dial, quarter steps, flips, Reset and Apply', () => {
    const rotate = panel('rotate-panel');
    assert.match(rotate, /role="dialog"[^>]*aria-labelledby="rotate-title"/);
    assert.match(rotate, /id="rotate-dial"[^>]*role="slider"[^>]*tabindex="0"[^>]*aria-valuemin="-180"[^>]*aria-valuemax="180"[^>]*aria-valuenow="0"/);
    assert.match(rotate, /class="rotate-dial-value"/);
    assert.match(rotate, /data-rotate-step="-90"[^>]*aria-label="Rotate 90° left"/);
    assert.match(rotate, /data-rotate-step="90"[^>]*aria-label="Rotate 90° right"/);
    assert.match(rotate, /data-transform="flip-horizontal"/);
    assert.match(rotate, /data-transform="flip-vertical"/);
    assert.match(rotate, /id="rotate-reset"[^>]*disabled/);
    assert.match(rotate, /id="rotate-apply"[^>]*disabled/);
    assert.doesNotMatch(rotate, /data-transform="align-/);
  });

  test('the dial turns with --dial-angle and takes touch drags', () => {
    assert.match(css, /\.rotate-dial\s*\{[^}]*touch-action:\s*none/);
    assert.match(css, /\.rotate-dial-knob\s*\{[^}]*rotate\(var\(--dial-angle\)\)/);
  });
});
