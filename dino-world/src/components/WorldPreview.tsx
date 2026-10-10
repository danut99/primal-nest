// Ce câștigi deblocând o lume: speciile care trăiesc acolo (din ou sau din Bârlog), oul ei și locurile.

import {
  DEN_RECIPES,
  EGG_SPECIES,
  HABITAT_CAPACITY,
  HABITAT_EGG_PRICE,
  SPECIES,
  speciesOf,
  type ElementId,
  type GameState,
} from '@shared/game';
import { DinoThumb, formatNumber } from './ui';

export function WorldPreview({ state, element, compact }: { state: GameState; element: ElementId; compact?: boolean }) {
  const species = SPECIES.filter((s) => s.elements[0] === element).sort(
    (a, b) => Number(b.id === EGG_SPECIES[element]) - Number(a.id === EGG_SPECIES[element]),
  );
  return (
    <div className={`world-preview ${compact ? 'compact' : ''}`}>
      <small className="world-preview-title">Aici descoperi</small>
      <ul>
        {species.map((s) => {
          const parents = DEN_RECIPES[s.id];
          return (
            <li
              key={s.id}
              title={
                parents
                  ? `${s.name} · din Bârlog: ${parents.map((p) => speciesOf(p).name).join(' + ')}`
                  : `${s.name} · din oul lumii`
              }
            >
              <DinoThumb species={s.id} className="small" lazy />
              <span>
                <strong>{state.discovered.includes(s.id) || !parents ? s.name : '???'}</strong>
                {!compact && <small>{parents ? '💞 din Bârlog' : '🥚 din ou'}</small>}
              </span>
            </li>
          );
        })}
      </ul>
      {!compact && (
        <p className="world-preview-facts">
          <span>🥚 Ou nou · 🪙 {formatNumber(HABITAT_EGG_PRICE[element])}</span>
          <span>
            🦖 {HABITAT_CAPACITY[element][0]} locuri, până la {HABITAT_CAPACITY[element].at(-1)}
          </span>
        </p>
      )}
    </div>
  );
}
