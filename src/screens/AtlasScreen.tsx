import { ThemeText } from '../components/ThemeText';
// Atlasul Speciilor (Pokédex-ul): fiecare linie e un drum de evoluție (pui → juvenil → două ramuri de adult),
// cu dragonul ei. Speciile nedescoperite apar ca siluete; fișa unei specii se deschide cu un clic.

import { useState } from 'react';
import { BRANCH_INFO, DIET_INFO, SPECIES, SPECIES_LIST, STAT_NAMES, TYPES, type Species, type Stats } from '@shared/game';
import { LINE_DRAGON, speciesStill } from '../content/dragons';
import { DinoLive } from '../components/DinoLive';
import { DietArt } from '../components/AssetIcon';
import { Bar, Modal, PageHeader, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';

const STAGE_LABEL = (s: Species) => (s.stage === 'pui' ? 'Pui' : s.stage === 'juvenil' ? 'Juvenil' : `Adult · ${BRANCH_INFO[s.branch!].name}`);
const capital = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

export function AtlasScreen({ game }: { game: Game }) {
  const state = game.state!;
  const [open, setOpen] = useState<string | null>(null);
  const owned = SPECIES_LIST.filter((s) => state.atlas[s.id]?.owned).length;
  const seen = SPECIES_LIST.filter((s) => state.atlas[s.id]?.seen).length;
  const lines = [...new Set(SPECIES_LIST.map((s) => s.line))];

  const card = (s: Species) => {
    const entry = state.atlas[s.id];
    const n = SPECIES_LIST.indexOf(s) + 1;
    const known = !!entry?.seen;
    return (
      <button
        key={s.id}
        className={`atlas-card${entry?.owned ? ' owned' : known ? ' seen' : ' unknown'}`}
        style={{ ['--type' as string]: TYPES[s.types[0]].color }}
        onClick={() => known && setOpen(s.id)}
        disabled={!known}
        title={known ? `Deschide fișa: ${s.name}` : 'Încă nedescoperit'}
      >
        <span className="atlas-n">#<ThemeText>{String(n).padStart(3, '0')}</ThemeText></span>
        {entry?.albino && (
          <span className="atlas-albino" title="Ai avut și varianta albino"><ThemeText>{"\r\n            🤍\r\n          "}</ThemeText></span>
        )}
        <span className="atlas-art">
          <img src={speciesStill(s.id)} alt="" loading="lazy" className={known ? '' : 'silhouette'} />
        </span>
        <b><ThemeText>{known ? s.name : '???'}</ThemeText></b>
        <small className="atlas-stage"><ThemeText>{STAGE_LABEL(s)}</ThemeText></small>
        <span className={`atlas-status${entry?.owned ? ' ok' : ''}`}><ThemeText>{entry?.owned ? '✓ crescut' : known ? '👁 văzut' : '🔒 nedescoperit'}</ThemeText></span>
      </button>
    );
  };

  return (
    <div className="screen">
      <PageHeader
        icon="📖"
        title="Atlasul Speciilor"
        subtitle="Toate speciile, pe linii de evoluție: pui → juvenil → două ramuri de adult (dieta decide ramura). Le descoperi întâlnindu-le în expediții și crescându-le."
        stats={[
          { label: 'crescute', value: `${owned}/${SPECIES_LIST.length}`, tone: owned === SPECIES_LIST.length ? 'gold' : undefined },
          { label: 'văzute', value: seen },
          { label: 'complet', value: `${Math.round((owned / SPECIES_LIST.length) * 100)}%` },
        ]}
      />

      <div className="atlas-lines">
        {lines.map((line) => {
          const list = SPECIES_LIST.filter((s) => s.line === line);
          const [pui, juvenil, ...adults] = list;
          const type = TYPES[pui.types[0]];
          const done = list.filter((s) => state.atlas[s.id]?.owned).length;
          return (
            <section key={line} className="atlas-line-card" style={{ ['--type' as string]: type.color }}>
              <header className="atlas-line-head">
                <span className="atlas-line-icon"><ThemeText>{type.icon}</ThemeText></span>
                <div>
                  <h3>Linia <ThemeText>{capital(LINE_DRAGON[line])}</ThemeText></h3>
                  <small className="muted">
                    <ThemeText>{type.name}</ThemeText> · îi place <DietArt diet={pui.diet} /> <ThemeText>{DIET_INFO[pui.diet].name.toLowerCase()}</ThemeText>
                  </small>
                </div>
                <span className="atlas-line-count">
                  <ThemeText>{done}</ThemeText>/<ThemeText>{list.length}</ThemeText>
                </span>
              </header>
              <div className="atlas-path">
                <ThemeText>{card(pui)}</ThemeText>
                <span className="atlas-arrow">➜</span>
                <ThemeText>{card(juvenil)}</ThemeText>
                <span className="atlas-arrow">➜</span>
                <div className="atlas-branches"><ThemeText>{adults.map(card)}</ThemeText></div>
              </div>
            </section>
          );
        })}
      </div>

      {open && <SpeciesCard id={open} game={game} onOpen={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SpeciesCard({ id, game, onOpen, onClose }: { id: string; game: Game; onOpen: (id: string) => void; onClose: () => void }) {
  const state = game.state!;
  const s = SPECIES[id];
  const owned = !!state.atlas[id]?.owned;
  const family = SPECIES_LIST.filter((x) => x.line === s.line);
  const max = Math.max(...family.flatMap((x) => Object.values(x.base)));

  return (
    <Modal onClose={onClose} wide className="species-modal">
      <div className="species-layout">
        <div className={`detail-art type-bg-${s.types[0]}`}>
          <DinoLive key={id} speciesId={id} size={360} />
        </div>
        <div className="species-info">
          <small className="atlas-n">#<ThemeText>{String(SPECIES_LIST.indexOf(s) + 1).padStart(3, '0')}</ThemeText></small>
          <h2><ThemeText>{s.name}</ThemeText></h2>
          <div className="dd-chips">
            {s.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <span className="chip"><ThemeText>{STAGE_LABEL(s)}</ThemeText></span>
            <span className="chip">
              Îi place: <DietArt diet={s.diet} /> <ThemeText>{DIET_INFO[s.diet].name}</ThemeText>
            </span>
          </div>
          <p className="species-blurb"><ThemeText>{s.blurb}</ThemeText></p>

          <h4>Statistici de bază</h4>
          {owned ? (
            <div className="stats-table">
              {(Object.keys(s.base) as (keyof Stats)[]).map((k) => (
                <div key={k} className="stat-row">
                  <span><ThemeText>{STAT_NAMES[k]}</ThemeText></span>
                  <Bar value={s.base[k]} max={max} thin color="#7bc66b" />
                  <b><ThemeText>{s.base[k]}</ThemeText></b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted"><ThemeText>{"🔒 Crește unul ca să-i afli statisticile."}</ThemeText></p>
          )}

          <h4>În luptă</h4>
          <ul className="dd-facts">
            <li>
              <span><ThemeText>{"⚔️ Atac de bază"}</ThemeText></span>
              <b><ThemeText>{s.basic.name}</ThemeText></b>
            </li>
            <li>
              <span><ThemeText>{"✨ Ultimată"}</ThemeText></span>
              <b>
                <ThemeText>{s.special.name}</ThemeText> {s.special.type && <TypeBadge type={s.special.type} small />}
              </b>
            </li>
          </ul>

          <h4>Linia de evoluție</h4>
          <div className="species-family">
            {family.map((f) => {
              const known = !!state.atlas[f.id]?.seen;
              return (
                <button
                  key={f.id}
                  className={`species-mini${f.id === id ? ' current' : ''}`}
                  disabled={!known || f.id === id}
                  onClick={() => onOpen(f.id)}
                  title={known ? f.name : '???'}
                >
                  <img src={speciesStill(f.id)} alt="" className={known ? '' : 'silhouette'} />
                  <small><ThemeText>{known ? f.name : '???'}</ThemeText></small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
