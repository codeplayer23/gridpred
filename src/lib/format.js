/** Shared formatting helpers. */

export const ordinal = (n) => {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const pos = (n) => (n == null ? '—' : `P${n}`);

export const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export const signed = (n, digits = 1) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

export const dateParts = (iso) => {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    year: d.getFullYear(),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
};

/** Break a countdown in ms into calendar-ish units. */
export const countdownParts = (ms) => {
  const clamped = Math.max(0, ms);
  return {
    days: Math.floor(clamped / 86400000),
    hours: Math.floor((clamped / 3600000) % 24),
    minutes: Math.floor((clamped / 60000) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
    expired: clamped === 0,
  };
};

/** Translate a 0-100 score into a short qualitative label. */
export const band = (v) => {
  if (v >= 92) return 'Elite';
  if (v >= 84) return 'Strong';
  if (v >= 74) return 'Solid';
  if (v >= 64) return 'Average';
  return 'Developing';
};

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

/**
 * Spell a small number, for display headlines that read better as words.
 * Used so counts like the size of the grid stay correct as the data changes,
 * rather than being typed into copy and going stale.
 */
export const numberWord = (n) => {
  if (n == null || n < 0 || n > 59) return String(n);
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o ? `${t}-${ONES[o]}` : t;
};

/** Same, capitalised for display type. */
export const numberWordUpper = (n) => numberWord(n).toUpperCase();

/** Mix a hex colour with black — used for accent washes on dark surfaces. */
export const tint = (hex, alpha) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
