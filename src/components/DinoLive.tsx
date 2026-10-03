// Dinozaurul viu: dragonul animat al speciei (Spine), în repaus, cu aura tipului. Înlocuiește rotirea 360°.
// Atingerea îl face să joace o animație (zbor, atac, evoluție), apoi revine la repaus.
// BossLive: bossul unei regiuni, care respiră (cardurile din Expediții); ultimata lui se vede în luptă.

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { SPECIES, TYPES } from '@shared/game';
import { bossRecipe, bossStill as bossStillOf, speciesRecipe } from '../content/dragons';
import { LabDragon } from '../dragon-lab/LabDragon';
import type { LabController } from '../dragon-lab/engine';
import { DinoSprite } from './DinoSprite';

const STAGE_SCALE = { pui: 0.8, juvenil: 0.9, adult: 1 } as const;
/** Ce animații joacă la atingere, pe rând. */
const TRICKS = ['fly', 'attack', 'special1', 'levelup'];

function calm(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DinoLive({
  speciesId,
  albino,
  size = 180,
  className,
  intro,
  cheer = 0,
}: {
  speciesId: string;
  albino?: boolean;
  size?: number;
  className?: string;
  /** Animația jucată o dată la apariție (de ex. „levelup” la evoluție), apoi repaus. */
  intro?: string;
  /** Crește la fiecare hrănire: dragonul se bucură (fără să fie reîncărcat). */
  cheer?: number;
}) {
  const recipe = useMemo(() => speciesRecipe(speciesId, albino), [speciesId, albino]);
  const dragon = useRef<LabController | null>(null);
  const trick = useRef(0);
  const [still] = useState(calm);
  useEffect(() => {
    const d = dragon.current;
    if (!cheer || !d) return;
    d.playOnce(d.animations.includes('levelup') ? 'levelup' : d.animations[0]);
  }, [cheer]);
  if (still) return <DinoSprite speciesId={speciesId} albino={albino} size={size} className={className} />;

  const s = SPECIES[speciesId];
  const glow = albino ? '#ffd6e4' : TYPES[s.types[0]].color;
  const style = {
    width: size,
    height: size,
    ['--glow' as string]: glow,
    ['--tt-scale' as string]: STAGE_SCALE[s.stage],
  } as CSSProperties;
  const poke = () => {
    const d = dragon.current;
    if (!d) return;
    const names = TRICKS.filter((t) => d.animations.includes(t));
    if (names.length) d.playOnce(names[trick.current++ % names.length]);
  };

  return (
    <div
      className={`turntable dino-live${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={`${s.name}, atinge-l ca să se miște`}
      title="Atinge-l"
      onPointerDown={poke}
    >
      <span className="turntable-aura" />
      <span className="turntable-pool" />
      <span className="turntable-body">
        <LabDragon
          recipe={recipe}
          follow
          onReady={(d) => {
            dragon.current = d;
            if (intro) d.playOnce(intro);
          }}
        />
      </span>
    </div>
  );
}

/** Bossul regiunii, animat: respiră în buclă, încadrat strâns. Cu grafică redusă, imaginea statică. */
export function BossLive({ zoneId, speciesId, className }: { zoneId: string; speciesId: string; className?: string }) {
  const recipe = useMemo(() => ({ ...bossRecipe(zoneId), motion: { flip: true } }), [zoneId]);
  const [still] = useState(calm);
  if (still)
    return <DinoSprite speciesId={speciesId} art={bossStillOf(zoneId)} size={150} flip className={className} />;
  return (
    <div className={`boss-live${className ? ` ${className}` : ''}`} role="img" aria-label={recipe.name}>
      {/* Camera stă strâns pe corpul bossului în respirație: e mare și se vede întreg. */}
      <LabDragon recipe={recipe} animation="breathe" fixedViewport={['breathe']} />
    </div>
  );
}
