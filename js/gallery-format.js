// Text for the Gallery's project tiles (home-screen redesign). Pure - no
// DOM, no persistence - so it's unit-tested directly
// (test/gallery-format.test.js); js/gallery.js does the rendering.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "32×16", or '' for a record without dimensions. */
export function formatCanvasSize({ width, height } = {}) {
  return width && height ? `${width}×${height}` : '';
}

/**
 * Last-edited label: "Just now" under a minute (or for a timestamp
 * slightly in the future - clock skew between devices once sync exists),
 * relative minutes/hours under a day, "Yesterday" under two days, then a
 * short date, with the year only when it isn't `now`'s year. `locale` is
 * the browser default unless given (tests pin it).
 */
export function formatEdited(timestamp, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(timestamp)) return '';
  const age = now - timestamp;
  if (age < MINUTE) return 'Just now';
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return relative.format(-Math.floor(age / HOUR), 'hour');
  if (age < 2 * DAY) return capitalize(relative.format(-1, 'day'));
  const date = new Date(timestamp);
  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date(now).getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString(locale, options);
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
