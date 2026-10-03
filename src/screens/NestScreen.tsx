// Cuibul: ouă la incubat, timere, rotire, lumânare, eclozare. Plus ouăle din rucsac.

import { useState } from 'react';
import {
  type Egg,
  type Temperature,
  RARITIES,
  SPECIES,
  TEMPERAMENTS,
  TEMPERATURES,
  TURN_COOLDOWN_SECONDS,
  canTurn,
  candleHint,
  eggPrice,
  eggsInNest,
  incubationSeconds,
  nestSlots,
} from '@shared/game';
import { EggSprite } from '../components/EggSprite';
import { Panel, Sparkles } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration, formatSeconds } from '../utils/format';
import { HatchModal } from './HatchModal';

export function NestScreen({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  const nest = eggsInNest(state);
  const bag = state.eggs.filter((e) => !e.incubation);
  const slots = nestSlots(state);
  const [hatching, setHatching] = useState<Egg | null>(null);

  return (
    <div className="screen">
      <Panel title="Cuibul" icon="🪺" right={<span className="muted">{nest.length}/{slots} locuri</span>}>
        <div className="nest-grid">
          {Array.from({ length: slots }, (_, i) => {
            const egg = nest[i];
            if (!egg) {
              return (
                <div key={`empty${i}`} className="nest-slot empty">
                  <NestBowl />
                  <span className="muted">Loc liber</span>
                  {bag.length > 0 && <small>Pune un ou din rucsac ↓</small>}
                </div>
              );
            }
            const inc = egg.incubation!;
            const total = inc.endsAt - inc.startedAt;
            const left = inc.endsAt - now;
            const ready = left <= 0;
            const nearly = !ready && left < total * 0.15;
            const turnable = canTurn(egg, now);
            const species = SPECIES[egg.speciesId];
            const temp = TEMPERATURES[inc.temperature];
            const turnLeft = inc.lastTurnedAt ? inc.lastTurnedAt + TURN_COOLDOWN_SECONDS * 1000 - now : 0;
            const pct = Math.min(100, Math.floor(((now - inc.startedAt) / total) * 100));
            return (
              <div key={egg.id} className={`nest-slot r-${egg.rarity}${ready ? ' ready' : ''}`}>
                <div className="slot-head">
                  <span className={`rarity-tag r-${egg.rarity}`}>{RARITIES[egg.rarity].name}</span>
                  <span className="temp-tag" title={`${temp.name} → pui ${TEMPERAMENTS[temp.temperament].name.toLowerCase()}`}>
                    {temp.icon} {TEMPERAMENTS[temp.temperament].name}
                  </span>
                </div>
                <button
                  className="egg-button"
                  onClick={() => ready && setHatching(egg)}
                  disabled={!ready}
                  aria-label={ready ? 'Eclozează oul' : 'Ou la incubat'}
                >
                  {ready && <span className="light-beam" />}
                  {ready && <Sparkles count={12} />}
                  <NestBowl />
                  <EggSprite egg={egg} size={92} cracks={ready ? 2 : nearly ? 1 : 0} className={ready ? 'wobble-fast' : nearly ? 'wobble' : 'breathe'} />
                </button>
                {ready ? (
                  <button className="btn primary glow slot-hatch" onClick={() => setHatching(egg)}>
                    🐣 Eclozează!
                  </button>
                ) : (
                  <>
                    <div className="slot-timer">
                      <div className="slot-time">
                        <small>{nearly ? 'Aproape gata…' : 'Eclozează în'}</small>
                        <b>{formatDuration(left)}</b>
                        <small className="slot-pct">{pct}%</small>
                      </div>
                      <div className="slot-progress">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="slot-actions">
                      <button
                        className="slot-act"
                        disabled={!turnable}
                        onClick={() => game.dispatch({ type: 'turnEgg', eggId: egg.id })}
                        title={turnable ? 'Rotește oul: −5% din timp' : `Poți roti o dată la ${TURN_COOLDOWN_SECONDS / 60} min`}
                      >
                        <span>🔄</span>
                        {turnable ? 'Rotește' : formatDuration(turnLeft)}
                      </button>
                      <button
                        className="slot-act"
                        disabled={egg.candled}
                        onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })}
                        title="Privește oul prin lumină"
                      >
                        <span>🕯️</span>
                        {egg.candled ? 'Privit' : 'Lumânare'}
                      </button>
                    </div>
                  </>
                )}
                {egg.candled && <CandleNote egg={egg} />}
                {state.atlas[species.id]?.owned && <small className="muted slot-foot">Seamănă cu un ou de {species.name}</small>}
              </div>
            );
          })}
        </div>
        <p className="hint">
          🔥 Nisip fierbinte → Fioros · ❄️ Peșteră rece → Calm · 🌪️ Vânt schimbător → Agitat. Rotește ouăle o dată la 30 min ca să grăbești
          eclozarea.
        </p>
      </Panel>

      <EggBag game={game} bag={bag} nestFull={nest.length >= slots} />

      {hatching && <HatchModal game={game} egg={hatching} onClose={() => setHatching(null)} />}
    </div>
  );
}

/** Ouă care arată la fel (raritate + culoarea petelor) se adună într-un teanc. Cele lumânate sau din împerechere rămân separate. */
function stackKey(egg: Egg): string {
  if (egg.candled || egg.lineage || egg.tutorial) return egg.id;
  return `${egg.rarity}:${SPECIES[egg.speciesId].types[0]}`;
}

