// Shared app data, persisted to localStorage.
//
// Every screen reads from this one store so future screens (Cycle, history graphs, plans,
// meals) see the same check-ins, cycle events, sessions and completed sets.
//
// Shape (version 1):
// {
//   profile:   { name, unit: 'lb' | 'kg' },
//   prefs:     { restSec, restOverrides: { [exerciseId]: seconds } },
//   checkIns:  { [YYYY-MM-DD]: { date, status: 'done' | 'skipped', flow, cramps, energy,
//                                periodStarted, savedAt, updatedAt } },
//   cycleEvents: [{ id, type: 'period_start', date, source: 'checkin', createdAt }],
//   sessions:  [{ id, planId, name, date, startedAt, endedAt, durationSec,
//                 status: 'in_progress' | 'completed', checkIn }],
//   sets:      [{ id, sessionId, date, planId, exerciseId, exerciseName, setNumber,
//                 weight, unit, weightKg, reps, targetReps, durationSec, warmup,
//                 suggestedWeight, completedAt }],
//   activeWorkout: null | draft (see createDraft below),
// }

import { useSyncExternalStore } from 'react';
import { todayKey } from '../lib/date.js';
import { convertWeight, roundTo, toKg } from '../lib/units.js';
import { PLANS, startingWeight } from './plans.js';

const KEY = 'tempo:v1';

