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
  eggsInNest,
  incubationSeconds,
  nestSlots,
} from '@shared/game';
import { EggSprite } from '../components/EggSprite';
import { Bar, Panel, Sparkles } from '../components/ui';
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
  const [placing, setPlacing] = useState<string | null>(null);

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
            return (
              <div key={egg.id} className={`nest-slot${ready ? ' ready' : ''}`}>
                <span className={`rarity-tag r-${egg.rarity}`}>{RARITIES[egg.rarity].name}</span>
                <span className="temp-tag" title={`Pui ${TEMPERAMENTS[TEMPERATURES[inc.temperature].temperament].name}`}>
                  {TEMPERATURES[inc.temperature].icon}
                </span>
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
                  <button className="btn primary glow" onClick={() => setHatching(egg)}>
                    🐣 Eclozează!
                  </button>
                ) : (
                  <>
                    <Bar value={now - inc.startedAt} max={total} color="#f5b942" label={formatDuration(left)} />
                    <div className="row gap-s">
                      <button
                        className="btn small"
                        disabled={!turnable}
                        onClick={() => game.dispatch({ type: 'turnEgg', eggId: egg.id })}
                        title={turnable ? 'Rotește oul: −5% din timp' : `Poți roti o dată la ${TURN_COOLDOWN_SECONDS / 60} min`}
                      >
                        🔄 Rotește
                      </button>
                      {!egg.candled && (
                        <button className="btn small" onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })} title="Privește oul prin lumină">
                          🕯️ Lumânare
                        </button>
                      )}
                    </div>
                  </>
                )}
                {egg.candled && <CandleNote egg={egg} />}
                {state.atlas[species.id]?.owned && <small className="muted">Seamănă cu un ou de {species.name}</small>}
              </div>
            );
          })}
        </div>
        <p className="hint">
          🔥 Nisip fierbinte → Fioros · ❄️ Peșteră rece → Calm · 🌪️ Vânt schimbător → Agitat. Rotește ouăle o dată la 30 min ca să grăbești
          eclozarea.
        </p>
      </Panel>

      <Panel title="Ouă în rucsac" icon="🎒" right={<span className="muted">{bag.length}</span>}>
        {bag.length === 0 ? (
          <p className="empty-state">Niciun ou deocamdată. Le găsești la Săpături și în Expediții.</p>
        ) : (
          <div className="egg-list">
            {bag.map((egg) => {
              const full = nest.length >= slots;
              const price = Math.round(RARITIES[egg.rarity].sell * (egg.candled ? 1.25 : 1));
              return (
                <div key={egg.id} className="egg-card">
                  <EggSprite egg={egg} size={64} className="breathe" />
                  <div className="egg-info">
                    <b className={`r-text r-${egg.rarity}`}>Ou {RARITIES[egg.rarity].name.toLowerCase()}</b>
                    <small>Incubare: {formatSeconds(incubationSeconds(state, egg))}</small>
                    {egg.candled && <CandleNote egg={egg} />}
                  </div>
                  <div className="egg-actions">
                    {placing === egg.id ? (
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
                      <button className="btn primary small" disabled={full} onClick={() => setPlacing(egg.id)} title={full ? 'Cuibul e plin' : ''}>
                        🪺 În cuib
                      </button>
                    )}
                    {!egg.candled && (
                      <button className="btn small" onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })}>
                        🕯️
                      </button>
                    )}
                    <button className="btn small ghost" onClick={() => game.dispatch({ type: 'sellEgg', eggId: egg.id })} title="Dă oul altui cuib pentru scântei">
                      ✨ {price}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {hatching && <HatchModal game={game} egg={hatching} onClose={() => setHatching(null)} />}
    </div>
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
