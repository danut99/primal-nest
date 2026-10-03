// Creaturile: imaginile generate din art/turntables (patru corpuri: sauropod, theropod, ankylosaur,
// pterosaur), poza 3/4 cu fața spre dreapta. Viewbox 100×100, picioarele pe y≈90.
// Mărimea crește cu stadiul; lumina din spate are culoarea tipului.

import { useId } from 'react';
import { RELICS, SPECIES, TYPES } from '@shared/game';
import { turntableFor } from '../content/turntables';

interface Props {
  speciesId: string;
  albino?: boolean;
  size?: number;
  flip?: boolean;
  silhouette?: boolean;
  className?: string;
  title?: string;
  /** Aura luminoasă în culoarea tipului (implicit pornită). */
  aura?: boolean;
  /** Atins de Umbră: ceață violetă, culori stinse (inamicii din lupte). */
  shadowed?: boolean;
  /** Relicva purtată: plutește lângă creatură și strălucește. */
  relic?: string;
}

/** Imaginile sunt decupate strâns: puii se micșorează, adulții umplu cadrul. */
const STAGE_SCALE = { pui: 0.78, juvenil: 0.9, adult: 1 } as const;

export function DinoSprite({ speciesId, albino, size = 96, flip, silhouette, className, title, aura = true, shadowed, relic }: Props) {
  const uid = useId().replace(/:/g, '');
  const species = SPECIES[speciesId];
  if (!species) return null;
  const art = turntableFor(speciesId)?.still;
  const stage = species.stage;
  const scale = STAGE_SCALE[stage];
  // Lumina creaturii: culoarea tipului, violet pentru Umbră, alb-roz pentru albino.
  const glow = shadowed ? '#9b5cff' : albino ? '#ffd6e4' : TYPES[species.types[0]].color;
  const lit = aura && !silhouette;
  // Fără drop-shadow: e scump la redesenare. Strălucirea vine din aura în gradient.
  const filter = silhouette
    ? 'brightness(0) opacity(.75)'
    : albino
      ? 'saturate(0) brightness(1.55) sepia(.15) hue-rotate(300deg)'
      : shadowed
        ? 'saturate(.7) brightness(.85)'
        : undefined;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? species.name}
      style={{ overflow: 'visible' }}
    >
      {lit && (
        <defs>
          <radialGradient id={`aura${uid}`}>
            <stop offset="0" stopColor={glow} stopOpacity={shadowed ? 0.55 : 0.5} />
            <stop offset="0.55" stopColor={glow} stopOpacity="0.16" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`pool${uid}`}>
            <stop offset="0" stopColor={shadowed ? '#2a0f4a' : '#fff6c8'} stopOpacity="0.75" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {lit && <ellipse className="dino-aura" cx="50" cy="60" rx="50" ry="44" fill={`url(#aura${uid})`} />}
      {lit ? (
        <ellipse cx="50" cy="91" rx={36 * scale} ry="6" fill={`url(#pool${uid})`} />
      ) : (
        <ellipse cx="50" cy="91" rx={30 * scale} ry="4" fill="rgba(0,0,0,.25)" />
      )}
      {art && (
        <g transform={`translate(50 92) scale(${flip ? -scale : scale} ${scale}) translate(-50 -92)`}>
          <image href={art} x="-8" y="-6" width="116" height="98" preserveAspectRatio="xMidYMax meet" style={{ filter }} />
        </g>
      )}
      {relic && RELICS[relic] && !silhouette && <RelicArt relic={relic} x={flip ? 12 : 88} y={stage === 'pui' ? 40 : 26} />}
      {shadowed && (
        <g className="umbra-wisps" fill="#7b3fe4" opacity=".5">
          <ellipse cx="22" cy="82" rx="14" ry="5" />
          <ellipse cx="74" cy="84" rx="16" ry="5" />
          <ellipse cx="50" cy="88" rx="22" ry="5" />
        </g>
      )}
    </svg>
  );
}

function RelicArt({ relic, x, y }: { relic: string; x: number; y: number }) {
  const r = RELICS[relic];
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="20" fill={`url(#relicglow-${relic})`} />
      <defs>
        <radialGradient id={`relicglow-${relic}`}>
          <stop offset="0" stopColor={r.color} stopOpacity=".75" />
          <stop offset="1" stopColor={r.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="relic-float" stroke="#1a1208" strokeWidth="1.6" strokeLinejoin="round">
        {relic === 'colti_licurici' && (
          <>
            <path d="M-8 -12 Q-14 0 -6 12 Q-6 0 -3 -10 Z" fill={r.color} />
            <path d="M4 -12 Q-2 0 6 12 Q6 0 9 -10 Z" fill={r.color} />
          </>
        )}
        {relic === 'lama_junglei' && (
          <>
            <path d="M0 -20 L5 -6 L3 10 L-3 10 L-5 -6 Z" fill={r.color} />
            <path d="M0 -17 L0 8" stroke="#eafff4" strokeWidth="1" />
            <rect x="-8" y="10" width="16" height="3.5" rx="1.5" fill="#6b4a26" />
            <rect x="-2" y="13.5" width="4" height="8" rx="1.5" fill="#3b2a1a" />
          </>
        )}
        {relic === 'coroana_vulcanului' && (
          <>
            <path d="M-12 6 L-12 -8 L-6 -2 L0 -12 L6 -2 L12 -8 L12 6 Z" fill={r.color} />
            <circle cx="0" cy="0" r="2.6" fill="#ff4a2a" />
            <circle cx="-7" cy="2" r="1.6" fill="#ffe7a8" />
            <circle cx="7" cy="2" r="1.6" fill="#ffe7a8" />
          </>
        )}
      </g>
    </g>
  );
}
