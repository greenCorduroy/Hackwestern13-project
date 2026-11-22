// Workout plans. Starting weights are stored in kg so they convert cleanly to either unit;
// `startLb` keeps the round numbers from the design for lb users.
//
// Exercises can set `timed: true` and `durationSec` (e.g. a plank) to get an optional
// "Time set" action. Regular lifts go straight from Done to rest.
//
// A later pass will generate plans from the lifter's goals; for now there is one plan.

export const PLANS = {
  'lower-body-a': {
    id: 'lower-body-a',
    name: 'Lower Body A',
    subtitle: 'Rest to recover · durations are adjustable',
    estMinutes: 35,
    focus: 'legs and hips',
    exercises: [
      {
        id: 'goblet-squat',
        name: 'Goblet squat',
        sets: 3,
        reps: 10,
        startLb: 35,
        startKg: 16,
        how: [
          'Hold one dumbbell vertically against your chest, elbows tucked.',
          'Feet a little wider than hips, toes slightly out.',
          'Sit down between your heels, chest tall, until thighs are about parallel.',
          'Drive through the whole foot to stand. Breathe out on the way up.',
        ],
      },
      {
        id: 'romanian-deadlift',
        name: 'Romanian deadlift',
        sets: 3,
        reps: 10,
        startLb: 65,
        startKg: 30,
        how: [
          'Stand tall holding the weight in front of your thighs.',
          'Soften the knees, then push your hips back as the weight slides down your legs.',
          'Keep your back flat; stop when you feel a strong hamstring stretch.',
          'Squeeze your glutes to return to standing.',
        ],
      },
      {
        id: 'reverse-lunge',
        name: 'Reverse lunge',
        sets: 3,
        reps: 8,
        note: '3 × 8 each side · light dumbbells',
        startLb: 20,
        startKg: 9,
        how: [
          'Hold a light dumbbell in each hand at your sides.',
          'Step one foot back and lower until both knees are near 90°.',
          'Push through the front heel to return. Do all reps on one side, then switch.',
        ],
      },
    ],
  },
};

export const TODAYS_PLAN_ID = 'lower-body-a';

export function startingWeight(exercise, unit) {
  return unit === 'kg' ? exercise.startKg : exercise.startLb;
}
