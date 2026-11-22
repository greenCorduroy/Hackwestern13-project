import { useEffect, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const digits = (v) => v.replace(/[^0-9]/g, '').slice(0, 2);
const selectAll = (e) => {
  const el = e.target;
  requestAnimationFrame(() => el.select());
};

/** Compact typed "m:ss" duration. Calls onChange(totalSeconds) as the lifter types. */
export default function DurationInput({ valueSec, onChange, label, min = 5, max = 3599 }) {
  const [mm, setMm] = useState(String(Math.floor(valueSec / 60)));
  const [ss, setSs] = useState(pad(valueSec % 60));
  const editing = useRef(false);

  useEffect(() => {
    if (editing.current) return;
    setMm(String(Math.floor(valueSec / 60)));
    setSs(pad(valueSec % 60));
  }, [valueSec]);

  const commit = (m, s) => {
    const total = Number(m || 0) * 60 + Math.min(59, Number(s || 0));
    if (total >= min && total <= max) onChange(total);
  };

  return (
    <span className="duration-input" role="group" aria-label={label}>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`${label} minutes`}
        value={mm}
        onFocus={(e) => {
          editing.current = true;
          selectAll(e);
        }}
        onBlur={() => {
          editing.current = false;
          setMm(String(Number(mm || 0)));
        }}
        onChange={(e) => {
          const v = digits(e.target.value);
          setMm(v);
          commit(v, ss);
        }}
      />
      <span aria-hidden="true">:</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`${label} seconds`}
        value={ss}
        onFocus={(e) => {
          editing.current = true;
          selectAll(e);
        }}
        onBlur={() => {
          editing.current = false;
          setSs(pad(Math.min(59, Number(ss || 0))));
        }}
        onChange={(e) => {
          const v = digits(e.target.value);
          setSs(v);
          commit(mm, v);
        }}
      />
    </span>
  );
}
