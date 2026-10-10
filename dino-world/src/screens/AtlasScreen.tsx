// Atlasul speciilor: fiecare specie e o linie pui → juvenil → adult. Filtru pe elemente; fișa unei forme are
// dinozaurul animat mare, cifrele ca plăcuțe și linia de evoluție. Același cadru întunecat ca panourile clădirilor.
import { useMemo, useState, type CSSProperties } from 'react';
import {
  ATLAS_REWARD,
  ELEMENTS,
  ELEMENT_IDS,
  EVOLUTION_STAGES,
  FEED_COST,
  SPECIES,
  highestDiscoveredLevel,
  incomeAt,
  stageForLevel,
  type ElementId,
  type EvolutionStage,
  type GameState,
  type Species,
} from '@shared/game';
import { DinoView } from '../dino-lab/DinoView';
import { recipeFor } from '../dino-lab/recipes';
import { DinoThumb, Modal, Progress, RarityBadge, formatNumber, formatTime } from '../components/ui';
import '../styles/atlas.css';

type Entry = { species: Species; stage: EvolutionStage };
const stageInfo = (stage: EvolutionStage) => EVOLUTION_STAGES.find((s) => s.id === stage)!;

export function AtlasScreen({
  state,
  onClaim,
  onClose,
}: {
  state: GameState;
  onClaim: (species: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<Entry | null>(null);
  const [filter, setFilter] = useState<ElementId | 'all'>('all');
  const known = (s: Species, stage: EvolutionStage) => highestDiscoveredLevel(state, s.id) >= stageInfo(stage).minLevel;
  const owned = (s: Species, stage: EvolutionStage) =>
    state.dinos.some((d) => d.species === s.id && stageForLevel(d.level) === stage);
  const total = SPECIES.length * EVOLUTION_STAGES.length;
  const discovered = SPECIES.reduce((n, s) => n + EVOLUTION_STAGES.filter((stage) => known(s, stage.id)).length, 0);
  const list = SPECIES.filter((s) => filter === 'all' || s.elements.includes(filter));

  const form = (s: Species, stage: EvolutionStage) => {
    const seen = known(s, stage);
    const mine = owned(s, stage);
    const info = stageInfo(stage);
    return (
      <button
        key={stage}
        className={`atlas-form ${mine ? 'owned' : seen ? 'seen' : 'unknown'}`}
        disabled={!seen}
        onClick={() => setOpen({ species: s, stage })}
        title={seen ? `${s.name} · ${info.name}` : `Nivel ${info.minLevel}`}
      >
        <DinoThumb species={s.id} stage={seen ? stage : 'adult'} hidden={!seen} lazy />
        {mine && <span className="atlas-form-owned">✓</span>}
        {!seen && <span className="atlas-form-lock">🔒 {info.minLevel}</span>}
      </button>
    );
  };

  return (
    <Modal title="Atlasul speciilor" onClose={onClose} bare className="bp-modal atlas-modal">
      <div className="bp-adv" style={{ '--tint': '#c77dff' } as CSSProperties}>
        <header className="bp-bar">
          {open ? (
            <button className="bp-ghost atlas-back" onClick={() => setOpen(null)}>
              ← Atlas
            </button>
          ) : (
            <span className="shop-bar-icon" aria-hidden="true">
              📖
            </span>
          )}
          <div className="bp-bar-title">
            <h2>{open ? open.species.name : 'Atlas'}</h2>
          </div>
          <div className="atlas-progress" title={`${discovered}/${total} forme descoperite`}>
            <Progress value={discovered / total} />
            <span>
              {discovered}/{total}
            </span>
          </div>
        </header>
        <div className="bp-adv-body atlas-body">
          {open ? (
            <SpeciesCard entry={open} state={state} onOpen={setOpen} />
          ) : (
            <>
              <nav className="atlas-filter" aria-label="Filtrează după element">
                <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                  Toate
                </button>
                {ELEMENT_IDS.map((e) => (
                  <button
                    key={e}
                    className={filter === e ? 'on' : ''}
                    style={{ '--el': ELEMENTS[e].color } as CSSProperties}
                    onClick={() => setFilter(e)}
                    title={ELEMENTS[e].name}
                  >
                    {ELEMENTS[e].icon}
                  </button>
                ))}
              </nav>
              <div className="atlas-grid">
                {list.map((s) => {
                  const count = EVOLUTION_STAGES.filter((stage) => known(s, stage.id)).length;
                  return (
                    <section
                      key={s.id}
                      className={`atlas-line r-${s.rarity} ${count ? '' : 'unknown'}`}
                      style={{ '--el': ELEMENTS[s.elements[0]].color } as CSSProperties}
                    >
                      <header>
                        <span className="atlas-line-els">
                          {s.elements.map((e) => (
                            <span key={e} title={ELEMENTS[e].name}>
                              {ELEMENTS[e].icon}
                            </span>
                          ))}
                        </span>
                        <strong>{count ? s.name : '???'}</strong>
                        {count === 3 && !state.atlasClaimed?.includes(s.id) ? (
                          <button
                            className="atlas-claim"
                            onClick={() => onClaim(s.id)}
                            title="Linie completă: ia recompensa"
                          >
                            🎁 💎 {ATLAS_REWARD[s.rarity]}
                          </button>
                        ) : (
                          <span className={`atlas-line-count ${count === 3 ? 'complete' : ''}`}>
                            {count === 3 ? '✓' : `${count}/3`}
                          </span>
                        )}
                      </header>
                      <div className="atlas-forms">
                        {form(s, 'pui')}
                        <i aria-hidden="true">›</i>
                        {form(s, 'juvenil')}
                        <i aria-hidden="true">›</i>
                        {form(s, 'adult')}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function SpeciesCard({ entry, state, onOpen }: { entry: Entry; state: GameState; onOpen: (entry: Entry) => void }) {
  const { species: s, stage } = entry;
  const info = stageInfo(stage);
  const recipe = useMemo(() => recipeFor(s.id, stage), [s.id, stage]);
  const count = state.dinos.filter((d) => d.species === s.id && stageForLevel(d.level) === stage).length;
  const next = EVOLUTION_STAGES[EVOLUTION_STAGES.indexOf(info) + 1];
  return (
    <div className={`atlas-detail r-${s.rarity}`} style={{ '--el': ELEMENTS[s.elements[0]].color } as CSSProperties}>
      <div className="atlas-detail-art">
        <DinoView key={`${s.id}-${stage}`} recipe={recipe} className="atlas-live" tapToAttack />
        <span className="atlas-detail-hint">Atinge pentru atac</span>
      </div>
      <div className="atlas-detail-info">
        <div className="bp-chips atlas-detail-chips">
          <RarityBadge rarity={s.rarity} />
          {s.elements.map((e) => (
            <span key={e} className="bp-chip">
              {ELEMENTS[e].icon} {ELEMENTS[e].name}
            </span>
          ))}
          <span className="bp-chip gold">{info.name}</span>
          {count > 0 && <span className="bp-chip">✓ {count} în colecție</span>}
        </div>
        <p className="atlas-blurb">{s.description}</p>
        <div className="atlas-facts">
          <span>
            <small>Nivel</small>
            {info.minLevel}–{info.maxLevel}
          </span>
          <span>
            <small>Aur / min</small>🪙 {incomeAt(s, info.minLevel)}–{incomeAt(s, info.maxLevel)}
          </span>
          <span>
            <small>Putere</small>⚔ {info.minLevel * 10 + s.income}–{info.maxLevel * 10 + s.income}
          </span>
          <span>
            <small>Eclozare</small>⏱ {formatTime(s.hatchSeconds * 1000)}
          </span>
        </div>
        <div className="atlas-how">
          <span className="atlas-how-icon">{s.shopPrice ? '🥚' : '💞'}</span>
          <span>
            {s.shopPrice
              ? `Ou · 🪙 ${formatNumber(s.shopPrice)}`
              : s.elements.map((e) => ELEMENTS[e].icon).join(' + ') + ' împerechere'}
          </span>
          {next && (
            <span className="atlas-how-next">
              🍖 {formatNumber(FEED_COST.slice(info.minLevel, next.minLevel).reduce((n, cost) => n + cost, 0))} →{' '}
              {next.name}
            </span>
          )}
        </div>
        <div className="atlas-family">
          {EVOLUTION_STAGES.map((f, i) => {
            const seen = highestDiscoveredLevel(state, s.id) >= f.minLevel;
            return (
              <span key={f.id} className="atlas-family-step">
                {i > 0 && <i aria-hidden="true">›</i>}
                <button
                  className={`atlas-form ${f.id === stage ? 'current' : seen ? 'seen' : 'unknown'}`}
                  disabled={!seen || f.id === stage}
                  onClick={() => onOpen({ species: s, stage: f.id })}
                  title={f.name}
                >
                  <DinoThumb species={s.id} stage={f.id} hidden={!seen} />
                  <small>{f.name}</small>
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
