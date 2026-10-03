// Tabăra ca bază de joc: o hartă cu clădirile tale (Tabăra, Forja lui Saurok, Cuibul, Posturile de muncă,
// Bucătăria). Fiecare are platformă, plăcuță și insigne (⬆ upgrade posibil, surplus de vândut, ouă gata…).
// Apeși pe o clădire și sub hartă se deschide panoul ei: upgrade-ul, rucsacul forjei sau o scurtătură.

import { type ReactNode, useState } from 'react';
import {
  EVOLUTION,
  GATHER_ACTIONS,
  type ItemId,
  ITEMS,
  MAX_SKILL_LEVEL,
  PROPERTY_LEVELS,
  SKILLS,
  SPECIES,
  type SkillId,
  WORK_JOBS,
  ZONES,
  eggsInNest,
  nestSlots,
  skillLevel,
  skillXp,
  workSlots,
} from '@shared/game';
import type { Screen } from '../app/App';
import { EggIcon, ItemArt } from '../components/AssetIcon';
import { Saurok } from '../components/ui';
import { sceneBackground } from '../content/art';
import type { Game } from '../hooks/useGame';

const BUILDING_ICONS = ['🪺', '🛖', '🏯'];

type Spot = 'tabara' | 'forja' | 'cuib' | 'munca' | 'bucatarie';

/** Primul loc de unde vine o resursă (activitate, regiune sau muncă). */
function sourceOf(item: ItemId): { label: string; screen: Screen } | null {
  const a = GATHER_ACTIONS.find((x) => x.drops.some((d) => d.value === item));
  if (a) return { label: a.name, screen: 'activitati' };
  const z = ZONES.find((x) => x.drops.some((d) => d.item === item));
  if (z) return { label: z.name, screen: 'expeditii' };
  const j = WORK_JOBS.find((x) => x.drops.some((d) => d.value === item));
  if (j) return { label: `${j.name} (muncă)`, screen: 'activitati' };
  return null;
}

