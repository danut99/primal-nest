// Haita: toți dinozaurii, haita de luptă, hrănire, statistici și evoluție.

import { useState } from 'react';
import {
  type Diet,
  type Dino,
  type ItemId,
  BRANCH_INFO,
  DIET_INFO,
  ITEMS,
  RELICS,
  SPECIES,
  STAT_NAMES,
  TEMPERAMENTS,
  adultTarget,
  canEvolve,
  computeStats,
  currentFullness,
  evolutionRequirement,
  evolutionTarget,
  geneStars,
  levelXp,
  partySize,
  type Stats,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { Bar, Hearts, Panel, Stars, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration } from '../utils/format';
import { EvolveModal } from './EvolveModal';

export function PackScreen({ game, selected, onSelect }: { game: Game; selected: string | null; onSelect: (id: string | null) => void }) {
  const state = game.state!;
  const now = game.now();
  const dino = state.dinos.find((d) => d.id === selected) ?? state.dinos[0];

  if (state.dinos.length === 0) {
    return (
      <div className="screen">
        <Panel title="Haita" icon="🦖">
          <p className="empty-state">Încă n-ai niciun dinozaur. Primul ou din cuib e aproape gata! 🥚</p>
        </Panel>
      </div>
    );
  }

  const size = partySize(state);
  const togglePartyMember = (id: string) => {
    const inParty = state.party.includes(id);
    game.dispatch({ type: 'setParty', ids: inParty ? state.party.filter((x) => x !== id) : [...state.party, id] });
  };

  return (
    <div className="screen pack-layout">
      <Panel title="Haita" icon="🦖" right={<span className="muted">În luptă: {state.party.length}/{size}</span>} className="pack-list">
        <div className="dino-grid">
          {state.dinos.map((d) => {
            const s = SPECIES[d.speciesId];
            const inParty = state.party.includes(d.id);
            const ready = d.molt && now >= d.molt.endsAt;
            return (
              <button key={d.id} className={`dino-card${d.id === dino.id ? ' selected' : ''}${d.variant === 'albino' ? ' albino' : ''}`} onClick={() => onSelect(d.id)}>
                {inParty && <span className="party-pin" title="În haita de luptă">⚔️</span>}
                {d.molt && <span className="molt-pin">{ready ? '✨' : '🌀'}</span>}
                <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} relic={d.relic} size={72} className={d.molt ? 'molting' : ''} />
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
      <DinoDetail key={dino.id} game={game} dino={dino} inParty={state.party.includes(dino.id)} onToggleParty={() => togglePartyMember(dino.id)} />
    </div>
  );
}

function DinoDetail({ game, dino, inParty, onToggleParty }: { game: Game; dino: Dino; inParty: boolean; onToggleParty: () => void }) {
  const state = game.state!;
  const now = game.now();
  const s = SPECIES[dino.speciesId];
  const stats = computeStats(dino);
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
          <DinoSprite key={fed} speciesId={dino.speciesId} albino={dino.variant === 'albino'} relic={dino.relic} size={180} className={dino.molt ? 'molting' : fed ? 'happy-hop' : 'bob'} />
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
          </div>
          <div className="level-row">
            <b>Nivel {dino.level}</b>
            <Bar value={dino.xp - xpFrom} max={xpTo - xpFrom} color="#5bb4f0" label={`${dino.xp - xpFrom}/${xpTo - xpFrom} XP`} />
          </div>
          <div className="level-row">
            <span>Atașament</span>
            <Bar value={dino.bond} max={100} color="#ff7a9a" label={`${dino.bond}/100`} />
          </div>
          <div className="level-row">
            <span>Burtică</span>
            <Bar value={fullness} max={100} color="#f5b942" label={fullness >= 100 ? 'Sătul!' : `${Math.round(fullness)}%`} />
          </div>
          <button className={`btn ${inParty ? '' : 'primary'}`} onClick={onToggleParty} disabled={!!dino.molt}>
            {inParty ? '✓ În haita de luptă' : '⚔️ Pune în haită'}
          </button>
        </div>
      </div>

      <div className="detail-cols">
        <div>
          <h3>Hrănește</h3>
          <p className="muted small">
            Îi place: {DIET_INFO[s.diet].icon} <b>{DIET_INFO[s.diet].name}</b> (dublu atașament)
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
  if (state.relics.length === 0) {
    return <p className="relic-box empty">⚔️ Relicve: învinge un Alfa ca să câștigi o armă străveche.</p>;
  }
  return (
    <div className="relic-box">
      <h3>Relicvă</h3>
      <div className="relic-row">
        {state.relics.map((id) => {
          const r = RELICS[id];
          const worn = dino.relic === id;
          const owner = state.dinos.find((d) => d.relic === id && d.id !== dino.id);
          const bonus = Object.entries(r.bonus)
            .map(([k, v]) => `+${Math.round(v! * 100)}% ${STAT_NAMES[k as keyof Stats]}`)
            .join(', ');
          return (
            <button
              key={id}
              className={`relic-card${worn ? ' worn' : ''}`}
              style={{ ['--relic' as string]: r.color }}
              onClick={() => game.dispatch({ type: 'equip', dinoId: dino.id, relicId: worn ? null : id })}
              title={r.blurb}
            >
              <span className="relic-icon">{r.icon}</span>
              <b>{r.name}</b>
              <small>{bonus}</small>
              <small className="muted">{worn ? 'Purtată · atinge ca s-o scoți' : owner ? `O poartă ${owner.nickname}` : 'Echipează'}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
