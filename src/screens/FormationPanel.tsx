// Formația de luptă, cu drag & drop: rândul din față (încasează loviturile), rândul din spate
// (ferit, dar lovește mai slab) și dinozaurii disponibili. Pe telefon merge și cu atingeri.
// Se aranjează într-o fereastră care se deschide înainte de fiecare luptă sau expediție.

import { type DragEvent, useState } from 'react';
import { type Dino, SPECIES, geneStars, partySize } from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { Modal, Panel, Stars } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { SkillHeader } from './ActivitiesScreen';

type Zone = 'front' | 'back' | 'bench';

/** Tabla formației: cele două rânduri și dinozaurii disponibili. */
export function FormationBoard({ game }: { game: Game }) {
  const state = game.state!;
  const [over, setOver] = useState<Zone | null>(null);
  const size = partySize(state);
  const locked = state.activity?.kind === 'expedition';
  const party = state.party.map((id) => state.dinos.find((d) => d.id === id)!).filter(Boolean);
  const front = party.filter((d) => !state.backRow.includes(d.id));
  const back = party.filter((d) => state.backRow.includes(d.id));
  const busy = (d: Dino) =>
    d.molt ? 'Năpârlește' : state.workers.some((w) => w.dinoId === d.id) ? 'La muncă' : state.breeding?.a === d.id || state.breeding?.b === d.id ? 'În Bârlog' : null;
  const bench = state.dinos.filter((d) => !state.party.includes(d.id)).sort((a, b) => Number(!!busy(a)) - Number(!!busy(b)) || b.level - a.level);

  /** Mută un dinozaur într-o zonă: în haită (față/spate) sau înapoi printre disponibili. */
  const move = (id: string, to: Zone) => {
    const inParty = state.party.includes(id);
    if (to === 'bench') {
      if (inParty) game.dispatch({ type: 'setParty', ids: state.party.filter((x) => x !== id) }, { quiet: true });
      return;
    }
    if (!inParty && !game.dispatch({ type: 'setParty', ids: [...state.party, id] }, { quiet: true })) return;
    const isBack = state.backRow.includes(id);
    if ((to === 'back') !== isBack) game.dispatch({ type: 'setRow', dinoId: id, back: to === 'back' }, { quiet: true });
  };

  const dropProps = (zone: Zone) => ({
    onDragOver: (e: DragEvent) => {
      if (locked) return;
      e.preventDefault();
      setOver(zone);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      if (!locked) move(e.dataTransfer.getData('text/plain'), zone);
    },
  });

  const card = (d: Dino, where: Zone) => {
    const why = where === 'bench' ? busy(d) : null;
    const full = where === 'bench' && state.party.length >= size;
    const canDrag = !locked && !why;
    return (
      <div
        key={d.id}
        className={`form-dino${why ? ' blocked' : ''}${d.rarity ? ` r-${d.rarity}` : ''}`}
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', d.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => where === 'bench' && canDrag && !full && move(d.id, 'front')}
        title={why ?? (where === 'bench' ? (full ? `Haita are ${size} locuri` : 'Trage într-un rând sau atinge') : 'Trage ca să-l muți')}
      >
        <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={where === 'bench' ? 52 : 72} className={where === 'bench' ? '' : 'bob'} />
        <b>{d.nickname}</b>
        <small className="muted">
          Nv. {d.level} · {SPECIES[d.speciesId].name}
        </small>
        {where === 'bench' ? (
          why ? <span className="form-why">{why}</span> : <Stars n={geneStars(d.genes)} />
        ) : (
          !locked && (
            <span className="form-actions">
              <button
                className="form-mini"
                onClick={(e) => {
                  e.stopPropagation();
                  move(d.id, where === 'front' ? 'back' : 'front');
                }}
                title={where === 'front' ? 'Mută în spate' : 'Mută în față'}
              >
                {where === 'front' ? '⬇' : '⬆'}
              </button>
              <button
                className="form-mini"
                onClick={(e) => {
                  e.stopPropagation();
                  move(d.id, 'bench');
                }}
                title="Scoate din haită"
              >
                ✕
              </button>
            </span>
          )
        )}
      </div>
    );
  };

  const empty = size - party.length;
  return (
    <div className="formation">
      {locked && <p className="lock-text">🔒 Haita e în expediție. Oprește expediția ca să schimbi formația.</p>}
      <div className="form-rows">
        <div className={`form-row front${over === 'front' ? ' over' : ''}`} {...dropProps('front')}>
          <div className="form-row-label">
            <b>🛡️ Față</b>
            <small>Încasează loviturile</small>
          </div>
          <div className="form-row-slots">
            {front.map((d) => card(d, 'front'))}
            {empty > 0 && !locked && <div className="form-slot">Trage aici</div>}
          </div>
        </div>
        <div className={`form-row back${over === 'back' ? ' over' : ''}`} {...dropProps('back')}>
          <div className="form-row-label">
            <b>🏹 Spate</b>
            <small>Ferit cât timp e cineva în față · −15% damage</small>
          </div>
          <div className="form-row-slots">
            {back.map((d) => card(d, 'back'))}
            {empty > 0 && !locked && <div className="form-slot">Trage aici</div>}
          </div>
        </div>
      </div>
      {front.length === 0 && back.length > 0 && <p className="hint">Nimeni în față: cei din spate nu mai sunt feriți.</p>}

      <div className={`form-bench${over === 'bench' ? ' over' : ''}`} {...dropProps('bench')}>
        <h3>
          Disponibili <small className="muted">· trage în formație sau atinge · {party.length}/{size} în luptă</small>
        </h3>
        {bench.length === 0 ? <p className="muted small">Toți dinozaurii sunt deja în luptă.</p> : <div className="form-bench-list">{bench.map((d) => card(d, 'bench'))}</div>}
      </div>
    </div>
  );
}