export function CampScreen({ game, onGo }: { game: Game; onGo?: (screen: Screen) => void }) {
  const state = game.state!;
  const now = game.now();
  const [spot, setSpot] = useState<Spot>('tabara');
  // Vânzarea la forjă: resursa aleasă și câte bucăți.
  const [picked, setPicked] = useState<ItemId | null>(null);
  const [qty, setQty] = useState(1);
  const current = PROPERTY_LEVELS[state.property];
  const next = PROPERTY_LEVELS[state.property + 1];

  // Ce trebuie păstrat: materialele construcției următoare și câte un Cristal pentru fiecare juvenil.
  const juveniles = state.dinos.filter((d) => SPECIES[d.speciesId].stage === 'juvenil').length;
  const keep: Partial<Record<ItemId, number>> = {};
  if (next) for (const [item, qty] of Object.entries(next.cost)) keep[item as ItemId] = qty!;
  const evolutionItem = EVOLUTION.adult.item;
  if (evolutionItem && juveniles > 0) keep[evolutionItem] = (keep[evolutionItem] ?? 0) + juveniles;

  const items = (Object.keys(ITEMS) as ItemId[]).filter((id) => (state.inventory[id] ?? 0) > 0);
  const sellable = (id: ItemId) => Math.max(0, (state.inventory[id] ?? 0) - (keep[id] ?? 0));
  const spare = items.filter((id) => sellable(id) > 0);
  const spareValue = spare.reduce((sum, id) => sum + sellable(id) * ITEMS[id].sell, 0);
  const sell = (id: ItemId, qty: number) => qty > 0 && game.dispatch({ type: 'sell', itemId: id, qty });

  const needs: { key: string; icon: ReactNode; name: string; have: number; need: number; go?: () => void; hint?: string }[] = next
    ? [
        ...(next.sparks > 0 ? [{ key: 'sparks', icon: '✨', name: 'Scântei', have: state.sparks, need: next.sparks, hint: 'vinde la Forjă', go: () => setSpot('forja') }] : []),
        ...Object.entries(next.cost).map(([item, qty]) => {
          const src = sourceOf(item as ItemId);
          return {
            key: item,
            icon: <ItemArt item={item as ItemId} size={30} />,
            name: ITEMS[item as ItemId].name,
            have: state.inventory[item as ItemId] ?? 0,
            need: qty!,
            hint: src?.label,
            go: src ? () => onGo?.(src.screen) : undefined,
          };
        }),
      ]
    : [];
  const ready = !!next && needs.every((n) => n.have >= n.need);
  const progress = needs.length ? Math.round((needs.reduce((s, n) => s + Math.min(1, n.have / n.need), 0) / needs.length) * 100) : 100;

  const nest = eggsInNest(state);
  const hatchReady = nest.filter((e) => e.incubation!.endsAt <= now).length;
  const kitchen = state.property >= 1;

  /** O clădire pe hartă. */
  const building = (id: Spot, icon: ReactNode, name: string, sub: string, badge?: ReactNode, extra = '') => (
    <button key={id} className={`camp-spot spot-${id}${spot === id ? ' selected' : ''}${extra}`} onClick={() => setSpot(id)}>
      {badge && <span className="spot-badge">{badge}</span>}
      <span className="spot-art">{icon}</span>
      <span className="spot-plate">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </button>
  );

  return (
    <div className="screen camp3">
      {/* Harta bazei */}
      <section className="camp-map" style={sceneBackground('jungla', 0.2)}>
        <div className="camp-map-title">
          <small>Baza ta</small>
          <h2>{current.name}</h2>
          <span>
            Nivel {state.property + 1}/{PROPERTY_LEVELS.length}
          </span>
        </div>
        <div className="camp-fire" aria-hidden="true" />

        {building(
          'tabara',
          BUILDING_ICONS[state.property],
          current.name,
          next ? `upgrade ${progress}%` : 'nivel maxim',
          ready ? '⬆' : undefined,
          ` main${ready ? ' can-upgrade' : ''}`,
        )}
        {building('forja', <Saurok size={64} />, 'Forja lui Saurok', 'vinde pe scântei', spare.length ? `+${spareValue}✨` : undefined)}
        {building('cuib', '🥚', 'Cuibul', `${nest.length}/${nestSlots(state)} ouă`, hatchReady ? `${hatchReady} gata!` : undefined)}
        {building('munca', '⛏️', 'Posturi de muncă', `${state.workers.length}/${workSlots(state)} la muncă`, state.workers.length < workSlots(state) ? 'loc liber' : undefined)}
        {building('bucatarie', kitchen ? '🍳' : '🔒', 'Bucătăria', kitchen ? 'gătește hrană' : `la ${PROPERTY_LEVELS[1].name}`, undefined, kitchen ? '' : ' locked')}
      </section>

      {/* Panoul clădirii alese */}
      <section className={`camp-drawer drawer-${spot}`}>
        {spot === 'tabara' &&
          (next ? (
            <div className="drawer-build">
              <div className="drawer-build-head">
                <span className="drawer-from">{BUILDING_ICONS[state.property]}</span>
                <span className="drawer-arrow">➜</span>
                <span className={`drawer-to${ready ? ' ready' : ''}`}>{BUILDING_ICONS[state.property + 1]}</span>
                <div>
                  <small className="camp-kicker">Upgrade</small>
                  <h3>{next.name}</h3>
                  <div className="build-gain">
                    {next.nestSlots > current.nestSlots && <span>+{next.nestSlots - current.nestSlots} loc în cuib</span>}
                    {next.workSlots > current.workSlots && <span>+{next.workSlots - current.workSlots} post de muncă</span>}
                    {next.unlocks.includes('Bucătăria') && <span>🍳 Bucătăria</span>}
                  </div>
                </div>
              </div>
              <div className="build-rings">
                {needs.map((n) => {
                  const pct = Math.min(100, Math.round((n.have / n.need) * 100));
                  const done = n.have >= n.need;
                  return (
                    <button key={n.key} className={`ring${done ? ' done' : ''}`} onClick={n.go} disabled={done || !n.go} title={done ? 'Gata!' : n.hint ? `De unde: ${n.hint}` : ''}>
                      <span className="ring-circle" style={{ ['--p' as string]: `${pct}%` }}>
                        <span className="ring-icon">{done ? '✓' : n.icon}</span>
                      </span>
                      <b>
                        {Math.min(n.have, n.need)}/{n.need}
                      </b>
                      <small>{n.name}</small>
                      {!done && n.hint && <em>{n.hint}</em>}
                    </button>
                  );
                })}
              </div>
              <button className="btn primary big build-btn" disabled={!ready} onClick={() => game.dispatch({ type: 'upgrade' })}>
                {ready ? `🔨 Construiește ${next.name}` : '🔒 Strânge resursele'}
              </button>
            </div>
          ) : (
            <p className="drawer-note">🏆 Baza e complet construită. Incubatorul termal vine curând!</p>
          ))}

        {spot === 'forja' && (
          <div>
            <div className="forge2-head">
              <div>
                <h3>Forja lui Saurok</h3>
                <small className="muted">Alege o resursă și câte bucăți vrei să vinzi.</small>
              </div>
              {spare.length > 0 && (
                <button className="btn primary" onClick={() => spare.forEach((id) => sell(id, sellable(id)))}>
                  🔥 Vinde surplusul · +{spareValue} ✨
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="empty-state">Rucsacul e gol. Resursele vin din Activități și Expediții.</p>
            ) : (
              <div className="bag2">
                {items.map((id) => {
                  const def = ITEMS[id];
                  return (
                    <button
                      key={id}
                      className={`bag-tile${picked === id ? ' picked' : ''}`}
                      onClick={() => {
                        setPicked(picked === id ? null : id);
                        setQty(1);
                      }}
                      title={`${def.name}: ${def.blurb}`}
                    >
                      <span className="bag-count">×{state.inventory[id]}</span>
                      <ItemArt item={id} size={44} />
                      <small>{def.name}</small>
                      <span className="bag-price">+{def.sell} ✨</span>
                    </button>
                  );
                })}
              </div>
            )}
            {picked && (state.inventory[picked] ?? 0) > 0 && (() => {
              const def = ITEMS[picked];
              const have = state.inventory[picked]!;
              const n = Math.min(Math.max(1, qty), have);
              const set = (v: number) => setQty(Math.min(have, Math.max(1, Math.floor(v) || 1)));
              return (
                <div className="sell-panel">
                  <ItemArt item={picked} size={52} />
                  <div className="sell-info">
                    <b>{def.name}</b>
                    <small className="muted">
                      ai ×{have} · {def.sell} ✨/buc
                    </small>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => set(n - 1)} disabled={n <= 1} aria-label="Mai puțin">
                      −
                    </button>
                    <input type="number" min={1} max={have} value={n} onChange={(e) => set(+e.target.value)} aria-label="Câte bucăți" />
                    <button onClick={() => set(n + 1)} disabled={n >= have} aria-label="Mai mult">
                      +
                    </button>
                    <button className="qty-chip" onClick={() => set(have)}>
                      Max ({have})
                    </button>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (sell(picked, n)) {
                        if (n >= have) setPicked(null);
                        else setQty(1);
                      }
                    }}
                  >
                    🔥 Vinde {n} · +{n * def.sell} ✨
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {spot === 'cuib' && (
          <div className="drawer-go">
            <span className="drawer-go-icon">🥚</span>
            <div>
              <h3>Cuibul</h3>
              <p className="muted">
                {nest.length}/{nestSlots(state)} locuri ocupate{hatchReady ? ` · ${hatchReady} ou(ă) gata de eclozare!` : ''}. Mai multe locuri vin cu upgrade-ul bazei.
              </p>
            </div>
            <button className="btn primary" onClick={() => onGo?.('cuib')}>
              Mergi la Cuib →
            </button>
          </div>
        )}

        {spot === 'munca' && (
          <div className="drawer-go">
            <span className="drawer-go-icon">⛏️</span>
            <div>
              <h3>Posturi de muncă</h3>
              <p className="muted">
                {state.workers.length}/{workSlots(state)} dragoni lucrează și aduc resurse, chiar și când ești plecat.
              </p>
            </div>
            <button className="btn primary" onClick={() => onGo?.('activitati')}>
              Trimite la muncă →
            </button>
          </div>
        )}

        {spot === 'bucatarie' && (
          <div className="drawer-go">
            <span className="drawer-go-icon">{kitchen ? '🍳' : '🔒'}</span>
            <div>
              <h3>Bucătăria</h3>
              <p className="muted">{kitchen ? 'Hrana gătită dă mult mai mult XP și atașament.' : `Se deschide când construiești ${PROPERTY_LEVELS[1].name}.`}</p>
            </div>
            {kitchen ? (
              <button className="btn primary" onClick={() => onGo?.('activitati')}>
                Gătește →
              </button>
            ) : (
              <button className="btn" onClick={() => setSpot('tabara')}>
                Vezi upgrade-ul
              </button>
            )}
          </div>
        )}
      </section>

      {/* Skill-urile */}
      <section className="skills-strip">
        {(Object.keys(SKILLS) as SkillId[]).map((sk) => {
          const level = skillLevel(state, sk);
          const from = skillXp(level);
          const to = skillXp(level + 1);
          const pct = level >= MAX_SKILL_LEVEL ? 100 : Math.round(((state.skills[sk] - from) / (to - from)) * 100);
          return (
            <div key={sk} className="skill-pill" title={SKILLS[sk].blurb}>
              <span className="skill-pill-icon">{sk === 'incubatie' ? <EggIcon size={22} /> : SKILLS[sk].icon}</span>
              <span className="skill-pill-text">
                <b>{SKILLS[sk].name}</b>
                <small>Nv. {level}</small>
              </span>
              <span className="skill-pill-bar">
                <i style={{ width: `${pct}%` }} />
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
