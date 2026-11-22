import { useEffect, useState } from 'react';
import Sheet from '../components/Sheet.jsx';
import { ChoicePills } from '../components/Chrome.jsx';
import { saveCheckIn, skipCheckIn } from '../data/store.js';

export const FLOW_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];
export const CRAMP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'strong', label: 'Strong' },
];
export const ENERGY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'usual', label: 'Usual' },
  { value: 'high', label: 'High' },
];

export function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? '—';
}

/**
 * Daily check-in. In "first visit" mode it can't be dismissed without saving or skipping,
 * so the choice is always recorded for the day.
 */
export default function CheckInSheet({ open, date, existing, firstVisit, onClose }) {
  const [flow, setFlow] = useState(null);
  const [cramps, setCramps] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [periodStarted, setPeriodStarted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const done = existing?.status === 'done' ? existing : null;
    setFlow(done?.flow ?? null);
    setCramps(done?.cramps ?? null);
    setEnergy(done?.energy ?? null);
    setPeriodStarted(!!done?.periodStarted);
  }, [open, existing]);

  const complete = flow && cramps && energy;

  const save = () => {
    if (!complete) return;
    saveCheckIn(date, { flow, cramps, energy, periodStarted });
    onClose?.('saved');
  };

  const skip = () => {
    skipCheckIn(date);
    onClose?.('skipped');
  };

  return (
    <Sheet
      open={open}
      eyebrow={firstVisit ? 'Good morning' : 'Edit check-in'}
      title="How are you feeling today?"
      dismissable={!firstVisit}
      onClose={() => onClose?.('dismissed')}
      footer={
        <>
          <button className="btn primary block" disabled={!complete} onClick={save}>
            {existing?.status === 'done' ? 'Save changes' : 'Save check-in'}
          </button>
          {firstVisit && (
            <button className="btn text block" onClick={skip}>
              Skip today
            </button>
          )}
        </>
      }
    >
      <p className="muted small sheet-lede">
        Three quick taps. We use them to tune today's weights. You can change them later.
      </p>

      <fieldset className="question">
        <legend>Flow</legend>
        <ChoicePills label="Flow" options={FLOW_OPTIONS} value={flow} onChange={setFlow} />
      </fieldset>
      <fieldset className="question">
        <legend>Cramps</legend>
        <ChoicePills label="Cramps" options={CRAMP_OPTIONS} value={cramps} onChange={setCramps} />
      </fieldset>
      <fieldset className="question">
        <legend>Energy</legend>
        <ChoicePills label="Energy" options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
      </fieldset>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={periodStarted}
          onChange={(e) => setPeriodStarted(e.target.checked)}
        />
        <span className="toggle" aria-hidden="true" />
        <span>
          <strong>Period started today</strong>
          <span className="muted small block">Saved to your cycle calendar as day 1.</span>
        </span>
      </label>
    </Sheet>
  );
}
