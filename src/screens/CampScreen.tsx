// Tabăra: construcții, rucsacul și forja lui Saurok (vânzare), skill-urile.

import { type ItemId, ITEMS, PROPERTY_LEVELS, SKILLS, type SkillId } from '@shared/game';
import { ItemChip, Panel, Saurok } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { SkillHeader } from './ActivitiesScreen';

export function CampScreen({ game }: { game: Game }) {
  const state = game.state!;
  const current = PROPERTY_LEVELS[state.property];
  const next = PROPERTY_LEVELS[state.property + 1];
  const items = (Object.keys(ITEMS) as ItemId[]).filter((id) => (state.inventory[id] ?? 0) > 0);

  return (
    <div className="screen">
      <Panel title="Tabăra Paznicului" icon="🏕️">
        <div className="camp-levels">
          {PROPERTY_LEVELS.map((lvl, i) => (
            <div key={lvl.name} className={`camp-step${i <= state.property ? ' built' : ''}${i === state.property + 1 ? ' next' : ''}`}>
              <span className="camp-icon">{['🪺', '🛖', '🏯'][i]}</span>
              <b>{lvl.name}</b>
              <small>{lvl.unlocks}</small>
            </div>
          ))}
        </div>
        <p>
          Acum ai: <b>{current.name}</b>.
        </p>
        {next ? (
          <div className="upgrade-box">
            <h3>Construiește: {next.name}</h3>
            <p className="muted">{next.unlocks}</p>
            <div className="drops">
              <span className={`item-chip${state.sparks < next.sparks ? ' short' : ''}`}>
                ✨ <b>
                  {state.sparks}/{next.sparks}
                </b>{' '}
                scântei
              </span>
              {Object.entries(next.cost).map(([item, qty]) => (
                <ItemChip key={item} item={item as ItemId} qty={qty!} have={state.inventory[item as ItemId] ?? 0} />
              ))}
            </div>
            <button className="btn primary" onClick={() => game.dispatch({ type: 'upgrade' })}>
              🔨 Construiește
            </button>
          </div>
        ) : (
          <p className="muted">Tabăra e la nivelul maxim în această versiune. Incubatorul termal vine curând!</p>
        )}
      </Panel>

      <Panel title="Forja lui Saurok" icon="🔥" right={<span className="sparks">✨ {state.sparks}</span>}>
        <div className="speech small">
          <Saurok size={52} />
          <p>„Adu-mi oase, fosile și chihlimbar. Focul meu le preface în scântei stelare. Fără ele, tabăra nu rezistă.”</p>
        </div>
        {items.length === 0 ? (
          <p className="empty-state">Rucsacul e gol.</p>
        ) : (
          <div className="bag-grid">
            {items.map((id) => {
              const def = ITEMS[id];
              const n = state.inventory[id]!;
              return (
                <div key={id} className="bag-item" title={def.blurb}>
                  <span className="bag-icon">{def.icon}</span>
                  <div className="grow">
                    <b>{def.name}</b>
                    <small className="muted">
                      ×{n} · {def.sell} ✨/buc
                    </small>
                  </div>
                  <div className="row gap-xs">
                    <button className="btn tiny" onClick={() => game.dispatch({ type: 'sell', itemId: id, qty: 1 })}>
                      Topește 1
                    </button>
                    {n > 1 && (
                      <button className="btn tiny" onClick={() => game.dispatch({ type: 'sell', itemId: id, qty: n })}>
                        Tot ({def.sell * n})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="hint">Păstrează Cristalele Stelare: ai nevoie de ele ca să evoluezi în Adult!</p>
      </Panel>

      <Panel title="Skill-uri" icon="📈">
        {(Object.keys(SKILLS) as SkillId[]).map((sk) => (
          <SkillHeader key={sk} game={game} skill={sk} />
        ))}
      </Panel>
    </div>
  );
}
