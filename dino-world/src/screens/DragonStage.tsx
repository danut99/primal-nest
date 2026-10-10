// Primal's main creature stage, connected to dino-world's selected dinosaur and commands.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ELEMENTS,
  EVOLUTION_STAGES,
  FEED_COST,
  MAX_LEVEL,
  dinoPower,
  homesFor,
  incomeAt,
  onAdventure,
  isRecovering,
  sellPrice,
  speciesOf,
  stageForLevel,
  type Dino,
  type ElementId,
} from '@shared/game';
import type { Game } from '../hooks/useGame';
import { DinoView } from '../dino-lab/DinoView';
import type { DinoController } from '../dino-lab/engine';
import { recipeFor } from '../dino-lab/recipes';
import { ElementBadge, Progress, RarityBadge, formatTime, formatNumber } from '../components/ui';
import '../styles/dragon-stage.css';

const SCENES: Record<ElementId, string> = {
  fire: 'vulcan',
  water: 'jungla',
  earth: 'canion',
  plant: 'jungla',
  ice: 'piscuri',
  storm: 'piscuri',
};
const ANIM_LABELS: Record<string, string> = {
  idle: '😌 Repaus',
  breathe: '😌 Repaus',
  walk: '🐾 Mers',
  run: '🐾 Alergare',
  attack: '⚔ Atac',
  special1: '✨ Ultimată',
  ultimate: '✨ Atac puternic',
  levelup: '🌟 Bucurie',
  death: 'Odihnă',
  hit: 'Reacție',
};

