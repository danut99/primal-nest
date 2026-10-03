// Haita: toți dinozaurii, haita de luptă, hrănire, statistici și evoluție.

import { useState } from 'react';
import {
  type Diet,
  type Dino,
  type ItemId,
  BREED_MAX,
  BRANCH_INFO,
  DIET_INFO,
  ITEMS,
  MAX_RELIC_LEVEL,
  RELICS,
  RUNAWAY_HOURS,
  RELIC_UPGRADES,
  SPECIES,
  STAT_NAMES,
  TEMPERAMENTS,
  adultTarget,
  canEvolve,
  computeStats,
  RARITIES,
  TROUGH_CAPACITY,
  TROUGH_HOURS,
  releaseReward,
  troughTotal,
  hoursSinceMeal,
  returnCost,
  runawayIn,
  findJob,
  hasItems,
  relicBonus,
  relicLevel,
  currentFullness,
  evolutionRequirement,
  evolutionTarget,
  geneStars,
  levelXp,
  partySize,
  type Stats,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { DinoTurntable } from '../components/DinoTurntable';
import { Bar, Hearts, Panel, Stars, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration } from '../utils/format';
import { EvolveModal } from './EvolveModal';

export function PackScreen({ game, selected, onSelect }: { game: Game; selected: string | null; onSelect: (id: string | null) => void }) {
  const state = game.state!;
  const now = game.now();
  const dino = state.dinos.find((d) => d.id === selected) ?? state.dinos[0];
  const [sort, setSort] = useState<Sort>('level');
  const [filter, setFilter] = useState<Filter>('all');

  if (state.dinos.length === 0) {
    return (
      <div className="screen">
        <Panel title="Haita" icon="🦖">
          <p className="empty-state">
            {state.wild.length ? 'Toată haita a fugit în sălbăticie. Adu-i înapoi mai jos.' : 'Încă n-ai niciun dinozaur. Primul ou din cuib e aproape gata! 🥚'}
          </p>
        </Panel>
        <WildPanel game={game} />
      </div>
    );
  }

  const size = partySize(state);
  const shown = sortDinos(
    state.dinos.filter((d) => matchesFilter(d, filter, state, now)),
    sort,
    now,
  );
  const togglePartyMember = (id: string) => {
    const inParty = state.party.includes(id);
    game.dispatch({ type: 'setParty', ids: inParty ? state.party.filter((x) => x !== id) : [...state.party, id] });
  };

  return (
    <div className="screen pack-layout">
      <div className="pack-side">
        <Panel title="Haita" icon="🦖" right={<span className="muted">În luptă: {state.party.length}/{size}</span>} className="pack-list">
          <div className="pack-tools">
            <button className="btn small primary" onClick={() => game.dispatch({ type: 'feedAll' })} title="Fiecare primește mâncarea lui preferată din rucsac">
              🍖 Hrănește toată haita
            </button>
            <select className="pack-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortează">
              <option value="level">Nivel</option>
              <option value="stars">Gene ⭐</option>
              <option value="rarity">Raritate</option>
              <option value="bond">Atașament</option>
              <option value="hunger">Cei mai flămânzi</option>
              <option value="name">Nume</option>
            </select>
          </div>
          <div className="pack-filters">
            {FILTERS.map(([id, label]) => (
              <button key={id} className={`chip-btn${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          {shown.length === 0 && <p className="muted small">Niciun dinozaur aici.</p>}
          <div className="dino-grid">
            {shown.map((d) => {
              const s = SPECIES[d.speciesId];
              const inParty = state.party.includes(d.id);
              const ready = d.molt && now >= d.molt.endsAt;
              return (
                <button
                key={d.id}
                className={`dino-card${d.id === dino.id ? ' selected' : ''}${d.variant === 'albino' ? ' albino' : ''}${d.rarity ? ` r-${d.rarity}` : ''}`}
                onClick={() => onSelect(d.id)}
              >
                  {inParty && <span className="party-pin" title="În haita de luptă">⚔️</span>}
                  {state.workers.some((w) => w.dinoId === d.id) && (
                    <span className="party-pin" title="La muncă">
                      {findJob(state.workers.find((w) => w.dinoId === d.id)!.jobId).icon}
                    </span>
                  )}
                  {d.molt && <span className="molt-pin">{ready ? '✨' : '🌀'}</span>}
                  {runawayIn(d, now) !== null && (
                    <span className="hunger-pin" title={`Flămând! Fuge în ${Math.ceil(runawayIn(d, now)!)} h dacă nu-l hrănești`}>
                      😟
                    </span>
                  )}
                  <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={72} className={d.molt ? 'molting' : ''} />
                  <b>{d.nickname}</b>
                  <small>
                    Nv. {d.level} · {s.name}
                  </small>
                  <Hearts bond={d.bond} />
                </button>
              );
            })}
          </div>
        </Panel>
        <TroughPanel game={game} />
        <WildPanel game={game} />
      </div>
      <DinoDetail key={dino.id} game={game} dino={dino} inParty={state.party.includes(dino.id)} onToggleParty={() => togglePartyMember(dino.id)} />
    </div>
  );
}

function DinoDetail({ game, dino, inParty, onToggleParty }: { game: Game; dino: Dino; inParty: boolean; onToggleParty: () => void }) {
  const state = game.state!;
  const now = game.now();
  const s = SPECIES[dino.speciesId];
  const stats = computeStats(dino, relicLevel(state, dino.relic));
  const work = state.workers.find((w) => w.dinoId === dino.id);
  const [releasing, setReleasing] = useState(false);
  const job = work ? findJob(work.jobId) : undefined;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(dino.nickname);
  const [evolving, setEvolving] = useState<{ from: string; to: string } | null>(null);
  const [fed, setFed] = useState(0);
  const fullness = currentFullness(dino, now);
  const foods = (Object.keys(ITEMS) as ItemId[]).filter((id) => ITEMS[id].food && (state.inventory[id] ?? 0) > 0);
  const xpFrom = levelXp(dino.level);
  const xpTo = levelXp(dino.level + 1);
  const t = TEMPERAMENTS[dino.temperament];

  const feed = (itemId: ItemId) => {
    if (game.dispatch({ type: 'feed', dinoId: dino.id, itemId })) setFed((n) => n + 1);
  };

  const finishMolt = () => {
    const from = dino.speciesId;
    const res = game.dispatch({ type: 'finishEvolve', dinoId: dino.id }, { quiet: true });
    if (res) setEvolving({ from, to: res.state.dinos.find((d) => d.id === dino.id)!.speciesId });
  };

  return (
    <Panel className="dino-detail">
      <div className="detail-top">
        <div className={`detail-art type-bg-${s.types[0]}`}>
          <DinoTurntable key={fed} speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={180} className={dino.molt ? 'molting' : fed ? 'happy-hop' : ''} />
          {fed > 0 && (
            <span key={`h${fed}`} className="float-heart">
              ❤️
            </span>
          )}
        </div>
        <div className="detail-head">
          {renaming ? (
            <form
              className="name-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (game.dispatch({ type: 'rename', dinoId: dino.id, nickname: name }, { quiet: true })) setRenaming(false);
              }}
            >
              <input autoFocus value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label="Nume nou" />
              <button className="btn small primary">OK</button>
            </form>
          ) : (
            <h2>
              {dino.nickname}{' '}
              <button className="icon-btn" onClick={() => setRenaming(true)} aria-label="Redenumește">
                ✏️
              </button>
            </h2>
          )}
          <div className="row gap-s wrap">
            <span className="chip">{s.name}</span>
            <span className="chip">{s.stage === 'pui' ? 'Pui' : s.stage === 'juvenil' ? 'Juvenil' : `Adult · ${BRANCH_INFO[s.branch!].name}`}</span>
            {s.types.map((ty) => (
              <TypeBadge key={ty} type={ty} small />
            ))}
            {dino.variant === 'albino' && <span className="chip albino-chip">🤍 Albino</span>}
            {dino.rarity && <span className={`rarity-tag r-${dino.rarity}`}>Ou {RARITIES[dino.rarity].name.toLowerCase()}</span>}
          </div>
          <div className="level-row">
            <b>Nivel {dino.level}</b>
            <Bar value={dino.xp - xpFrom} max={xpTo - xpFrom} color="#5bb4f0" label={`${dino.xp - xpFrom}/${xpTo - xpFrom} XP`} />
          </div>
          <div className="level-row">
            <span>Atașament</span>
            <Bar value={dino.bond} max={100} color="#ff7a9a" label={`${dino.bond}/100`} />
          </div>
          {runawayIn(dino, now) !== null && (
            <p className="hunger-warn">
              😟 N-a mâncat de {Math.floor(hoursSinceMeal(dino, now))} h. Fuge în sălbăticie în <b>{Math.ceil(runawayIn(dino, now)!)} h</b> dacă nu-l
              hrănești!
            </p>
          )}
          <div className="level-row">
            <span>Burtică</span>
            <Bar value={fullness} max={100} color="#f5b942" label={fullness >= 100 ? 'Sătul!' : `${Math.round(fullness)}%`} />
          </div>
          {job ? (
            <button className="btn" disabled title="Cheamă-l acasă din Activități → Haita la muncă">
              {job.icon} La muncă: {job.name}
            </button>
          ) : (
            <button className={`btn ${inParty ? '' : 'primary'}`} onClick={onToggleParty} disabled={!!dino.molt}>
              {inParty ? '✓ În haita de luptă' : '⚔️ Pune în haită'}
            </button>
          )}
        </div>
      </div>

      <div className="detail-cols">
        <div>
          <h3>Hrănește</h3>
          <p className="muted small">
            Îi place: {DIET_INFO[s.diet].icon} <b>{DIET_INFO[s.diet].name}</b> (dublu atașament)
          </p>
          <p className="feed-rule small">
            🍽️ Hrănește-l <b>măcar o dată la {RUNAWAY_HOURS / 24} zile</b>, altfel fuge în sălbăticie. Ultima masă:{' '}
            <b>{formatAgo(hoursSinceMeal(dino, now))}</b>.
          </p>
          {foods.length === 0 ? (
            <p className="empty-state small">N-ai mâncare. Culege ferigi sau adu carne din expediții.</p>
          ) : (
            <div className="food-row">
              {foods.map((id) => {
                const food = ITEMS[id].food!;
                const loves = food.diet === s.diet;
                return (
                  <button key={id} className={`food-btn${loves ? ' loves' : ''}`} onClick={() => feed(id)} disabled={fullness >= 100 || !!dino.molt} title={`${ITEMS[id].name}: +${food.xp} XP`}>
                    <span className="food-icon">{ITEMS[id].icon}</span>
                    <small>×{state.inventory[id]}</small>
                    {loves && <span className="love-tag">❤️</span>}
                  </button>
                );
              })}
            </div>
          )}
          <DietMeter dino={dino} />
        </div>

        <div>
          <h3>Statistici</h3>
          <p className="muted small">
            Temperament <b>{t.name}</b>: {t.text}
          </p>
          {(dino.lineage || !!dino.breeds) && (
            <p className="lineage small">
              💞 Generația {dino.lineage?.generation ?? 1}
              {dino.lineage && ` · părinți: ${dino.lineage.parents[0]} × ${dino.lineage.parents[1]}`}
              {` · împerecheri ${dino.breeds ?? 0}/${BREED_MAX}`}
            </p>
          )}
          <StatsTable stats={stats} genes={dino.genes} up={t.up} down={t.down} />
          <div className="row gap-s">
            <span className="muted small">Gene:</span> <Stars n={geneStars(dino.genes)} />
          </div>
          <p className="muted small">
            ⚔️ {s.basic.name} · ✨ {s.special.name} ({s.special.type ? <TypeBadge type={s.special.type} small /> : null})
          </p>
        </div>
      </div>

      <RelicBox game={game} dino={dino} />
      <EvolutionBox game={game} dino={dino} onFinish={finishMolt} />
      <div className="release-row">
        {releasing ? (
          <>
            <span className="small">
              Sigur îl eliberezi pe <b>{dino.nickname}</b>? Primești <b>+{releaseReward(dino)} ✨</b>, dar nu se mai întoarce.
            </span>
            <button className="btn small danger" onClick={() => game.dispatch({ type: 'release', dinoId: dino.id }) && setReleasing(false)}>
              Da, eliberează-l
            </button>
            <button className="btn small ghost" onClick={() => setReleasing(false)}>
              Nu
            </button>
          </>
        ) : (
          <button className="btn tiny ghost" onClick={() => setReleasing(true)} title="Îl lași liber în junglă, în schimbul unor scântei">
            🌿 Eliberează (+{releaseReward(dino)} ✨)
          </button>
        )}
      </div>
      {evolving && <EvolveModal from={evolving.from} to={evolving.to} albino={dino.variant === 'albino'} onClose={() => setEvolving(null)} />}
    </Panel>
  );
}

function StatsTable({ stats, genes, up, down }: { stats: Stats; genes: Stats; up: keyof Stats; down: keyof Stats }) {
  const max = 220;
  return (
    <div className="stats-table">
      {(Object.keys(stats) as (keyof Stats)[]).map((k) => (
        <div key={k} className="stat-row">
          <span className={k === up ? 'stat-up' : k === down ? 'stat-down' : ''}>
            {STAT_NAMES[k]}
            {k === up ? ' ▲' : k === down ? ' ▼' : ''}
          </span>
          <Bar value={stats[k]} max={max} thin color={k === 'hp' ? '#6cc36a' : k === 'atk' ? '#ef7b4f' : k === 'def' ? '#7d9fd6' : '#f2c84b'} />
          <b>{stats[k]}</b>
          <small className="gene" title="Genă (0–15)">
            {genes[k] >= 13 ? '★' : genes[k] >= 8 ? '☆' : '·'}
          </small>
        </div>
      ))}
    </div>
  );
}

function DietMeter({ dino }: { dino: Dino }) {
  const s = SPECIES[dino.speciesId];
  const counts: Record<Diet, number> = { plante: 0, carne: 0, insecte: 0 };
  for (const d of dino.diets) counts[d]++;
  const total = dino.diets.length || 1;
  const target = s.stage === 'juvenil' ? adultTarget(dino) : null;
  return (
    <div className="diet-meter">
      <small className="muted">Ultimele {dino.diets.length}/20 mese</small>
      <div className="diet-bar">
        {(Object.keys(counts) as Diet[]).map((d) =>
          counts[d] ? (
            <span key={d} className={`diet-seg d-${d}`} style={{ flex: counts[d] / total }} title={`${DIET_INFO[d].name}: ${counts[d]}`}>
              {DIET_INFO[d].icon}
            </span>
          ) : null,
        )}
        {dino.diets.length === 0 && <span className="diet-seg empty">—</span>}
      </div>
      {s.stage === 'juvenil' && s.branches && (
        <div className="branch-preview">
          {(Object.keys(s.branches) as (keyof typeof BRANCH_INFO)[]).map((b) => (
            <div key={b} className={`branch${target?.speciesId === s.branches![b] ? ' active' : ''}`}>
              <DinoSprite speciesId={s.branches![b]!} size={56} silhouette={target?.speciesId !== s.branches![b]} />
              <small>
                {DIET_INFO[BRANCH_INFO[b].diet].icon} {BRANCH_INFO[b].name}
              </small>
            </div>
          ))}
          <small className="muted">Dieta dominantă decide în ce evoluează!</small>
        </div>
      )}
    </div>
  );
}

function EvolutionBox({ game, dino, onFinish }: { game: Game; dino: Dino; onFinish: () => void }) {
  const state = game.state!;
  const now = game.now();
  const req = evolutionRequirement(dino);
  if (!req) return <p className="evo-box done">🏆 Formă finală. Felicitări, Paznicule!</p>;

  if (dino.molt) {
    const left = dino.molt.endsAt - now;
    const total = dino.molt.endsAt - dino.molt.startedAt;
    return (
      <div className="evo-box molting-box">
        <h3>🌀 Năpârlește…</h3>
        {left > 0 ? (
          <Bar value={total - left} max={total} color="#b48cf2" label={formatDuration(left)} />
        ) : (
          <button className="btn primary glow" onClick={onFinish}>
            ✨ Vezi evoluția!
          </button>
        )}
      </div>
    );
  }

  const target = evolutionTarget(dino)!;
  const check = canEvolve(state, dino);
  return (
    <div className="evo-box">
      <div className="evo-preview">
        <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={64} />
        <span className="arrow">➜</span>
        <DinoSprite speciesId={target} size={64} silhouette={!state.atlas[target]?.owned} />
      </div>
      <div className="evo-reqs">
        <h3>Evoluție: {SPECIES[dino.speciesId].stage === 'pui' ? 'Juvenil' : 'Adult'}</h3>
        <ul>
          <li className={dino.level >= req.level ? 'ok' : ''}>Nivel {req.level}</li>
          <li className={dino.bond >= req.bond ? 'ok' : ''}>Atașament {req.bond}</li>
          {req.item && <li className={(state.inventory[req.item] ?? 0) > 0 ? 'ok' : ''}>1 {ITEMS[req.item].name}</li>}
          <li className="muted">Năpârlire: {formatDuration(req.seconds * 1000)}</li>
        </ul>
        <button className="btn primary" disabled={!check.ok} onClick={() => game.dispatch({ type: 'evolve', dinoId: dino.id })}>
          🌀 Începe năpârlirea
        </button>
      </div>
    </div>
  );
}

function RelicBox({ game, dino }: { game: Game; dino: Dino }) {
  const state = game.state!;
  return (
    <div className="relic-box">
      <h3>Relicve</h3>
      <div className="relic-grid">
        {Object.keys(RELICS).map((id) => {
          const r = RELICS[id];
          if (!state.relics.includes(id)) {
            return (
              <div key={id} className="relic-card locked" title="Învinge un Alfa ca s-o câștigi.">
                <span className="relic-icon">❔</span>
                <b>Necunoscută</b>
                <small className="muted">Învinge un Alfa</small>
              </div>
            );
          }
          const worn = dino.relic === id;
          const owner = state.dinos.find((d) => d.relic === id && d.id !== dino.id);
          const level = relicLevel(state, id);
          const next = level < MAX_RELIC_LEVEL ? RELIC_UPGRADES[level] : undefined;
          const affordable = !!next && state.sparks >= next.sparks && hasItems(state, next.cost);
          const bonus = (Object.keys(r.bonus) as (keyof Stats)[])
            .map((k) => `+${Math.round(relicBonus(r, k, level) * 100)}% ${STAT_NAMES[k]}`)
            .join(', ');
          return (
            <div key={id} className={`relic-card${worn ? ' worn' : ''}`} style={{ ['--relic' as string]: r.color }} title={r.blurb}>
              <span className="relic-icon">{r.icon}</span>
              <b>{r.name}</b>
              <span className="relic-pips" aria-label={`Nivel ${level} din ${MAX_RELIC_LEVEL}`}>
                {Array.from({ length: MAX_RELIC_LEVEL }, (_, i) => (
                  <i key={i} className={i < level ? 'on' : ''} />
                ))}
              </span>
              <small>{bonus}</small>
              <small className="muted">{worn ? 'Purtată' : owner ? `O poartă ${owner.nickname}` : 'Liberă'}</small>
              <div className="relic-actions">
                <button className={`btn small${worn ? '' : ' primary'}`} onClick={() => game.dispatch({ type: 'equip', dinoId: dino.id, relicId: worn ? null : id })}>
                  {worn ? 'Scoate' : 'Echipează'}
                </button>
                {next ? (
                  <button className="btn small" disabled={!affordable} onClick={() => game.dispatch({ type: 'upgradeRelic', relicId: id })}>
                    ⬆️ Întărește
                  </button>
                ) : (
                  <span className="chip">MAX</span>
                )}
              </div>
              {next && (
                <small className={`relic-cost${affordable ? '' : ' muted'}`}>
                  ✨ {next.sparks}
                  {Object.entries(next.cost).map(([item, qty]) => (
                    <span key={item} className={(state.inventory[item as ItemId] ?? 0) >= qty! ? '' : 'missing'}>
                      {' '}
                      · {ITEMS[item as ItemId].icon} {state.inventory[item as ItemId] ?? 0}/{qty}
                    </span>
                  ))}
                </small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WildPanel({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  if (state.wild.length === 0) return null;
  return (
    <Panel title="În sălbăticie" icon="🌲" className="wild-panel" right={<span className="diamonds">💎 {state.diamonds}</span>}>
      <p className="muted small">Au fugit pentru că n-au primit de mâncare {RUNAWAY_HOURS / 24} zile. Se întorc cu tot ce știau, dar flămânzi și mai puțin atașați.</p>
      <div className="wild-list">
        {state.wild.map(({ dino, leftAt }) => {
          const cost = returnCost(dino);
          const days = Math.max(0, Math.floor((now - leftAt) / (24 * 3600 * 1000)));
          return (
            <div key={dino.id} className="wild-card">
              <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={56} silhouette />
              <div className="grow">
                <b>{dino.nickname}</b>
                <small className="muted">
                  Nv. {dino.level} · {SPECIES[dino.speciesId].name} · {days === 0 ? 'a fugit azi' : `de ${days} ${days === 1 ? 'zi' : 'zile'}`}
                </small>
              </div>
              <button className="btn small primary" disabled={state.diamonds < cost} onClick={() => game.dispatch({ type: 'bringBack', dinoId: dino.id })}>
                Adu-l înapoi · 💎 {cost}
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatAgo(hours: number): string {
  if (hours < 1) return 'acum câteva minute';
  if (hours < 24) return `acum ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return `acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

type Sort = 'level' | 'stars' | 'rarity' | 'bond' | 'hunger' | 'name';
type Filter = 'all' | 'party' | 'hungry' | 'adults' | 'free';

const FILTERS: [Filter, string][] = [
  ['all', 'Toți'],
  ['party', '⚔️ În luptă'],
  ['hungry', '😟 Flămânzi'],
  ['adults', 'Juvenili și adulți'],
  ['free', 'Liberi'],
];

const RARITY_RANK = Object.keys(RARITIES);

function matchesFilter(d: Dino, filter: Filter, state: NonNullable<Game['state']>, now: number): boolean {
  if (filter === 'party') return state.party.includes(d.id);
  if (filter === 'hungry') return hoursSinceMeal(d, now) >= TROUGH_HOURS;
  if (filter === 'adults') return SPECIES[d.speciesId].stage !== 'pui';
  if (filter === 'free') return !d.molt && !state.workers.some((w) => w.dinoId === d.id) && state.breeding?.a !== d.id && state.breeding?.b !== d.id;
  return true;
}

function sortDinos(list: Dino[], sort: Sort, now: number): Dino[] {
  const by: Record<Sort, (a: Dino, b: Dino) => number> = {
    level: (a, b) => b.level - a.level,
    stars: (a, b) => geneStars(b.genes) - geneStars(a.genes) || b.level - a.level,
    rarity: (a, b) => RARITY_RANK.indexOf(b.rarity ?? 'comun') - RARITY_RANK.indexOf(a.rarity ?? 'comun'),
    bond: (a, b) => b.bond - a.bond,
    hunger: (a, b) => hoursSinceMeal(b, now) - hoursSinceMeal(a, now),
    name: (a, b) => a.nickname.localeCompare(b.nickname, 'ro'),
  };
  return [...list].sort(by[sort]);
}

function TroughPanel({ game }: { game: Game }) {
  const state = game.state!;
  const total = troughTotal(state);
  const foods = (Object.keys(ITEMS) as ItemId[]).filter((id) => ITEMS[id].food && (state.inventory[id] ?? 0) > 0);
  const stored = (Object.keys(state.trough) as ItemId[]).filter((id) => (state.trough[id] ?? 0) > 0);
  return (
    <Panel title="Troaca" icon="🥣" className="trough-panel" right={<span className="muted small">{total}/{TROUGH_CAPACITY}</span>}>
      <p className="muted small">
        Cine n-a mâncat de {TROUGH_HOURS} h mănâncă singur de aici, chiar și cât lipsești. Fiecare își alege mâncarea preferată.
      </p>
      <Bar value={total} max={TROUGH_CAPACITY} color="#f5b942" thin />
      {stored.length > 0 && (
        <div className="trough-row">
          {stored.map((id) => (
            <button key={id} className="trough-item" onClick={() => game.dispatch({ type: 'troughWithdraw', itemId: id })} title="Scoate înapoi în rucsac">
              {ITEMS[id].icon} ×{state.trough[id]}
            </button>
          ))}
        </div>
      )}
      {foods.length === 0 ? (
        <p className="muted small">N-ai mâncare în rucsac de pus în troacă.</p>
      ) : (
        <div className="trough-add">
          <span className="muted small">Pune din rucsac:</span>
          {foods.map((id) => (
            <button
              key={id}
              className="btn tiny"
              disabled={total >= TROUGH_CAPACITY}
              onClick={() => game.dispatch({ type: 'troughDeposit', itemId: id, qty: state.inventory[id] ?? 0 })}
              title={`Pune toate (${state.inventory[id]})`}
            >
              {ITEMS[id].icon} +{state.inventory[id]}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
