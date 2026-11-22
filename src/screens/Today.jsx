import { useMemo, useState } from 'react';
import Sheet from '../components/Sheet.jsx';
import { ArrowUpRightIcon } from '../components/Icons.jsx';
import { PLANS, TODAYS_PLAN_ID } from '../data/plans.js';
import { completedSessionOn, cycleDayFor, lastSessionSets, useStore } from '../data/store.js';
import { suggestWeight } from '../data/suggest.js';
import { formatLongDate, todayKey } from '../lib/date.js';
import { formatWeight } from '../lib/units.js';
import { CRAMP_OPTIONS, ENERGY_OPTIONS, FLOW_OPTIONS, labelFor } from './CheckInSheet.jsx';

function whyThisWorkout(plan, checkIn) {
  const lines = [
    `${plan.name} works your ${plan.focus} with ${plan.exercises.length} moves that build a strong base: a squat, a hinge and a single-leg lunge.`,
    'Each exercise uses moderate reps (8–10), which is a good range for building strength and learning form.',
  ];
  if (checkIn?.status === 'done') {
    const easier =
      checkIn.energy === 'low' || ['moderate', 'strong'].includes(checkIn.cramps) || checkIn.flow === 'heavy';
    lines.push(
      easier
        ? "Your check-in suggests an easier day, so today's suggested weights are a little lighter. Steady, controlled reps still count."
        : 'Your check-in looks steady, so suggestions follow your normal progression.'
    );
  } else {
    lines.push('Do a check-in and the suggested weights will adjust to how you feel today.');
  }
  return lines;
}

export default function Today({ onStartWorkout, onEditCheckIn, onViewCycle, onToast }) {
  const s = useStore();
  const date = todayKey();
  const plan = PLANS[TODAYS_PLAN_ID];
  const checkIn = s.checkIns[date];
  const cycle = cycleDayFor(s, date);
  const active = s.activeWorkout;
  const doneToday = completedSessionOn(s, date);
  const [whyOpen, setWhyOpen] = useState(false);

  const first = plan.exercises[0];
  const firstUp = useMemo(
    () =>
      suggestWeight({
        exercise: first,
        unit: s.profile.unit,
        lastSets: lastSessionSets(s, first.id, active?.sessionId),
        checkIn,
        warmup: null,
      }),
    [s, first, active?.sessionId, checkIn]
  );

  const inProgress = active?.startedAt && active.planId === plan.id;
  const loggedToday = doneToday.reduce(
    (n, sess) => n + s.sets.filter((x) => x.sessionId === sess.id).length,
    0
  );

  return (
    <div className="screen today">
      <div className="eyebrow muted-eyebrow">{formatLongDate(date)}</div>
      <h1 className="display">Your pace. Your progress.</h1>
      <p className="muted">Welcome back, {s.profile.name}. Let's keep building.</p>

      <section className="card plan-card" aria-labelledby="plan-title">
        <div className="eyebrow">Today's plan</div>
        <h2 id="plan-title" className="plan-title">
          {plan.name}
        </h2>
        <p className="plan-meta">
          {plan.exercises.length} exercises · about {plan.estMinutes} min
        </p>

        <div className="first-up">
          <div className="eyebrow">First up</div>
          <div className="first-up-name">{first.name}</div>
          <div className="first-up-meta">
            {first.sets} sets × {first.reps} reps · {formatWeight(firstUp.weight)} {firstUp.unit}
          </div>
        </div>

        {doneToday.length > 0 && !inProgress && (
          <p className="done-note">
            Completed today · {loggedToday} {loggedToday === 1 ? 'set' : 'sets'} in{' '}
            {Math.max(1, Math.round((doneToday.at(-1).durationSec ?? 0) / 60))} min
          </p>
        )}

        <button className="btn primary block" onClick={onStartWorkout}>
          {inProgress ? 'Resume workout' : doneToday.length ? 'Start another round' : 'Start workout'}
        </button>
        <button className="link" onClick={() => setWhyOpen(true)}>
          Why this workout? <ArrowUpRightIcon />
        </button>
      </section>

      <button
        className="btn text build-own"
        onClick={() => onToast('Building your own workout arrives in a later pass.')}
      >
        Build my own workout
      </button>

      <section className="card checkin-card" aria-labelledby="checkin-title">
        <div className="row-between">
          <h3 id="checkin-title" className="card-title">
            Today's check-in
          </h3>
          <button className="link small-link" onClick={onEditCheckIn}>
            {checkIn?.status === 'done' ? 'Edit check-in' : 'Check in'}
          </button>
        </div>
        {checkIn?.status === 'done' ? (
          <div className="checkin-grid">
            <span>Energy · {labelFor(ENERGY_OPTIONS, checkIn.energy)}</span>
            <span>Cramps · {labelFor(CRAMP_OPTIONS, checkIn.cramps)}</span>
            <span>Flow · {labelFor(FLOW_OPTIONS, checkIn.flow)}</span>
          </div>
        ) : (
          <p className="muted small checkin-empty">
            {checkIn?.status === 'skipped'
              ? 'Skipped today. Weights use your last workout only.'
              : 'Not checked in yet.'}
          </p>
        )}
        <div className="cycle-strip">
          <span>
            {cycle
              ? cycle.day === 1
                ? 'Cycle day 1 · period started today'
                : `Cycle day ${cycle.day} · estimated`
              : 'Cycle day · not tracked yet'}
          </span>
          <button className="link small-link" onClick={onViewCycle}>
            View cycle →
          </button>
        </div>
      </section>

      <Sheet open={whyOpen} eyebrow="Why this workout?" title={plan.name} onClose={() => setWhyOpen(false)}>
        {whyThisWorkout(plan, checkIn).map((l) => (
          <p key={l} className="why-line">
            {l}
          </p>
        ))}
        <p className="muted small">Gemini explanations are coming in a later pass.</p>
      </Sheet>
    </div>
  );
}
