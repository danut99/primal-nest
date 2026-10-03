// Cadrul aplicației: început → joc. Bara de sus, navigarea, activitatea curentă, notificările.

import { useState } from 'react';
import {
  type Haul,
  GATHER_ACTIONS,
  RECIPES,
  ZONES,
  activityDuration,
  currentObjective,
  eggsInNest,
  readyCount,
} from '@shared/game';
import { Bar, Modal, Saurok, Sky } from '../components/ui';
import { type Game, useGame, useTick } from '../hooks/useGame';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { AtlasScreen } from '../screens/AtlasScreen';
import { HaulList } from '../screens/BattleView';
import { CampScreen } from '../screens/CampScreen';
import { ExpeditionsScreen } from '../screens/ExpeditionsScreen';
import { NestScreen } from '../screens/NestScreen';
import { Onboarding } from '../screens/Onboarding';
import { PackScreen } from '../screens/PackScreen';
import { applyLowFx, bloodEnabled, lowFxEnabled, setBloodEnabled, setLowFxEnabled } from '../utils/settings';
import { sound } from '../utils/sound';

export type Screen = 'cuib' | 'haita' | 'activitati' | 'expeditii' | 'tabara' | 'atlas';

const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'cuib', icon: '🪺', label: 'Cuib' },
  { id: 'haita', icon: '🦖', label: 'Haită' },
  { id: 'activitati', icon: '⛏️', label: 'Activități' },
  { id: 'expeditii', icon: '🗺️', label: 'Expediții' },
  { id: 'tabara', icon: '🏕️', label: 'Tabără' },
  { id: 'atlas', icon: '📖', label: 'Atlas' },
];

export default function App() {
  const game = useGame();
  useTick();
  return (
    <>
      <Sky />
      {game.state ? <GameShell game={game} /> : <Onboarding onStart={game.start} now={game.now} />}
    </>
  );
}

