// Pe hartă: obiectivul curent (următorul pas, cu recompensa lui) și fereastra de recompensă după acțiunile mari.

import { useState } from 'react';
import {
  GOALS,
  MATERIALS,
  currentGoal,
  farmPlots,
  residents,
  type BuildingKind,
  type GameState,
  type Goal,
  type MaterialId,
  type Reward,
} from '@shared/game';
import type { RewardPopup } from '../hooks/useGame';
import { useNav, type NavTarget } from './nav';

const INTRO = GOALS.filter((g) => g.intro);

/** Unde se face obiectivul: clădirea, insula sau tabul din Extinde, cu butonul de evidențiat acolo. */
export function goalTarget(goal: Goal, s: GameState, now: number): NavTarget | undefined {
  const has = (kind: BuildingKind) => s.buildings.some((b) => b.kind === kind);
  const open = (kind: BuildingKind, spot?: string): NavTarget =>
    has(kind) ? { to: 'building', kind, spot } : { to: 'shop', tab: 'buildings', spot: `shop-${kind}` };
  // lumea cu cei mai mulți dinozauri (acolo e de hrănit)
  const home = s.buildings
    .filter((b) => b.kind === 'habitat')
    .sort((a, b) => residents(s, b.id).length - residents(s, a.id).length)[0];
  const feed: NavTarget = home
    ? { to: 'building', kind: 'habitat', id: home.id, spot: 'feed' }
    : { to: 'island', element: 'fire' };
  switch (goal.id) {
    case 'world':
      return { to: 'island', element: 'fire', spot: 'unlock-fire' };
    case 'feed1':
    case 'feed':
      return feed;
    case 'harvest': {
      const ready = s.buildings.some((b) => b.kind === 'farm' && farmPlots(b).some((p) => p && p.readyAt <= now));
      return open('farm', ready ? 'harvest' : 'crop-ferigi');
    }
    case 'egg':
      return s.eggs.length
        ? open('hatchery', 'hatch')
        : { to: 'shop', tab: 'eggs', spot: `egg-${home?.element ?? 'fire'}` };
    case 'outpost':
    case 'forge':
    case 'arena':
      return { to: 'shop', tab: 'buildings', spot: `shop-${goal.id}` };
    case 'expedition':
      return open('outpost');
    case 'craft':
      return open('forge');
    case 'duel':
      return open('arena');
    case 'world3':
    case 'world4':
      return home && { to: 'building', kind: 'habitat', id: home.id, spot: 'upgrade' };
    case 'farm2':
      return open('farm', 'upgrade');
    case 'forge2':
      return open('forge', 'upgrade');
    case 'worlds3':
      return { to: 'shop', tab: 'worlds' };
    case 'gear':
      return home && { to: 'building', kind: 'habitat', id: home.id, spot: 'gear' };
    case 'atlas':
      return { to: 'atlas' };
    case 'breed':
      return open('den');
  }
}

/** Recompensa ca șir de etichete mici: 🪙 150 · 💎 2 · 🦴 4. */
export function RewardChips({ reward }: { reward: Reward }) {
  const chips: [string, number][] = [
    ['🪙', reward.gold ?? 0],
    ['🍖', reward.food ?? 0],
    ['💎', reward.gems ?? 0],
    ['✦', reward.fragments ?? 0],
    ...Object.entries(reward.materials ?? {}).map(([k, n]): [string, number] => [
      MATERIALS[k as MaterialId].icon,
      n ?? 0,
    ]),
  ];
  return (
    <span className="reward-chips">
      {chips
        .filter(([, n]) => n > 0)
        .map(([icon, n]) => (
          <span key={icon}>
            {icon} {n}
          </span>
        ))}
    </span>
  );
}

export function GoalCard({ state, now, onClaim }: { state: GameState; now: number; onClaim: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const nav = useNav();
  const goal = currentGoal(state);
  if (!goal) return null;
  const done = goal.done(state);
  const index = GOALS.indexOf(goal);
  const intro = INTRO.indexOf(goal);
  const target = done ? undefined : goalTarget(goal, state, now);
  if (!open)
    return (
      <button
        className={`goal-pill ${done ? 'done' : ''}`}
        data-tour="goal-pill"
        onClick={() => setOpen(true)}
        aria-label="Arată obiectivul"
      >
        {goal.icon}
        {done && <i aria-hidden="true" />}
      </button>
    );
  return (
    <aside className={`goal-card ${done ? 'done' : ''} ${intro >= 0 ? 'intro' : ''}`} aria-label="Obiectiv">
      <button className="goal-hide" onClick={() => setOpen(false)} aria-label="Ascunde obiectivul">
        –
      </button>
      <span className="goal-icon" aria-hidden="true">
        {goal.icon}
      </span>
      <div className="goal-copy">
        <small>
          {intro >= 0 ? `Primii pași · ${intro + 1}/${INTRO.length}` : `Obiectiv ${index + 1}/${GOALS.length}`}
        </small>
        <strong>{goal.title}</strong>
        {done ? <RewardChips reward={goal.reward} /> : <span className="goal-hint">{goal.hint}</span>}
        {target && (
          <button className="goal-go" data-tour="goal-go" onClick={() => nav(target)}>
            Du-mă acolo →
          </button>
        )}
      </div>
      {done ? (
        <button className="button goal-claim" data-tour="goal-claim" onClick={() => onClaim(goal.id)}>
          Ia
        </button>
      ) : (
        <span className="goal-reward">
          <RewardChips reward={goal.reward} />
        </span>
      )}
    </aside>
  );
}

export function RewardWindow({ popup, onClose }: { popup: RewardPopup; onClose: () => void }) {
  return (
    <div className="reward-backdrop" onClick={onClose}>
      <section className="reward-card" role="dialog" aria-label={popup.title} onClick={(e) => e.stopPropagation()}>
        <span className="reward-burst" aria-hidden="true">
          {popup.icon}
        </span>
        <h2>{popup.title}</h2>
        <div className="reward-lines">
          {popup.lines.map((l, i) => (
            <span key={i} className="reward-line" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
              <b aria-hidden="true">{l.icon}</b>
              <strong>{l.value}</strong>
              <small>{l.label}</small>
            </span>
          ))}
        </div>
        <button className="button reward-ok" onClick={onClose} autoFocus>
          Super!
        </button>
      </section>
    </div>
  );
}
