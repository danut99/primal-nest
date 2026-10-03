// Coaja generată urmează tipul speciei; aura și sigiliul indică raritatea.
// Ouăle strălucesc din interior, mai tare cu cât sunt mai rare.
// Când sunt gata, crăpăturile lasă să iasă lumina.

import { useId } from 'react';
import { RARITIES, SPECIES, type Egg } from '@shared/game';

interface Props {
  egg: Pick<Egg, 'rarity' | 'speciesId'>;
  size?: number;
  cracks?: 0 | 1 | 2;
  className?: string;
}

const HALO: Record<string, number> = { comun: 0.25, neobisnuit: 0.4, rar: 0.55, epic: 0.7, legendar: 0.9 };

export function EggSprite({ egg, size = 80, cracks = 0, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const r = RARITIES[egg.rarity];
  const type = SPECIES[egg.speciesId]?.types[0] ?? 'jungla';
  const artwork = type === 'apa' ? 'aer' : type;
  const lightColor = cracks ? '#fff3a8' : r.spot;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Ou ${r.name}`} data-egg-type={type} data-rarity={egg.rarity} data-cracks={cracks} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`halo${uid}`}>
          <stop offset="0.35" stopColor={lightColor} stopOpacity={cracks ? 0.9 : HALO[egg.rarity]} />
          <stop offset="1" stopColor={lightColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="egg-halo" cx="50" cy="58" rx="58" ry="58" fill={`url(#halo${uid})`} />
      <ellipse cx="50" cy="95" rx="30" ry="4" fill="rgba(0,0,0,.25)" />
      <image href={`/art/eggs/${artwork}.png`} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
      <circle cx="50" cy="83" r={egg.rarity === 'legendar' ? 5 : 3.5} fill={r.spot} stroke={r.shell} strokeWidth="1.5" />
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
