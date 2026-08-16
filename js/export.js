const SCALES = [1, 2, 4, 8];
const FORMATS = ['png', 'webp', 'jpg'];

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
 * nothing (empty/whitespace-only) falls back to "untitled".
 */
function sanitizeFilename(name) {
  const sanitized = (name ?? '').replace(/[/\\:*?"<>|]/g, '-').trim();
  return sanitized || 'untitled';
}

/**
 * Wires the Export popover (scale multiplier, format selector,
 * transparent-background override, Export action) in the Workspace
 * screen. Doesn't own or touch a LayerStack directly - reports the
 * user's export choice via `onExport(options)`, so workspace.js keeps
 * sole ownership of the current layer stack and its own download/
 * celebration behavior. `getProjectName()` is called at export time (not
 * cached when the popover opens) so a rename right before exporting is
 * still reflected. Scale, format, and the toggle reset to their defaults
 * (1x, PNG, off) every time the popover opens - they're transient UI
 * state, not saved with the project.
 */
export function initExport({ onExport, getProjectName }) {
  const toggleButton = document.getElementById('export-button');
  const panel = document.getElementById('export-panel');
  const closeButton = document.getElementById('export-close');
  const scaleOptions = [...panel.querySelectorAll('.export-scale-option')];
  const formatOptions = [...panel.querySelectorAll('.export-format-option')];
  const transparentCheckbox = document.getElementById('export-transparent-background');
  const transparentLabel = document.getElementById('export-transparent-label');
  const downloadButton = document.getElementById('export-download');

  function currentFormat() {
    const activeFormatButton = formatOptions.find((btn) => btn.classList.contains('active'));
    return FORMATS.includes(activeFormatButton?.dataset.format) ? activeFormatButton.dataset.format : 'png';
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

  function close() {
    panel.classList.add('hidden');
  }

  toggleButton.addEventListener('click', () => {
    const wasHidden = panel.classList.contains('hidden');
    if (wasHidden) resetToDefaults();
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from.
    panel.classList.remove('hidden');
    if (wasHidden) {
      positionPanel(panel, toggleButton);
    } else {
      close();
    }
  });

  closeButton.addEventListener('click', close);

  // Close on outside click/Escape too, not just the explicit close button
  // or re-clicking the toggle - standard popover behavior, same as
  // Canvas Settings and the color-picker popover.
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target)) return;
    if (e.target === toggleButton || toggleButton.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) close();
  });

  scaleOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      scaleOptions.forEach((other) => other.classList.toggle('active', other === btn));
    });
  });

  formatOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      formatOptions.forEach((other) => other.classList.toggle('active', other === btn));
      syncTransparentToggleAvailability();
    });
  });

  downloadButton.addEventListener('click', () => {
    const activeScaleButton = scaleOptions.find((btn) => btn.classList.contains('active'));
    const scale = SCALES.includes(Number(activeScaleButton?.dataset.scale))
      ? Number(activeScaleButton.dataset.scale)
      : 1;
    const format = currentFormat();
    const filename = `${sanitizeFilename(getProjectName())}@${scale}x.${format}`;
    onExport({ scale, format, skipBackground: transparentCheckbox.checked, filename });
    close();
  });

  return {
    /** Called by workspace.js's per-project reset - a freshly opened project starts with the popover closed and defaults reset. */
    close() {
      resetToDefaults();
      close();
    },
  };
}
