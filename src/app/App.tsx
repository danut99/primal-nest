// Cadrul aplicației: început → joc. Bara de sus, navigarea, activitatea curentă, notificările.

import { Suspense, lazy, useState } from 'react';
import {
  type Haul,
  GATHER_ACTIONS,
  RECIPES,
  ZONES,
  activityDuration,
  currentObjective,
  eggsInNest,
  readyCount,
  runawayIn,
  SPECIES,
  type Dino,
  levelXp,
} from '@shared/game';
import { Bar, Modal, Saurok } from '../components/ui';
import { GameIcon } from '../components/GameIcon';
import { ItemArt } from '../components/AssetIcon';
import { type Game, useGame, useTick } from '../hooks/useGame';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { AtlasScreen } from '../screens/AtlasScreen';
import { HaulList } from '../screens/BattleView';
import { BreedingPanel } from '../screens/BreedingPanel';
import { CampScreen } from '../screens/CampScreen';
import { MissionsModal, claimableCount } from '../screens/MissionsModal';
import { WelcomeModal } from '../screens/WelcomeModal';
// Vizualizatorul de dragoni se încarcă doar când deschizi tabul.
const DragonsScreen = lazy(() => import('../dragons/DragonsScreen').then((m) => ({ default: m.DragonsScreen })));
// Laboratorul de dragoni (editorul de rețete), tot la cerere.
const LabScreen = lazy(() => import('../dragon-lab/LabScreen').then((m) => ({ default: m.LabScreen })));
import { ExpeditionsScreen } from '../screens/ExpeditionsScreen';
import { NestScreen } from '../screens/NestScreen';
import { Onboarding } from '../screens/Onboarding';
import { PackScreen } from '../screens/PackScreen';
import { sound } from '../utils/sound';

export type Screen = 'cuib' | 'haita' | 'barlog' | 'activitati' | 'expeditii' | 'tabara' | 'atlas' | 'dragoni' | 'laborator';

const NAV: { id: Screen; label: string }[] = [
  { id: 'cuib', label: 'Cuib' },
  { id: 'haita', label: 'Haită' },
  { id: 'barlog', label: 'Bârlog' },
  { id: 'activitati', label: 'Activități' },
  { id: 'expeditii', label: 'Expediții' },
  { id: 'tabara', label: 'Tabără' },
  { id: 'atlas', label: 'Atlas' },
  { id: 'dragoni', label: 'Dragoni' },
  { id: 'laborator', label: 'Laborator' },
];

export default function App() {
  const game = useGame();
  useTick();
  return (
    <>{game.state ? <GameShell game={game} /> : <Onboarding onStart={game.start} now={game.now} />}</>
  );
}

