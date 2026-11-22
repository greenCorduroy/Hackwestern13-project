// Exercise catalog and built-in routines.
//
// Starting weights are given in both units so each stays a round number.
// Exercises with `timed: true` (e.g. a plank) get an optional "Time set" action and a
// per-set duration instead of reps in the editor. Regular lifts go straight from Done to rest.
//
// Lifters can customize a built-in routine or create their own; those are saved through
// src/data/store.js (state.routines) and take precedence over the built-in versions here.

import { convertWeight } from '../lib/units.js';

export const EXERCISES = {
  'goblet-squat': {
    id: 'goblet-squat',
    name: 'Goblet squat',
    group: 'Legs',
    defaultReps: 10,
    startLb: 35,
    startKg: 16,
    how: [
      'Hold one dumbbell vertically against your chest, elbows tucked.',
      'Feet a little wider than hips, toes slightly out.',
      'Sit down between your heels, chest tall, until thighs are about parallel.',
      'Drive through the whole foot to stand. Breathe out on the way up.',
    ],
  },
  'romanian-deadlift': {
    id: 'romanian-deadlift',
    name: 'Romanian deadlift',
    group: 'Legs',
    defaultReps: 10,
    startLb: 65,
    startKg: 30,
    how: [
      'Stand tall holding the weight in front of your thighs.',
      'Soften the knees, then push your hips back as the weight slides down your legs.',
      'Keep your back flat; stop when you feel a strong hamstring stretch.',
      'Squeeze your glutes to return to standing.',
    ],
  },
  'reverse-lunge': {
    id: 'reverse-lunge',
    name: 'Reverse lunge',
    group: 'Legs',
    defaultReps: 8,
    note: 'each side · light dumbbells',
    startLb: 20,
    startKg: 9,
    how: [
      'Hold a light dumbbell in each hand at your sides.',
      'Step one foot back and lower until both knees are near 90°.',
      'Push through the front heel to return. Do all reps on one side, then switch.',
    ],
  },
  'glute-bridge': {
    id: 'glute-bridge',
    name: 'Glute bridge',
    group: 'Legs',
    defaultReps: 12,
    startLb: 45,
    startKg: 20,
    how: [
      'Lie on your back, knees bent, feet flat, weight resting on your hips.',
      'Press through your heels to lift your hips until your body forms a straight line.',
      'Squeeze your glutes at the top, then lower with control.',
    ],
  },
  'step-up': {
    id: 'step-up',
    name: 'Step-up',
    group: 'Legs',
    defaultReps: 8,
    note: 'each side',
    startLb: 15,
    startKg: 7,
    how: [
      'Stand facing a sturdy box or bench, a dumbbell in each hand.',
      'Place one whole foot on the box and drive through it to stand on top.',
      'Step down slowly with the other foot. Do all reps on one side, then switch.',
    ],
  },
  'split-squat': {
    id: 'split-squat',
    name: 'Split squat',
    group: 'Legs',
    defaultReps: 8,
    note: 'each side',
    startLb: 15,
    startKg: 7,
    how: [
      'Take a long stance, one foot forward and one back, dumbbells at your sides.',
      'Lower straight down until your back knee nearly touches the floor.',
      'Push through the front foot to rise. Finish one side, then switch.',
    ],
  },
  'dumbbell-bench-press': {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell bench press',
    group: 'Upper body',
    defaultReps: 10,
    startLb: 20,
    startKg: 9,
    how: [
      'Lie on a bench with a dumbbell in each hand above your chest.',
      'Lower the weights to the sides of your chest, elbows about 45° from your body.',
      'Press back up until your arms are straight.',
    ],
  },
  'dumbbell-row': {
    id: 'dumbbell-row',
    name: 'One-arm dumbbell row',
    group: 'Upper body',
    defaultReps: 10,
    note: 'each side',
    startLb: 25,
    startKg: 11,
    how: [
      'Place one hand and knee on a bench, back flat, dumbbell in the other hand.',
      'Pull the dumbbell toward your hip, keeping your elbow close.',
      'Lower with control. Finish one side, then switch.',
    ],
  },
  'shoulder-press': {
    id: 'shoulder-press',
    name: 'Dumbbell shoulder press',
    group: 'Upper body',
    defaultReps: 10,
    startLb: 15,
    startKg: 7,
    how: [
      'Sit or stand tall with dumbbells at shoulder height, palms forward.',
      'Press overhead until your arms are straight, without arching your back.',
      'Lower back to your shoulders with control.',
    ],
  },
  'lat-pulldown': {
    id: 'lat-pulldown',
    name: 'Lat pulldown',
    group: 'Upper body',
    defaultReps: 10,
    startLb: 50,
    startKg: 22.5,
    how: [
      'Grip the bar a little wider than your shoulders and sit with thighs secured.',
      'Pull the bar to your upper chest, leading with your elbows.',
      'Let it rise slowly until your arms are straight.',
    ],
  },
  plank: {
    id: 'plank',
    name: 'Plank',
    group: 'Core',
    timed: true,
    durationSec: 30,
    defaultReps: 1,
    startLb: 0,
    startKg: 0,
    how: [
      'Forearms on the floor, elbows under shoulders, legs straight behind you.',
      'Brace your stomach and squeeze your glutes so your body is a straight line.',
      'Breathe steadily and hold until the heart is complete.',
    ],
  },
  'wall-sit': {
    id: 'wall-sit',
    name: 'Wall sit',
    group: 'Core',
    timed: true,
    durationSec: 30,
    defaultReps: 1,
    startLb: 0,
    startKg: 0,
    how: [
      'Lean your back against a wall and slide down until your knees are at about 90°.',
      'Keep your weight in your heels and your back flat on the wall.',
      'Hold until the heart is complete, then stand up slowly.',
    ],
  },
};

