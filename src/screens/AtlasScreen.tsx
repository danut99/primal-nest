// Atlasul Speciilor (Pokédex-ul): siluete pentru speciile nedescoperite.

import { useState } from 'react';
import { BRANCH_INFO, DIET_INFO, SPECIES, SPECIES_LIST, STAT_NAMES, type Stats } from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { Bar, Modal, Panel, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';

export function AtlasScreen({ game }: { game: Game }) {
  const state = game.state!;
  const [open, setOpen] = useState<string | null>(null);
  const owned = SPECIES_LIST.filter((s) => state.atlas[s.id]?.owned).length;
  const seen = SPECIES_LIST.filter((s) => state.atlas[s.id]?.seen).length;
  const lines = [...new Set(SPECIES_LIST.map((s) => s.line))];

  return (
    <div className="screen">
      <Panel title="Atlasul Speciilor" icon="📖" right={<span className="muted">Crescute {owned}/{SPECIES_LIST.length} · Văzute {seen}</span>}>
        <Bar value={owned} max={SPECIES_LIST.length} color="#f5b942" label={`${Math.round((owned / SPECIES_LIST.length) * 100)}% complet`} />
        {lines.map((line) => (
          <div key={line} className="atlas-line">
            {SPECIES_LIST.filter((s) => s.line === line).map((s, i) => {
              const entry = state.atlas[s.id];
              const n = SPECIES_LIST.indexOf(s) + 1;
              return (
                <button key={s.id} className={`atlas-card${entry?.owned ? ' owned' : entry?.seen ? ' seen' : ''}`} onClick={() => entry?.seen && setOpen(s.id)}>
                  <small className="atlas-n">#{String(n).padStart(3, '0')}</small>
                  {entry?.albino && <span className="albino-dot" title="Ai avut și varianta albino">🤍</span>}
                  <DinoSprite speciesId={s.id} size={70} silhouette={!entry?.seen} />
                  <b>{entry?.seen ? s.name : '???'}</b>
                  {entry?.owned ? <small className="ok">✓ crescut</small> : entry?.seen ? <small className="muted">văzut</small> : <small className="muted">—</small>}
                  {i === 1 && <span className="evo-arrow">➜</span>}
                </button>
              );
            })}
          </div>
        ))}
      </Panel>
      {open && <SpeciesCard id={open} owned={!!state.atlas[open]?.owned} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SpeciesCard({ id, owned, onClose }: { id: string; owned: boolean; onClose: () => void }) {
  const s = SPECIES[id];
  return (
    <Modal onClose={onClose}>
      <div className={`detail-art type-bg-${s.types[0]}`}>
        <DinoSprite speciesId={id} size={170} className="bob" />
      </div>
      <h2>{s.name}</h2>
      <div className="row gap-s wrap">
        {s.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        <span className="chip">{s.stage === 'pui' ? 'Pui' : s.stage === 'juvenil' ? 'Juvenil' : `Adult · ${BRANCH_INFO[s.branch!].name}`}</span>
        <span className="chip">
          Îi place: {DIET_INFO[s.diet].icon} {DIET_INFO[s.diet].name}
        </span>
      </div>
      <p>{s.blurb}</p>
      {owned ? (
        <div className="stats-table">
          {(Object.keys(s.base) as (keyof Stats)[]).map((k) => (
            <div key={k} className="stat-row">
              <span>{STAT_NAMES[k]}</span>
              <Bar value={s.base[k]} max={150} thin color="#7bc66b" />
              <b>{s.base[k]}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Crește unul ca să-i afli statisticile de bază.</p>
      )}
    </Modal>
  );
}
