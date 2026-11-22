export const KG_PER_LB = 0.45359237;

/** Smallest practical weight jump per unit, used for rounding suggestions. */
export const WEIGHT_STEP = { lb: 2.5, kg: 1 };
/** Typical progression jump when the lifter hit every rep last time. */
export const PROGRESSION_STEP = { lb: 5, kg: 2.5 };

export function roundTo(value, step) {
  return Math.round(value / step) * step;
}

export function toKg(weight, unit) {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

export function fromKg(kg, unit) {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** Convert a value between units, rounded to 0.5 so the inputs stay readable. */
export function convertWeight(weight, from, to) {
  if (from === to || weight === '' || weight == null) return weight;
  return roundTo(fromKg(toKg(Number(weight), from), to), 0.5);
}

export function formatWeight(weight) {
  if (weight === '' || weight == null || Number.isNaN(Number(weight))) return '—';
  const n = Number(weight);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
