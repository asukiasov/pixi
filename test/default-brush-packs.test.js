import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_BRUSH_PACKS } from '../js/default-brush-packs.js';

describe('DEFAULT_BRUSH_PACKS', () => {
  test('is the five packs, in order', () => {
    assert.deepEqual(DEFAULT_BRUSH_PACKS.map((p) => p.id), ['shapes', 'nature', 'texture', 'soft', 'game']);
  });

  test('every brush is a well-formed 3-16 px grid with at least one pixel, ids unique per pack', () => {
    for (const pack of DEFAULT_BRUSH_PACKS) {
      const ids = new Set();
      for (const brush of pack.brushes) {
        const where = `${pack.id}/${brush.id}`;
        assert.ok(!ids.has(brush.id), `${where} unique`);
        ids.add(brush.id);
        assert.match(brush.id, /^[a-z0-9-]+$/, `${where} id`);
        assert.ok(brush.name.trim(), `${where} name`);
        const width = brush.rows[0].length;
        assert.ok(width >= 3 && width <= 16, `${where} width ${width}`);
        assert.ok(brush.rows.length >= 3 && brush.rows.length <= 16, `${where} height`);
        for (const row of brush.rows) {
          assert.equal(row.length, width, `${where} row "${row}" length`);
          assert.match(row, /^[.X1-9]+$/, `${where} row "${row}" characters`);
        }
        assert.ok(brush.rows.some((r) => /[X1-9]/.test(r)), `${where} has pixels`);
      }
    }
  });

  test('assets/brushes/standard.json is the same list', () => {
    const json = JSON.parse(readFileSync(new URL('../assets/brushes/standard.json', import.meta.url), 'utf8'));
    assert.deepEqual(json, DEFAULT_BRUSH_PACKS);
  });
});
