import { useEffect, useMemo, useRef, useState } from 'react';
import DurationInput from '../components/DurationInput.jsx';
import HeartTimer from '../components/HeartTimer.jsx';
import Sheet from '../components/Sheet.jsx';
import { ChoicePills } from '../components/Chrome.jsx';
import { ArrowUpRightIcon, CheckIcon, HeartIcon } from '../components/Icons.jsx';
import { PLANS } from '../data/plans.js';
import {
  acceptSuggestion,
  addRestTime,
  cancelSetTimer,
  completeSet,
  discardWorkout,
  endRest,
  finishWorkout,
  lastSessionSets,
  restSecFor,
  setRestDuration,
  setRestOverride,
  setUnit,
  setWarmup,
  startSetTimer,
  startWorkout,
  undoSet,
  updateRowField,
  useStore,
} from '../data/store.js';
import { suggestWeight } from '../data/suggest.js';
import { formatClock, formatShortTimer } from '../lib/date.js';
import { convertWeight, formatWeight } from '../lib/units.js';
import { useNow } from '../hooks/useNow.js';

const WARMUP_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'right', label: 'About right' },
  { value: 'heavy', label: 'Heavy' },
];

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/** Tapping a number selects it so typing replaces it. */
function selectOnFocus(e) {
  const el = e.target;
  requestAnimationFrame(() => el.select());
}

