import { visibleAnchor } from './layout.js';
import { writeImage } from './clipboard.js';
import { showToast } from './toast.js';

const SCALES = [1, 2, 4, 8];
const FORMATS = ['png', 'webp', 'jpg'];

// Embeddable-editor-api (Phase 3): initExport() is called fresh on every
// initWorkspace() call (js/workspace.js's bindDomOnce(), once per distinct
// `root` - see that file's globalListenersBound comment for the general
// pattern). Unlike the listeners covered by that guard, this file's two
// document-level listeners close over `panel`/`toggleButton` - locals of
// *this specific call* - so binding once-ever would leave them wired to
// the first call's (possibly since-destroyed) panel forever. Tracked here
// so each call removes its predecessor's pair before adding its own.
let outsideClickHandler = null;
let escapeHandler = null;

/**
 * Positions `panel` as a popover below `anchorEl`, clamped to the
 * viewport - flips above if it would overflow the bottom, clamped
 * horizontally too. Same unhide-to-measure-then-clamp pattern as
 * js/canvas-settings.js's positionPanel (duplicated rather than shared,
 * matching this codebase's existing per-popover convention - see
 * workspace.js's openColorPicker).
 */
function positionPanel(panel, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;

  let top = rect.bottom + 8;
  if (top + panelRect.height > window.innerHeight - margin) {
    top = rect.top - panelRect.height - 8;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));

  let left = rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

/**
 * Filesystem-unsafe characters replaced with `-`, matching the `export`
 * capability spec's Export filename requirement. A name that sanitizes to
 * nothing (empty/whitespace-only) falls back to "untitled". Exported
 * (drawing-timelapse-recording): js/workspace.js's timelapse Save action
 * reuses this exact rule for its own downloaded filename rather than
 * keeping a second copy that could drift out of sync.
 */