const RARITY_ORDER = Object.keys(RARITIES) as Egg['rarity'][];

function EggBag({ game, bag, nestFull }: { game: Game; bag: Egg[]; nestFull: boolean }) {
  const state = game.state!;
  const [placing, setPlacing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const stacks = new Map<string, Egg[]>();
  for (const egg of bag) stacks.set(stackKey(egg), [...(stacks.get(stackKey(egg)) ?? []), egg]);
  const sorted = [...stacks.entries()].sort(([, x], [, y]) => RARITY_ORDER.indexOf(y[0].rarity) - RARITY_ORDER.indexOf(x[0].rarity));
  const sellable = bag.filter((e) => !e.tutorial);
  const total = sellable.reduce((sum, e) => sum + eggPrice(e), 0);

  return (
    <Panel
      title="Ouă în rucsac"
      icon="🎒"
      right={
        <span className="row gap-s">
          <span className="muted">{bag.length}</span>
          {sellable.length > 1 &&
            (confirm === 'all' ? (
              <button className="btn tiny danger" onClick={() => (game.dispatch({ type: 'sellEggs', eggIds: sellable.map((e) => e.id) }), setConfirm(null))}>
                Sigur? Vinde toate ({total} ✨)
              </button>
            ) : (
              <button className="btn tiny" onClick={() => setConfirm('all')}>
                ✨ Vinde toate
              </button>
            ))}
        </span>
      }
    >
      {bag.length === 0 ? (
        <p className="empty-state">Niciun ou deocamdată. Le găsești la Săpături și în Expediții.</p>
      ) : (
        <div className="egg-list">
          {sorted.map(([key, eggs]) => {
            const egg = eggs[0];
            const n = eggs.length;
            const ids = eggs.map((e) => e.id);
            return (
              <div key={key} className={`egg-card r-${egg.rarity}`}>
                <span className="egg-stack">
                  <EggSprite egg={egg} size={64} className="breathe" />
                  {n > 1 && <span className="egg-count">×{n}</span>}
                </span>
                <div className="egg-info">
                  <b className={`r-text r-${egg.rarity}`}>
                    Ou {RARITIES[egg.rarity].name.toLowerCase()}
                    {n > 1 && <span className="muted"> ×{n}</span>}
                  </b>
                  <small>Incubare: {formatSeconds(incubationSeconds(state, egg))}</small>
                  {egg.lineage && (
                    <small className="lineage">
                      💞 Gen. {egg.lineage.generation} · {egg.lineage.parents[0]} × {egg.lineage.parents[1]}
                    </small>
                  )}
                  {egg.candled && <CandleNote egg={egg} />}
                </div>
                <div className="egg-actions">
                  {placing === key ? (
                    <div className="temp-pick">
                      {(Object.keys(TEMPERATURES) as Temperature[]).map((t) => (
                        <button
                          key={t}
                          className="btn small"
                          title={`Pui ${TEMPERAMENTS[TEMPERATURES[t].temperament].name}: ${TEMPERAMENTS[TEMPERATURES[t].temperament].text}`}
                          onClick={() => {
                            game.dispatch({ type: 'placeEgg', eggId: egg.id, temperature: t });
                            setPlacing(null);
                          }}
                        >
                          {TEMPERATURES[t].icon} {TEMPERATURES[t].name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button className="btn primary small" disabled={nestFull} onClick={() => setPlacing(key)} title={nestFull ? 'Cuibul e plin' : ''}>
                      🪺 În cuib
                    </button>
                  )}
                  {!egg.candled && (
                    <button className="btn small" onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })} title="Privește un ou prin lumină">
                      🕯️
                    </button>
                  )}
                  {!egg.tutorial && (
                    <>
                      <button className="btn small" onClick={() => game.dispatch({ type: 'sellEggs', eggIds: [egg.id] })} title="Dă oul altui cuib pentru scântei">
                        ✨ Vinde {eggPrice(egg)}
                      </button>
                      {n > 1 && (
                        <button className="btn small" onClick={() => game.dispatch({ type: 'sellEggs', eggIds: ids })}>
                          ✨ Vinde ×{n} ({eggs.reduce((sum, e) => sum + eggPrice(e), 0)})
                        </button>
                      )}
                      {confirm === key ? (
                        <button className="btn small danger" onClick={() => (game.dispatch({ type: 'discardEggs', eggIds: ids }), setConfirm(null))}>
                          Sigur? Aruncă{n > 1 ? ` ×${n}` : ''}
                        </button>
                      ) : (
                        <button className="btn small ghost" onClick={() => setConfirm(key)} title="Lasă oul în sălbăticie, fără scântei">
                          🗑️
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function CandleNote({ egg }: { egg: Egg }) {
  const hint = candleHint(egg);
  return (
    <small className="candle-note">
      🕯️ {hint.text} {hint.quality}
    </small>
  );
}

export function NestBowl() {
  return (
    <svg className="nest-bowl" viewBox="0 0 120 40" aria-hidden="true">
      <ellipse cx="60" cy="22" rx="56" ry="16" fill="#a57a45" stroke="#2b1d14" strokeWidth="2.5" />
      <ellipse cx="60" cy="16" rx="44" ry="9" fill="#6b4a26" />
      <g stroke="#d9b06a" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M10 22 q20 -6 40 2" />
        <path d="M50 30 q22 -8 46 -2" />
        <path d="M20 30 q14 2 24 -2" />
        <path d="M80 16 q14 2 30 8" />
      </g>
    </svg>
  );
}
