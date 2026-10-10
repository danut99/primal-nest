import { useEffect, useState } from 'react';
import {
  ARENA_MATERIALS,
  ARENA_STEP_MS,
  MATERIALS,
  type MaterialId,
  ARENA_TRAINING_COST,
  ARENA_RECOVERY_MS,
  ELEMENTS,
  ELEMENT_IDS,
  dailyArena,
  arenaAbility,
  arenaStats,
  elementAdvantage,
  dinoUnavailable,
  isRecovering,
  nextExpeditionReset,
  speciesOf,
  stageForLevel,
  type Building,
  type Dino,
} from '@shared/game';
import type { Game } from '../hooks/useGame';
import { DinoThumb, ElementBadge, formatTime, Progress } from '../components/ui';
import '../styles/arena.css';

const tiers = { easy: 'Debutant', medium: 'Rival', hard: 'Campion' };
export function ArenaPanel({ game, building }: { game: Game; building: Building }) {
  const { state, now, run } = game,
    board = dailyArena(state, now),
    active = building.adventure,
    duel = active?.duel;
  const [challengeId, setChallenge] = useState(board.challenges.find((c) => !c.claimed)?.id ?? board.challenges[0].id);
  const [fighterId, setFighter] = useState(
    state.dinos.find((d) => !dinoUnavailable(state, d, now))?.id ?? state.dinos[0]?.id,
  );
  const [view, setView] = useState<'duel' | 'training'>('duel');
  const [visualNow, setVisualNow] = useState(now);
  useEffect(() => {
    setVisualNow(now);
    if (!duel || !active || now >= active.readyAt) return;
    const start = performance.now();
    const timer = setInterval(() => setVisualNow(now + performance.now() - start), 150);
    return () => clearInterval(timer);
  }, [now, duel, active]);
  const challenge = board.challenges.find((c) => c.id === (duel?.challengeId ?? challengeId)) ?? board.challenges[0];
  const fighter = duel?.fighter ?? state.dinos.find((d) => d.id === fighterId);
  const enemy: Dino = duel?.enemy ?? {
    id: 'enemy',
    species: challenge.species,
    level: challenge.level,
    habitatId: building.id,
  };
  const ready = !!active && now >= active.readyAt;
  const step = duel
    ? ready
      ? duel.frames.length
      : Math.min(duel.frames.length, Math.floor(Math.max(0, visualNow - duel.startedAt) / ARENA_STEP_MS))
    : 0;
  const frame = duel && step > 0 ? duel.frames[step - 1] : undefined;
  const maxPlayerHp = duel?.playerMaxHp ?? (fighter ? arenaStats(fighter).hp : 1);
  const maxEnemyHp = duel?.enemyMaxHp ?? arenaStats(enemy).hp;
  const playerHp = frame?.playerHp ?? maxPlayerHp,
    enemyHp = frame?.enemyHp ?? maxEnemyHp;
  const advantage = fighter ? elementAdvantage(fighter.species, enemy.species) : 1;
  const busy = !fighter || dinoUnavailable(state, fighter, now);
  const canStart = !!fighter && !busy && !active && !challenge.claimed && state.food >= challenge.cost;
  const rank = fighter?.arenaRank ?? 0,
    trainingCost = ARENA_TRAINING_COST[rank];
  const portrait = (d: Dino | undefined, side: 'player' | 'enemy', hp: number, maxHp: number) => (
    <section className={`duel-fighter ${side} ${frame?.actor === side && !ready ? 'attacking' : ''}`} key={side + step}>
      <span className="duel-fighter-tag">{side === 'player' ? 'Tu' : 'Adversar'}</span>
      <div className="duel-portrait">
        <span className="duel-pedestal" aria-hidden="true" />
        {d ? (
          <DinoThumb species={d.species} stage={stageForLevel(d.level)} tight />
        ) : (
          <span className="duel-empty">?</span>
        )}
      </div>
      <strong>{d ? (d.nickname ?? speciesOf(d.species).name) : 'Alege un luptător'}</strong>
      {d && (
        <span className="duel-fighter-meta">
          <b>Nv. {d.level}</b>
          {speciesOf(d.species).elements.map((e) => (
            <span key={e} title={ELEMENTS[e].name}>
              {ELEMENTS[e].icon}
            </span>
          ))}
        </span>
      )}
      <div
        className="duel-health"
        role="progressbar"
        aria-label={side === 'player' ? 'Viața luptătorului' : 'Viața adversarului'}
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
      >
        <i style={{ width: `${(100 * hp) / maxHp}%` }} />
        <small>
          {hp} / {maxHp}
        </small>
      </div>
      {d && (
        <small className="duel-ability" title={arenaAbility(d.species).description}>
          ✦ {arenaAbility(d.species).name}
        </small>
      )}
    </section>
  );
  const commentary = active
    ? ready
      ? duel?.won
        ? 'Victorie!'
        : 'Adversarul a câștigat.'
      : (frame?.text ?? 'Luptătorii intră în arenă…')
    : advantage > 1
      ? '▲ Avantaj de element · +25%'
      : advantage < 1
        ? '▼ Dezavantaj de element · −20%'
        : '= Elemente echilibrate';
  return (
    <div className="arena">
      <nav className="arena-top" aria-label="Arena">
        <div className="arena-tabs">
          <button className={view === 'duel' ? 'on' : ''} onClick={() => setView('duel')}>
            ⚔ Dueluri
          </button>
          <button className={view === 'training' ? 'on' : ''} onClick={() => setView('training')}>
            ✦ Abilitate
          </button>
        </div>
        <span className="arena-pill" title="Adversari noi">
          ⏱ {formatTime(nextExpeditionReset(now) - now)}
        </span>
        <span className="arena-pill medals" title="Medalii de arenă">
          🏅 {state.medals ?? 0}
        </span>
      </nav>
      {view === 'duel' ? (
        <div className="arena-grid">
          <div className="arena-left">
            <div className="duel-challenges">
              {board.challenges.map((c) => {
                const el = speciesOf(c.species).elements[0];
                return (
                  <button
                    key={c.id}
                    className={`${challenge.id === c.id ? 'selected' : ''} ${c.tier} ${c.claimed ? 'claimed' : ''}`}
                    style={{ '--el': ELEMENTS[el].color } as React.CSSProperties}
                    disabled={!!active}
                    aria-pressed={challenge.id === c.id}
                    onClick={() => setChallenge(c.id)}
                  >
                    <span className="duel-challenge-icon">{c.claimed ? '✓' : ELEMENTS[el].icon}</span>
                    <span className="duel-challenge-copy">
                      <strong>{tiers[c.tier]}</strong>
                      <small>Nv. {c.level}</small>
                    </span>
                    <b>🏅 {c.medals}</b>
                  </button>
                );
              })}
            </div>
            <div className={`duel-stage ${ready ? (duel?.won ? 'victory' : 'defeat') : ''}`}>
              {portrait(fighter, 'player', playerHp, maxPlayerHp)}
              <div className="duel-versus">
                <b>{ready ? (duel?.won ? '✓' : '✕') : 'VS'}</b>
              </div>
              {portrait(enemy, 'enemy', enemyHp, maxEnemyHp)}
              <div
                className={`duel-commentary ${!active && advantage > 1 ? 'good' : !active && advantage < 1 ? 'bad' : ''}`}
                aria-live="polite"
              >
                {commentary}
              </div>
            </div>
          </div>
          <aside className="arena-right">
            {active ? (
              <div className="duel-result">
                {!ready ? (
                  <>
                    <span className="duel-result-icon">⚔</span>
                    <strong>Duel în desfășurare</strong>
                    <Progress value={step / (duel?.frames.length ?? 1)} />
                    <button
                      className="arena-ghost"
                      onClick={() => run({ type: 'skipDuelAnimation', buildingId: building.id })}
                    >
                      Sari animația →
                    </button>
                  </>
                ) : (
                  <>
                    <span className="duel-result-icon">{duel?.won ? '🏆' : '💤'}</span>
                    <strong>{duel?.won ? 'Victorie!' : 'Înfrângere'}</strong>
                    {duel?.won && (
                      <span className="arena-rewards">
                        <span>🪙 {duel.gold}</span>
                        <span>🏅 {duel.medals}</span>
                      </span>
                    )}
                    <small>⏳ Odihnă {formatTime(ARENA_RECOVERY_MS[duel?.won ? 'win' : 'loss'])}</small>
                    <button
                      className="button arena-primary"
                      onClick={() => run({ type: 'claimAdventure', buildingId: building.id })}
                    >
                      {duel?.won ? 'Adună recompensa' : 'Înapoi'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <h3 className="arena-heading">Luptătorul</h3>
                <div className="duel-roster">
                  {state.dinos.map((d) => {
                    const s = speciesOf(d.species);
                    const unavailable = dinoUnavailable(state, d, now);
                    return (
                      <button
                        key={d.id}
                        className={`r-${s.rarity} ${fighterId === d.id ? 'selected' : ''}`}
                        style={{ '--el': ELEMENTS[s.elements[0]].color } as React.CSSProperties}
                        aria-pressed={fighterId === d.id}
                        disabled={unavailable}
                        title={
                          isRecovering(d, now)
                            ? `Odihnă ${formatTime(d.recoveryUntil! - now)}`
                            : unavailable
                              ? 'Ocupat'
                              : (d.nickname ?? s.name)
                        }
                        onClick={() => setFighter(d.id)}
                      >
                        <DinoThumb species={d.species} stage={stageForLevel(d.level)} tight />
                        <span className="duel-roster-level">{d.level}</span>
                        {unavailable && <span className="duel-roster-busy">⏳</span>}
                      </button>
                    );
                  })}
                </div>
                {fighter && (
                  <div className="duel-ability-summary" title={arenaAbility(fighter.species).description}>
                    <span>✦</span>
                    <strong>{arenaAbility(fighter.species).name}</strong>
                    <small>Rang {rank + 1}</small>
                  </div>
                )}
                <div className="duel-entry">
                  <span className="arena-rewards">
                    <span>🪙 {challenge.gold}</span>
                    <span>🏅 {challenge.medals}</span>
                    {Object.entries(ARENA_MATERIALS[challenge.tier]).map(([k, n]) => (
                      <span key={k} className="material" title={MATERIALS[k as MaterialId].name}>
                        {MATERIALS[k as MaterialId].icon} {n}
                      </span>
                    ))}
                  </span>
                  <button
                    className="button arena-primary"
                    disabled={!canStart}
                    onClick={() =>
                      fighter &&
                      run({
                        type: 'startDuel',
                        buildingId: building.id,
                        challengeId: challenge.id,
                        dinoId: fighter.id,
                        day: board.day,
                      })
                    }
                  >
                    <span>{challenge.claimed ? '✓ Învins azi' : '⚔ Luptă'}</span>
                    <span className="arena-cost">🍖 {challenge.cost}</span>
                  </button>
                  {!challenge.claimed && (busy || state.food < challenge.cost) && (
                    <small className="duel-hint">{busy ? 'Alege un luptător liber' : 'Hrană insuficientă'}</small>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      ) : (
        <section className="duel-training">
          {fighter ? (
            <div className="duel-training-card">
              <div className="duel-training-art">
                <span className="duel-pedestal" aria-hidden="true" />
                <DinoThumb species={fighter.species} stage={stageForLevel(fighter.level)} tight />
              </div>
              <div className="duel-training-copy">
                <select
                  className="arena-select"
                  aria-label="Luptător pentru antrenament"
                  value={fighterId ?? ''}
                  disabled={!!active}
                  onChange={(e) => setFighter(e.target.value)}
                >
                  {state.dinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nickname ?? speciesOf(d.species).name} · Nv. {d.level}
                    </option>
                  ))}
                </select>
                <h3>✦ {arenaAbility(fighter.species).name}</h3>
                <p>{arenaAbility(fighter.species).description}</p>
                <div className="duel-training-ranks">
                  {[0, 1, 2, 3].map((r) => (
                    <span key={r} className={rank >= r ? 'done' : ''}>
                      {rank >= r ? '✦' : r + 1}
                    </span>
                  ))}
                  <b>+{rank * 15}%</b>
                </div>
                <button
                  className="button arena-primary"
                  disabled={!!active || trainingCost === undefined || (state.medals ?? 0) < trainingCost}
                  onClick={() => run({ type: 'trainArenaAbility', dinoId: fighter.id })}
                >
                  {trainingCost === undefined ? (
                    'Rang maxim'
                  ) : (
                    <>
                      <span>Îmbunătățește</span>
                      <span className="arena-cost">🏅 {trainingCost}</span>
                    </>
                  )}
                </button>
                {trainingCost !== undefined && !active && (state.medals ?? 0) < trainingCost && (
                  <p className="duel-training-need">
                    <strong>Îți lipsesc 🏅 {trainingCost - (state.medals ?? 0)}</strong>
                    <small>Câștigă dueluri în tab-ul Dueluri: 🏅 5 · 10 · 18, fiecare adversar o dată pe zi</small>
                  </p>
                )}
                {active && (
                  <p className="duel-training-need">
                    <small>Arena e ocupată: antrenamentul merge după ce se termină duelul</small>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="duel-hint">Nu ai încă dinozauri.</p>
          )}
        </section>
      )}
      <details className="duel-elements-help">
        <summary>? Avantaje de element</summary>
        <div>
          {[...ELEMENT_IDS, ELEMENT_IDS[0]].map((e, i) => (
            <span key={i}>
              {i > 0 && <i>→</i>}
              <ElementBadge element={e} />
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
