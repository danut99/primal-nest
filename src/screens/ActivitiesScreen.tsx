// Activități în stil MilkyWay: Cules, Săpături, Bucătărie. O singură activitate odată.

import { useState } from 'react';
import {
  GATHER_ACTIONS,
  ITEMS,
  type ItemId,
  MAX_SKILL_LEVEL,
  PROPERTY_LEVELS,
  QUEUE_MAX,
  type QueuedAction,
  RECIPES,
  ZONES,
  SKILLS,
  type SkillId,
  maxCookable,
  skillLevel,
  skillXp,
} from '@shared/game';
import { Bar, ItemChip, Panel } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatSeconds } from '../utils/format';
import { WorkPanel } from './WorkPanel';

type Tab = 'cules' | 'sapaturi' | 'bucatarie';

/** Câte acțiuni la cules/săpături; 0 = fără sfârșit. */
const GATHER_COUNTS = [0, 10, 50, 100];

function queuedLabel(item: QueuedAction): string {
  if (item.kind === 'gather') {
    const a = GATHER_ACTIONS.find((x) => x.id === item.actionId)!;
    return `${a.icon} ${a.name} ×${item.count}`;
  }
  if (item.kind === 'cook') return `${ITEMS[RECIPES.find((r) => r.id === item.recipeId)!.output].icon} ${RECIPES.find((r) => r.id === item.recipeId)!.name} ×${item.count}`;
  const z = ZONES.find((x) => x.id === item.zoneId)!;
  return `${z.icon} ${z.name}`;
}

function QueueStrip({ game }: { game: Game }) {
  const state = game.state!;
  if (!state.activity && state.queue.length === 0) return null;
  return (
    <div className="queue-strip">
      <span className="queue-title">Coada</span>
      {Array.from({ length: QUEUE_MAX }, (_, i) => {
        const item = state.queue[i];
        return item ? (
          <span key={i} className="queue-item">
            <small>{i + 1}.</small> {queuedLabel(item)}
            <button className="queue-x" onClick={() => game.dispatch({ type: 'dequeue', index: i })} aria-label="Scoate din coadă">
              ✕
            </button>
          </span>
        ) : (
          <span key={i} className="queue-item empty">
            <small>{i + 1}.</small> loc liber
          </span>
        );
      })}
    </div>
  );
}

export function SkillHeader({ game, skill }: { game: Game; skill: SkillId }) {
  const state = game.state!;
  const level = skillLevel(state, skill);
  const from = skillXp(level);
  const to = skillXp(level + 1);
  const xp = state.skills[skill];
  return (
    <div className="skill-header">
      <span className="skill-icon">{SKILLS[skill].icon}</span>
      <div className="grow">
        <div className="row between">
          <b>
            {SKILLS[skill].name} · nivel {level}
          </b>
          <small className="muted">{SKILLS[skill].blurb}</small>
        </div>
        {level < MAX_SKILL_LEVEL ? (
          <Bar value={xp - from} max={to - from} color="#7bc66b" thin label={`${xp - from}/${to - from} XP`} />
        ) : (
          <small>Nivel maxim!</small>
        )}
      </div>
    </div>
  );
}