function initialState() {
  return {
    version: 1,
    profile: { name: 'Alex', unit: 'lb' },
    prefs: { restSec: 90, restOverrides: {} },
    checkIns: {},
    cycleEvents: [],
    sessions: [],
    sets: [],
    activeWorkout: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = initialState();
      return {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...parsed.profile },
        prefs: {
          ...base.prefs,
          ...parsed.prefs,
          restOverrides: { ...(parsed.prefs?.restOverrides ?? {}) },
        },
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initialState();
}

let state = load();
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function setState(updater) {
  state = updater(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
  emit();
}

if (typeof window !== 'undefined') {
  // Keep multiple tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  });
}

export function getState() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribe to the whole store, or to a slice. Selectors must return existing references. */
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resetAllData() {
  setState(() => initialState());
}

// ---------------------------------------------------------------------------
// Check-ins & cycle
// ---------------------------------------------------------------------------

export function getCheckIn(s, date) {
  return s.checkIns[date];
}

export function saveCheckIn(date, { flow, cramps, energy, periodStarted }) {
  setState((s) => {
    const now = new Date().toISOString();
    const prev = s.checkIns[date];
    const entry = {
      date,
      status: 'done',
      flow,
      cramps,
      energy,
      periodStarted: !!periodStarted,
      savedAt: prev?.savedAt ?? now,
      updatedAt: now,
    };
    // One period-start entry per day from the check-in; editing the check-in replaces it.
    let cycleEvents = s.cycleEvents.filter(
      (e) => !(e.type === 'period_start' && e.date === date && e.source === 'checkin')
    );
    if (periodStarted) {
      cycleEvents = [
        ...cycleEvents,
        { id: uid(), type: 'period_start', date, source: 'checkin', createdAt: now },
      ].sort((a, b) => a.date.localeCompare(b.date));
    }
    return { ...s, checkIns: { ...s.checkIns, [date]: entry }, cycleEvents };
  });
}

export function skipCheckIn(date) {
  setState((s) => ({
    ...s,
    checkIns: {
      ...s.checkIns,
      [date]: { date, status: 'skipped', savedAt: new Date().toISOString() },
    },
  }));
}

/** Most recent period start on or before `date`, with the cycle day number (day 1 = start). */
export function cycleDayFor(s, date) {
  const starts = s.cycleEvents.filter((e) => e.type === 'period_start' && e.date <= date);
  if (!starts.length) return null;
  const last = starts[starts.length - 1];
  const [y1, m1, d1] = last.date.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  const diff = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  return { day: diff + 1, startDate: last.date };
}

// ---------------------------------------------------------------------------
// Workout history
// ---------------------------------------------------------------------------

/** Completed sets for an exercise from the most recent other session, in set order. */
export function lastSessionSets(s, exerciseId, excludeSessionId) {
  const sets = s.sets.filter(
    (x) => x.exerciseId === exerciseId && x.sessionId !== excludeSessionId
  );
  if (!sets.length) return [];
  const latest = sets.reduce((a, b) => (a.completedAt > b.completedAt ? a : b));
  return sets
    .filter((x) => x.sessionId === latest.sessionId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function completedSessionOn(s, date) {
  return s.sessions.filter((x) => x.date === date && x.status === 'completed');
}

// ---------------------------------------------------------------------------
// Active workout (draft rows the lifter edits, persisted so a refresh never loses them)
// ---------------------------------------------------------------------------

function createDraft(s, planId) {
  const plan = PLANS[planId];
  const unit = s.profile.unit;
  const sessionId = uid();
  return {
    sessionId,
    planId,
    date: todayKey(),
    startedAt: null,
    unit,
    rest: null, // { startedAt, durationSec, exerciseId }
    exercises: plan.exercises.map((ex) => {
      const last = lastSessionSets(s, ex.id, sessionId);
      // Rows start at what the lifter actually did last time (or the plan's start weight);
      // the suggestion is offered separately so they can accept or ignore it.
      const lastWeight = last.length
        ? roundTo(convertWeight(last[0].weight, last[0].unit, unit), 0.5)
        : startingWeight(ex, unit);
      return {
        exerciseId: ex.id,
        warmup: null, // 'easy' | 'right' | 'heavy'
        acceptedSuggestion: null,
        rows: Array.from({ length: ex.sets }, (_, i) => ({
          weight: last[i] ? roundTo(convertWeight(last[i].weight, last[i].unit, unit), 0.5) : lastWeight,
          reps: last[i] ? last[i].reps : ex.reps,
          timer: null, // { durationSec, startedAt }
          doneSetId: null,
        })),
      };
    }),
  };
}

/** Make sure there is a draft for today's plan (re-created if an unstarted draft is stale). */
export function ensureActiveWorkout(planId) {
  const s = state;
  const d = s.activeWorkout;
  if (d && (d.startedAt || d.date === todayKey())) return;
  setState((cur) => ({ ...cur, activeWorkout: createDraft(cur, planId) }));
}

function updateDraft(fn) {
  setState((s) => (s.activeWorkout ? { ...s, activeWorkout: fn(s.activeWorkout, s) } : s));
}

function updateRow(draft, exIdx, rowIdx, patch) {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) =>
      i !== exIdx
        ? ex
        : { ...ex, rows: ex.rows.map((r, j) => (j === rowIdx ? { ...r, ...patch } : r)) }
    ),
  };
}

function withStarted(draft, s) {
  if (draft.startedAt) return { draft, s };
  const startedAt = Date.now();
  const plan = PLANS[draft.planId];
  const session = {
    id: draft.sessionId,
    planId: draft.planId,
    name: plan.name,
    date: draft.date,
    startedAt,
    endedAt: null,
    durationSec: null,
    status: 'in_progress',
    checkIn: s.checkIns[draft.date] ?? null,
  };
  return {
    draft: { ...draft, startedAt },
    s: { ...s, sessions: [...s.sessions.filter((x) => x.id !== draft.sessionId), session] },
  };
}

export function startWorkout() {
  setState((s) => {
    if (!s.activeWorkout) return s;
    const r = withStarted(s.activeWorkout, s);
    return { ...r.s, activeWorkout: r.draft };
  });
}

export function updateRowField(exIdx, rowIdx, field, value) {
  updateDraft((d) => updateRow(d, exIdx, rowIdx, { [field]: value }));
}

export function setUnit(unit) {
  setState((s) => {
    const d = s.activeWorkout;
    const next = { ...s, profile: { ...s.profile, unit } };
    if (!d || d.unit === unit) return next;
    return {
      ...next,
      activeWorkout: {
        ...d,
        unit,
        exercises: d.exercises.map((ex) => ({
          ...ex,
          acceptedSuggestion:
            ex.acceptedSuggestion == null ? null : convertWeight(ex.acceptedSuggestion, d.unit, unit),
          rows: ex.rows.map((r) => ({
            ...r,
            weight: r.weight === '' ? '' : convertWeight(r.weight, d.unit, unit),
          })),
        })),
      },
    };
  });
}

export function setWarmup(exIdx, warmup) {
  updateDraft((d) => ({
    ...d,
    exercises: d.exercises.map((ex, i) => (i === exIdx ? { ...ex, warmup } : ex)),
  }));
}

/** Fill every not-yet-logged set of an exercise with the suggested weight. */
export function acceptSuggestion(exIdx, weight) {
  updateDraft((d) => ({
    ...d,
    exercises: d.exercises.map((ex, i) =>
      i !== exIdx
        ? ex
        : {
            ...ex,
            acceptedSuggestion: weight,
            rows: ex.rows.map((r) => (r.doneSetId ? r : { ...r, weight })),
          }
    ),
  }));
}

export function startSetTimer(exIdx, rowIdx, durationSec) {
  setState((s) => {
    if (!s.activeWorkout) return s;
    const r = withStarted(s.activeWorkout, s);
    // Only one timed set runs at a time: cancel any other timer that is still counting down.
    const cleared = {
      ...r.draft,
      exercises: r.draft.exercises.map((ex) => ({
        ...ex,
        rows: ex.rows.map((row) =>
          row.timer &&
          !row.doneSetId &&
          row.timer.startedAt &&
          Date.now() < row.timer.startedAt + row.timer.durationSec * 1000
            ? { ...row, timer: null }
            : row
        ),
      })),
    };
    return {
      ...r.s,
      activeWorkout: updateRow(cleared, exIdx, rowIdx, {
        timer: { durationSec, startedAt: Date.now() },
      }),
    };
  });
}

export function cancelSetTimer(exIdx, rowIdx) {
  updateDraft((d) => updateRow(d, exIdx, rowIdx, { timer: null }));
}

/** Rest length for an exercise: its override if set, otherwise the default. */
export function restSecFor(s, exerciseId) {
  return s.prefs.restOverrides?.[exerciseId] ?? s.prefs.restSec;
}

/** Log a finished set with the actual weight and reps, then start the rest countdown. */
export function completeSet(exIdx, rowIdx, { weight, reps, suggestedWeight }) {
  setState((s) => {
    if (!s.activeWorkout) return s;
    // Already saved (e.g. a double tap): never log the same row twice.
    if (s.activeWorkout.exercises[exIdx].rows[rowIdx].doneSetId) return s;
    const r = withStarted(s.activeWorkout, s);
    const d = r.draft;
    const plan = PLANS[d.planId];
    const ex = plan.exercises[exIdx];
    const row = d.exercises[exIdx].rows[rowIdx];
    const id = uid();
    const record = {
      id,
      sessionId: d.sessionId,
      date: d.date,
      planId: d.planId,
      exerciseId: ex.id,
      exerciseName: ex.name,
      setNumber: rowIdx + 1,
      weight: Number(weight),
      unit: d.unit,
      weightKg: Math.round(toKg(Number(weight), d.unit) * 100) / 100,
      reps: Number(reps),
      targetReps: ex.reps,
      durationSec: row.timer ? row.timer.durationSec : null,
      warmup: d.exercises[exIdx].warmup,
      suggestedWeight: suggestedWeight ?? null,
      completedAt: new Date().toISOString(),
    };
    const draft = {
      ...updateRow(d, exIdx, rowIdx, {
        weight: Number(weight),
        reps: Number(reps),
        doneSetId: id,
        timer: row.timer ? { ...row.timer, startedAt: null, finished: true } : null,
      }),
      rest: { startedAt: Date.now(), durationSec: restSecFor(r.s, ex.id), exerciseId: ex.id },
    };
    return { ...r.s, sets: [...r.s.sets, record], activeWorkout: draft };
  });
}

export function undoSet(exIdx, rowIdx) {
  setState((s) => {
    const d = s.activeWorkout;
    if (!d) return s;
    const id = d.exercises[exIdx].rows[rowIdx].doneSetId;
    return {
      ...s,
      sets: s.sets.filter((x) => x.id !== id),
      activeWorkout: updateRow(d, exIdx, rowIdx, { doneSetId: null }),
    };
  });
}

/** Default rest between sets, remembered across workouts. */
export function setRestDuration(sec) {
  setState((s) => ({ ...s, prefs: { ...s.prefs, restSec: sec } }));
}

/** Per-exercise rest override; pass null to go back to the default. */
export function setRestOverride(exerciseId, sec) {
  setState((s) => {
    const restOverrides = { ...s.prefs.restOverrides };
    if (sec == null) delete restOverrides[exerciseId];
    else restOverrides[exerciseId] = sec;
    return { ...s, prefs: { ...s.prefs, restOverrides } };
  });
}

export function addRestTime(sec) {
  updateDraft((d) => (d.rest ? { ...d, rest: { ...d.rest, durationSec: d.rest.durationSec + sec } } : d));
}

export function endRest() {
  updateDraft((d) => ({ ...d, rest: null }));
}

export function finishWorkout() {
  setState((s) => {
    const d = s.activeWorkout;
    if (!d) return s;
    const endedAt = Date.now();
    const sessions = s.sessions.map((x) =>
      x.id === d.sessionId
        ? {
            ...x,
            endedAt,
            durationSec: Math.round((endedAt - (d.startedAt ?? endedAt)) / 1000),
            status: 'completed',
            checkIn: s.checkIns[d.date] ?? x.checkIn,
          }
        : x
    );
    return { ...s, sessions, activeWorkout: null };
  });
}

/** Throw away the in-progress workout and any sets it logged. */
export function discardWorkout() {
  setState((s) => {
    const d = s.activeWorkout;
    if (!d) return s;
    return {
      ...s,
      sets: s.sets.filter((x) => x.sessionId !== d.sessionId),
      sessions: s.sessions.filter((x) => x.id !== d.sessionId),
      activeWorkout: null,
    };
  });
}
