// Line icons drawn to match the Figma screens: rounded strokes, small hearts as accents.

export const HEART_PATH =
  'M12 20.6l-1.3-1.2C6 15.1 2.9 12.3 2.9 8.8 2.9 6 5.1 3.8 7.9 3.8c1.6 0 3.1.7 4.1 1.9 1-1.2 2.5-1.9 4.1-1.9 2.8 0 5 2.2 5 5 0 3.5-3.1 6.3-7.8 10.6L12 20.6z';

function Svg({ size = 24, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HeartIcon({ size = 24, filled = false, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d={HEART_PATH} fill={filled ? 'currentColor' : 'none'} />
    </Svg>
  );
}

/** Hamburger with a small heart on the bottom line (top-left of both screens). */
export function MenuHeartIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M3 6h18M3 12h12M3 18h9" />
      <path
        transform="translate(14.2 13.2) scale(0.36)"
        d={HEART_PATH}
        strokeWidth="4.6"
      />
    </Svg>
  );
}

/** Heart inside a circle (top-right of both screens). */
export function HeartCircleIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9.2" />
      <path transform="translate(6.6 6.9) scale(0.45)" d={HEART_PATH} strokeWidth="3.8" />
    </Svg>
  );
}

/** House with a heart inside (Today tab). */
export function HomeHeartIcon({ size = 24 }) {
  return (
    <Svg size={size}>
      <path d="M3.5 10.2L12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
      <path transform="translate(7.6 9.1) scale(0.37)" d={HEART_PATH} strokeWidth="4.6" />
    </Svg>
  );
}

/** Two linked hearts (Workout tab). */
export function TwoHeartsIcon({ size = 24 }) {
  return (
    <Svg size={size} viewBox="0 0 28 24">
      <path transform="translate(0.6 4.4) scale(0.62)" d={HEART_PATH} strokeWidth="2.9" />
      <path transform="translate(11.8 4.4) scale(0.62)" d={HEART_PATH} strokeWidth="2.9" />
    </Svg>
  );
}

/** Calendar with a heart (Cycle tab). */
export function CalendarHeartIcon({ size = 24 }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path transform="translate(8.2 11) scale(0.32)" d={HEART_PATH} strokeWidth="5.2" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ size = 12 }) {
  return (
    <Svg size={size} strokeWidth="2.2">
      <path d="M7 17L17 7M9 7h8v8" />
    </Svg>
  );
}

export function CloseIcon({ size = 20 }) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function CheckIcon({ size = 16 }) {
  return (
    <Svg size={size} strokeWidth="2.4">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}
