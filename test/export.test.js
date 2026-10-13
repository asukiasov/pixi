// Share/Export popover (2026-10-13 share-export): the pure half of
// js/export.js. The popover's DOM wiring is checked in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFileSize,
  copyLabel,
  shareCapabilities,
  createLatestOnly,
  exportFilename,
} from '../js/export.js';

describe('formatFileSize', () => {
  test('bytes under 1 KB are exact', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
  });

  test('kilobytes are rounded and marked approximate', () => {
    assert.equal(formatFileSize(1024), '~1 KB');
    assert.equal(formatFileSize(3200), '~3 KB');
    assert.equal(formatFileSize(1024 * 1024 - 1), '~1024 KB');
  });

  test('megabytes get one decimal', () => {
    assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
    assert.equal(formatFileSize(1.25 * 1024 * 1024), '1.3 MB');
  });
});

describe('copyLabel', () => {
  test('says Copy for PNG, Copy PNG otherwise', () => {
    assert.equal(copyLabel('png'), 'Copy');
    assert.equal(copyLabel('webp'), 'Copy PNG');
    assert.equal(copyLabel('jpg'), 'Copy PNG');
  });
});

describe('shareCapabilities', () => {
  class FakeFile {
    constructor(parts, name, options) {
      this.name = name;
      this.type = options?.type;
    }
  }
  class FakeClipboardItem {}
  const env = { File: FakeFile, ClipboardItem: FakeClipboardItem };

  test('can share when share() exists and canShare accepts files', () => {
    const nav = { share() {}, canShare: ({ files }) => files[0] instanceof FakeFile };
    assert.equal(shareCapabilities(nav, env).canShare, true);
  });

  test('cannot share when canShare rejects files', () => {
    const nav = { share() {}, canShare: () => false };
    assert.equal(shareCapabilities(nav, env).canShare, false);
  });

  test('cannot share without share() or canShare()', () => {
    assert.equal(shareCapabilities({}, env).canShare, false);
    assert.equal(shareCapabilities({ share() {} }, env).canShare, false);
  });

  test('cannot share when canShare throws', () => {
    const nav = { share() {}, canShare: () => { throw new TypeError('nope'); } };
    assert.equal(shareCapabilities(nav, env).canShare, false);
  });

  test('can copy with clipboard.write and ClipboardItem', () => {
    const nav = { clipboard: { write() {} } };
    assert.equal(shareCapabilities(nav, env).canCopy, true);
  });

  test('cannot copy without ClipboardItem or clipboard.write', () => {
    assert.equal(shareCapabilities({ clipboard: { write() {} } }, { File: FakeFile }).canCopy, false);
    assert.equal(shareCapabilities({ clipboard: {} }, env).canCopy, false);
    assert.equal(shareCapabilities(undefined, env).canCopy, false);
  });
});

describe('createLatestOnly', () => {
  function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  test('the only run is current', async () => {
    const latest = createLatestOnly();
    assert.deepEqual(await latest.run(async () => 'a'), { current: true, result: 'a' });
  });

  test('an older run that finishes last is not current', async () => {
    const latest = createLatestOnly();
    const slow = deferred();
    const first = latest.run(() => slow.promise);
    const second = latest.run(async () => 'new');
    slow.resolve('old');
    assert.deepEqual(await second, { current: true, result: 'new' });
    assert.deepEqual(await first, { current: false });
  });

  test('cancel() makes a pending run stale', async () => {
    const latest = createLatestOnly();
    const slow = deferred();
    const run = latest.run(() => slow.promise);
    latest.cancel();
    slow.resolve('x');
    assert.deepEqual(await run, { current: false });
  });

  test('a current run rethrows; a stale one swallows its error', async () => {
    const latest = createLatestOnly();
    await assert.rejects(latest.run(async () => { throw new Error('boom'); }), /boom/);
    const slow = deferred();
    const stale = latest.run(() => slow.promise);
    latest.run(async () => 'new');
    slow.reject(new Error('late'));
    assert.deepEqual(await stale, { current: false });
  });
});

describe('exportFilename', () => {
  test('follows <name>@<scale>x.<ext>, sanitized', () => {
    assert.equal(exportFilename('My Sprite', 4, 'webp'), 'My Sprite@4x.webp');
    assert.equal(exportFilename('Sword/Shield: v2', 1, 'png'), 'Sword-Shield- v2@1x.png');
    assert.equal(exportFilename('  ', 2, 'jpg'), 'untitled@2x.jpg');
  });
});
