// ════════════════════════════════════════════════════════════
//  Masatoshi — Date/Time Utilities
//  Single source of truth for how a transaction/deposit
//  timestamp is displayed across the storefront + admin panel.
// ════════════════════════════════════════════════════════════

// Always keep the RAW timestamp when storing a transaction/deposit
// (e.g. `new Date().toISOString()` or whatever the backend returned).
// Never pre-truncate it to "YYYY-MM-DD HH:MM" before storing — that
// throws away the timezone info and makes it ambiguous to re-parse.
// Formatting for display should always happen at render time via
// the helpers below.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Format a timestamp (ISO string, Date, or epoch ms) into a full,
 * unambiguous local date + time string showing time, day, month and year,
 * e.g. "07 Jul 2026, 14:35".
 * Returns '—' for missing/invalid input.
 */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  const day = pad2(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Same as formatDateTime but also includes seconds, e.g.
 * "07 Jul 2026, 14:35:09" — handy for admin audit tables.
 */
export function formatDateTimeWithSeconds(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  const day = pad2(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  const seconds = pad2(d.getSeconds());
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
}
