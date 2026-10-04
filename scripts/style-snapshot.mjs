// Computed-style snapshots of Pixi's screens, for refactors that must not
// change how anything looks (the Forma UI extraction). No dependencies:
// drives Google Chrome over the DevTools protocol with Node 22's built-in
// WebSocket and fetch.
//
//   node scripts/style-snapshot.mjs capture <out-dir> [base-url]
//   node scripts/style-snapshot.mjs diff <dir-a> <dir-b>
//
// capture needs a local server (python3 -m http.server 8765 in the repo
// root). Per theme and window size it starts a fresh Chrome profile (so
// IndexedDB starts empty) and writes <theme>-<w>x<h>-<state>.json (the
// listed computed properties of every element, plus ::before/::after) and
// a .png. Elements are keyed by DOM index path, so class renames don't
// change keys. diff lists every difference and exits 1 if there are any.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THEMES = ['dark', 'light'];
const SIZES = [[1180, 820], [390, 844]];
const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'isolation',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'box-sizing',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order',
  'align-items', 'justify-content', 'row-gap', 'column-gap', 'grid-template-columns',
  'overflow-x', 'overflow-y',
  'color', 'background-color', 'background-image', 'background-size', 'background-position',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'box-shadow', 'opacity', 'visibility', 'transform', 'translate', 'filter', 'backdrop-filter',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
  'cursor', 'pointer-events', 'touch-action',
  'outline-style', 'outline-width', 'outline-color', 'outline-offset',
  'content', 'object-fit', 'image-rendering', 'aspect-ratio', 'transition-property', 'transition-duration',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-snap-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) {
    proc.kill();
    throw new Error('Chrome did not start');
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of [...listeners]) l(msg);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitEvent = (method) => new Promise((resolve) => {
    const l = (m) => {
      if (m.method !== method) return;
      listeners.splice(listeners.indexOf(l), 1);
      resolve(m.params);
    };
    listeners.push(l);
  });
  const close = async () => {
    ws.close();
    const exited = new Promise((resolve) => proc.once('exit', resolve));
    proc.kill();
    await Promise.race([exited, sleep(2000)]);
    // Chrome's process can still be flushing profile files for a moment
    // after it reports exited, which races a plain rmSync into ENOTEMPTY.
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };
  return { send, waitEvent, close };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function settle(page) {
  // document.fonts.ready only awaits fonts a layout pass has already
  // requested; the Material Symbols @font-face (loaded from Google Fonts,
  // cold on every fresh profile here) can still be in flight when that
  // check runs, so explicitly request it before waiting on fonts.ready -
  // otherwise icon glyphs occasionally render as fallback text mid-fetch,
  // which showed up as a nondeterministic width diff on the embed page.
  await evaluate(page, `(async () => {
    try { await document.fonts.load("300 24px 'Material Symbols Outlined'"); } catch (e) {}
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  })()`);
  await sleep(500);
}

async function go(page, url) {
  const loaded = page.waitEvent('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  await settle(page);
}

async function setHash(page, hash) {
  await evaluate(page, `location.hash = ${JSON.stringify(hash)}`);
  await settle(page);
}

async function waitFor(page, expression, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate(page, expression)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${expression}`);
}

const DUMP = `(() => {
  const PROPS = ${JSON.stringify(PROPS)};
  const key = (el) => {
    const parts = [];
    for (let e = el; e !== document.body; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + ':' + [...e.parentElement.children].indexOf(e) + (e.id ? '#' + e.id : ''));
    }
    return parts.join('/');
  };
  const read = (cs) => Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
  const out = {};
  for (const el of document.body.querySelectorAll('*')) {
    const k = key(el);
    const r = el.getBoundingClientRect();
    out[k] = { rect: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10).join(','), ...read(getComputedStyle(el)) };
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content !== 'none' && cs.content !== 'normal') out[k + pseudo] = read(cs);
    }
  }
  return out;
})()`;

async function capture(outDir, base) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const theme of THEMES) {
    for (const [width, height] of SIZES) {
      const page = await openChrome();
      const tag = `${theme}-${width}x${height}`;
      try {
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await page.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `try { localStorage.setItem('pixi-theme-preference', '${theme}'); } catch (e) {}`,
        });
        const snap = async (state) => {
          const data = await evaluate(page, DUMP);
          fs.writeFileSync(path.join(outDir, `${tag}-${state}.json`), JSON.stringify(data));
          const { data: png } = await page.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(outDir, `${tag}-${state}.png`), Buffer.from(png, 'base64'));
          console.log(`${tag}-${state}`);
        };
        await go(page, new URL('index.html#/', base).href);
        await snap('gallery-empty');
        await setHash(page, '#/new');
        await snap('new-canvas');
        await evaluate(page, `document.getElementById('create-canvas-button').click()`);
        await waitFor(page, `location.hash.startsWith('#/project/')`);
        await settle(page);
        await sleep(800);
        await snap('workspace');
        await evaluate(page, `document.getElementById('more-button').click()`);
        await settle(page);
        await snap('workspace-more-open');
        await setHash(page, '#/');
        await snap('gallery-populated');
        await go(page, new URL('lib/pixi-embed-example.html', base).href);
        await sleep(800);
        await snap('embed');
      } finally {
        await page.close();
      }
    }
  }
}

function diff(dirA, dirB) {
  let count = 0;
  for (const file of fs.readdirSync(dirA).filter((f) => f.endsWith('.json')).sort()) {
    const fileB = path.join(dirB, file);
    if (!fs.existsSync(fileB)) {
      console.log(`${file}: missing in ${dirB}`);
      count++;
      continue;
    }
    const a = JSON.parse(fs.readFileSync(path.join(dirA, file), 'utf8'));
    const b = JSON.parse(fs.readFileSync(fileB, 'utf8'));
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[k] || !b[k]) {
        console.log(`${file} ${k}: only in ${a[k] ? dirA : dirB}`);
        count++;
        continue;
      }
      for (const p of Object.keys(a[k])) {
        if (a[k][p] !== b[k][p]) {
          console.log(`${file} ${k}\n    ${p}: ${a[k][p]}  ->  ${b[k][p]}`);
          count++;
        }
      }
    }
  }
  console.log(count ? `${count} difference(s)` : 'no differences');
  process.exitCode = count ? 1 : 0;
}

const [command, ...args] = process.argv.slice(2);
if (command === 'capture' && args[0]) {
  await capture(args[0], args[1] ?? 'http://127.0.0.1:8765/');
} else if (command === 'diff' && args[1]) {
  diff(args[0], args[1]);
} else {
  console.error('usage: node scripts/style-snapshot.mjs capture <out-dir> [base-url]\n       node scripts/style-snapshot.mjs diff <dir-a> <dir-b>');
  process.exit(2);
}