/** Fereastra dinaintea luptei: aranjezi formația, apoi pornești. */
export function FormationModal({
  game,
  title,
  startLabel,
  onStart,
  onClose,
}: {
  game: Game;
  title: string;
  startLabel: string;
  onStart: () => void;
  onClose: () => void;
}) {
  const ready = game.state!.party.length > 0;
  return (
    <Modal wide onClose={onClose} className="formation-modal">
      <h2>{title}</h2>
      <p className="muted small">Trage dinozaurii în rânduri. Pe câmpul de luptă vor sta exact așa: cei din față lângă inamic, cei din spate în urmă.</p>
      <FormationBoard game={game} />
      {!ready && <p className="lock-text formation-empty">Pune cel puțin un dinozaur în formație.</p>}
      <div className="formation-cta">
        <button className="btn ghost" onClick={onClose}>
          Înapoi
        </button>
        <button className="btn primary big glow" disabled={!ready} onClick={onStart}>
          {startLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Rezumatul formației, sus pe ecranul Expediții. */
export function FormationSummary({ game, onEdit }: { game: Game; onEdit: () => void }) {
  const state = game.state!;
  const size = partySize(state);
  const party = state.party.map((id) => state.dinos.find((d) => d.id === id)!).filter(Boolean);
  const row = (back: boolean) => party.filter((d) => state.backRow.includes(d.id) === back);
  return (
    <Panel
      title="Haita de luptă"
      icon="⚔️"
      right={
        <button className="btn small" onClick={onEdit}>
          Aranjează formația
        </button>
      }
    >
      <SkillHeader game={game} skill="imblanzire" />
      {party.length === 0 ? (
        <p className="empty-state">Haita e goală. Apasă „Aranjează formația” și trage dinozauri în luptă.</p>
      ) : (
        <div className="form-summary">
          {([false, true] as const).map((back) => (
            <div key={String(back)} className={`form-summary-row ${back ? 'back' : 'front'}`}>
              <span className="form-summary-label">{back ? '🏹 Spate' : '🛡️ Față'}</span>
              {row(back).length === 0 ? (
                <small className="muted">—</small>
              ) : (
                row(back).map((d) => (
                  <span key={d.id} className="form-summary-dino">
                    <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={44} />
                    <small>
                      {d.nickname} · nv. {d.level}
                    </small>
                  </span>
                ))
              )}
            </div>
          ))}
          <small className="muted">
            {party.length}/{size} în luptă
          </small>
        </div>
      )}
    </Panel>
  );
}
