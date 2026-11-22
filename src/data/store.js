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
//   routines:  { [id]: { id, name, builtIn, unit, createdAt, updatedAt,
//                 exercises: [{ key, exerciseId, note, restSec | null,
//                               sets: [{ reps, weight | null, durationSec | null }] }] } },
//   selectedRoutineId,
//   activeWorkout: null | draft (see createDraft below),
// }
//
// Routines are templates. Starting a workout copies the routine into `activeWorkout`, and every
// logged set stores its own exercise name, weight and reps, so editing or deleting a routine
// only changes future sessions; history is never rewritten.

import { useSyncExternalStore } from 'react';
import { todayKey } from '../lib/date.js';
import { convertWeight, roundTo, toKg } from '../lib/units.js';
import {
  DEFAULT_ROUTINE_ID,
  EXERCISES,
  PLANS,
  builtInRoutine,
  startingWeight,
  suggestionExercise,
} from './plans.js';

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
    routines: {},
    selectedRoutineId: DEFAULT_ROUTINE_ID,
    activeWorkout: null,
  };
}

/** Drafts saved before routines existed only had rows; fill in the routine snapshot. */
function migrateDraft(d) {
  if (!d || d.name) return d;
  const plan = PLANS[d.planId];
  if (!plan) return null;
  const routine = builtInRoutine(d.planId);
  return {
    ...d,
    name: plan.name,
    subtitle: plan.subtitle,
    routineVersion: null,
    exercises: d.exercises.map((dex, i) => {
      const rex = routine.exercises[i];
      const sx = suggestionExercise(rex, routine.unit);
      const cat = EXERCISES[rex.exerciseId];
      return {
        ...dex,
        key: rex.key,
        exerciseId: rex.exerciseId,
        name: cat.name,
        note: rex.note ?? null,
        timed: !!cat.timed,
        restSec: null,
        targetReps: sx.reps,
        startLb: sx.startLb,
        startKg: sx.startKg,
        rows: dex.rows.map((r) => ({ ...r, targetReps: r.targetReps ?? sx.reps })),
      };
    }),
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
        routines: parsed.routines ?? {},
        selectedRoutineId: parsed.selectedRoutineId ?? DEFAULT_ROUTINE_ID,
        activeWorkout: migrateDraft(parsed.activeWorkout ?? null),
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
// Routines (built-in plans, customized copies of them, and lifter-created workouts)
// ---------------------------------------------------------------------------

export function getRoutine(s, id) {
  return s.routines[id] ?? builtInRoutine(id);
}

export function getSelectedRoutine(s) {
  return getRoutine(s, s.selectedRoutineId) ?? builtInRoutine(DEFAULT_ROUTINE_ID);
}

/** Built-ins first (customized version if saved), then the lifter's own, oldest first. */
export function listRoutines(s) {
  const builtIns = Object.keys(PLANS).map((id) => getRoutine(s, id));
  const custom = Object.values(s.routines)
    .filter((r) => !PLANS[r.id])
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  return [...builtIns, ...custom];
}

/**
 * Create or update a routine. Returns its id.
 * Saving a built-in stores a customized copy under the same id.
 */
export function saveRoutine({ id, name, unit, exercises }) {
  const routineId = id ?? `routine-${uid()}`;
  setState((s) => {
    const prev = getRoutine(s, routineId);
    const now = new Date().toISOString();
    const routine = {
      id: routineId,
      name: name.trim(),
      builtIn: !!PLANS[routineId],
      unit,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      exercises: exercises.map((ex) => ({
        key: ex.key ?? uid(),
        exerciseId: ex.exerciseId,
        note: ex.note ?? null,
        restSec: ex.restSec ?? null,
        sets: ex.sets.map((set) => ({
          reps: Number(set.reps) || 0,
          weight: set.weight === '' || set.weight == null ? 0 : Number(set.weight),
          durationSec: set.durationSec ?? null,
        })),
      })),
    };
    const next = { ...s, routines: { ...s.routines, [routineId]: routine } };
    // An unstarted preview of this routine picks up the edits straight away.
    const d = s.activeWorkout;
    if (d && !d.startedAt && d.planId === routineId) next.activeWorkout = createDraft(next, routineId);
    return next;
  });
  return routineId;
}

export function deleteRoutine(id) {
  setState((s) => {
    if (PLANS[id] || s.activeWorkout?.startedAt && s.activeWorkout.planId === id) return s;
    const routines = { ...s.routines };
    delete routines[id];
    const selectedRoutineId = s.selectedRoutineId === id ? DEFAULT_ROUTINE_ID : s.selectedRoutineId;
    const d = s.activeWorkout;
    const next = { ...s, routines, selectedRoutineId };
    if (d && !d.startedAt && d.planId === id) next.activeWorkout = createDraft(next, selectedRoutineId);
    return next;
  });
}

/** Choose the routine the Workout screen shows. Ignored while another workout is running. */
export function selectRoutine(id) {
  setState((s) => {
    const d = s.activeWorkout;
    if (d?.startedAt && d.planId !== id) return s;
    const next = { ...s, selectedRoutineId: id };
    if (!d || (!d.startedAt && d.planId !== id)) next.activeWorkout = createDraft(next, id);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Active workout (draft rows the lifter edits, persisted so a refresh never loses them)
// ---------------------------------------------------------------------------

function createDraft(s, routineId) {
  const routine = getRoutine(s, routineId) ?? builtInRoutine(DEFAULT_ROUTINE_ID);
  const unit = s.profile.unit;
  const sessionId = uid();
  const toUnit = (w) => roundTo(convertWeight(w, routine.unit, unit), 0.5);
  return {
    sessionId,
    planId: routine.id,
    name: routine.name,
    subtitle: routine.subtitle ?? null,
    routineVersion: routine.updatedAt,
    date: todayKey(),
    startedAt: null,
    unit,
    rest: null, // { startedAt, durationSec, exerciseId }
    exercises: routine.exercises.map((rex) => {
      const cat = EXERCISES[rex.exerciseId];
      const sx = suggestionExercise(rex, routine.unit);
      const last = lastSessionSets(s, rex.exerciseId, sessionId);
      // Sets with no target weight start at what the lifter did last time (or the catalog
      // start); the suggestion is offered separately so they can accept or ignore it.
      const lastWeight = last.length
        ? roundTo(convertWeight(last[0].weight, last[0].unit, unit), 0.5)
        : startingWeight(cat, unit);
      return {
        key: rex.key,
        exerciseId: rex.exerciseId,
        name: cat.name,
        note: rex.note ?? null,
        timed: !!cat.timed,
        restSec: rex.restSec ?? null,
        targetReps: sx.reps,
        startLb: sx.startLb,
        startKg: sx.startKg,
        warmup: null, // 'easy' | 'right' | 'heavy'
        acceptedSuggestion: null,
        rows: rex.sets.map((t, i) => ({
          weight:
            t.weight != null
              ? toUnit(t.weight)
              : last[i]
                ? roundTo(convertWeight(last[i].weight, last[i].unit, unit), 0.5)
                : lastWeight,
          reps: t.weight == null && last[i] ? last[i].reps : t.reps,
          targetReps: t.reps,
          targetDurationSec: t.durationSec ?? null,
          timer: null, // { durationSec, startedAt }
          doneSetId: null,
        })),
      };
    }),
  };
}

/**
 * Make sure there is a draft for the selected routine. An unstarted draft is rebuilt when it
 * is from another day, another routine, or an older version of the routine.
 */
export function ensureActiveWorkout(routineId) {
  const s = state;
  const id = routineId ?? s.selectedRoutineId;
  const d = s.activeWorkout;
  if (d?.startedAt) return;
  const routine = getRoutine(s, id);
  if (d && d.date === todayKey() && d.planId === id && d.routineVersion === routine?.updatedAt) return;
  setState((cur) => ({ ...cur, activeWorkout: createDraft(cur, id) }));
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
  const session = {
    id: draft.sessionId,
    planId: draft.planId,
    name: draft.name,
    date: draft.date,
    startedAt,
    endedAt: null,
    durationSec: null,
    status: 'in_progress',
    checkIn: s.checkIns[draft.date] ?? null,
  };
  return {
    draft: { ...draft, startedAt },
    s: {
      ...s,
      selectedRoutineId: draft.planId,
      sessions: [...s.sessions.filter((x) => x.id !== draft.sessionId), session],
    },
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

/** Rest length for a workout exercise: routine setting, then older per-exercise prefs, then default. */
export function restSecFor(s, dex) {
  return dex?.restSec ?? s.prefs.restOverrides?.[dex?.exerciseId] ?? s.prefs.restSec;
}

/**
 * Change one exercise's rest from the rest-timer sheet: applies to this workout now and is
 * saved to the routine for next time (null = use the default).
 */
export function setExerciseRest(exIdx, sec) {
  setState((s) => {
    const d = s.activeWorkout;
    if (!d) return s;
    const dex = d.exercises[exIdx];
    const restOverrides = { ...s.prefs.restOverrides };
    delete restOverrides[dex.exerciseId];
    const activeWorkout = {
      ...d,
      exercises: d.exercises.map((ex, i) => (i === exIdx ? { ...ex, restSec: sec } : ex)),
    };
    const routine = getRoutine(s, d.planId);
    let routines = s.routines;
    if (routine) {
      const now = new Date().toISOString();
      routines = {
        ...routines,
        [routine.id]: {
          ...routine,
          createdAt: routine.createdAt ?? now,
          updatedAt: now,
          exercises: routine.exercises.map((rex) => (rex.key === dex.key ? { ...rex, restSec: sec } : rex)),
        },
      };
      activeWorkout.routineVersion = now;
    }
    return { ...s, prefs: { ...s.prefs, restOverrides }, routines, activeWorkout };
  });
}

/** Log a finished set with the actual weight and reps, then start the rest countdown. */
export function completeSet(exIdx, rowIdx, { weight, reps, suggestedWeight }) {
  setState((s) => {
    if (!s.activeWorkout) return s;
    // Already saved (e.g. a double tap): never log the same row twice.
    if (s.activeWorkout.exercises[exIdx].rows[rowIdx].doneSetId) return s;
    const r = withStarted(s.activeWorkout, s);
    const d = r.draft;
    const ex = d.exercises[exIdx];
    const row = ex.rows[rowIdx];
    const id = uid();
    const record = {
      id,
      sessionId: d.sessionId,
      date: d.date,
      planId: d.planId,
      routineName: d.name,
      exerciseId: ex.exerciseId,
      exerciseName: ex.name,
      setNumber: rowIdx + 1,
      weight: Number(weight),
      unit: d.unit,
      weightKg: Math.round(toKg(Number(weight), d.unit) * 100) / 100,
      reps: Number(reps),
      targetReps: row.targetReps ?? ex.targetReps,
      durationSec: row.timer ? row.timer.durationSec : null,
      warmup: ex.warmup,
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
      rest: { startedAt: Date.now(), durationSec: restSecFor(r.s, ex), exerciseId: ex.exerciseId },
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
