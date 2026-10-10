// Sărbătoarea de nivel nou: o clădire sau un dinozaur crește. Apare scurt peste tot, nu blochează nimic.

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  BUILDINGS,
  ELEMENTS,
  FARM_PLOTS,
  HATCHERY_SLOTS,
  dinoIncome,
  habitatCapacity,
  speciesOf,
  stageForLevel,
  type GameState,
} from '@shared/game';
import type { Celebration } from '../hooks/useGame';
import { DinoThumb } from './ui';
import { BuildingPreview } from '../world/BuildingArt';

const SHOW_MS = 2200;

export function LevelUp({
  celebration,
  state,
  onDone,
}: {
  celebration: Celebration;
  state: GameState;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(timer);
  }, [celebration.key, onDone]);

  const e = celebration.event;
  let art: ReactNode = null;
  let name = '';
  let perk = '';
  if (e.type === 'levelUp') {
    const d = state.dinos.find((d) => d.id === e.dinoId);
    if (!d) return null;
    name = d.nickname ?? speciesOf(d.species).name;
    art = <DinoThumb species={d.species} stage={stageForLevel(d.level)} tight />;
    perk = `🪙 ${dinoIncome(d)} / min`;
  } else {
    const b = state.buildings.find((b) => b.id === e.buildingId);
    if (!b) return null;
    if (b.kind === 'habitat') {
      const el = ELEMENTS[b.element ?? 'fire'];
      name = `Lumea de ${el.name}`;
      art = <span className="levelup-icon">{el.icon}</span>;
      perk = `🦖 ${habitatCapacity(b)} locuri`;
    } else {
      name = BUILDINGS[b.kind].name;
      art = <BuildingPreview kind={b.kind} />;
      if (b.kind === 'farm') perk = `🌱 ${FARM_PLOTS[b.level - 1]} straturi`;
      if (b.kind === 'hatchery') perk = `🥚 ${HATCHERY_SLOTS[b.level - 1]} ouă deodată`;
      if (b.kind === 'forge') perk = '⚒️ rețete noi';
    }
  }

  return (
    <div className="levelup" key={celebration.key} role="status" aria-live="polite" onClick={onDone}>
      <div className="levelup-rays" aria-hidden="true" />
      <div className="levelup-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ '--a': `${i * 30}deg`, '--d': `${(i % 3) * 0.08}s` } as CSSProperties} />
        ))}
      </div>
      <div className="levelup-card">
        <div className="levelup-art">{art}</div>
        <span className="levelup-badge">
          <small>Nivel</small>
          <strong>{e.level}</strong>
        </span>
        <h2>{name}</h2>
        {perk && <p>{perk}</p>}
      </div>
    </div>
  );
}
