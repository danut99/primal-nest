// „Extinde”: lumi noi, ouă și clădiri, pe taburi. Același cadru întunecat ca panourile clădirilor.

import { useState, type CSSProperties } from 'react';
import {
  BUILDINGS,
  ELEMENTS,
  ELEMENT_IDS,
  WORLD_UNLOCK_COST,
  buildLock,
  buildSteps,
  type BuildStepGo,
  type BuildingKind,
  type ElementId,
  type GameState,
} from '@shared/game';
import { Modal, formatNumber } from '../components/ui';
import { HABITAT_ISLANDS } from '../world/islands';
import { HabitatEggShop } from '../components/Eggs';
import { WorldPreview } from '../components/WorldPreview';
import type { Placement } from './WorldScreen';
import type { ShopTab } from '../components/nav';
import { BuildingPreview } from '../world/BuildingArt';

type Tab = ShopTab;
/** Clădirile insulei principale, în ordinea în care se deblochează (vezi BUILD_UNLOCKS). */
const BUILDABLE: { kind: 'farm' | 'outpost' | 'arena' | 'forge' | 'den'; color: string; label: string }[] = [
  { kind: 'farm', color: '#7fae45', label: '🌱 Hrană pentru dinozauri' },
  { kind: 'outpost', color: '#3e9a7a', label: '🧭 Expediții · materiale și fragmente' },
  { kind: 'arena', color: '#d0703e', label: '⚔️ Dueluri · aur și medalii' },
  { kind: 'forge', color: '#e0703e', label: '⚒️ Echipament, consumabile, piese' },
  { kind: 'den', color: '#d0607f', label: '💞 Împerechere · specii noi' },
];
const TABS: [Tab, string][] = [
  ['worlds', '🏝️ Lumi'],
  ['eggs', '🥚 Ouă'],
  ['buildings', '🏗️ Clădiri'],
];

