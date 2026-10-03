// Dinozaurul în 360°: se rotește încet singur, iar cu mouse-ul sau degetul îl rotești tu.
// Toate cele 8 unghiuri stau într-o singură imagine (o încărcare, o decodare); fiecare unghi e un strat,
// iar trecerea dintre unghiuri e o estompare de opacitate (ieftină, pe GPU). Fără imagini, cade pe DinoSprite.

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { SPECIES, TYPES } from '@shared/game';
import { STILL_FRAME, TURNTABLE_FRAMES, turntableFor } from '../content/turntables';
import { DinoSprite } from './DinoSprite';

/** Cât stă pe fiecare unghi la rotirea automată. */
const SPIN_MS = 650;
/** Câți pixeli de tragere înseamnă un unghi. */
const DRAG_PX = 28;
/** După ce lași dinozaurul din mână, rotirea automată reîncepe după atât. */
const RESUME_MS = 2500;

const STAGE_SCALE = { pui: 0.78, juvenil: 0.9, adult: 1 } as const;

function calm(): boolean {
  return document.documentElement.classList.contains('low-fx') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DinoTurntable({ speciesId, albino, size = 180, className }: { speciesId: string; albino?: boolean; size?: number; className?: string }) {
  const tt = turntableFor(speciesId);
  const [frame, setFrame] = useState(STILL_FRAME);
  const [held, setHeld] = useState(false);
  const drag = useRef<{ x: number; frame: number } | null>(null);
  const resumeAt = useRef(0);

  useEffect(() => {
    if (!tt || calm()) return;
    const id = setInterval(() => {
      if (drag.current || Date.now() < resumeAt.current || document.hidden) return;
      setFrame((f) => (f + 1) % TURNTABLE_FRAMES);
    }, SPIN_MS);
    return () => clearInterval(id);
  }, [tt]);

  if (!tt) return <DinoSprite speciesId={speciesId} albino={albino} size={size} className={className} />;

  const glow = albino ? '#ffd6e4' : TYPES[SPECIES[speciesId].types[0]].color;
  const style = {
    width: size,
    height: size,
    ['--glow' as string]: glow,
    ['--tt-scale' as string]: STAGE_SCALE[tt.stage],
  } as CSSProperties;

  return (
    <div
      className={`turntable${held ? ' held' : ''}${albino ? ' albino' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={`${SPECIES[speciesId].name}, rotește-l trăgând stânga-dreapta`}
      title="Trage stânga-dreapta ca să-l rotești"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, frame };
        setHeld(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const steps = Math.round((e.clientX - drag.current.x) / DRAG_PX);
        setFrame((((drag.current.frame - steps) % TURNTABLE_FRAMES) + TURNTABLE_FRAMES) % TURNTABLE_FRAMES);
      }}
      onPointerUp={() => {
        drag.current = null;
        resumeAt.current = Date.now() + RESUME_MS;
        setHeld(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setHeld(false);
      }}
    >
      <span className="turntable-aura" />
      <span className="turntable-pool" />
      <span className="turntable-body">
        {Array.from({ length: TURNTABLE_FRAMES }, (_, i) => (
          <span
            key={i}
            className={`turntable-frame${i === frame ? ' on' : ''}`}
            style={{ backgroundImage: `url(${tt.strip})`, backgroundPosition: `${(i * 100) / (TURNTABLE_FRAMES - 1)}% 0` }}
          />
        ))}
      </span>
      <span className="turntable-hint">⟲ 360°</span>
    </div>
  );
}
