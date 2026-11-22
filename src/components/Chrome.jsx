import { CalendarHeartIcon, HeartCircleIcon, HomeHeartIcon, MenuHeartIcon, TwoHeartsIcon } from './Icons.jsx';

export function Header({ title, logo = false, onMenu }) {
  return (
    <header className="app-header">
      <button className="icon-btn" onClick={onMenu} aria-label="Menu">
        <MenuHeartIcon />
      </button>
      {logo ? <span className="logo">tempo</span> : <h1 className="header-title">{title}</h1>}
      <span className="header-spacer" />
      <button className="icon-btn" aria-label="Profile" title="Profile (coming soon)">
        <HeartCircleIcon />
      </button>
    </header>
  );
}

const TABS = [
  { id: 'today', label: 'Today', Icon: HomeHeartIcon },
  { id: 'workout', label: 'Workout', Icon: TwoHeartsIcon },
  { id: 'cycle', label: 'Cycle', Icon: CalendarHeartIcon },
];

export function BottomNav({ tab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-item${tab === id ? ' active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Pill-shaped single choice used by the check-in and warm-up questions. */
export function ChoicePills({ options, value, onChange, small = false, label }) {
  return (
    <div className={`pills${small ? ' small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`pill${value === o.value ? ' selected' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
