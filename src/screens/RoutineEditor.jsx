import { useEffect, useMemo, useRef, useState } from 'react';
import DurationInput from '../components/DurationInput.jsx';
import Sheet from '../components/Sheet.jsx';
import { CloseIcon } from '../components/Icons.jsx';
import { EXERCISES, EXERCISE_GROUPS, defaultSet, startingWeight } from '../data/plans.js';
import {
  deleteRoutine,
  getState,
  lastSessionSets,
  saveRoutine,
  selectRoutine,
  setUnit,
  useStore,
} from '../data/store.js';
import { cleanDecimal, cleanInt, selectOnFocus } from '../lib/inputs.js';
import { formatShortTimer } from '../lib/date.js';
import { convertWeight, roundTo } from '../lib/units.js';

let keySeq = 0;
const newKey = () => `ex-${Date.now().toString(36)}-${(keySeq += 1)}`;

/** Editable copy of a routine, with weights shown in the lifter's current unit. */
function toEditable(routine, unit) {
  if (!routine) return { name: '', exercises: [] };
  const s = getState();
  return {
    name: routine.name,
    exercises: routine.exercises.map((rex) => {
      const cat = EXERCISES[rex.exerciseId];
      const last = lastSessionSets(s, rex.exerciseId);
      return {
        key: rex.key,
        exerciseId: rex.exerciseId,
        note: rex.note ?? null,
        restSec: rex.restSec ?? null,
        sets: rex.sets.map((t, i) => {
          // Built-in sets without a target weight show what the workout would start at.
          let w;
          if (t.weight != null) w = convertWeight(t.weight, routine.unit, unit);
          else if (last[i] || last[0]) {
            const l = last[i] ?? last[0];
            w = convertWeight(l.weight, l.unit, unit);
          } else w = startingWeight(cat, unit);
          return {
            reps: String(t.reps ?? cat.defaultReps),
            weight: String(roundTo(Number(w), 0.5)),
            durationSec: cat.timed ? t.durationSec ?? cat.durationSec ?? 30 : null,
          };
        }),
      };
    }),
  };
}

function newExercise(exerciseId, unit) {
  const cat = EXERCISES[exerciseId];
  const set = defaultSet(exerciseId, unit);
  return {
    key: newKey(),
    exerciseId,
    note: null,
    restSec: null,
    sets: Array.from({ length: 3 }, () => ({
      reps: String(set.reps),
      weight: String(set.weight),
      durationSec: cat.timed ? set.durationSec : null,
    })),
  };
}

