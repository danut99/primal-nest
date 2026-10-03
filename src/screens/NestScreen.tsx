// Cuibul: o cameră de incubație. Ouăle stau pe cuibul din scenă, fiecare cu un inel de progres, cronometru și
// acțiuni (rotește, lumânare); cel gata strălucește și se eclozează cu un clic. Sub scenă, raftul cu ouăle din
// rucsac: alegi un ou, apoi lumina sub care îl clocești (ea îi dă temperamentul puiului).

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
import { Sparkles } from '../components/ui';
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
  const [focus, setFocus] = useState<number | null>(null);
  const readyNow = nest.filter((e) => e.incubation!.endsAt <= now).length;
  const toBag = () => document.getElementById('egg-shelf')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const spots = EGG_SPOTS[Math.min(4, Math.max(1, slots))] ?? EGG_SPOTS[4];

  return (
    <div className="screen nest5">
      <section className="nest-hall">
        {/* Portalul: camera de incubație la mărimea ei reală, cu ouăle așezate pe cuibul din imagine. */}
        <div className="nest-portal">
          <span className="portal-motes" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ ['--i' as string]: i }} />
            ))}
          </span>
          {Array.from({ length: slots }, (_, i) => {
            const egg = nest[i];
            const [x, y] = spots[i] ?? [50, 66];
            const pos = { left: `${x}%`, top: `${y}%` };
            if (!egg) {
              return (
                <button
                  key={`ghost${i}`}
                  className={`portal-egg ghost${focus === i ? ' focus' : ''}`}
                  style={pos}
                  onClick={toBag}
                  onMouseEnter={() => setFocus(i)}
                  onMouseLeave={() => setFocus(null)}
                  title="Loc liber: pune un ou"
                >
                  ＋
                </button>
              );
            }
            const inc = egg.incubation!;
            const total = inc.endsAt - inc.startedAt;
            const left = inc.endsAt - now;
            const ready = left <= 0;
            const nearly = !ready && left < total * 0.15;
            const pct = Math.min(100, Math.floor(((now - inc.startedAt) / total) * 100));
            return (
              <button
                key={egg.id}
                className={`portal-egg r-${egg.rarity} t-${inc.temperature}${ready ? ' ready' : ''}${focus === i ? ' focus' : ''}`}
                style={{ ...pos, ['--p' as string]: `${pct}%` }}
                onClick={() => ready && setHatching(egg)}
                onMouseEnter={() => setFocus(i)}
                onMouseLeave={() => setFocus(null)}
                aria-label={ready ? 'Eclozează oul' : `Ou la incubat, ${pct}%`}
              >
                {ready && <span className="light-beam" />}
                {ready && <Sparkles count={10} />}
                <EggSprite egg={egg} size={62} cracks={ready ? 2 : nearly ? 1 : 0} className={ready ? 'wobble-fast' : nearly ? 'wobble' : 'breathe'} />
              </button>
            );
          })}
          <span className="portal-caption">Camera de incubație</span>
        </div>

        {/* Locurile din cuib, cu tot ce poți face */}
        <div className="nest-side">
          <header className="nest-side-head">
            <h2>Cuibul</h2>
            <span className="nest-count">
              {nest.length}/{slots} ouă{readyNow ? ` · ${readyNow} gata!` : ''}
            </span>
          </header>
          <ol className="nest-slots">
            {Array.from({ length: slots }, (_, i) => {
              const egg = nest[i];
              const hover = { onMouseEnter: () => setFocus(i), onMouseLeave: () => setFocus(null) };
              if (!egg) {
                return (
                  <li key={`free${i}`} className={`nest-slot-row free${focus === i ? ' focus' : ''}`} {...hover}>
                    <span className="slot-no">{i + 1}</span>
                    <div className="slot-main">
                      <b>Loc liber</b>
                      <small className="muted">{bag.length ? 'Alege un ou din rucsac și lumina lui.' : 'Ouăle vin din Săpături și Expediții.'}</small>
                    </div>
                    {bag.length > 0 && (
                      <button className="btn small" onClick={toBag}>
                        ＋ Pune un ou
                      </button>
                    )}
                  </li>
                );
              }
              const inc = egg.incubation!;
              const total = inc.endsAt - inc.startedAt;
              const left = inc.endsAt - now;
              const ready = left <= 0;
              const turnable = canTurn(egg, now);
              const temp = TEMPERATURES[inc.temperature];
              const turnLeft = inc.lastTurnedAt ? inc.lastTurnedAt + TURN_COOLDOWN_SECONDS * 1000 - now : 0;
              const pct = Math.min(100, Math.floor(((now - inc.startedAt) / total) * 100));
              const species = SPECIES[egg.speciesId];
              return (
                <li key={egg.id} className={`nest-slot-row r-${egg.rarity} t-${inc.temperature}${ready ? ' ready' : ''}${focus === i ? ' focus' : ''}`} {...hover}>
                  <span className="slot-no">{i + 1}</span>
                  <div className="slot-main">
                    <div className="slot-line">
                      <span className={`rarity-tag r-${egg.rarity}`}>{RARITIES[egg.rarity].name}</span>
                      <span className="slot-temp" title={`${temp.name} → pui ${TEMPERAMENTS[temp.temperament].name.toLowerCase()}`}>
                        {temp.icon} {TEMPERAMENTS[temp.temperament].name}
                      </span>
                      {state.atlas[species.id]?.owned && <small className="muted">seamănă cu {species.name}</small>}
                    </div>
                    {ready ? (
                      <b className="slot-ready">Gata de eclozare!</b>
                    ) : (
                      <>
                        <div className="slot-time-row">
                          <b>⏳ {formatDuration(left)}</b>
                          <small>{pct}%</small>
                        </div>
                        <div className="slot-bar">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    )}
                    {egg.candled && <CandleNote egg={egg} />}
                  </div>
                  <div className="slot-btns">
                    {ready ? (
                      <button className="btn primary glow" onClick={() => setHatching(egg)}>
                        🐣 Eclozează
                      </button>
                    ) : (
                      <>
                        <button
                          className="egg-tool"
                          disabled={!turnable}
                          onClick={() => game.dispatch({ type: 'turnEgg', eggId: egg.id })}
                          title={turnable ? 'Rotește oul: −5% din timp' : `Din nou în ${formatDuration(turnLeft)}`}
                        >
                          🔄
                        </button>
                        <button
                          className="egg-tool"
                          disabled={egg.candled}
                          onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })}
                          title={egg.candled ? 'Deja privit prin lumină' : 'Privește oul prin lumină'}
                        >
                          🕯️
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="nest-tip">
            🔄 Rotește oul o dată la {TURN_COOLDOWN_SECONDS / 60} min ca să eclozeze mai repede · 🕯️ lumânarea arată ce pui e în el
          </p>
        </div>
      </section>

      <EggShelf game={game} bag={bag} nestFull={nest.length >= slots} />

      {hatching && <HatchModal game={game} egg={hatching} onClose={() => setHatching(null)} />}
    </div>
  );
}

/** Unde stau ouăle pe cuibul din imagine (procente), după numărul de locuri. */
const EGG_SPOTS: Record<number, [number, number][]> = {
  1: [[50, 70]],
  2: [
    [36, 70],
    [64, 70],
  ],
  3: [
    [25, 72],
    [50, 68],
    [75, 72],
  ],
  4: [
    [20, 73],
    [40, 68],
    [60, 68],
    [80, 73],
  ],
};

/** Ouă care arată la fel (raritate + culoarea petelor) se adună într-un teanc. Cele lumânate sau din împerechere rămân separate. */
function stackKey(egg: Egg): string {
  if (egg.candled || egg.lineage || egg.tutorial) return egg.id;
  return `${egg.rarity}:${SPECIES[egg.speciesId].types[0]}`;
}

const RARITY_ORDER = Object.keys(RARITIES) as Egg['rarity'][];

function EggShelf({ game, bag, nestFull }: { game: Game; bag: Egg[]; nestFull: boolean }) {
  const state = game.state!;
  const [picked, setPicked] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const stacks = new Map<string, Egg[]>();
  for (const egg of bag) stacks.set(stackKey(egg), [...(stacks.get(stackKey(egg)) ?? []), egg]);
  const sorted = [...stacks.entries()].sort(([, x], [, y]) => RARITY_ORDER.indexOf(y[0].rarity) - RARITY_ORDER.indexOf(x[0].rarity));
  const sellable = bag.filter((e) => !e.tutorial);
  const total = sellable.reduce((sum, e) => sum + eggPrice(e), 0);
  const chosen = sorted.find(([k]) => k === picked);

  return (
    <section className="egg-shelf" id="egg-shelf">
      <header className="egg-shelf-head">
        <div>
          <h3>🎒 Ouăle din rucsac</h3>
          <small className="muted">{bag.length ? 'Alege un ou ca să-l pui în cuib, să-l privești prin lumină sau să-l vinzi.' : 'Niciun ou deocamdată. Le găsești la Săpături și în Expediții.'}</small>
        </div>
        {sellable.length > 1 &&
          (confirm === 'all' ? (
            <button className="btn small danger" onClick={() => (game.dispatch({ type: 'sellEggs', eggIds: sellable.map((e) => e.id) }), setConfirm(null))}>
              Sigur? Vinde toate ({total} ✨)
            </button>
          ) : (
            <button className="btn small" onClick={() => setConfirm('all')}>
              ✨ Vinde toate
            </button>
          ))}
      </header>

      {bag.length > 0 && (
        <div className="shelf-row">
          {sorted.map(([key, eggs]) => {
            const egg = eggs[0];
            return (
              <button key={key} className={`shelf-egg r-${egg.rarity}${picked === key ? ' picked' : ''}`} onClick={() => setPicked(picked === key ? null : key)}>
                {eggs.length > 1 && <span className="shelf-count">×{eggs.length}</span>}
                <EggSprite egg={egg} size={70} className="breathe" />
                <b className={`r-text r-${egg.rarity}`}>{RARITIES[egg.rarity].name}</b>
                <small>{formatSeconds(incubationSeconds(state, egg))}</small>
              </button>
            );
          })}
        </div>
      )}

      {chosen &&
        (() => {
          const [key, eggs] = chosen;
          const egg = eggs[0];
          const n = eggs.length;
          const ids = eggs.map((e) => e.id);
          return (
            <div className="egg-panel">
              <div className="egg-panel-info">
                <EggSprite egg={egg} size={84} className="breathe" />
                <div>
                  <b className={`r-text r-${egg.rarity}`}>
                    Ou {RARITIES[egg.rarity].name.toLowerCase()}
                    {n > 1 && <span className="muted"> ×{n}</span>}
                  </b>
                  <small className="muted">Incubare: {formatSeconds(incubationSeconds(state, egg))}</small>
                  {egg.lineage && (
                    <small className="lineage">
                      💞 Gen. {egg.lineage.generation} · {egg.lineage.parents[0]} × {egg.lineage.parents[1]}
                    </small>
                  )}
                  {egg.candled && <CandleNote egg={egg} />}
                </div>
              </div>

              <div className="egg-panel-place">
                <h4>{nestFull ? '🪺 Cuibul e plin' : 'Pune-l în cuib, sub lumina:'}</h4>
                <div className="light-pick">
                  {(Object.keys(TEMPERATURES) as Temperature[]).map((t) => {
                    const temp = TEMPERATURES[t];
                    const kind = TEMPERAMENTS[temp.temperament];
                    return (
                      <button
                        key={t}
                        className={`light-btn t-${t}`}
                        disabled={nestFull}
                        onClick={() => {
                          game.dispatch({ type: 'placeEgg', eggId: egg.id, temperature: t });
                          if (n <= 1) setPicked(null);
                        }}
                      >
                        <span>{temp.icon}</span>
                        <b>{temp.name}</b>
                        <small>
                          pui <b>{kind.name.toLowerCase()}</b> · {kind.text}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="egg-panel-more">
                {!egg.candled && (
                  <button className="btn small" onClick={() => game.dispatch({ type: 'candleEgg', eggId: egg.id })}>
                    🕯️ Privește prin lumină
                  </button>
                )}
                {!egg.tutorial && (
                  <>
                    <button className="btn small" onClick={() => game.dispatch({ type: 'sellEggs', eggIds: [egg.id] })}>
                      ✨ Vinde 1 · {eggPrice(egg)}
                    </button>
                    {n > 1 && (
                      <button className="btn small" onClick={() => (game.dispatch({ type: 'sellEggs', eggIds: ids }), setPicked(null))}>
                        ✨ Vinde ×{n} · {eggs.reduce((sum, e) => sum + eggPrice(e), 0)}
                      </button>
                    )}
                    {confirm === key ? (
                      <button className="btn small danger" onClick={() => (game.dispatch({ type: 'discardEggs', eggIds: ids }), setConfirm(null), setPicked(null))}>
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
        })()}
    </section>
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
