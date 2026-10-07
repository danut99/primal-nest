import { ThemeText } from '../components/ThemeText';
import { EggIcon, ItemArt } from '../components/AssetIcon';
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
import { Bar, ItemChip, PageHeader, Panel } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatSeconds } from '../utils/format';
import { WorkPanel } from './WorkPanel';

type Tab = 'cules' | 'sapaturi' | 'bucatarie';

/** Câte acțiuni la cules/săpături; 0 = fără sfârșit. */
const GATHER_COUNTS = [0, 10, 50, 100];

function queuedLabel(item: QueuedAction): string {
  if (item.kind === 'gather') {
    const a = GATHER_ACTIONS.find((x) => x.id === item.actionId)!;
    return `${a.name} ×${item.count}`;
  }
  if (item.kind === 'cook') return `${RECIPES.find((r) => r.id === item.recipeId)!.name} ×${item.count}`;
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
            <small><ThemeText>{i + 1}</ThemeText>.</small> <ThemeText>{queuedLabel(item)}</ThemeText>
            <button className="queue-x" onClick={() => game.dispatch({ type: 'dequeue', index: i })} aria-label="Scoate din coadă"><ThemeText>{"\r\n              ✕\r\n            "}</ThemeText></button>
          </span>
        ) : (
          <span key={i} className="queue-item empty">
            <small><ThemeText>{i + 1}</ThemeText>.</small> loc liber
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
      <span className="skill-icon"><ThemeText>{SKILLS[skill].icon}</ThemeText></span>
      <div className="grow">
        <div className="row between">
          <b>
            <ThemeText>{SKILLS[skill].name}</ThemeText> <span className="skill-level">Nv. <ThemeText>{level}</ThemeText></span>
          </b>
          <small className="muted"><ThemeText>{level < MAX_SKILL_LEVEL ? `${xp - from}/${to - from} XP până la nivelul ${level + 1}` : 'Nivel maxim!'}</ThemeText></small>
        </div>
        {level < MAX_SKILL_LEVEL && <Bar value={xp - from} max={to - from} color="#7bc66b" thin />}
        <small className="muted"><ThemeText>{SKILLS[skill].blurb}</ThemeText></small>
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
      <PageHeader
        icon="⛏️"
        title="Activități"
        subtitle="Tu culegi, sapi sau gătești: o activitate odată, care merge și cât ești plecat (până la 8 ore). Pune altele în coadă și trimite haita la muncă în paralel."
        stats={(['cules', 'sapaturi', 'bucatarie'] as Tab[]).map((t) => ({ label: SKILLS[t].name, value: `Nv. ${skillLevel(state, t)}` }))}
      />

      {/* Ce poți face: trei taburi mari, cu nivelul fiecăruia. */}
      <div className="act-tabs" role="tablist">
        {(['cules', 'sapaturi', 'bucatarie'] as Tab[]).map((t) => {
          const running =
            (active?.kind === 'gather' && GATHER_ACTIONS.find((a) => a.id === active.actionId)?.skill === t) ||
            (t === 'bucatarie' && active?.kind === 'cook');
          return (
            <button key={t} role="tab" aria-selected={tab === t} className={`act-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              <span className="act-tab-icon"><ThemeText>{SKILLS[t].icon}</ThemeText></span>
              <span className="act-tab-text">
                <b><ThemeText>{SKILLS[t].name}</ThemeText></b>
                <small>
                  Nv. <ThemeText>{skillLevel(state, t)}</ThemeText>
                  {running && <span className="act-tab-running"><ThemeText>{" · ⏳ în lucru"}</ThemeText></span>}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      {tab !== 'bucatarie' ? (
        <Panel>
          <SkillHeader game={game} skill={tab} />
          <div className="count-row">
            <span className="muted small">Repetă:</span>
            <span className="segmented">
              {GATHER_COUNTS.map((n) => (
                <button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)} title={n === 0 ? 'Până o oprești (maximum 8 ore)' : `${n} acțiuni`}>
                  <ThemeText>{n === 0 ? '∞ continuu' : `×${n}`}</ThemeText>
                </button>
              ))}
            </span>
          </div>
          <div className="action-grid">
            {GATHER_ACTIONS.filter((a) => a.skill === tab).map((a) => {
              const locked = skillLevel(state, a.skill) < a.level;
              const running = active?.kind === 'gather' && active.actionId === a.id;
              const totalWeight = a.drops.reduce((s, d) => s + d.weight, 0);
              return (
                <div key={a.id} className={`action-card${running ? ' running' : ''}${locked ? ' locked' : ''}`}>
                  <div className="action-icon"><ThemeText>{locked ? '🔒' : a.skill === 'cules' ? <ItemArt item={a.drops[0].value} size={52} /> : a.icon}</ThemeText></div>
                  <b><ThemeText>{a.name}</ThemeText></b>
                  <small className="muted">
                    <ThemeText>{formatSeconds(a.seconds)}</ThemeText> / acțiune · +<ThemeText>{a.xp}</ThemeText> XP
                  </small>
                  <div className="drops">
                    {a.drops.map((d) => (
                      <span key={d.value} className="drop" title={ITEMS[d.value].blurb}>
                        <ItemArt item={d.value} /> <ThemeText>{ITEMS[d.value].name}</ThemeText> · <ThemeText>{Math.round((d.weight / totalWeight) * 100)}</ThemeText>%
                      </span>
                    ))}
                    {a.egg && <span className="drop egg-drop"><EggIcon /> <ThemeText>{+(a.egg.chance * 100).toFixed(1)}</ThemeText>%</span>}
                  </div>
                  {locked ? (
                    <small className="lock-text">Nivel <ThemeText>{a.level}</ThemeText></small>
                  ) : (
                    <div className="action-btns">
                      {running ? (
                        <span className="running-tag"><ThemeText>{"⏳ În lucru…"}</ThemeText></span>
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
                        ><ThemeText>{"\r\n                          ＋ Coadă\r\n                        "}</ThemeText></button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tab === 'sapaturi' && !state.tutorialDone.includes('first-dig-egg') && (
            <p className="hint"><ThemeText>{"🔥 Saurok: „Sub nisip strălucește chihlimbar. Acolo e un ou. Sapă!”"}</ThemeText></p>
          )}
        </Panel>
      ) : (
        <Kitchen game={game} />
      )}

      <QueueStrip game={game} />
      <WorkPanel game={game} />
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
        <p className="empty-state"><ThemeText>{"\r\n          🔒 Bucătăria se deblochează când construiești "}</ThemeText><b><ThemeText>{PROPERTY_LEVELS[1].name}</ThemeText></b> în Tabără.
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
              <div className="action-icon"><ThemeText>{locked ? '🔒' : <ItemArt item={r.output} size={52} />}</ThemeText></div>
              <b><ThemeText>{r.name}</ThemeText></b>
              <small className="muted">
                <ThemeText>{formatSeconds(r.seconds)}</ThemeText> / porție · +<ThemeText>{food.xp}</ThemeText> XP la hrănire
              </small>
              <div className="drops">
                {Object.entries(r.inputs).map(([item, qty]) => (
                  <ItemChip key={item} item={item as ItemId} qty={qty! * count} have={state.inventory[item as ItemId] ?? 0} />
                ))}
              </div>
              {locked ? (
                <small className="lock-text">Nivel <ThemeText>{r.level}</ThemeText></small>
              ) : running ? (
                <span className="running-tag"><ThemeText>{"\r\n                  ⏳ "}</ThemeText><ThemeText>{active.done}</ThemeText>/<ThemeText>{active.count}</ThemeText>
                </span>
              ) : (
                <>
                  <div className="qty-row">
                    {[1, 5, 10].map((n) => (
                      <button key={n} className={`btn tiny${count === n ? ' primary' : ''}`} disabled={n > max} onClick={() => setCounts({ ...counts, [r.id]: n })}>
                        <ThemeText>{n}</ThemeText>
                      </button>
                    ))}
                    <button className={`btn tiny${count === max && max > 1 ? ' primary' : ''}`} disabled={max < 1} onClick={() => setCounts({ ...counts, [r.id]: max })}>
                      Max (<ThemeText>{max}</ThemeText>)
                    </button>
                  </div>
                  <div className="action-btns">
                    <button className="btn primary small" disabled={max < 1} onClick={() => game.dispatch({ type: 'cook', recipeId: r.id, count })}><ThemeText>{"\r\n                      🍳 Gătește "}</ThemeText><ThemeText>{count}</ThemeText>
                    </button>
                    {active && game.state!.queue.length < QUEUE_MAX && (
                      <button
                        className="btn small"
                        title="Ingredientele se iau când pornește"
                        onClick={() => game.dispatch({ type: 'enqueue', item: { kind: 'cook', recipeId: r.id, count: counts[r.id] ?? 1 } })}
                      ><ThemeText>{"\r\n                        ＋ Coadă\r\n                      "}</ThemeText></button>
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