export function DragonStage({
  game,
  dinoId,
  onSelect,
  onClose,
}: {
  game: Game;
  dinoId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const dino = game.state.dinos.find((d) => d.id === dinoId);
  return dino ? <StageContent game={game} dino={dino} onSelect={onSelect} onClose={onClose} /> : null;
}

function StageContent({
  game,
  dino,
  onSelect,
  onClose,
}: {
  game: Game;
  dino: Dino;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const species = speciesOf(dino.species);
  const stage = stageForLevel(dino.level);
  const info = EVOLUTION_STAGES.find((s) => s.id === stage)!;
  const next = EVOLUTION_STAGES[EVOLUTION_STAGES.indexOf(info) + 1];
  const home = game.state.buildings.find((b) => b.id === dino.habitatId);
  const element = home?.element ?? species.elements[0];
  const recipe = useMemo(() => recipeFor(dino.species, stage), [dino.species, stage]);
  const [ready, setReady] = useState(false);
  const controller = useRef<DinoController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [animation, setAnimation] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(dino.nickname ?? species.name);
  const away = onAdventure(game.state, dino.id, game.now);
  const breeding = game.state.breeding?.a === dino.id || game.state.breeding?.b === dino.id;
  const family = game.state.dinos.filter((d) => d.habitatId === dino.habitatId);
  const at = family.findIndex((d) => d.id === dino.id);
  const step = (direction: number) => {
    if (family.length > 1) onSelect(family[(at + direction + family.length) % family.length].id);
  };
  const homes = homesFor(game.state, dino.species, dino.id).filter((b) => b.id !== dino.habitatId);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (previous instanceof HTMLElement || previous instanceof SVGElement) previous.focus();
    };
  }, []);
  const feed = () => {
    if (game.run({ type: 'feed', dinoId: dino.id })) {
      const c = controller.current;
      if (c)
        c.playOnce(
          c.animations.includes('levelup') ? 'levelup' : c.animations.includes('attack') ? 'attack' : c.animations[0],
        );
    }
  };
  return (
    <div
      className="dragon-stage-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dragon-stage-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          step(e.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      <section
        className={`pack-stage stage-${element}`}
        style={
          {
            '--tc': ELEMENTS[element].color,
            backgroundImage: `linear-gradient(#05050a20,#05050a70),url(${import.meta.env.BASE_URL}world/stages/${SCENES[element]}.webp)`,
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ps-canvas">
          {!ready && (
            <div className="stage-preloader" role="status">
              <span className="dino-thumb-wait" aria-hidden="true" />
              <span>Se încarcă dinozaurul…</span>
            </div>
          )}
          <DinoView
            recipe={recipe}
            animation={animation || undefined}
            camera="fixed"
            pad={{ top: 18, bottom: 26, left: 6, right: 6 }}
            className={`stage-live ${ready ? 'ready' : 'preparing'}`}
            tapToAttack
            onReady={(c) => {
              controller.current = c;
              setReady(true);
              setAnimations(c.animations);
              setAnimation(c.animations.find((a) => a === 'idle' || a === 'breathe') ?? c.animations[0]);
            }}
          />
        </div>
        <header className="ps-top">
          <button
            className="ps-arrow"
            disabled={family.length < 2}
            onClick={() => step(-1)}
            aria-label="Dinozaurul anterior"
          >
            ◀
          </button>
          <div className="ps-title">
            {renaming ? (
              <form
                className="stage-name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (game.run({ type: 'rename', dinoId: dino.id, nickname: name })) setRenaming(false);
                }}
              >
                <input
                  autoFocus
                  aria-label="Nume nou"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="button small">OK</button>
              </form>
            ) : (
              <h2 id="dragon-stage-title">
                {dino.nickname ?? species.name}
                <button className="ps-rename" aria-label="Redenumește" onClick={() => setRenaming(true)}>
                  ✎
                </button>
              </h2>
            )}
            <div className="ps-chips">
              <span className="ps-level">Nv. {dino.level}</span>
              {species.elements.map((e) => (
                <ElementBadge key={e} element={e} />
              ))}
              <span className="stage-chip">{info.name}</span>
              <RarityBadge rarity={species.rarity} />
            </div>
          </div>
          <span className="ps-pos">
            {at + 1}/{family.length}
          </span>
          <button
            className="ps-arrow"
            disabled={family.length < 2}
            onClick={() => step(1)}
            aria-label="Dinozaurul următor"
          >
            ▶
          </button>
          <button ref={closeButton} className="stage-close ps-arrow" onClick={onClose} aria-label="Înapoi la habitat">
            ✕
          </button>
        </header>
        <div className="ps-body">
          <aside className="ps-glass">
            <h4>Creștere</h4>
            <strong>
              {info.name} · nivel {dino.level}
            </strong>
            <Progress
              value={next ? (dino.level - info.minLevel) / (next.minLevel - info.minLevel) : dino.level / MAX_LEVEL}
            />
            <p>{next ? `${next.name} la nivelul ${next.minLevel}` : 'Forma finală · maximum nivel 10'}</p>
            <p>🌾 {formatNumber(game.state.food)} hrană disponibilă</p>
            {isRecovering(dino, game.now) && (
              <p className="stage-busy">
                Recuperare: {formatTime(dino.recoveryUntil! - game.now)} · arena și împerecherea indisponibile.
              </p>
            )}
            {away && <p className="stage-busy">Echipa este în misiune.</p>}
          </aside>
          <div className="ps-dragon" aria-hidden="true" />
          <aside className="ps-glass">
            <h4>Statistici</h4>
            <dl>
              <dt>⚔ Putere</dt>
              <dd>{dinoPower(dino)}</dd>
              <dt>🪙 Aur / min</dt>
              <dd>{home?.kind === 'habitat' ? incomeAt(species, dino.level) : 0}</dd>
              <dt>Lume</dt>
              <dd>{home?.element ? ELEMENTS[home.element].name : 'Incubator'}</dd>
            </dl>
            <p>{species.description}</p>
          </aside>
        </div>
        <div className="ps-anims" aria-label="Animații">
          <span className="ps-anims-label">Animații</span>
          {animations.map((a) => (
            <button
              key={a}
              className={a === animation ? 'on' : ''}
              aria-pressed={a === animation}
              onClick={() => {
                setAnimation(a);
                controller.current?.setAnimation(a);
              }}
            >
              {recipe.animations?.[a]?.label ?? ANIM_LABELS[a] ?? a}
            </button>
          ))}
        </div>
        <footer className="ps-actions">
          <button
            className="ps-btn feed"
            disabled={away || dino.level >= MAX_LEVEL || game.state.food < FEED_COST[dino.level]}
            onClick={feed}
          >
            <span>🌾</span>
            <b>{dino.level >= MAX_LEVEL ? 'Nivel maxim' : 'Hrănește'}</b>
            <small>
              {dino.level >= MAX_LEVEL
                ? 'Adult · nivel 10'
                : away
                  ? 'E plecat · revine curând'
                  : game.state.food < FEED_COST[dino.level]
                    ? `lipsesc ${FEED_COST[dino.level] - game.state.food} hrană · Ferma`
                    : `${FEED_COST[dino.level]} hrană · nivel ${dino.level + 1}`}
            </small>
          </button>
          {homes.length > 0 && (
            <label className="stage-move">
              Mută în altă lume
              <select
                className="select"
                disabled={away || breeding}
                value=""
                onChange={(e) => game.run({ type: 'moveDino', dinoId: dino.id, habitatId: e.target.value })}
              >
                <option value="">Alege lumea…</option>
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {ELEMENTS[h.element!].name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="ps-btn stage-sell"
            disabled={away || breeding || game.state.dinos.length < 2}
            onClick={() => {
              const nextDino = game.state.dinos.find((d) => d.id !== dino.id);
              if (game.run({ type: 'sellDino', dinoId: dino.id })) {
                if (nextDino) onSelect(nextDino.id);
                else onClose();
              }
            }}
          >
            <span>🪙</span>
            <b>Vinde</b>
            <small>{formatNumber(sellPrice(dino))} aur</small>
          </button>
        </footer>
      </section>
    </div>
  );
}
