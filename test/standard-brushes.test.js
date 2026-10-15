import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStandardBrushes,
  BUILT_IN_BRUSH_PACKS,
  standardBrushRows,
  missingPackBrushes,
  loadStandardBrushes,
  brushSections,
} from '../js/standard-brushes.js';
import { DEFAULT_BRUSH_PACKS } from '../js/default-brush-packs.js';

const DOT = { id: 'dot', name: 'Dot', rows: ['...', '.X.', '...'] };
const SOFT = { id: 'soft', name: 'Soft', rows: ['...', '.5.', '...'] };

describe('parseStandardBrushes', () => {
  test('turns rows into width, height and pixels', () => {
    assert.deepEqual(parseStandardBrushes([{ id: 'p', name: ' P ', brushes: [DOT, SOFT] }]), [
      {
        id: 'p',
        name: 'P',
        brushes: [
          { id: 'dot', name: 'Dot', width: 3, height: 3, pixels: [[1, 1]] },
          { id: 'soft', name: 'Soft', width: 3, height: 3, pixels: [[1, 1, 0.5]] },
        ],
      },
    ]);
  });

  test('drops malformed brushes, then packs left empty; null for a non-list', () => {
    const parsed = parseStandardBrushes([
      {
        id: 'p',
        name: 'P',
        brushes: [
          DOT,
          { ...DOT }, // duplicate id
          { id: 'ragged', name: 'R', rows: ['XXX', 'XX', 'XXX'] },
          { id: 'bad-char', name: 'B', rows: ['XXX', 'XoX', 'XXX'] },
          { id: 'tiny', name: 'T', rows: ['XX', 'XX'] },
          { id: 'huge', name: 'H', rows: Array(17).fill('X'.repeat(17)) },
          { id: 'empty', name: 'E', rows: ['...', '...', '...'] },
          { id: 'Bad Id', name: 'I', rows: ['XXX', 'XXX', 'XXX'] },
          { id: 'no-name', name: ' ', rows: ['XXX', 'XXX', 'XXX'] },
        ],
      },
      { id: 'all-bad', name: 'All bad', brushes: [{ id: 'x', name: 'X', rows: [] }] },
      { id: 'p', name: 'Duplicate pack', brushes: [DOT] },
      { id: '', name: 'No id', brushes: [DOT] },
      'nope',
    ]);
    assert.deepEqual(parsed.map((p) => [p.id, p.brushes.map((b) => b.id)]), [['p', ['dot']]]);
    assert.equal(parseStandardBrushes({ id: 'x' }), null);
  });

  test('the built-in packs all parse in full', () => {
    assert.equal(BUILT_IN_BRUSH_PACKS.length, DEFAULT_BRUSH_PACKS.length);
    BUILT_IN_BRUSH_PACKS.forEach((pack, i) => assert.equal(pack.brushes.length, DEFAULT_BRUSH_PACKS[i].brushes.length, pack.id));
  });
});

const PACK = parseStandardBrushes([{ id: 'p', name: 'P', brushes: [DOT, SOFT] }])[0];
const record = (packBrushId, extra = {}) => ({ id: `r-${packBrushId}`, pack: 'p', packName: 'P', packBrushId, ...extra });

describe('standardBrushRows', () => {
  test('add when none present, restore when some, added when all', () => {
    const status = (existing) => standardBrushRows([PACK], existing)[0].status;
    assert.equal(status([]), 'add');
    assert.equal(status([record('dot')]), 'restore');
    assert.equal(status([record('dot'), record('soft')]), 'added');
  });

  test('ignores user brushes and other packs\' brushes', () => {
    const existing = [{ id: 'mine', name: 'dot' }, { id: 'o', pack: 'other', packBrushId: 'dot' }];
    assert.equal(standardBrushRows([PACK], existing)[0].status, 'add');
  });
});

describe('missingPackBrushes', () => {
  test('returns only the absent brushes, with pack info and their position', () => {
    assert.deepEqual(missingPackBrushes(PACK, [record('dot')]), [
      {
        name: 'Soft',
        width: 3,
        height: 3,
        pixels: [[1, 1, 0.5]],
        packInfo: { pack: 'p', packName: 'P', packBrushId: 'soft', packIndex: 1 },
      },
    ]);
  });
});

describe('loadStandardBrushes', () => {
  test('uses the downloaded list when it parses', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => [{ id: 'r', name: 'Remote', brushes: [DOT] }] });
    const packs = await loadStandardBrushes(fetchFn);
    assert.deepEqual(packs.map((p) => p.id), ['r']);
  });

  test('falls back to the built-in packs when offline, on a bad status, or bad JSON', async () => {
    for (const fetchFn of [
      async () => {
        throw new Error('offline');
      },
      async () => ({ ok: false, json: async () => [] }),
      async () => ({ ok: true, json: async () => ({ not: 'a list' }) }),
      async () => ({ ok: true, json: async () => [] }),
    ]) {
      assert.deepEqual(await loadStandardBrushes(fetchFn), BUILT_IN_BRUSH_PACKS);
    }
  });
});

describe('brushSections', () => {
  const core = [{ id: 'heart', name: 'Heart' }];

  test('Core, then packs in pack order, then My Brushes; empty sections hidden', () => {
    const custom = [
      { id: 'm1', name: 'Mine', createdAt: 2 },
      { id: 'b', pack: 'b', packName: 'Bee', packBrushId: 'x', packIndex: 0 },
      { id: 'a2', pack: 'a', packName: 'Ay', packBrushId: 'y', packIndex: 1 },
      { id: 'a1', pack: 'a', packName: 'Ay', packBrushId: 'x', packIndex: 0 },
      { id: 'm0', name: 'Older', createdAt: 1 },
    ];
    const sections = brushSections(core, custom, ['a', 'b']);
    assert.deepEqual(
      sections.map((s) => [s.id, s.title, s.brushes.map((b) => b.id)]),
      [
        ['core', 'Core', ['heart']],
        ['pack:a', 'Ay', ['a1', 'a2']],
        ['pack:b', 'Bee', ['b']],
        ['mine', 'My Brushes', ['m0', 'm1']],
      ],
    );
    assert.deepEqual(brushSections(core, [], ['a']).map((s) => s.id), ['core']);
  });

  test('packs no longer in the list come after the known ones, by name', () => {
    const custom = [
      { id: 'z', pack: 'zed', packName: 'Zed', packBrushId: 'x', packIndex: 0 },
      { id: 'o', pack: 'old', packName: 'Old', packBrushId: 'x', packIndex: 0 },
      { id: 'a', pack: 'a', packName: 'Ay', packBrushId: 'x', packIndex: 0 },
    ];
    assert.deepEqual(brushSections(core, custom, ['a']).map((s) => s.title), ['Core', 'Ay', 'Old', 'Zed']);
  });
});
