import { HEART_PATH } from './Icons.jsx';

/**
 * A heart whose outline traces itself in pink as a countdown runs.
 * progress: 0 (just started) → 1 (time is up, outline complete).
 * fillOnDone: also fill the heart solid at zero.
 */
export default function HeartTimer({ progress, size = 30, fillOnDone = false, track = 'var(--rose-200)' }) {
  const p = Math.min(1, Math.max(0, progress));
  const done = p >= 1;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="heart-timer">
      <path d={HEART_PATH} fill="none" stroke={track} strokeWidth="1.8" />
      <path
        d={HEART_PATH}
        fill={done && fillOnDone ? 'var(--rose-600)' : 'none'}
        stroke="var(--rose-600)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={100 - p * 100}
        style={{ transition: 'stroke-dashoffset 250ms linear, fill 300ms ease' }}
      />
    </svg>
  );
}
