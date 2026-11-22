import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, Header } from './components/Chrome.jsx';
import Sheet from './components/Sheet.jsx';
import { TODAYS_PLAN_ID } from './data/plans.js';
import { ensureActiveWorkout, resetAllData, startWorkout, useStore } from './data/store.js';
import { formatShortDate, todayKey } from './lib/date.js';
import CheckInSheet from './screens/CheckInSheet.jsx';
import Today from './screens/Today.jsx';
import Workout from './screens/Workout.jsx';

const TAB_KEY = 'tempo:tab';

function readTab() {
  try {
    return localStorage.getItem(TAB_KEY) || 'today';
  } catch {
    return 'today';
  }
}

export default function App() {
  const s = useStore();
  const date = todayKey();
  const [tab, setTabState] = useState(readTab);
  const [editCheckIn, setEditCheckIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const scrollRef = useRef(null);

  const setTab = useCallback((t) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (tab === 'workout') ensureActiveWorkout(TODAYS_PLAN_ID);
  }, [tab]);

  // First visit of the day: ask until the lifter saves or skips.
  const needsCheckIn = !s.checkIns[date];

  const startFromToday = () => {
    ensureActiveWorkout(TODAYS_PLAN_ID);
    startWorkout();
    setTab('workout');
  };

  const periodStarts = s.cycleEvents.filter((e) => e.type === 'period_start');

  return (
    <div className="stage">
      <div className="phone">
        <Header
          logo={tab === 'today'}
          title={tab === 'workout' ? 'Workout' : 'Cycle'}
          onMenu={() => setMenuOpen(true)}
        />
        <main className="scroll" ref={scrollRef}>
          {tab === 'today' && (
            <Today
              onStartWorkout={startFromToday}
              onEditCheckIn={() => setEditCheckIn(true)}
              onViewCycle={() => setTab('cycle')}
              onToast={showToast}
            />
          )}
          {tab === 'workout' && (
            <Workout
              onToast={showToast}
              onFinished={(msg) => {
                showToast(msg);
                setTab('today');
              }}
            />
          )}
          {tab === 'cycle' && (
            <div className="screen">
              <h1 className="display small-display">Cycle calendar</h1>
              <p className="muted">The full calendar arrives with the next batch of screens.</p>
              <section className="card">
                <h3 className="card-title">Period starts logged</h3>
                {periodStarts.length ? (
                  <ul className="plain-list">
                    {periodStarts.map((e) => (
                      <li key={e.id}>
                        {formatShortDate(e.date)} <span className="muted tiny">· from check-in</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">
                    None yet. Turn on "Period started today" in your check-in to add one.
                  </p>
                )}
              </section>
            </div>
          )}
        </main>
        <BottomNav tab={tab} onChange={setTab} />

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        <CheckInSheet
          open={needsCheckIn || editCheckIn}
          firstVisit={needsCheckIn}
          date={date}
          existing={s.checkIns[date]}
          onClose={(result) => {
            setEditCheckIn(false);
            if (result === 'saved') showToast('Check-in saved');
            if (result === 'skipped') showToast("Skipped for today. We won't ask again until tomorrow.");
          }}
        />

        <Sheet open={menuOpen} eyebrow="Menu" title="Tempo" onClose={() => setMenuOpen(false)}>
          <p className="muted small sheet-lede">
            Goals, plans, meals and history screens arrive in later passes.
          </p>
          <button
            className="btn secondary block"
            onClick={() => {
              if (window.confirm('Erase all check-ins, workouts and sets on this device?')) {
                resetAllData();
                setMenuOpen(false);
                setTab('today');
              }
            }}
          >
            Reset all local data
          </button>
        </Sheet>
      </div>
    </div>
  );
}
