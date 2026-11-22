// Local weight-suggestion rules. Each rule adds a plain-language reason so the
// "Why this weight?" sheet can explain the number without an AI call.
// A later pass will hand these same inputs to Gemini for a richer explanation.

import { formatShortDate } from '../lib/date.js';
import { PROGRESSION_STEP, WEIGHT_STEP, convertWeight, formatWeight, roundTo } from '../lib/units.js';
import { startingWeight } from './plans.js';

const ENERGY_ADJ = { low: -0.1, usual: 0, high: 0 };
const CRAMPS_ADJ = { none: 0, mild: 0, moderate: -0.05, strong: -0.1 };
const FLOW_ADJ = { none: 0, light: 0, medium: 0, heavy: -0.05 };
const WARMUP_ADJ = { easy: 0.05, right: 0, heavy: -0.1 };
const MAX_CHECKIN_CUT = -0.2;

/**
 * @param {object} args
 * @param {object} args.exercise   plan exercise ({ name, sets, reps, startLb, startKg })
 * @param {'lb'|'kg'} args.unit
 * @param {Array}  args.lastSets   completed sets from the previous session for this exercise
 * @param {object|undefined} args.checkIn  today's check-in record
 * @param {'easy'|'right'|'heavy'|null} args.warmup
 * @returns {{ weight:number, unit:string, base:number, reasons:Array<{title:string,text:string}>, summary:string }}
 */
export function suggestWeight({ exercise, unit, lastSets, checkIn, warmup }) {
  const reasons = [];
  const u = unit;
  let base;
  let progression = 0;

  // 1. Previous workout
  if (lastSets && lastSets.length) {
    const weights = lastSets.map((s) => convertWeight(s.weight, s.unit, u));
    base = roundTo(Math.max(...weights), 0.5);
    const repsList = lastSets.map((s) => s.reps).join(', ');
    const hitAll =
      lastSets.length >= exercise.sets && lastSets.every((s) => s.reps >= exercise.reps);
    const shortBy2 = lastSets.some((s) => s.reps <= exercise.reps - 2);
    const when = formatShortDate(lastSets[0].date);
    if (hitAll) {
      progression = PROGRESSION_STEP[u];
      reasons.push({
        title: 'Last workout',
        text: `On ${when} you did ${formatWeight(base)} ${u} for ${repsList} reps, hitting every target. That earns a small step up of ${formatWeight(progression)} ${u}.`,
      });
    } else if (shortBy2) {
      reasons.push({
        title: 'Last workout',
        text: `On ${when} you did ${formatWeight(base)} ${u} for ${repsList} reps, a little short of ${exercise.reps}. Stay at this weight until every set feels solid.`,
      });
    } else {
      reasons.push({
        title: 'Last workout',
        text: `On ${when} you did ${formatWeight(base)} ${u} for ${repsList} reps, close to the target. Repeat the weight and aim for all ${exercise.reps} reps.`,
      });
    }
  } else {
    base = startingWeight(exercise, u);
    reasons.push({
      title: 'Starting point',
      text: `You haven't logged ${exercise.name.toLowerCase()} yet, so this starts from the plan's beginner-friendly ${formatWeight(base)} ${u}. Finish a workout and the next suggestion will use your real numbers.`,
    });
  }

  // 2. Today's check-in
  let checkInAdj = 0;
  if (checkIn && checkIn.status === 'done') {
    const notes = [];
    const e = ENERGY_ADJ[checkIn.energy] ?? 0;
    const c = CRAMPS_ADJ[checkIn.cramps] ?? 0;
    const f = FLOW_ADJ[checkIn.flow] ?? 0;
    if (e) notes.push(`energy is low (${Math.round(e * 100)}%)`);
    if (c) notes.push(`cramps are ${checkIn.cramps} (${Math.round(c * 100)}%)`);
    if (f) notes.push(`flow is heavy (${Math.round(f * 100)}%)`);
    checkInAdj = Math.max(MAX_CHECKIN_CUT, e + c + f);
    if (checkInAdj < 0) {
      let text = `Today ${notes.join(', ')}, so the weight comes down a bit. Lighter days still count.`;
      if (progression) {
        text += ' The step up from last time waits for a stronger day.';
        progression = 0;
      }
      reasons.push({ title: "Today's check-in", text });
    } else if (checkIn.energy === 'high') {
      reasons.push({
        title: "Today's check-in",
        text: 'Your energy is high and nothing in your check-in calls for going lighter.',
      });
    } else {
      reasons.push({
        title: "Today's check-in",
        text: 'Your check-in looks steady, so it doesn\'t change the weight today.',
      });
    }
  } else {
    reasons.push({
      title: "Today's check-in",
      text:
        checkIn && checkIn.status === 'skipped'
          ? 'You skipped today\'s check-in, so nothing is adjusted for how you feel.'
          : 'No check-in yet today, so nothing is adjusted for how you feel.',
    });
  }

  // 3. Warm-up feedback
  const warmAdj = warmup ? WARMUP_ADJ[warmup] ?? 0 : 0;
  if (warmup === 'easy') {
    reasons.push({ title: 'Warm-up', text: 'Your warm-up felt easy, so the weight goes up about 5%.' });
  } else if (warmup === 'heavy') {
    reasons.push({
      title: 'Warm-up',
      text: 'Your warm-up felt heavy, so the weight comes down about 10% to keep your form clean.',
    });
  } else if (warmup === 'right') {
    reasons.push({ title: 'Warm-up', text: 'Your warm-up felt about right, so no change.' });
  } else {
    reasons.push({
      title: 'Warm-up',
      text: 'Do a light warm-up set and tell us how it felt to fine-tune this number.',
    });
  }

  const raw = (base + progression) * (1 + checkInAdj) * (1 + warmAdj);
  const weight = Math.max(WEIGHT_STEP[u], roundTo(raw, WEIGHT_STEP[u]));
  const diff = Math.round((weight - base) * 10) / 10;
  const summary =
    diff === 0
      ? lastSets && lastSets.length
        ? 'Same as last time'
        : 'Plan starting weight'
      : diff > 0
        ? `Up ${formatWeight(diff)} ${u}`
        : `Down ${formatWeight(Math.abs(diff))} ${u}`;

  return { weight, unit: u, base, reasons, summary };
}