function GameShell({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  const [screen, setScreen] = useState<Screen>('cuib');
  const [selectedDino, setSelectedDino] = useState<string | null>(null);
  const [haul, setHaul] = useState<Haul | null>(null);
  const [muted, setMuted] = useState(sound.muted);
  const objective = currentObjective(state);
  const readyEggs = eggsInNest(state).filter((e) => e.incubation!.endsAt <= now).length;
  const readyMolts = state.dinos.filter((d) => d.molt && d.molt.endsAt <= now).length;
  const breedReady = state.breeding && state.breeding.endsAt <= now ? 1 : 0;
  const hungry = state.dinos.filter((d) => runawayIn(d, now) !== null).length;
  const [missions, setMissions] = useState(false);
  const rewards = claimableCount(state);

  const go = (s: Screen) => {
    sound.click();
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo" aria-label="Primal Nest">
          <GameIcon name="logo" size={48} className="brand-mark" /> Primal Nest
        </div>
        {/* Activitatea curentă stă în bara de sus: se vede mereu și nu acoperă conținutul. */}
        <ActivityBar game={game} onHaul={setHaul} onGo={go} />
        <div className="topbar-right">
          <span className="res-pill sparks" title="Scântei stelare: din forjă, lupte, Alfa și misiuni">
            <GameIcon name="scanteie" className="res-icon" />
            <b>{state.sparks}</b>
            <small>scântei</small>
          </span>
          <span className="res-pill diamonds" title="Diamante: le câștigi din Alfa, misiuni, realizări și, rar, din lupte">
            <GameIcon name="diamant" className="res-icon" />
            <b>{state.diamonds}</b>
            <small>diamante</small>
          </span>
          <button className="round-btn missions-btn" onClick={() => setMissions(true)} aria-label="Misiuni și realizări" title="Misiuni și realizări">
            <GameIcon name="misiune" size={28} />{rewards > 0 && <span className="badge">{rewards}</span>}
          </button>
          <button className="round-btn" onClick={() => setMuted(sound.toggle())} aria-label={muted ? 'Pornește sunetul' : 'Oprește sunetul'} title={muted ? 'Sunet oprit' : 'Sunet pornit'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {objective && (
        <button className="objective" onClick={() => go(objective.screen)}>
          <Saurok size={38} />
          <div>
            <small className="objective-kicker">Pasul următor</small>
            <b>{objective.title}</b>
            <small>{objective.hint}</small>
          </div>
          <span className="objective-go">→</span>
        </button>
      )}

      <div className="layout">
        <nav className="nav" aria-label="Navigare">
          {NAV.map((n) => {
            const badge = n.id === 'cuib' ? readyEggs : n.id === 'haita' ? readyMolts + hungry : n.id === 'barlog' ? breedReady : 0;
            return (
              <button key={n.id} className={`nav-btn${screen === n.id ? ' active' : ''}`} onClick={() => go(n.id)} aria-current={screen === n.id ? 'page' : undefined}>
                <img className="nav-icon" src={`/icons/tabs/${n.id}.png`} alt="" aria-hidden="true" width={40} height={40} />
                <span className="nav-label">{n.label}</span>
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <main className="main">
          {screen === 'cuib' && <NestScreen game={game} />}
          {screen === 'haita' && <PackScreen game={game} selected={selectedDino} onSelect={setSelectedDino} />}
          {screen === 'barlog' && (
            <div className="screen">
              <BreedingPanel game={game} />
            </div>
          )}
          {screen === 'activitati' && <ActivitiesScreen game={game} />}
          {screen === 'expeditii' && <ExpeditionsScreen game={game} />}
          {screen === 'tabara' && <CampScreen game={game} onGo={go} />}
          {screen === 'atlas' && <AtlasScreen game={game} />}
          {screen === 'dragoni' && (
            <Suspense fallback={<div className="screen muted">Se încarcă dragonii…</div>}>
              <DragonsScreen />
            </Suspense>
          )}
          {screen === 'laborator' && (
            <Suspense fallback={<div className="screen muted">Se încarcă laboratorul…</div>}>
              <LabScreen />
            </Suspense>
          )}
        </main>
      </div>

      <Toasts game={game} />
      {import.meta.env.DEV && <DevTools game={game} />}

      {missions && <MissionsModal game={game} onClose={() => setMissions(false)} />}
      {game.welcome && (
        <WelcomeModal
          game={game}
          away={game.welcome.away}
          events={game.welcome.events}
          onGo={(s) => {
            game.dismissWelcome();
            go(s);
          }}
          onMissions={() => {
            game.dismissWelcome();
            setMissions(true);
          }}
          onClose={game.dismissWelcome}
        />
      )}

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

function ActivityBar({ game, onHaul, onGo }: { game: Game; onHaul: (h: Haul) => void; onGo: (s: Screen) => void }) {
  const state = game.state!;
  const a = state.activity;
  if (!a) {
    return (
      <button className="activity-bar idle" onClick={() => onGo('activitati')} title="Alege o activitate">
        <span className="act-icon">💤</span>
        <span className="act-main">
          <b>Nicio activitate</b>
          <small>Pornește una: cules, săpături, gătit sau o expediție →</small>
        </span>
      </button>
    );
  }
  const now = game.now();
  const dur = activityDuration(a) * 1000;
  const ready = readyCount(a, now);
  const progress = ((now - a.startedAt) % dur) / dur;
  const gather = a.kind === 'gather' ? GATHER_ACTIONS.find((x) => x.id === a.actionId)! : null;
  const recipe = a.kind === 'cook' ? RECIPES.find((r) => r.id === a.recipeId)! : null;
  const activityItem = recipe?.output ?? (gather?.skill === 'cules' ? gather.drops[0].value : null);
  const label =
    a.kind === 'gather'
      ? gather!
      : a.kind === 'cook'
        ? { icon: '🍳', name: recipe!.name }
        : ZONES.find((z) => z.id === a.zoneId)!;
  const unit = a.kind === 'expedition' ? 'lupte' : 'gata';
  const cookDone = (a.kind === 'cook' && a.done + ready >= a.count) || (a.kind === 'gather' && !!a.limit && a.index + ready >= a.limit);

  const claim = (stop: boolean) => {
    const res = game.dispatch({ type: stop ? 'stop' : 'claim' });
    if (res?.haul && (Object.keys(res.haul.items).length || res.haul.eggs.length || res.haul.wins || res.haul.losses)) onHaul(res.haul);
  };

  return (
    <div className="activity-bar">
      <span className="act-icon">{activityItem ? <ItemArt item={activityItem} size={28} /> : label.icon}</span>
      <div className="act-main">
        <div className="row between">
          <b>{label.name}</b>
          <small>
            {a.kind === 'cook' ? `${a.done + ready}/${a.count} porții` : a.kind === 'gather' && a.limit ? `${a.index + ready}/${a.limit}` : `${ready} ${unit}`}
            {state.queue.length > 0 && <span className="queue-count"> · +{state.queue.length} în coadă</span>}
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
/** Doar pentru test: pune în sălbăticie un pui de nivel mic, fugit de o zi. */
function addRunaway(game: Game) {
  const state = game.state!;
  const now = game.now();
  const babies = Object.values(SPECIES).filter((s) => s.stage === 'pui');
  const sp = babies[Math.floor(Math.random() * babies.length)];
  const g = () => Math.floor(Math.random() * 16);
  const dino: Dino = {
    id: `dev-${now}`,
    speciesId: sp.id,
    nickname: `${sp.name} fugar`,
    level: 3,
    xp: levelXp(3),
    bond: 30,
    genes: { hp: g(), atk: g(), def: g(), spd: g() },
    temperament: 'calm',
    variant: 'normal',
    diets: [],
    fullness: 0,
    fullAt: now - 4 * 24 * 3600 * 1000,
    hatchedAt: now - 5 * 24 * 3600 * 1000,
  };
  game.start({ ...state, wild: [...state.wild, { dino, leftAt: now - 24 * 3600 * 1000 }] });
}

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
          <b>Resurse</b>
          <button className="btn tiny" onClick={() => game.start({ ...game.state!, diamonds: game.state!.diamonds + 1000 })}>
            +1000 💎
          </button>
          <button className="btn tiny" onClick={() => game.start({ ...game.state!, sparks: game.state!.sparks + 1000 })}>
            +1000 ✨
          </button>
          <button className="btn tiny" onClick={() => addRunaway(game)}>
            🌲 Dino fugit (nv. 3)
          </button>
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