export function ActivitiesScreen({ game }: { game: Game }) {
  const [tab, setTab] = useState<Tab>('cules');
  const [count, setCount] = useState(0);
  const state = game.state!;
  const active = state.activity;
  const canQueue = !!active && state.queue.length < QUEUE_MAX;

  return (
    <div className="screen">
      <WorkPanel game={game} />
      <QueueStrip game={game} />
      <div className="tabs" role="tablist">
        {(['cules', 'sapaturi', 'bucatarie'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {SKILLS[t].icon} {SKILLS[t].name}
          </button>
        ))}
      </div>

      {tab !== 'bucatarie' ? (
        <Panel>
          <SkillHeader game={game} skill={tab} />
          <div className="count-row">
            <span className="muted small">Câte acțiuni:</span>
            {GATHER_COUNTS.map((n) => (
              <button key={n} className={`btn tiny${count === n ? ' primary' : ''}`} onClick={() => setCount(n)}>
                {n === 0 ? '∞' : n}
              </button>
            ))}
          </div>
          <div className="action-grid">
            {GATHER_ACTIONS.filter((a) => a.skill === tab).map((a) => {
              const locked = skillLevel(state, a.skill) < a.level;
              const running = active?.kind === 'gather' && active.actionId === a.id;
              const totalWeight = a.drops.reduce((s, d) => s + d.weight, 0);
              return (
                <div key={a.id} className={`action-card${running ? ' running' : ''}${locked ? ' locked' : ''}`}>
                  <div className="action-icon">{locked ? '🔒' : a.icon}</div>
                  <b>{a.name}</b>
                  <small className="muted">
                    {formatSeconds(a.seconds)} / acțiune · +{a.xp} XP
                  </small>
                  <div className="drops">
                    {a.drops.map((d) => (
                      <span key={d.value} className="drop" title={ITEMS[d.value].name}>
                        {ITEMS[d.value].icon} {Math.round((d.weight / totalWeight) * 100)}%
                      </span>
                    ))}
                    {a.egg && <span className="drop egg-drop">🥚 {+(a.egg.chance * 100).toFixed(1)}%</span>}
                  </div>
                  {locked ? (
                    <small className="lock-text">Nivel {a.level}</small>
                  ) : (
                    <div className="action-btns">
                      {running ? (
                        <span className="running-tag">⏳ În lucru…</span>
                      ) : (
                        <button className="btn primary small" onClick={() => game.dispatch({ type: 'gather', actionId: a.id, count: count || undefined })}>
                          Pornește
                        </button>
                      )}
                      {canQueue && (
                        <button
                          className="btn small"
                          title={count ? '' : 'Alege un număr de acțiuni ca să o pui în coadă'}
                          disabled={!count}
                          onClick={() => game.dispatch({ type: 'enqueue', item: { kind: 'gather', actionId: a.id, count } })}
                        >
                          ＋ Coadă
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tab === 'sapaturi' && !state.tutorialDone.includes('first-dig-egg') && (
            <p className="hint">🔥 Saurok: „Sub nisip strălucește chihlimbar. Acolo e un ou. Sapă!”</p>
          )}
        </Panel>
      ) : (
        <Kitchen game={game} />
      )}
      <p className="hint">
        Activitatea merge și cât ești plecat (maximum 8 ore). Alege un număr de acțiuni și pune altele în coadă: pornesc singure, una după alta.
      </p>
    </div>
  );
}

function Kitchen({ game }: { game: Game }) {
  const state = game.state!;
  const [counts, setCounts] = useState<Record<string, number>>({});
  if (state.property < 1) {
    return (
      <Panel>
        <SkillHeader game={game} skill="bucatarie" />
        <p className="empty-state">
          🔒 Bucătăria se deblochează când construiești <b>{PROPERTY_LEVELS[1].name}</b> în Tabără.
        </p>
      </Panel>
    );
  }
  const active = state.activity;
  return (
    <Panel>
      <SkillHeader game={game} skill="bucatarie" />
      <div className="action-grid">
        {RECIPES.map((r) => {
          const locked = skillLevel(state, 'bucatarie') < r.level;
          const max = maxCookable(state, r.id);
          const count = Math.min(counts[r.id] ?? 1, Math.max(1, max));
          const running = active?.kind === 'cook' && active.recipeId === r.id;
          const food = ITEMS[r.output].food!;
          return (
            <div key={r.id} className={`action-card${running ? ' running' : ''}${locked ? ' locked' : ''}`}>
              <div className="action-icon">{locked ? '🔒' : ITEMS[r.output].icon}</div>
              <b>{r.name}</b>
              <small className="muted">
                {formatSeconds(r.seconds)} / porție · +{food.xp} XP la hrănire
              </small>
              <div className="drops">
                {Object.entries(r.inputs).map(([item, qty]) => (
                  <ItemChip key={item} item={item as ItemId} qty={qty! * count} have={state.inventory[item as ItemId] ?? 0} />
                ))}
              </div>
              {locked ? (
                <small className="lock-text">Nivel {r.level}</small>
              ) : running ? (
                <span className="running-tag">
                  ⏳ {active.done}/{active.count}
                </span>
              ) : (
                <>
                  <div className="qty-row">
                    {[1, 5, 10].map((n) => (
                      <button key={n} className={`btn tiny${count === n ? ' primary' : ''}`} disabled={n > max} onClick={() => setCounts({ ...counts, [r.id]: n })}>
                        {n}
                      </button>
                    ))}
                    <button className={`btn tiny${count === max && max > 1 ? ' primary' : ''}`} disabled={max < 1} onClick={() => setCounts({ ...counts, [r.id]: max })}>
                      Max ({max})
                    </button>
                  </div>
                  <div className="action-btns">
                    <button className="btn primary small" disabled={max < 1} onClick={() => game.dispatch({ type: 'cook', recipeId: r.id, count })}>
                      🍳 Gătește {count}
                    </button>
                    {active && game.state!.queue.length < QUEUE_MAX && (
                      <button
                        className="btn small"
                        title="Ingredientele se iau când pornește"
                        onClick={() => game.dispatch({ type: 'enqueue', item: { kind: 'cook', recipeId: r.id, count: counts[r.id] ?? 1 } })}
                      >
                        ＋ Coadă
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