export const EXERCISE_GROUPS = ['Legs', 'Upper body', 'Core'];

// Built-in routines. `weight: null` means "use the last logged weight, or the catalog start".
export const PLANS = {
  'lower-body-a': {
    id: 'lower-body-a',
    name: 'Lower Body A',
    subtitle: 'Rest to recover · durations are adjustable',
    estMinutes: 35,
    focus: 'legs and hips',
    exercises: [
      { exerciseId: 'goblet-squat', sets: 3, reps: 10 },
      { exerciseId: 'romanian-deadlift', sets: 3, reps: 10 },
      { exerciseId: 'reverse-lunge', sets: 3, reps: 8, note: '3 × 8 each side · light dumbbells' },
    ],
  },
};

export const DEFAULT_ROUTINE_ID = 'lower-body-a';

export function startingWeight(exercise, unit) {
  return unit === 'kg' ? exercise.startKg : exercise.startLb;
}

/** One target set for a catalog exercise. */
export function defaultSet(exerciseId, unit, reps) {
  const cat = EXERCISES[exerciseId];
  return {
    reps: cat.timed ? 1 : reps ?? cat.defaultReps,
    weight: startingWeight(cat, unit),
    durationSec: cat.timed ? cat.durationSec ?? 30 : null,
  };
}

const builtInCache = {};
/** A built-in plan expressed in the same shape as a saved routine. */
export function builtInRoutine(id) {
  const plan = PLANS[id];
  if (!plan) return null;
  if (!builtInCache[id]) {
    builtInCache[id] = {
      id,
      name: plan.name,
      builtIn: true,
      subtitle: plan.subtitle,
      focus: plan.focus,
      unit: 'lb',
      createdAt: null,
      updatedAt: null,
      exercises: plan.exercises.map((ex) => ({
        key: ex.exerciseId,
        exerciseId: ex.exerciseId,
        note: ex.note ?? null,
        restSec: null,
        sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: null, durationSec: null })),
      })),
    };
  }
  return builtInCache[id];
}

/** The fields suggestWeight() needs, built from a routine exercise. */
export function suggestionExercise(rex, routineUnit) {
  const cat = EXERCISES[rex.exerciseId];
  const first = rex.sets[0] ?? {};
  const w = first.weight;
  return {
    id: cat.id,
    name: cat.name,
    sets: rex.sets.length,
    reps: first.reps ?? cat.defaultReps,
    startLb: w != null ? convertWeight(w, routineUnit, 'lb') : cat.startLb,
    startKg: w != null ? convertWeight(w, routineUnit, 'kg') : cat.startKg,
  };
}

/** Rough duration: work + rest per set, plus a warm-up. */
export function estimateMinutes(routine, defaultRestSec) {
  if (routine.builtIn && PLANS[routine.id] && !routine.updatedAt) return PLANS[routine.id].estMinutes;
  const sec = routine.exercises.reduce(
    (t, ex) =>
      t +
      ex.sets.reduce((u, set) => u + (set.durationSec ?? 40) + (ex.restSec ?? defaultRestSec), 0),
    0
  );
  return Math.max(10, Math.round(sec / 60 / 5) * 5 + 5);
}
