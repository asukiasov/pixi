// Share popover markup and CSS (2026-10-13 share-export). Static, like
// test/floating-layout-css.test.js: reads the files, renders nothing.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const embed = read('../lib/pixi.js');
const css = read('../style.css').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Share popover markup', () => {
  for (const [label, source] of [['index.html', html], ['lib/pixi.js', embed]]) {
    test(`${label}: top-bar button is Share with ios_share`, () => {
      assert.match(source, /id="export-button"[^>]*aria-label="Share"[^>]*data-tooltip="Share"/);
      assert.match(source, /id="export-button"[^>]*>\s*<span class="material-symbols-outlined"[^>]*>ios_share<\/span>/);
    });

    test(`${label}: popover has the preview and three actions`, () => {
      for (const id of [
        'export-preview-image',
        'export-preview-name',
        'export-preview-dimensions',
        'export-preview-size',
        'export-copy',
        'export-copy-label',
        'export-download',
        'export-share',
      ]) {
        assert.match(source, new RegExp(`id="${id}"`), `missing #${id}`);
      }
      assert.match(source, /<h2>Share<\/h2>/);
      assert.doesNotMatch(source, /<\/span> Export\s*<\/button>/);
    });
  }

  test('ios_share is in the icon font subset', () => {
    assert.match(html, /icon_names=[^"]*\bink_eraser,ios_share,layers\b/);
  });

  test('More menu item reads Share / Export', () => {
    assert.match(html, /data-forward="export-button">\s*<span[^>]*>ios_share<\/span>Share \/ Export/);
  });
});

describe('Share popover CSS', () => {
  test('preview is pixelated over a checkerboard', () => {
    assert.match(css, /#export-preview-image \{[^}]*image-rendering: pixelated/);
    assert.match(css, /\.export-preview-frame \{[^}]*conic-gradient/);
  });

  test('actions reuse .action-capsule; .is-primary is accent-filled', () => {
    assert.match(html, /class="action-capsule export-actions"[^>]*role="group"/);
    assert.match(html, /id="export-share" class="action-capsule-segment"/);
    assert.match(css, /\.action-capsule-segment\.is-primary \{[^}]*background: var\(--color-accent\)/);
  });

  test('timelapse Save keeps .export-download-button', () => {
    assert.match(css, /\.export-download-button \{/);
    assert.match(html, /id="timelapse-save" class="tool-button export-download-button"/);
  });
});
