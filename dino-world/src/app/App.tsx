// Cadrul jocului: resursele sus, insula în mijloc, meniul jos, panourile deschise peste.

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { freeSlots, type Building, type ElementId } from '@shared/game';
import { formatNumber } from '../components/ui';
import { FirstSteps, Guide, resetFirstSteps } from '../components/FirstSteps';
import { GoalCard, RewardWindow } from '../components/Goals';
import { LevelUp } from '../components/LevelUp';
import { NavProvider, spotlight, type NavTarget, type ShopTab } from '../components/nav';
import { Settings } from '../components/Settings';
import { Welcome } from '../components/Welcome';
import { useGame, type Game } from '../hooks/useGame';
// Panourile se încarcă la cerere: la pornire trebuie doar harta (scorul de încărcare, JS nefolosit).
const loadAtlas = () => import('../screens/AtlasScreen');
const loadWiki = () => import('../screens/WikiScreen');
const loadBuilding = () => import('../screens/BuildingPanel');
const loadShop = () => import('../screens/ShopPanel');
const loadStage = () => import('../screens/DragonStage');
const AtlasScreen = lazy(() => loadAtlas().then((m) => ({ default: m.AtlasScreen })));
const WikiScreen = lazy(() => loadWiki().then((m) => ({ default: m.WikiScreen })));
const BuildingPanel = lazy(() => loadBuilding().then((m) => ({ default: m.BuildingPanel })));
const ShopPanel = lazy(() => loadShop().then((m) => ({ default: m.ShopPanel })));
const DragonStage = lazy(() => loadStage().then((m) => ({ default: m.DragonStage })));
import { WorldScreen, type Placement } from '../screens/WorldScreen';

type Panel =
  | { type: 'building'; building: Building }
  | { type: 'dino'; id: string }
  | { type: 'shop'; tab?: ShopTab }
  | { type: 'atlas' }
  | { type: 'wiki'; article?: string }
  | { type: 'settings' }
  | null;

