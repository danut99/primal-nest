// Ouăle pe habitat: desenul oului (în culorile elementului) și raftul cu ouă din magazin și din incubator.

import {
  ELEMENTS,
  ELEMENT_IDS,
  HABITAT_EGG_PRICE,
  habitatEggOdds,
  hatcherySlots,
  type ElementId,
  type GameState,
} from '@shared/game';
import { DinoThumb, formatTime } from './ui';

/** Culorile oului fiecărui element: coajă, pete, strălucire. */
const EGG_COLORS: Record<ElementId, [string, string, string]> = {
  fire: ['#ffd9a8', '#e8572a', '#ffb347'],
  water: ['#d6f1ff', '#2f8fd8', '#7fd8ff'],
  earth: ['#efdcbc', '#8a5a2b', '#d9a75a'],
  plant: ['#e3f5c8', '#3f8f3a', '#9be37a'],
  ice: ['#f2fbff', '#6fb6e0', '#ffffff'],
  storm: ['#e7dcff', '#6f4bff', '#c9b0ff'],
};

/** Oul ca SVG (centrat pe baza lui: x 0, y 0 jos); merge și în HTML (`<svg>` propriu), și pe hartă. */
export function EggShape({
  element,
  size = 40,
  shaking = false,
}: {
  element: ElementId;
  size?: number;
  shaking?: boolean;
}) {
  const [shell, spots, glow] = EGG_COLORS[element],
    w = size * 0.4,
    h = size * 0.5,
    id = `egg-${element}`;
  return (
    <g className={shaking ? 'egg-shake' : undefined}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={shell} />
          <stop offset="1" stopColor={spots} stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={-1} rx={w * 0.95} ry={h * 0.16} fill="rgba(40,20,0,0.25)" />
      <path
        d={`M0 ${-2 * h} C ${w * 0.75} ${-2 * h} ${w} ${-h * 0.8} ${w} ${-h * 0.55} C ${w} ${-h * 0.12} ${w * 0.55} 0 0 0 C ${-w * 0.55} 0 ${-w} ${-h * 0.12} ${-w} ${-h * 0.55} C ${-w} ${-h * 0.8} ${-w * 0.75} ${-2 * h} 0 ${-2 * h} Z`}
        fill={`url(#${id})`}
        stroke={spots}
        strokeOpacity={0.6}
        strokeWidth={size * 0.03}
      />
      <ellipse cx={w * 0.3} cy={-h * 0.65} rx={w * 0.2} ry={h * 0.14} fill={spots} opacity={0.75} />
      <ellipse cx={-w * 0.35} cy={-h * 0.4} rx={w * 0.14} ry={h * 0.1} fill={spots} opacity={0.65} />
      <ellipse cx={-w * 0.1} cy={-h * 1.25} rx={w * 0.12} ry={h * 0.09} fill={spots} opacity={0.6} />
      <ellipse cx={-w * 0.35} cy={-h * 1.45} rx={w * 0.16} ry={h * 0.22} fill={glow} opacity={0.7} />
    </g>
  );
}

export function EggIcon({
  element,
  size = 56,
  shaking = false,
}: {
  element: ElementId;
  size?: number;
  shaking?: boolean;
}) {
  return (
    <svg
      className="egg-icon"
      width={size * 0.9}
      height={size * 1.08}
      viewBox={`${-size * 0.45} ${-size * 1.04} ${size * 0.9} ${size * 1.08}`}
      aria-hidden="true"
    >
      <EggShape element={element} size={size} shaking={shaking} />
    </svg>
  );
}

/** Raftul cu ouă pe habitat. `onBuy` lipsă = doar prezentare. */
export function HabitatEggShop({ state, onBuy }: { state: GameState; onBuy: (element: ElementId) => void }) {
  const full = state.eggs.length >= hatcherySlots(state);
  return (
    <div className="habitat-eggs">
      {ELEMENT_IDS.map((element) => {
        const unlocked = state.buildings.some((b) => b.kind === 'habitat' && b.element === element);
        const price = HABITAT_EGG_PRICE[element];
        const odds = habitatEggOdds(element);
        const times = odds.map((o) => o.species.hatchSeconds * 1000);
        return (
          <button
            key={element}
            className="habitat-egg"
            data-tour={`egg-${element}`}
            style={{ '--el': ELEMENTS[element].color } as React.CSSProperties}
            disabled={!unlocked || full || state.gold < price}
            onClick={() => onBuy(element)}
            title={unlocked ? undefined : `Deblochează lumea de ${ELEMENTS[element].name}`}
          >
            <EggIcon element={element} />
            <strong>
              {ELEMENTS[element].icon} Ou de {ELEMENTS[element].name.toLowerCase()}
            </strong>
            <span className="habitat-egg-odds">
              {odds.map((o) => (
                <span key={o.species.id} title={`${o.species.name} · ${Math.round(o.pct)}%`}>
                  <DinoThumb
                    species={o.species.id}
                    hidden={!state.discovered.includes(o.species.id)}
                    className="small"
                    lazy
                  />
                  <small>{Math.round(o.pct)}%</small>
                </span>
              ))}
            </span>
            <span className="muted">
              ⏱ {formatTime(Math.min(...times))}–{formatTime(Math.max(...times))}
            </span>
            <span>
              {!unlocked
                ? '🔒 Lume blocată'
                : full
                  ? 'Incubator plin'
                  : state.gold < price
                    ? `🪙 ${price} · lipsesc ${price - state.gold}`
                    : `🪙 ${price}`}
            </span>
            {unlocked && full && <small className="muted">Eclozează un ou din Incubator ca să faci loc</small>}
            {!unlocked && <small className="muted">Deblocheaz-o din Extinde → Lumi</small>}
          </button>
        );
      })}
    </div>
  );
}
