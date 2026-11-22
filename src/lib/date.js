// Local-date helpers. Dates are stored as "YYYY-MM-DD" in the lifter's local time zone.
//
// For testing day rollover you can append ?today=2026-11-22 to the URL.

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  try {
    const override = new URLSearchParams(window.location.search).get('today');
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  } catch {
    /* ignore */
  }
  return toDateKey(new Date());
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(fromKey, toKey) {
  const ms = parseDateKey(toKey) - parseDateKey(fromKey);
  return Math.round(ms / 86400000);
}

export function formatLongDate(key) {
  return parseDateKey(key)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
}

export function formatShortDate(key) {
  return parseDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** 75 -> "01:15", 3725 -> "1:02:05" */
export function formatClock(totalSec, sep = ':') {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}${sep}${pad(m)}${sep}${pad(sec)}`;
  return `${pad(m)}${sep}${pad(sec)}`;
}

/** 75 -> "1:15", 30 -> "0:30" */
export function formatShortTimer(totalSec) {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
