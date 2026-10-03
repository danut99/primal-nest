// Oul: coaja după raritate, petele după tipul speciei (un indiciu, ca la Pokémon).
// Ouăle sunt luminoase: strălucesc din interior, mai tare cu cât sunt mai rare.
// Când sunt gata, crăpăturile lasă să iasă lumina.

import { useId } from 'react';
import { RARITIES, SPECIES, TYPES, type Egg } from '@shared/game';

interface Props {
  egg: Pick<Egg, 'rarity' | 'speciesId'>;
  size?: number;
  cracks?: 0 | 1 | 2;
  className?: string;
}

const SHAPE = 'M50 6 C74 6 88 46 88 64 C88 84 72 96 50 96 C28 96 12 84 12 64 C12 46 26 6 50 6 Z';
const HALO: Record<string, number> = { comun: 0.25, neobisnuit: 0.4, rar: 0.55, epic: 0.7, legendar: 0.9 };

export function EggSprite({ egg, size = 80, cracks = 0, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const r = RARITIES[egg.rarity];
  const type = SPECIES[egg.speciesId]?.types[0] ?? 'jungla';
  const spot = TYPES[type].color;
  const lightColor = cracks ? '#fff3a8' : r.spot;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Ou ${r.name}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`halo${uid}`}>
          <stop offset="0.35" stopColor={lightColor} stopOpacity={cracks ? 0.9 : HALO[egg.rarity]} />
          <stop offset="1" stopColor={lightColor} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`shell${uid}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor={r.shell} />
          <stop offset="1" stopColor={r.spot} stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={`inner${uid}`} cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#fffbe0" stopOpacity={cracks ? 0.95 : 0.5} />
          <stop offset="1" stopColor="#fffbe0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="egg-halo" cx="50" cy="58" rx="58" ry="58" fill={`url(#halo${uid})`} />
      <ellipse cx="50" cy="95" rx="30" ry="4" fill="rgba(0,0,0,.25)" />
      <path d={SHAPE} fill={`url(#shell${uid})`} stroke="#2b1d14" strokeWidth="3" />
      <g fill={spot} opacity=".85">
        <ellipse cx="36" cy="40" rx="7" ry="9" />
        <ellipse cx="62" cy="58" rx="9" ry="8" />
        <ellipse cx="40" cy="76" rx="6" ry="5" />
        <ellipse cx="66" cy="28" rx="4" ry="5" />
        <ellipse cx="24" cy="62" rx="4" ry="5" />
      </g>
      {egg.rarity !== 'comun' && <path d="M14 58 Q50 70 86 58" fill="none" stroke={r.spot} strokeWidth="5" opacity=".75" />}
      <path d={SHAPE} fill={`url(#inner${uid})`} stroke="none" className="egg-inner" />
      <ellipse cx="34" cy="24" rx="6" ry="10" fill="#fff" opacity=".7" transform="rotate(25 34 24)" />
      {cracks >= 1 && (
        <g fill="none" strokeLinejoin="round">
          <path d="M30 46 l8 6 l6 -8 l8 8 l6 -6 l8 6" stroke="#fff3a8" strokeWidth="6" opacity=".8" />
          <path d="M30 46 l8 6 l6 -8 l8 8 l6 -6 l8 6" stroke="#2b1d14" strokeWidth="2.4" />
        </g>
      )}
      {cracks >= 2 && (
        <g fill="none" strokeLinejoin="round">
          <path d="M50 52 l-4 10 l6 4 l-4 10" stroke="#fff3a8" strokeWidth="6" opacity=".8" />
          <path d="M50 52 l-4 10 l6 4 l-4 10" stroke="#2b1d14" strokeWidth="2.2" />
        </g>
      )}
    </svg>
  );
}