export function sanitizeFilename(name) {
  const sanitized = (name ?? '').replace(/[/\\:*?"<>|]/g, '-').trim();
  return sanitized || 'untitled';
}

/** `<sanitized-project-name>@<scale>x.<ext>` - the export spec's Export filename requirement. */
export function exportFilename(name, scale, format) {
  return `${sanitizeFilename(name)}@${scale}x.${format}`;
}

/** Human-readable encoded size for the preview row: exact bytes, then ~KB, then MB. */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The clipboard only takes image/png reliably across browsers, so Copy
 * always copies a PNG - and says so when another format is selected.
 */
export function copyLabel(format) {
  return format === 'png' ? 'Copy' : 'Copy PNG';
}

/**
 * Which of Share/Copy this browser supports. Share needs Web Share with
 * files (Safari on iOS/iPadOS/macOS, Android, Chrome on Windows/ChromeOS);
 * Copy needs async clipboard image writes. Takes navigator-like and
 * global-like objects so tests can pass fakes.
 */
export function shareCapabilities(nav = globalThis.navigator, env = globalThis) {
  let canShare = false;
  try {
    canShare = typeof nav?.share === 'function'
      && typeof nav?.canShare === 'function'
      && typeof env.File === 'function'
      && Boolean(nav.canShare({ files: [new env.File([''], 'probe.png', { type: 'image/png' })] }));
  } catch {
    canShare = false;
  }
  const canCopy = typeof nav?.clipboard?.write === 'function' && typeof env.ClipboardItem === 'function';
  return { canShare, canCopy };
}

/**
 * Lets only the newest of several overlapping async renders win, so a
 * slow 8x render finishing late can't overwrite a newer 1x one. A stale
 * run's rejection is swallowed too - nobody is waiting on it any more.
 */
export function createLatestOnly() {
  let latest = 0;
  return {
    async run(task) {
      const id = ++latest;
      try {
        const result = await task();
        return id === latest ? { current: true, result } : { current: false };
      } catch (err) {
        if (id !== latest) return { current: false };
        throw err;
      }
    },
    cancel() {
      latest++;
    },
  };
}

/**
 * Wires the Share popover (preview, scale, format, transparent-background
 * override, and Copy/Download/Share) in the Workspace screen. Doesn't own
 * a LayerStack: `render(options)` (from workspace.js) encodes the output
 * Blob, and `onDownloaded()` runs workspace.js's celebration.
 *
 * The Blob is rendered ahead of time - on open and on every option
 * change - because Safari rejects navigator.share() and
 * clipboard.write() once an await has spent the click's user activation.
 * The same Blob drives the preview and the size readout. When the format
 * isn't PNG, a second PNG Blob is rendered for Copy (the clipboard only
 * takes PNG reliably).
 *
 * Scale, format and the toggle reset to their defaults (1x, PNG, off)
 * every time the popover opens - transient UI state, not saved with the
 * project. `getProjectName()` is read at action time, so a rename right
 * before sharing is still reflected in the filename.
 */
export function initExport({ render, onDownloaded = () => {}, getProjectName, getCanvasSize, root = document }) {
  const toggleButton = root.querySelector('#export-button');
  const panel = root.querySelector('#export-panel');
  const closeButton = root.querySelector('#export-close');
  const scaleOptions = [...panel.querySelectorAll('.export-scale-option')];
  const formatOptions = [...panel.querySelectorAll('.export-format-option')];
  const transparentCheckbox = root.querySelector('#export-transparent-background');
  const transparentLabel = root.querySelector('#export-transparent-label');
  const downloadButton = root.querySelector('#export-download');
  const copyButton = root.querySelector('#export-copy');
  const copyLabelText = root.querySelector('#export-copy-label');
  const shareButton = root.querySelector('#export-share');
  const previewImage = root.querySelector('#export-preview-image');
  const previewName = root.querySelector('#export-preview-name');
  const previewDimensions = root.querySelector('#export-preview-dimensions');
  const previewSize = root.querySelector('#export-preview-size');
  const actionButtons = [copyButton, downloadButton, shareButton].filter(Boolean);

  // Hide what this browser can't do. Share is the primary (accent) action
  // where there's a share sheet; elsewhere Download is.
  const { canShare, canCopy } = shareCapabilities();
  copyButton?.classList.toggle('hidden', !canCopy);
  shareButton?.classList.toggle('hidden', !canShare);
  shareButton?.classList.toggle('is-primary', canShare);
  downloadButton.classList.toggle('is-primary', !canShare);

  const latest = createLatestOnly();
  // { blob, pngBlob, options } for the current options, or null while
  // rendering / closed.
  let rendered = null;
  let previewUrl = null;

  function currentFormat() {
    const activeFormatButton = formatOptions.find((btn) => btn.classList.contains('active'));
    return FORMATS.includes(activeFormatButton?.dataset.format) ? activeFormatButton.dataset.format : 'png';
  }

  function currentScale() {
    const activeScaleButton = scaleOptions.find((btn) => btn.classList.contains('active'));
    return SCALES.includes(Number(activeScaleButton?.dataset.scale)) ? Number(activeScaleButton.dataset.scale) : 1;
  }

  function currentOptions() {
    return { scale: currentScale(), format: currentFormat(), skipBackground: transparentCheckbox.checked };
  }

  // JPG has no alpha channel (see the export spec's Transparent-background
  // override requirement) - disable and force off the toggle while JPG is
  // selected, rather than let the user pick a combination that can't mean
  // what it says.
  function syncTransparentToggleAvailability() {
    const disabled = currentFormat() === 'jpg';
    transparentCheckbox.disabled = disabled;
    transparentLabel.classList.toggle('disabled', disabled);
    if (disabled) transparentCheckbox.checked = false;
  }

  function resetToDefaults() {
    scaleOptions.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.scale) === 1));
    formatOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.format === 'png'));
    transparentCheckbox.checked = false;
    syncTransparentToggleAvailability();
  }

  function setBusy(busy) {
    actionButtons.forEach((btn) => { btn.disabled = busy; });
  }

  function showPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = rendered ? URL.createObjectURL(rendered.blob) : null;
    if (previewImage) {
      if (previewUrl) previewImage.src = previewUrl;
      else previewImage.removeAttribute('src');
    }
    if (!rendered) return;
    const { scale, format } = rendered.options;
    const { width, height } = getCanvasSize();
    if (previewName) previewName.textContent = getProjectName() || 'Untitled';
    if (previewDimensions) previewDimensions.textContent = `${width * scale}×${height * scale} · ${format.toUpperCase()}`;
    if (previewSize) previewSize.textContent = formatFileSize(rendered.blob.size);
  }

  async function refresh() {
    const options = currentOptions();
    if (copyLabelText) copyLabelText.textContent = copyLabel(options.format);
    rendered = null;
    setBusy(true);
    let outcome;
    try {
      outcome = await latest.run(async () => {
        const blob = await render(options);
        const pngBlob = options.format === 'png' ? blob : await render({ ...options, format: 'png' });
        if (!blob || !pngBlob) throw new Error('Image encoding returned no data');
        return { blob, pngBlob };
      });
    } catch (err) {
      console.error(err);
      showToast("Couldn't prepare the image.", { type: 'error' });
      return;
    }
    if (!outcome.current) return;
    rendered = { ...outcome.result, options };
    showPreview();
    setBusy(false);
  }

  function filenameFor(options) {
    return exportFilename(getProjectName(), options.scale, options.format);
  }

  function close() {
    panel.classList.add('hidden');
    latest.cancel();
    rendered = null;
    showPreview();
  }

  toggleButton.addEventListener('click', () => {
    const wasHidden = panel.classList.contains('hidden');
    if (wasHidden) resetToDefaults();
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from.
    panel.classList.remove('hidden');
    if (wasHidden) {
      // Floating layout: the toggle is hidden and this opens from the More
      // menu, so anchor to More instead (5b-top-bar-more).
      positionPanel(panel, visibleAnchor(toggleButton, root.querySelector('#more-button')));
      refresh();
    } else {
      close();
    }
  });

  closeButton.addEventListener('click', close);

  // Close on outside click/Escape too, not just the explicit close button
  // or re-clicking the toggle - standard popover behavior, same as
  // Canvas Settings and the color-picker popover.
  if (outsideClickHandler) document.removeEventListener('pointerdown', outsideClickHandler);
  outsideClickHandler = (e) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target)) return;
    if (e.target === toggleButton || toggleButton.contains(e.target)) return;
    close();
  };
  document.addEventListener('pointerdown', outsideClickHandler);

  if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
  escapeHandler = (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) close();
  };
  document.addEventListener('keydown', escapeHandler);

  scaleOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      scaleOptions.forEach((other) => other.classList.toggle('active', other === btn));
      refresh();
    });
  });

  formatOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      formatOptions.forEach((other) => other.classList.toggle('active', other === btn));
      syncTransparentToggleAvailability();
      refresh();
    });
  });

  transparentCheckbox.addEventListener('change', refresh);

  downloadButton.addEventListener('click', () => {
    if (!rendered) return;
    const url = URL.createObjectURL(rendered.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(rendered.options);
    a.click();
    URL.revokeObjectURL(url);
    onDownloaded();
    close();
  });

  // Copy and Share call the browser API synchronously in the click, with
  // the pre-rendered Blob - no await before it (see the doc comment).
  copyButton?.addEventListener('click', () => {
    if (!rendered) return;
    writeImage(rendered.pngBlob).then((ok) => {
      if (ok) showToast('Copied');
      else showToast("Couldn't copy the image. Try Download instead.", { type: 'error' });
    });
  });

  shareButton?.addEventListener('click', () => {
    if (!rendered) return;
    const file = new File([rendered.blob], filenameFor(rendered.options), { type: rendered.blob.type });
    navigator.share({ files: [file], title: getProjectName() || 'Untitled' })
      .then(close)
      .catch((err) => {
        // AbortError: the user dismissed the share sheet - not a failure.
        if (err?.name === 'AbortError') return;
        console.error(err);
        showToast("Couldn't share. Try Download instead.", { type: 'error' });
      });
  });

  return {
    /** Called by workspace.js's per-project reset - a freshly opened project starts with the popover closed and defaults reset. */
    close() {
      resetToDefaults();
      close();
    },
  };
}