export default function RoutineEditor({ open, routine, inProgress, activeRoutineId, onClose, onToast }) {
  const s = useStore();
  const unit = s.profile.unit;
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [picker, setPicker] = useState(null); // { mode: 'add' } | { mode: 'swap', idx }
  const [query, setQuery] = useState('');
  const initial = useRef('');
  const unitRef = useRef(unit);

  // Load the routine each time the editor opens.
  useEffect(() => {
    if (!open) return;
    const e = toEditable(routine, getState().profile.unit);
    setName(e.name);
    setExercises(e.exercises);
    initial.current = JSON.stringify(e);
    unitRef.current = getState().profile.unit;
    setPicker(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routine?.id]);

  // Unit switched (here or on the Workout screen): convert the weights being edited.
  useEffect(() => {
    if (!open || unitRef.current === unit) return;
    const from = unitRef.current;
    unitRef.current = unit;
    setExercises((xs) =>
      xs.map((ex) => ({
        ...ex,
        sets: ex.sets.map((t) => ({
          ...t,
          weight: t.weight === '' ? '' : String(convertWeight(Number(t.weight), from, unit)),
        })),
      }))
    );
  }, [unit, open]);

  const isNew = !routine;
  const dirty = open && JSON.stringify({ name, exercises }) !== initial.current;

  const problems = useMemo(() => {
    const p = [];
    if (!name.trim()) p.push('Give your workout a name.');
    if (!exercises.length) p.push('Add at least one exercise.');
    exercises.forEach((ex) => {
      const cat = EXERCISES[ex.exerciseId];
      if (!cat.timed && ex.sets.some((t) => !(Number(t.reps) > 0)))
        p.push(`Every ${cat.name.toLowerCase()} set needs at least 1 rep.`);
    });
    return p;
  }, [name, exercises]);

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this workout?')) return;
    onClose();
  };

  const updateEx = (idx, fn) => setExercises((xs) => xs.map((ex, i) => (i === idx ? fn(ex) : ex)));
  const updateSet = (idx, setIdx, patch) =>
    updateEx(idx, (ex) => ({ ...ex, sets: ex.sets.map((t, j) => (j === setIdx ? { ...t, ...patch } : t)) }));
  const move = (idx, dir) =>
    setExercises((xs) => {
      const j = idx + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const pick = (exerciseId) => {
    if (picker?.mode === 'swap') {
      const cat = EXERCISES[exerciseId];
      updateEx(picker.idx, (ex) => {
        const wasTimed = EXERCISES[ex.exerciseId].timed;
        return {
          ...ex,
          exerciseId,
          note: null,
          sets: ex.sets.map((t) => ({
            reps: cat.timed ? '1' : wasTimed ? String(cat.defaultReps) : t.reps,
            weight: String(startingWeight(cat, unit)),
            durationSec: cat.timed ? t.durationSec ?? cat.durationSec ?? 30 : null,
          })),
        };
      });
    } else {
      setExercises((xs) => [...xs, newExercise(exerciseId, unit)]);
    }
    setPicker(null);
    setQuery('');
  };

  const save = () => {
    if (problems.length) return;
    const id = saveRoutine({
      id: routine?.id,
      name,
      unit,
      exercises: exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((t) => ({
          reps: EXERCISES[ex.exerciseId].timed ? 1 : Number(t.reps),
          weight: t.weight === '' ? 0 : Number(t.weight),
          durationSec: t.durationSec,
        })),
      })),
    });
    const label = name.trim();
    if (inProgress && id === activeRoutineId) {
      onToast(`Saved. Changes apply the next time you start ${label}.`);
    } else if (inProgress) {
      onToast(`Saved ${label}. Finish your current workout to start it.`);
    } else {
      selectRoutine(id);
      onToast(`Saved ${label}.`);
    }
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Delete ${routine.name}? Workouts you already logged stay in your history.`)) return;
    deleteRoutine(routine.id);
    onToast(`Deleted ${routine.name}.`);
    onClose();
  };

  const q = query.trim().toLowerCase();
  const catalog = Object.values(EXERCISES).filter((e) => !q || e.name.toLowerCase().includes(q));

  return (
    <>
      <Sheet
        open={open}
        className="tall"
        eyebrow={isNew ? 'Create workout' : 'Customize workout'}
        title={name.trim() || (isNew ? 'New workout' : routine.name)}
        onClose={close}
        footer={
          <>
            {problems.length > 0 && (dirty || !isNew) && <p className="form-hint">{problems[0]}</p>}
            <button className="btn primary block" disabled={problems.length > 0} onClick={save}>
              Save workout
            </button>
            {!isNew && !routine.builtIn && !(inProgress && routine.id === activeRoutineId) && (
              <button className="btn text block" onClick={remove}>
                Delete workout
              </button>
            )}
          </>
        }
      >
        <label className="field">
          <span className="field-label">Workout name</span>
          <input
            className="text-input"
            value={name}
            maxLength={40}
            placeholder="e.g. My Leg Day"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {inProgress && routine?.id === activeRoutineId && (
          <p className="muted small sheet-lede">
            You're mid-workout. Changes are saved for next time; today's sets stay as they are.
          </p>
        )}

        {exercises.map((ex, idx) => {
          const cat = EXERCISES[ex.exerciseId];
          const timed = !!cat.timed;
          return (
            <section className="card edit-ex" key={ex.key} aria-label={`${idx + 1}. ${cat.name}`}>
              <div className="edit-ex-head">
                <span className="edit-ex-num">{idx + 1}</span>
                <div className="edit-ex-title">
                  <strong>{cat.name}</strong>
                  <span className="muted tiny">{timed ? 'Timed' : cat.group}</span>
                </div>
                <div className="order-btns">
                  <button
                    className="order-btn"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    aria-label={`Move ${cat.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    className="order-btn"
                    disabled={idx === exercises.length - 1}
                    onClick={() => move(idx, 1)}
                    aria-label={`Move ${cat.name} down`}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="edit-ex-links">
                <button className="link small-link" onClick={() => setPicker({ mode: 'swap', idx })}>
                  Swap
                </button>
                <span aria-hidden="true">·</span>
                <button
                  className="link small-link"
                  onClick={() => setExercises((xs) => xs.filter((_, i) => i !== idx))}
                  aria-label={`Remove ${cat.name}`}
                >
                  Remove
                </button>
              </div>

              <div className="rest-setting compact">
                <span>Rest</span>
                {ex.restSec == null ? (
                  <button
                    className="link small-link"
                    onClick={() => updateEx(idx, (e) => ({ ...e, restSec: s.prefs.restSec }))}
                  >
                    Default {formatShortTimer(s.prefs.restSec)} · Change
                  </button>
                ) : (
                  <span className="rest-override">
                    <DurationInput
                      label={`${cat.name} rest`}
                      valueSec={ex.restSec}
                      onChange={(v) => updateEx(idx, (e) => ({ ...e, restSec: v }))}
                    />
                    <button
                      className="link small-link"
                      onClick={() => updateEx(idx, (e) => ({ ...e, restSec: null }))}
                    >
                      Default
                    </button>
                  </span>
                )}
              </div>

              <div className={`set-grid edit-grid set-head${timed ? ' timed' : ''}`}>
                <span aria-hidden="true">SET</span>
                <button
                  className="unit-toggle"
                  onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')}
                  aria-label={`Weight in ${unit}. Switch to ${unit === 'lb' ? 'kg' : 'lb'}`}
                >
                  {unit.toUpperCase()} ⇄
                </button>
                <span className="center" aria-hidden="true">
                  {timed ? 'HOLD' : 'REPS'}
                </span>
                <span />
              </div>
              {ex.sets.map((t, setIdx) => {
                const label = `${cat.name} target set ${setIdx + 1}`;
                return (
                  <div className={`set-grid edit-grid set-row${timed ? ' timed' : ''}`} key={setIdx}>
                    <span className="set-num">{setIdx + 1}</span>
                    <label className="num-field">
                      <input
                        className="num-input"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`${label} weight in ${unit}`}
                        value={t.weight}
                        onFocus={selectOnFocus}
                        onChange={(e) => updateSet(idx, setIdx, { weight: cleanDecimal(e.target.value) })}
                      />
                      <span className="num-unit" aria-hidden="true">
                        {unit}
                      </span>
                    </label>
                    {timed ? (
                      <DurationInput
                        label={`${label} hold`}
                        valueSec={t.durationSec ?? 30}
                        onChange={(v) => updateSet(idx, setIdx, { durationSec: v })}
                      />
                    ) : (
                      <input
                        className="num-input"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        aria-label={`${label} reps`}
                        value={t.reps}
                        onFocus={selectOnFocus}
                        onChange={(e) => updateSet(idx, setIdx, { reps: cleanInt(e.target.value) })}
                      />
                    )}
                    <button
                      className="remove-set"
                      disabled={ex.sets.length === 1}
                      onClick={() => updateEx(idx, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== setIdx) }))}
                      aria-label={`Remove ${cat.name} set ${setIdx + 1}`}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </div>
                );
              })}
              <button
                className="add-set"
                onClick={() =>
                  updateEx(idx, (e) => ({
                    ...e,
                    sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? newExercise(e.exerciseId, unit).sets[0]) }],
                  }))
                }
              >
                + Add set
              </button>
            </section>
          );
        })}

        <button className="add-exercise" onClick={() => setPicker({ mode: 'add' })}>
          + Add exercise
        </button>
      </Sheet>

      {/* Exercise list, shared by Add and Swap */}
      <Sheet
        open={open && !!picker}
        eyebrow={picker?.mode === 'swap' ? `Swap ${EXERCISES[exercises[picker.idx]?.exerciseId]?.name ?? ''}` : 'Add exercise'}
        title="Choose an exercise"
        onClose={() => {
          setPicker(null);
          setQuery('');
        }}
      >
        <input
          className="text-input"
          type="search"
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {EXERCISE_GROUPS.map((group) => {
          const items = catalog.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <div className="eyebrow rest-group">{group}</div>
              <ul className="pick-list">
                {items.map((e) => (
                  <li key={e.id}>
                    <button className="pick-item" onClick={() => pick(e.id)}>
                      <span>{e.name}</span>
                      <span className="muted tiny">
                        {e.timed ? `Timed · ${formatShortTimer(e.durationSec ?? 30)}` : `${e.defaultReps} reps`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!catalog.length && <p className="muted small">No exercises match “{query}”.</p>}
      </Sheet>
    </>
  );
}
