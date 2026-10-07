import { ControlIcon, ThemeText } from '../components/ThemeText';
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
      {badge && <span className="spot-badge"><ThemeText>{badge}</ThemeText></span>}
      <span className="spot-art"><ThemeText>{icon}</ThemeText></span>
      <span className="spot-plate">
        <b><ThemeText>{name}</ThemeText></b>
        <small><ThemeText>{sub}</ThemeText></small>
      </span>
    </button>
  );

  return (
    <div className="screen camp3">
      {/* Harta bazei */}
      <section className="camp-map" style={sceneBackground('jungla', 0.2)}>
        <div className="camp-map-title">
          <small>Baza ta</small>
          <h2><ThemeText>{current.name}</ThemeText></h2>
          <span>
            Nivel <ThemeText>{state.property + 1}</ThemeText>/<ThemeText>{PROPERTY_LEVELS.length}</ThemeText>
          </span>
        </div>
        <div className="camp-fire" aria-hidden="true" />

        <ThemeText>{building(
          'tabara',
          BUILDING_ICONS[state.property],
          current.name,
          next ? `upgrade ${progress}%` : 'nivel maxim',
          ready ? '⬆' : undefined,
          ` main${ready ? ' can-upgrade' : ''}`,
        )}</ThemeText>
        {building('forja', <Saurok size={64} />, 'Forja lui Saurok', 'vinde pe scântei', spare.length ? `+${spareValue}✨` : undefined)}
        <ThemeText>{building('cuib', '🥚', 'Cuibul', `${nest.length}/${nestSlots(state)} ouă`, hatchReady ? `${hatchReady} gata!` : undefined)}</ThemeText>
        <ThemeText>{building('munca', '⛏️', 'Posturi de muncă', `${state.workers.length}/${workSlots(state)} la muncă`, state.workers.length < workSlots(state) ? 'loc liber' : undefined)}</ThemeText>
        <ThemeText>{building('bucatarie', kitchen ? '🍳' : '🔒', 'Bucătăria', kitchen ? 'gătește hrană' : `la ${PROPERTY_LEVELS[1].name}`, undefined, kitchen ? '' : ' locked')}</ThemeText>
      </section>

      {/* Panoul clădirii alese */}
      <section className={`camp-drawer drawer-${spot}`}>
        {spot === 'tabara' &&
          (next ? (
            <div className="drawer-build">
              <div className="drawer-build-head">
                <span className="drawer-from"><ThemeText>{BUILDING_ICONS[state.property]}</ThemeText></span>
                <span className="drawer-arrow"><ControlIcon glyph="→" /></span>
                <span className={`drawer-to${ready ? ' ready' : ''}`}><ThemeText>{BUILDING_ICONS[state.property + 1]}</ThemeText></span>
                <div>
                  <small className="camp-kicker">Upgrade</small>
                  <h3><ThemeText>{next.name}</ThemeText></h3>
                  <div className="build-gain">
                    {next.nestSlots > current.nestSlots && <span>+<ThemeText>{next.nestSlots - current.nestSlots}</ThemeText> loc în cuib</span>}
                    {next.workSlots > current.workSlots && <span>+<ThemeText>{next.workSlots - current.workSlots}</ThemeText> post de muncă</span>}
                    {next.unlocks.includes('Bucătăria') && <span><ThemeText>{"🍳 Bucătăria"}</ThemeText></span>}
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
                        <span className="ring-icon"><ThemeText>{done ? '✓' : n.icon}</ThemeText></span>
                      </span>
                      <b>
                        <ThemeText>{Math.min(n.have, n.need)}</ThemeText>/<ThemeText>{n.need}</ThemeText>
                      </b>
                      <small><ThemeText>{n.name}</ThemeText></small>
                      {!done && n.hint && <em><ThemeText>{n.hint}</ThemeText></em>}
                    </button>
                  );
                })}
              </div>
              <button className="btn primary big build-btn" disabled={!ready} onClick={() => game.dispatch({ type: 'upgrade' })}>
                <ThemeText>{ready ? `🔨 Construiește ${next.name}` : '🔒 Strânge resursele'}</ThemeText>
              </button>
            </div>
          ) : (
            <p className="drawer-note"><ThemeText>{"🏆 Baza e complet construită. Incubatorul termal vine curând!"}</ThemeText></p>
          ))}

        {spot === 'forja' && (
          <div>
            <div className="forge2-head">
              <div>
                <h3>Forja lui Saurok</h3>
                <small className="muted">Alege o resursă și câte bucăți vrei să vinzi.</small>
              </div>
              {spare.length > 0 && (
                <button className="btn primary" onClick={() => spare.forEach((id) => sell(id, sellable(id)))}><ThemeText>{"\r\n                  🔥 Vinde surplusul · +"}</ThemeText><ThemeText>{spareValue}</ThemeText><ThemeText>{" ✨\r\n                "}</ThemeText></button>
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
                      <span className="bag-count">×<ThemeText>{state.inventory[id]}</ThemeText></span>
                      <ItemArt item={id} size={44} />
                      <small><ThemeText>{def.name}</ThemeText></small>
                      <span className="bag-price">+<ThemeText>{def.sell}</ThemeText><ThemeText>{" ✨"}</ThemeText></span>
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
                    <b><ThemeText>{def.name}</ThemeText></b>
                    <small className="muted">
                      ai ×<ThemeText>{have}</ThemeText> · <ThemeText>{def.sell}</ThemeText><ThemeText>{" ✨/buc\r\n                    "}</ThemeText></small>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => set(n - 1)} disabled={n <= 1} aria-label="Mai puțin">
                      <ControlIcon glyph="−" />
                    </button>
                    <input type="number" min={1} max={have} value={n} onChange={(e) => set(+e.target.value)} aria-label="Câte bucăți" />
                    <button onClick={() => set(n + 1)} disabled={n >= have} aria-label="Mai mult">
                      <ControlIcon glyph="+" />
                    </button>
                    <button className="qty-chip" onClick={() => set(have)}>
                      Max (<ThemeText>{have}</ThemeText>)
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
                  ><ThemeText>{"\r\n                    🔥 Vinde "}</ThemeText><ThemeText>{n}</ThemeText> · +<ThemeText>{n * def.sell}</ThemeText><ThemeText>{" ✨\r\n                  "}</ThemeText></button>
                </div>
              );
            })()}
          </div>
        )}

        {spot === 'cuib' && (
          <div className="drawer-go">
            <span className="drawer-go-icon"><ThemeText>{"🥚"}</ThemeText></span>
            <div>
              <h3>Cuibul</h3>
              <p className="muted">
                <ThemeText>{nest.length}</ThemeText>/<ThemeText>{nestSlots(state)}</ThemeText> locuri ocupate<ThemeText>{hatchReady ? ` · ${hatchReady} ou(ă) gata de eclozare!` : ''}</ThemeText>. Mai multe locuri vin cu upgrade-ul bazei.
              </p>
            </div>
            <button className="btn primary" onClick={() => onGo?.('cuib')}><ThemeText>{"\r\n              Mergi la Cuib →\r\n            "}</ThemeText></button>
          </div>
        )}

        {spot === 'munca' && (
          <div className="drawer-go">
            <span className="drawer-go-icon"><ThemeText>{"⛏️"}</ThemeText></span>
            <div>
              <h3>Posturi de muncă</h3>
              <p className="muted">
                <ThemeText>{state.workers.length}</ThemeText>/<ThemeText>{workSlots(state)}</ThemeText> dragoni lucrează și aduc resurse, chiar și când ești plecat.
              </p>
            </div>
            <button className="btn primary" onClick={() => onGo?.('activitati')}><ThemeText>{"\r\n              Trimite la muncă →\r\n            "}</ThemeText></button>
          </div>
        )}

        {spot === 'bucatarie' && (
          <div className="drawer-go">
            <span className="drawer-go-icon"><ThemeText>{kitchen ? '🍳' : '🔒'}</ThemeText></span>
            <div>
              <h3>Bucătăria</h3>
              <p className="muted"><ThemeText>{kitchen ? 'Hrana gătită dă mult mai mult XP și atașament.' : `Se deschide când construiești ${PROPERTY_LEVELS[1].name}.`}</ThemeText></p>
            </div>
            {kitchen ? (
              <button className="btn primary" onClick={() => onGo?.('activitati')}><ThemeText>{"\r\n                Gătește →\r\n              "}</ThemeText></button>
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
              <span className="skill-pill-icon"><ThemeText>{sk === 'incubatie' ? <EggIcon size={22} /> : SKILLS[sk].icon}</ThemeText></span>
              <span className="skill-pill-text">
                <b><ThemeText>{SKILLS[sk].name}</ThemeText></b>
                <small>Nv. <ThemeText>{level}</ThemeText></small>
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
