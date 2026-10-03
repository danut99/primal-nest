// Creaturile, static: imaginea de repaus a dragonului speciei (public/dragons/stills, din `npm run stills`),
// cu fața spre dreapta. Viewbox 100×100, picioarele pe y≈90. Pentru dragonul animat, vezi DinoLive.
// Mărimea crește cu stadiul; lumina din spate are culoarea tipului.

import { useId } from 'react';
import { RELICS, SPECIES, TYPES } from '@shared/game';
import { speciesStill } from '../content/dragons';

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
  /** Altă imagine în locul speciei (de ex. bossul unei regiuni). */
  art?: string;
}

/** Imaginile sunt decupate strâns: puii se micșorează, adulții umplu cadrul. */
const STAGE_SCALE = { pui: 0.78, juvenil: 0.9, adult: 1 } as const;

export function DinoSprite({ speciesId, albino, size = 96, flip, silhouette, className, title, aura = true, shadowed, relic, art }: Props) {
  const uid = useId().replace(/:/g, '');
  const species = SPECIES[speciesId];
  if (!species) return null;
  const src = art ?? speciesStill(speciesId);
  const stage = species.stage;
  const scale = art ? 1 : STAGE_SCALE[stage];
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
      <g transform={`translate(50 92) scale(${flip ? -scale : scale} ${scale}) translate(-50 -92)`}>
        <image href={src} x="-8" y="-6" width="116" height="98" preserveAspectRatio="xMidYMax meet" style={{ filter }} />
      </g>
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
  const uid = useId().replace(/:/g, '');
  const r = RELICS[relic];
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={`relicglow-${uid}`}>
          <stop offset="0" stopColor={r.color} stopOpacity=".75" />
          <stop offset="1" stopColor={r.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="20" fill={`url(#relicglow-${uid})`} />
      <image className="relic-float" href={`/art/relics/${relic}.png`} x="-22" y="-22" width="44" height="44" preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}