export default function App() {
  const game = useGame();
  // după ce apare harta, panourile se descarcă în fundal: se deschid fără așteptare
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => [loadBuilding, loadShop, loadAtlas, loadStage].forEach((load) => void load()));
  }, []);
  const { state, now, run } = game;
  const [panel, setPanel] = useState<Panel>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [overview, setOverview] = useState(0);
  const [focusOn, setFocusOn] = useState<{ element: ElementId; n: number }>();
  /** „Du-mă acolo”: deschide locul cerut și evidențiază butonul de acolo. */
  const goTo = useCallback(
    (t: NavTarget) => {
      setPlacement(null);
      if (t.to === 'building') {
        const b = state.buildings.find((x) => x.id === t.id) ?? state.buildings.find((x) => x.kind === t.kind);
        if (b) setPanel({ type: 'building', building: b });
        else setPanel({ type: 'shop', tab: 'buildings' });
        if (!b) return spotlight(`shop-${t.kind}`);
      } else if (t.to === 'island') {
        setPanel(null);
        setFocusOn((f) => ({ element: t.element, n: (f?.n ?? 0) + 1 }));
      } else if (t.to === 'shop') setPanel({ type: 'shop', tab: t.tab });
      else if (t.to === 'wiki') setPanel({ type: 'wiki', article: t.article });
      else setPanel({ type: 'atlas' });
      if (t.spot) spotlight(t.spot);
    },
    [state.buildings],
  );
  return (
    <NavProvider value={goTo}>
      <div className={`app${panel?.type === 'dino' ? ' stage-open' : ''}`}>
        <WorldScreen
          state={state}
          now={now}
          placement={placement}
          onPlace={(slot) => {
            if (!placement) return;
            const ok = placement.moving
              ? run({ type: 'move', buildingId: placement.moving, slot })
              : run({ type: 'build', kind: placement.kind, element: placement.element, slot });
            if (ok) setPlacement(null);
          }}
          onCancelPlace={() => setPlacement(null)}
          onPlacePosition={(position) => {
            if (!placement) return;
            const ok = placement.moving
              ? run({ type: 'moveBuilding', buildingId: placement.moving, position })
              : run({ type: 'buildAt', kind: placement.kind, position });
            if (ok) setPlacement(null);
          }}
          onOpen={(building) => setPanel({ type: 'building', building })}
          onDino={(id) => setPanel({ type: 'dino', id })}
          onCollect={(b) => run({ type: 'collect', buildingId: b.id })}
          onUnlock={(element) => {
            run({ type: 'unlockWorld', element });
          }}
          overview={overview}
          focusOn={focusOn}
        />
        <FirstSteps state={state} onShowWorlds={() => setOverview((n) => n + 1)} />
        {!placement && <Guide state={state} now={now} />}

        <header className="hud-top">
          <div className="hud-summary">
            <span className="hud-brand">Dino World</span>
            <div className="hud-resources" aria-label="Resurse">
              <Resource icon="🪙" value={state.gold} label="Aur" />
              <Resource icon="🍖" value={state.food} label="Hrană" />
              <Resource icon="💎" value={state.gems} label="Nestemate" />
              <Resource icon="✦" value={state.fragments ?? 0} label="Fragmente" />
            </div>
            <button
              className="hud-settings"
              aria-label="Setări"
              title="Setări"
              onClick={() => setPanel({ type: 'settings' })}
            >
              ⚙️
            </button>
          </div>
        </header>

        <nav className="hud-actions">
          <button
            className="hud-button"
            title="Aurul din toate lumile și recoltele gata din toate fermele"
            onClick={() => run({ type: 'collectAll' })}
          >
            <span>🪙</span>Strânge tot
          </button>
          <button className="hud-button" onClick={() => setPanel({ type: 'atlas' })}>
            <span>📖</span>Atlas
          </button>
          <button className="hud-button" data-tour="wikipedia" onClick={() => setPanel({ type: 'wiki' })}>
            <span aria-hidden="true">📚</span>Wikipedia
          </button>
          <button className="hud-button primary" onClick={() => setPanel({ type: 'shop' })}>
            <span>🔓</span>Extinde
          </button>
        </nav>

        <Suspense fallback={null}>
          {panel?.type === 'building' && (
            <BuildingPanel
              game={game}
              building={panel.building}
              onDino={(id) => setPanel({ type: 'dino', id })}
              onClose={() => setPanel(null)}
              onMove={
                panel.building.kind !== 'habitat'
                  ? () => {
                      setPlacement({ kind: panel.building.kind, moving: panel.building.id });
                      setPanel(null);
                    }
                  : undefined
              }
            />
          )}
          {panel?.type === 'shop' && (
            <ShopPanel
              tab={panel.tab}
              state={state}
              onBuyEgg={(element) => run({ type: 'buyHabitatEgg', element })}
              onUnlock={(element) => {
                run({ type: 'unlockWorld', element });
              }}
              onClose={() => setPanel(null)}
              onPick={(p) => {
                // clădirile insulei principale se așază liber, pe hartă; restul (habitate) pe locurile lor
                if (p.kind !== 'habitat') {
                  setPlacement(p);
                  setPanel(null);
                  return;
                }
                const slot = freeSlots(state, p.kind)[0];
                if (!slot) return game.toast('Nu mai sunt locuri libere.', 'error');
                if (run({ type: 'build', kind: p.kind, element: p.element, slot: slot.id })) setPanel(null);
              }}
            />
          )}
          {panel?.type === 'atlas' && (
            <AtlasScreen
              state={state}
              onClaim={(species) => run({ type: 'claimAtlas', species })}
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.type === 'wiki' && (
            <WikiScreen key={panel.article} article={panel.article} onClose={() => setPanel(null)} />
          )}
          {panel?.type === 'settings' && <Settings game={game} onClose={() => setPanel(null)} />}
          {panel?.type === 'dino' && (
            <DragonStage
              key={panel.id}
              game={game}
              dinoId={panel.id}
              onSelect={(id) => setPanel({ type: 'dino', id })}
              onClose={() => setPanel(null)}
            />
          )}
        </Suspense>

        {!placement && <GoalCard state={state} now={now} onClaim={(goalId) => run({ type: 'claimGoal', goalId })} />}
        <Welcome state={state} now={now} lastSeen={game.lastSeen} onCollectAll={() => run({ type: 'collectAll' })} />
        {game.popup && <RewardWindow popup={game.popup} onClose={game.closePopup} />}
        {game.celebration && <LevelUp celebration={game.celebration} state={game.state} onDone={game.endCelebration} />}

        <div className="toasts" aria-live="polite">
          {game.toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>

        {import.meta.env.DEV && <DevTools game={game} />}
      </div>
    </NavProvider>
  );
}

function Resource({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <span className="hud-pill" title={label} aria-label={`${label}: ${formatNumber(value)}`}>
      <span className="hud-pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="hud-pill-copy">
        <span className="hud-pill-label">{label}</span>
        <span className="hud-pill-value">{formatNumber(value)}</span>
      </span>
    </span>
  );
}

const SKIPS: [string, number][] = [
  ['+1 min', 60_000],
  ['+10 min', 600_000],
  ['+1 h', 3_600_000],
  ['+8 h', 8 * 3_600_000],
];

/** Doar în dezvoltare: sare înainte în timp și pornește un joc nou. */
function DevTools({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="devtools">
      <button className="icon-button" onClick={() => setOpen(!open)} title="Unelte de dezvoltare">
        ⏩
      </button>
      {open && (
        <div className="devtools-menu">
          {SKIPS.map(([label, ms]) => (
            <button key={label} className="button small ghost" onClick={() => game.skip(ms)}>
              {label}
            </button>
          ))}
          <button
            className="button small ghost"
            onClick={() => {
              if (!window.confirm('Sigur vrei să începi un joc nou? Tot progresul actual va fi șters.')) return;
              resetFirstSteps();
              game.reset();
              game.toast('Joc nou pornit.');
            }}
          >
            Joc nou
          </button>
        </div>
      )}
    </div>
  );
}
