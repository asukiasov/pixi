// Text for the Gallery's project tiles (home-screen redesign). Pure - no
// DOM, no persistence - so it's unit-tested directly
// (test/gallery-format.test.js); js/gallery.js does the rendering.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "32×16", or '' for a record without dimensions. */
export function formatCanvasSize({ width, height } = {}) {
  return width && height ? `${width}×${height}` : '';
}

/**
 * Last-edited label: "Just now" under a minute (or for a timestamp
 * slightly in the future - clock skew between devices once sync exists),
 * relative minutes under an hour, relative hours for the rest of today,
 * "Yesterday" for the previous calendar day, then a short date, with the
 * year only when it isn't `now`'s year. Days are local calendar days, so
 * 23:00 two days ago is a date even if it's under 48 hours. `locale` is
 * the browser default unless given (tests pin it).
 */
export function formatEdited(timestamp, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(timestamp)) return '';
  const age = now - timestamp;
  if (age < MINUTE) return 'Just now';
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), 'minute');
  const date = new Date(timestamp);
  const today = new Date(now);
  if (sameDay(date, today)) return relative.format(-Math.floor(age / HOUR), 'hour');
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(date, yesterday)) return capitalize(relative.format(-1, 'day'));
  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString(locale, options);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