/** Digits with at most one decimal point. */
function cleanDecimal(v) {
  const [whole, ...rest] = v.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

function runningTimer(timer, now) {
  if (!timer?.startedAt || timer.finished) return null;
  const elapsed = (now - timer.startedAt) / 1000;
  return {
    progress: Math.min(1, elapsed / timer.durationSec),
    remaining: Math.max(0, timer.durationSec - elapsed),
    over: elapsed >= timer.durationSec,
  };
}

export default function Workout({ onFinished, onToast }) {
  const s = useStore();
  const draft = s.activeWorkout;
  const plan = draft ? PLANS[draft.planId] : null;
  const checkIn = draft ? s.checkIns[draft.date] : undefined;

  // The timed set (plank etc.) that is currently counting, if any.
  let timed = null;
  draft?.exercises.forEach((ex, exIdx) =>
    ex.rows.forEach((row, rowIdx) => {
      if (row.timer?.startedAt && !row.doneSetId && !row.timer.finished) timed = { exIdx, rowIdx, row };
    })
  );
  const now = useNow(!!(draft?.startedAt || draft?.rest || timed));

  const [undoFor, setUndoFor] = useState(null);
  const [whyFor, setWhyFor] = useState(null); // exIdx
  const [howFor, setHowFor] = useState(null); // exIdx
  const [restOpen, setRestOpen] = useState(false);
  const [timeSetFor, setTimeSetFor] = useState(null); // exIdx
  const [timeSetSec, setTimeSetSec] = useState(30);
  const [finishOpen, setFinishOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!draft) return [];
    return plan.exercises.map((ex, i) =>
      suggestWeight({
        exercise: ex,
        unit: draft.unit,
        lastSets: lastSessionSets(s, ex.id, draft.sessionId),
        checkIn,
        warmup: draft.exercises[i].warmup,
      })
    );
  }, [s, draft, plan, checkIn]);

  // Rest countdown: the heart outline traces in as it runs; at zero the next set is ready.
  const rest = draft?.rest ? runningTimer(draft.rest, now) : null;
  const restOver = !!rest?.over;
  useEffect(() => {
    if (!restOver) return undefined;
    buzz([120, 80, 120]);
    const id = setTimeout(endRest, 2500);
    return () => clearTimeout(id);
  }, [restOver]);

  // Buzz once when a timed set reaches zero.
  const timedState = timed ? runningTimer(timed.row.timer, now) : null;
  const timedOver = !!timedState?.over;
  useEffect(() => {
    if (timedOver) buzz(300);
  }, [timedOver]);

  if (!draft) return <div className="screen" />;

  const elapsed = draft.startedAt ? (now - draft.startedAt) / 1000 : 0;
  const totalSets = draft.exercises.reduce((n, ex) => n + ex.rows.length, 0);
  const doneSets = draft.exercises.reduce((n, ex) => n + ex.rows.filter((r) => r.doneSetId).length, 0);
  const unit = draft.unit;
  const restExercise = draft.rest && plan.exercises.find((e) => e.id === draft.rest.exerciseId);

  const saveRow = (exIdx, rowIdx) => {
    const row = draft.exercises[exIdx].rows[rowIdx];
    const weight = Number(row.weight);
    const reps = Number(row.reps);
    if (row.weight === '' || !Number.isFinite(weight) || row.reps === '' || !(reps > 0)) {
      onToast('Enter the weight and reps first.');
      return;
    }
    document.activeElement?.blur?.();
    completeSet(exIdx, rowIdx, {
      weight,
      reps: Math.round(reps),
      suggestedWeight: suggestions[exIdx].weight,
    });
  };

  const openTimeSet = (exIdx) => {
    setTimeSetSec(plan.exercises[exIdx].durationSec ?? 30);
    setTimeSetFor(exIdx);
  };

  return (
    <div className="screen workout">
      <div className="workout-sticky">
        <div className="clock-bar">
          <button
            className="timer-chip"
            onClick={() => setRestOpen(true)}
            aria-label={`Rest timer, default ${formatShortTimer(s.prefs.restSec)}. Change rest time`}
          >
            <HeartIcon size={15} />
            {formatShortTimer(s.prefs.restSec)}
          </button>
          <span className="clock-label">Workout time ·</span>
          <span className="clock" aria-label={`Workout time ${formatClock(elapsed)}`}>
            {formatClock(elapsed, ' : ')}
          </span>
        </div>

        {rest && (
          <div className={`rest-bar${restOver ? ' ready' : ''}`} role="timer" aria-live="off">
            <HeartTimer progress={rest.progress} size={22} />
            <span className="rest-label">
              {restOver ? 'Ready for next set' : `Rest ${formatShortTimer(rest.remaining)}`}
              {restExercise && !restOver && <span className="rest-sub"> · {restExercise.name}</span>}
            </span>
            {!restOver && (
              <span className="rest-actions">
                <button onClick={() => addRestTime(15)}>+15 sec</button>
                <span aria-hidden="true">·</span>
                <button onClick={endRest}>Skip</button>
              </span>
            )}
          </div>
        )}

        {timed && timedState && (
          <div className={`rest-bar${timedOver ? ' ready' : ''}`} role="timer">
            <HeartTimer progress={timedState.progress} size={22} />
            <span className="rest-label">
              {timedOver ? 'Time! Tap Done to save' : `Set ${formatShortTimer(timedState.remaining)}`}
              <span className="rest-sub"> · {plan.exercises[timed.exIdx].name}</span>
            </span>
            {!timedOver && (
              <span className="rest-actions">
                <button onClick={() => cancelSetTimer(timed.exIdx, timed.rowIdx)}>Stop</button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="row-between title-row">
        <h1 className="workout-title">{plan.name}</h1>
        <button className="ask-btn" onClick={() => setAskOpen(true)}>
          Ask <ArrowUpRightIcon />
        </button>
      </div>
      <p className="muted tiny">{plan.subtitle}</p>

      {plan.exercises.map((ex, exIdx) => {
        const dex = draft.exercises[exIdx];
        const sug = suggestions[exIdx];
        const last = lastSessionSets(s, ex.id, draft.sessionId);
        const undone = dex.rows.filter((r) => !r.doneSetId);
        const usingSuggestion = undone.length > 0 && undone.every((r) => Number(r.weight) === sug.weight);
        const lastLine = last.length
          ? `Last: ${formatWeight(convertWeight(last[0].weight, last[0].unit, unit))} ${unit} × ${last[0].reps}${ex.note ? ' each side' : ''}`
          : ex.note ?? `Plan start: ${formatWeight(sug.base)} ${unit} × ${ex.reps}`;
        const override = s.prefs.restOverrides?.[ex.id];

        return (
          <section className="card exercise" key={ex.id} aria-labelledby={`ex-${ex.id}`}>
            <div className="row-between">
              <h2 id={`ex-${ex.id}`} className="exercise-name">
                {ex.name}
              </h2>
              <span className="card-links">
                {ex.timed && (
                  <button className="link small-link" onClick={() => openTimeSet(exIdx)} disabled={!undone.length}>
                    Time set
                  </button>
                )}
                <button className="link small-link" onClick={() => setHowFor(exIdx)}>
                  How? <ArrowUpRightIcon />
                </button>
              </span>
            </div>
            <p className="muted tiny exercise-last">
              {lastLine}
              {override != null && ` · Rest ${formatShortTimer(override)}`}
            </p>

            <div className="warmup">
              <span className="tiny strong">Warm-up felt</span>
              <ChoicePills
                small
                label={`${ex.name} warm-up`}
                options={WARMUP_OPTIONS}
                value={dex.warmup}
                onChange={(v) => setWarmup(exIdx, dex.warmup === v ? null : v)}
              />
            </div>

            <div className="suggest">
              <div className="suggest-text">
                <span className="eyebrow">Suggested</span>
                <span className="suggest-weight">
                  {formatWeight(sug.weight)} {unit}
                </span>
                <span className="muted tiny">{sug.summary}</span>
              </div>
              {usingSuggestion ? (
                <span className="using">
                  <CheckIcon size={14} /> Using
                </span>
              ) : (
                <button
                  className="btn chip"
                  disabled={undone.length === 0}
                  onClick={() => acceptSuggestion(exIdx, sug.weight)}
                >
                  Use
                </button>
              )}
              <button className="link why-link" onClick={() => setWhyFor(exIdx)}>
                Why this weight?
              </button>
            </div>

            <div className="set-grid set-head">
              <span aria-hidden="true">SET</span>
              <button
                className="unit-toggle"
                onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')}
                aria-label={`Weight in ${unit}. Switch to ${unit === 'lb' ? 'kg' : 'lb'}`}
                title={`Switch to ${unit === 'lb' ? 'kg' : 'lb'}`}
              >
                {unit.toUpperCase()} ⇄
              </button>
              <span className="center" aria-hidden="true">
                REPS
              </span>
              <span className="center" aria-hidden="true">
                DONE
              </span>
            </div>

            {dex.rows.map((row, rowIdx) => {
              const done = !!row.doneSetId;
              const label = `${ex.name} set ${rowIdx + 1}`;
              return (
                <div className={`set-grid set-row${done ? ' done' : ''}`} key={rowIdx}>
                  <span className="set-num">{rowIdx + 1}</span>
                  <label className="num-field">
                    <input
                      className="num-input"
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="next"
                      autoComplete="off"
                      aria-label={`${label} weight in ${unit}`}
                      value={row.weight}
                      disabled={done}
                      onFocus={selectOnFocus}
                      onChange={(e) => updateRowField(exIdx, rowIdx, 'weight', cleanDecimal(e.target.value))}
                      onBlur={(e) =>
                        e.target.value !== '' &&
                        updateRowField(exIdx, rowIdx, 'weight', Number(e.target.value) || 0)
                      }
                    />
                    <span className="num-unit" aria-hidden="true">
                      {unit}
                    </span>
                  </label>
                  <input
                    className="num-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={`${label} reps`}
                    value={row.reps}
                    disabled={done}
                    onFocus={selectOnFocus}
                    onChange={(e) =>
                      updateRowField(exIdx, rowIdx, 'reps', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                    }
                    onBlur={(e) =>
                      e.target.value !== '' && updateRowField(exIdx, rowIdx, 'reps', Number(e.target.value) || 0)
                    }
                  />
                  <button
                    className={`done-btn${done ? ' done' : ''}`}
                    onClick={() => (done ? setUndoFor({ exIdx, rowIdx }) : saveRow(exIdx, rowIdx))}
                    aria-pressed={done}
                    aria-label={done ? `${label} saved. Undo` : `Save ${label}`}
                  >
                    <HeartIcon size={24} filled={done} />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="finish-bar">
        <button
          className="btn primary block big"
          onClick={() => (draft.startedAt ? setFinishOpen(true) : startWorkout())}
        >
          {draft.startedAt ? 'Finish workout' : 'Start workout'}
        </button>
      </div>

      {/* --- Rest timer settings: typed once, remembered --- */}
      <Sheet open={restOpen} eyebrow="Rest timer" title="Rest between sets" onClose={() => setRestOpen(false)}>
        <p className="muted small sheet-lede">
          Rest starts by itself when you tap Done. We'll remember these times.
        </p>
        <div className="rest-setting">
          <span className="strong">Default</span>
          <DurationInput label="Default rest" valueSec={s.prefs.restSec} onChange={setRestDuration} />
        </div>
        <div className="eyebrow rest-group">Per exercise (optional)</div>
        {plan.exercises.map((ex) => {
          const sec = s.prefs.restOverrides?.[ex.id];
          return (
            <div className="rest-setting" key={ex.id}>
              <span>{ex.name}</span>
              {sec == null ? (
                <button className="link small-link" onClick={() => setRestOverride(ex.id, restSecFor(s, ex.id))}>
                  Default · Change
                </button>
              ) : (
                <span className="rest-override">
                  <DurationInput label={`${ex.name} rest`} valueSec={sec} onChange={(v) => setRestOverride(ex.id, v)} />
                  <button className="link small-link" onClick={() => setRestOverride(ex.id, null)}>
                    Reset
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </Sheet>

      {/* --- Optional timed set (only for exercises marked timed, e.g. a plank) --- */}
      <Sheet
        open={timeSetFor != null}
        eyebrow={timeSetFor != null ? plan.exercises[timeSetFor].name : ''}
        title="Time set"
        onClose={() => setTimeSetFor(null)}
        footer={
          <button
            className="btn primary block"
            onClick={() => {
              const rowIdx = draft.exercises[timeSetFor].rows.findIndex((r) => !r.doneSetId);
              if (rowIdx >= 0) startSetTimer(timeSetFor, rowIdx, timeSetSec);
              setTimeSetFor(null);
            }}
          >
            Start {formatShortTimer(timeSetSec)}
          </button>
        }
      >
        <div className="rest-setting">
          <span className="strong">Hold for</span>
          <DurationInput label="Set duration" valueSec={timeSetSec} onChange={setTimeSetSec} />
        </div>
      </Sheet>

      {/* --- Undo a saved set --- */}
      <Sheet
        open={!!undoFor}
        eyebrow={undoFor ? plan.exercises[undoFor.exIdx].name : ''}
        title={undoFor ? `Undo set ${undoFor.rowIdx + 1}?` : ''}
        onClose={() => setUndoFor(null)}
        footer={
          <>
            <button
              className="btn secondary block"
              onClick={() => {
                undoSet(undoFor.exIdx, undoFor.rowIdx);
                setUndoFor(null);
              }}
            >
              Undo set
            </button>
            <button className="btn text block" onClick={() => setUndoFor(null)}>
              Keep it
            </button>
          </>
        }
      >
        <p className="muted small">This removes the saved set so you can edit it and save it again.</p>
      </Sheet>

      {/* --- Why this weight? (local explanation) --- */}
      <Sheet
        open={whyFor != null}
        eyebrow="Why this weight?"
        title={
          whyFor != null
            ? `${plan.exercises[whyFor].name} · ${formatWeight(suggestions[whyFor].weight)} ${unit}`
            : ''
        }
        onClose={() => setWhyFor(null)}
        footer={
          whyFor != null && (
            <button
              className="btn primary block"
              onClick={() => {
                acceptSuggestion(whyFor, suggestions[whyFor].weight);
                setWhyFor(null);
              }}
            >
              Use {formatWeight(suggestions[whyFor].weight)} {unit}
            </button>
          )
        }
      >
        {whyFor != null && (
          <>
            <ul className="reasons">
              {suggestions[whyFor].reasons.map((r) => (
                <li key={r.title}>
                  <strong>{r.title}</strong>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Prefer a different number? Type it into any set. Gemini explanations are coming in a later pass.
            </p>
          </>
        )}
      </Sheet>

      {/* --- How-to --- */}
      <Sheet
        open={howFor != null}
        eyebrow="How to"
        title={howFor != null ? plan.exercises[howFor].name : ''}
        onClose={() => setHowFor(null)}
      >
        {howFor != null && (
          <ol className="how-list">
            {plan.exercises[howFor].how.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </Sheet>

      {/* --- Finish --- */}
      <Sheet
        open={finishOpen}
        eyebrow={plan.name}
        title={doneSets ? 'Finish workout?' : 'No sets saved yet'}
        onClose={() => setFinishOpen(false)}
        footer={
          <>
            {doneSets > 0 ? (
              <button
                className="btn primary block"
                onClick={() => {
                  finishWorkout();
                  setFinishOpen(false);
                  onFinished(`Workout saved · ${doneSets} sets in ${formatClock(elapsed)}`);
                }}
              >
                Finish & save
              </button>
            ) : (
              <button
                className="btn secondary block"
                onClick={() => {
                  discardWorkout();
                  setFinishOpen(false);
                  onFinished('Workout discarded');
                }}
              >
                Discard workout
              </button>
            )}
            <button className="btn text block" onClick={() => setFinishOpen(false)}>
              Keep going
            </button>
          </>
        }
      >
        <div className="finish-stats">
          <div>
            <span className="stat">{doneSets}</span>
            <span className="muted tiny">of {totalSets} sets</span>
          </div>
          <div>
            <span className="stat">{formatClock(elapsed)}</span>
            <span className="muted tiny">workout time</span>
          </div>
        </div>
        {doneSets === 0 && (
          <p className="muted small">Save at least one set to keep this workout, or discard it.</p>
        )}
      </Sheet>

      {/* --- Ask (Gemini later) --- */}
      <Sheet open={askOpen} eyebrow="Ask" title="Questions about this workout" onClose={() => setAskOpen(false)}>
        <p className="muted small">
          Soon you'll be able to ask Gemini things like "Can I swap lunges for step-ups?" For now, tap
          <strong> How?</strong> on any exercise for form tips, or <strong>Why this weight?</strong> for
          the reasoning behind a suggestion.
        </p>
      </Sheet>
    </div>
  );
}