function GameShell({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  const [screen, setScreen] = useState<Screen>('cuib');
  const [selectedDino, setSelectedDino] = useState<string | null>(null);
  const [haul, setHaul] = useState<Haul | null>(null);
  const [muted, setMuted] = useState(sound.muted);
  const [blood, setBlood] = useState(bloodEnabled);
  const [lowFx, setLowFx] = useState(lowFxEnabled);
  const objective = currentObjective(state);
  const readyEggs = eggsInNest(state).filter((e) => e.incubation!.endsAt <= now).length;
  const readyMolts = state.dinos.filter((d) => d.molt && d.molt.endsAt <= now).length;

  const go = (s: Screen) => {
    sound.click();
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-egg">🥚</span> Primal Nest
        </div>
        <div className="topbar-right">
          <span className="sparks" title="Scântei stelare">
            ✨ {state.sparks}
          </span>
          <button
            className={`icon-btn${blood ? '' : ' off'}`}
            onClick={() => {
              setBloodEnabled(!blood);
              setBlood(!blood);
            }}
            aria-label={blood ? 'Oprește efectele de sânge' : 'Pornește efectele de sânge'}
            title={blood ? 'Efecte de sânge: pornite' : 'Efecte de sânge: oprite'}
          >
            🩸
          </button>
          <button
            className={'icon-btn' + (lowFx ? ' off' : '')}
            onClick={() => {
              setLowFxEnabled(!lowFx);
              applyLowFx(!lowFx);
              setLowFx(!lowFx);
            }}
            aria-label={lowFx ? 'Pornește efectele grafice' : 'Redu efectele grafice'}
            title={lowFx ? 'Grafică redusă (mai rapid)' : 'Grafică completă'}
          >
            🎆
          </button>
          <button className="icon-btn" onClick={() => setMuted(sound.toggle())} aria-label={muted ? 'Pornește sunetul' : 'Oprește sunetul'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {objective && (
        <button className="objective" onClick={() => go(objective.screen)}>
          <Saurok size={44} />
          <div>
            <b>{objective.title}</b>
            <small>{objective.hint}</small>
          </div>
          <span className="objective-go">→</span>
        </button>
      )}

      <div className="layout">
        <nav className="nav" aria-label="Navigare">
          {NAV.map((n) => {
            const badge = n.id === 'cuib' ? readyEggs : n.id === 'haita' ? readyMolts : 0;
            return (
              <button key={n.id} className={`nav-btn${screen === n.id ? ' active' : ''}`} onClick={() => go(n.id)} aria-current={screen === n.id ? 'page' : undefined}>
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <main className="main">
          {screen === 'cuib' && <NestScreen game={game} />}
          {screen === 'haita' && <PackScreen game={game} selected={selectedDino} onSelect={setSelectedDino} />}
          {screen === 'activitati' && <ActivitiesScreen game={game} />}
          {screen === 'expeditii' && <ExpeditionsScreen game={game} goPack={() => go('haita')} />}
          {screen === 'tabara' && <CampScreen game={game} />}
          {screen === 'atlas' && <AtlasScreen game={game} />}
        </main>
      </div>

      <ActivityBar game={game} onHaul={setHaul} />
      <Toasts game={game} />
      {import.meta.env.DEV && <DevTools game={game} />}

      {haul && (
        <Modal onClose={() => setHaul(null)}>
          <h2>Ai strâns:</h2>
          {(haul.wins > 0 || haul.losses > 0) && (
            <p className="muted">
              ⚔️ {haul.wins} victorii{haul.losses ? ` · ${haul.losses} înfrângeri` : ''}
            </p>
          )}
          <HaulList haul={haul} game={game} />
          <button className="btn primary" onClick={() => setHaul(null)}>
            Super!
          </button>
        </Modal>
      )}
    </div>
  );
}

function ActivityBar({ game, onHaul }: { game: Game; onHaul: (h: Haul) => void }) {
  const state = game.state!;
  const a = state.activity;
  if (!a) {
    return (
      <div className="activity-bar idle">
        <span>💤 Nicio activitate. Pornește una din Activități sau Expediții.</span>
      </div>
    );
  }
  const now = game.now();
  const dur = activityDuration(a) * 1000;
  const ready = readyCount(a, now);
  const progress = ((now - a.startedAt) % dur) / dur;
  const label =
    a.kind === 'gather'
      ? GATHER_ACTIONS.find((x) => x.id === a.actionId)!
      : a.kind === 'cook'
        ? { icon: '🍳', name: RECIPES.find((r) => r.id === a.recipeId)!.name }
        : ZONES.find((z) => z.id === a.zoneId)!;
  const unit = a.kind === 'expedition' ? 'lupte' : 'gata';
  const cookDone = a.kind === 'cook' && a.done + ready >= a.count;

  const claim = (stop: boolean) => {
    const res = game.dispatch({ type: stop ? 'stop' : 'claim' });
    if (res?.haul && (Object.keys(res.haul.items).length || res.haul.eggs.length || res.haul.wins || res.haul.losses)) onHaul(res.haul);
  };

  return (
    <div className="activity-bar">
      <span className="act-icon">{label.icon}</span>
      <div className="act-main">
        <div className="row between">
          <b>{label.name}</b>
          <small>
            {a.kind === 'cook' ? `${a.done + ready}/${a.count} porții` : `${ready} ${unit}`}
          </small>
        </div>
        <Bar value={cookDone ? 1 : progress} max={1} thin color="#7bc66b" />
      </div>
      <button className="btn primary small" disabled={ready < 1} onClick={() => claim(false)}>
        Revendică
      </button>
      <button className="btn small ghost" onClick={() => claim(true)} aria-label="Oprește activitatea">
        ⏹
      </button>
    </div>
  );
}

function Toasts({ game }: { game: Game }) {
  return (
    <div className="toasts" aria-live="polite">
      {game.toasts.map((t) => (
        <div key={t.id} className={`toast t-${t.kind}${t.error ? ' t-error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Doar în dezvoltare: avansează ceasul jocului ca să testezi timerele. */
function DevTools({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="devtools">
      {open && (
        <div className="devtools-panel">
          <b>Omite timpul</b>
          {[
            ['+1 min', 60_000],
            ['+10 min', 600_000],
            ['+1 h', 3_600_000],
            ['+8 h', 28_800_000],
          ].map(([label, ms]) => (
            <button key={label} className="btn tiny" onClick={() => game.skip(ms as number)}>
              {label}
            </button>
          ))}
          <button
            className="btn tiny danger"
            onClick={() => {
              if (window.confirm('Ștergi salvarea și începi de la zero?')) game.reset();
            }}
          >
            Joc nou
          </button>
        </div>
      )}
      <button className="devtools-toggle" onClick={() => setOpen(!open)} aria-label="Unelte de test">
        ⏩
      </button>
    </div>
  );
}
