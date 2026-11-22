// Shared behaviour for the numeric fields on the Workout screen and in the routine editor.

/** Tapping a number selects it so typing replaces it. */
export function selectOnFocus(e) {
  const el = e.target;
  requestAnimationFrame(() => el.select());
}

/** Digits with at most one decimal point (weights). */
export function cleanDecimal(v) {
  const [whole, ...rest] = String(v).replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

/** Whole numbers only (reps). */
export function cleanInt(v, maxLen = 3) {
  return String(v).replace(/[^0-9]/g, '').slice(0, maxLen);
}