export function ShopPanel({
  state,
  onPick,
  onUnlock,
  onBuyEgg,
  onClose,
  tab: initialTab = 'worlds',
}: {
  tab?: Tab;
  state: GameState;
  onBuyEgg: (element: ElementId) => void;
  onPick: (p: Placement) => void;
  onUnlock: (element: ElementId) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // „Mergi →” dintr-un pas: alt tab sau cardul clădirii cerute (clipește scurt)
  const [flash, setFlash] = useState<BuildingKind | null>(null);
  const go = (to: BuildStepGo) => {
    if (to === 'worlds' || to === 'eggs') return setTab(to);
    setFlash(to);
    document.getElementById(`shop-card-${to}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setFlash(null), 1600);
  };
  const unlockedCount = ELEMENT_IDS.filter((e) =>
    state.buildings.some((b) => b.kind === 'habitat' && b.element === e),
  ).length;
  return (
    <Modal title="Extinde lumea" onClose={onClose} bare className="bp-modal shop-modal">
      <div className="bp-adv" style={{ '--tint': '#f2b544' } as CSSProperties}>
        <header className="bp-bar">
          <span className="shop-bar-icon" aria-hidden="true">
            🔓
          </span>
          <div className="bp-bar-title">
            <h2>Extinde</h2>
          </div>
          <nav className="arena-tabs shop-tabs" aria-label="Magazin">
            {TABS.map(([id, label]) => (
              <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <span className="arena-pill medals shop-gold">🪙 {formatNumber(state.gold)}</span>
        </header>
        <div className="bp-adv-body shop-body">
          {tab === 'worlds' && (
            <>
              <p className="shop-progress">
                <span className="bp-seats" aria-hidden="true">
                  {ELEMENT_IDS.map((e, i) => (
                    <i key={e} className={i < unlockedCount ? 'on' : ''} />
                  ))}
                </span>
                {unlockedCount}/{ELEMENT_IDS.length} lumi
              </p>
              <div className="shop-worlds">
                {ELEMENT_IDS.map((element) => {
                  const unlocked = state.buildings.some((b) => b.kind === 'habitat' && b.element === element);
                  const cost = WORLD_UNLOCK_COST[element];
                  const island = HABITAT_ISLANDS[element];
                  return (
                    <article
                      key={element}
                      className={`shop-world ${unlocked ? 'unlocked' : state.gold >= cost ? 'affordable' : 'locked'}`}
                      style={{ '--el': ELEMENTS[element].color } as CSSProperties}
                    >
                      <div className="shop-world-art">
                        <img src={unlocked ? island.image : island.locked} loading="lazy" alt="" draggable={false} />
                        <span className="shop-world-el">{ELEMENTS[element].icon}</span>
                      </div>
                      <strong>{island.name}</strong>
                      {!unlocked && <WorldPreview state={state} element={element} compact />}
                      <ShopAction
                        gold={state.gold}
                        cost={cost}
                        done={unlocked ? 'Deblocată' : undefined}
                        label="🔓 Deblochează"
                        onClick={() => onUnlock(element)}
                      />
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'eggs' && <HabitatEggShop state={state} onBuy={onBuyEgg} />}
          {tab === 'buildings' && (
            <div className="shop-worlds">
              {BUILDABLE.map(({ kind, color, label }) => {
                const owned = state.buildings.filter((b) => b.kind === kind).length;
                const limit = BUILDINGS[kind].limit;
                const cost = BUILDINGS[kind].cost[0];
                const lock = buildLock(state, kind);
                return (
                  <article
                    key={kind}
                    id={`shop-card-${kind}`}
                    data-tour={`shop-${kind}`}
                    className={`shop-world ${lock ? 'locked' : owned < limit ? 'affordable' : 'unlocked'} ${flash === kind ? 'flash' : ''}`}
                    style={{ '--el': color } as CSSProperties}
                  >
                    <div className="shop-world-art building">
                      <BuildingPreview kind={kind} />
                      <span className="shop-world-el">
                        {owned}/{limit}
                      </span>
                    </div>
                    <strong>{BUILDINGS[kind].name}</strong>
                    <small className="shop-world-note">{label}</small>
                    <ShopAction
                      gold={state.gold}
                      cost={cost}
                      done={owned >= limit ? 'Construită' : undefined}
                      steps={lock ? buildSteps(state, kind) : undefined}
                      onGo={go}
                      label="🏗️ Construiește"
                      onClick={() => onPick({ kind })}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Butonul de jos al unui card: gata (✓), blocat (ce îți trebuie și unde se face) sau de cumpărat. Fără destul aur,
 * spune cât lipsește în loc să fie doar un buton stins.
 */
function ShopAction({
  gold,
  cost,
  done,
  steps,
  label,
  onClick,
  onGo,
}: {
  gold: number;
  cost: number;
  done?: string;
  /** Blocat: pașii până se deblochează, cu cei făcuți bifați. */
  steps?: { label: string; how: string; done: boolean; go?: BuildStepGo }[];
  onGo?: (to: BuildStepGo) => void;
  label: string;
  onClick: () => void;
}) {
  if (done) return <span className="shop-world-done">✓ {done}</span>;
  if (steps) {
    const next = steps.findIndex((s) => !s.done);
    return (
      <div className="shop-lock">
        <p className="shop-lock-title">
          🔒 Se deblochează în {steps.length} {steps.length === 1 ? 'pas' : 'pași'}
        </p>
        <ol>
          {steps.map((s, i) => (
            <li key={s.label} className={s.done ? 'done' : i === next ? 'next' : 'later'}>
              <b aria-hidden="true">{s.done ? '✓' : i + 1}</b>
              <span>
                <strong>{s.label}</strong>
                {i === next && <small>{s.how}</small>}
              </span>
              {i === next && s.go && onGo && (
                <button type="button" className="shop-go" onClick={() => onGo(s.go!)}>
                  Mergi →
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const short = cost - gold;
  return (
    <button className={`button shop-buy ${short > 0 ? 'short' : ''}`} disabled={short > 0} onClick={onClick}>
      <span>{short > 0 ? `Îți lipsesc 🪙 ${formatNumber(short)}` : label}</span>
      <span className="arena-cost">🪙 {formatNumber(cost)}</span>
    </button>
  );
}
