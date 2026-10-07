import { ThemeText } from '../components/ThemeText';
// Un dragon din laborator, ca componentă React: îl folosesc jocul (DinoLive, BossLive) și editorul.
// Stă separat de editor, ca jocul să nu încarce laboratorul întreg.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sourceKey } from '../dragons/runtime';
import { createLabDragon, type DragonRecipe, type LabController } from './engine';

export interface LabDragonProps {
  recipe: DragonRecipe;
  animation?: string;
  paused?: boolean;
  background?: string;
  /** Camera fixă pe corpul dragonului (vezi LabOptions.fixedViewport). */
  fixedViewport?: boolean | string[];
  /** Camera urmărește corpul dragonului de la o animație la alta (vezi LabOptions.follow). */
  follow?: boolean;
  /** Marginile din jurul dragonului (vezi LabOptions.pad). */
  pad?: { top: number; bottom: number; left: number; right: number };
  className?: string;
  style?: CSSProperties;
  onReady?: (dragon: LabController) => void;
}

/** Un dragon din laborator. Rețeta se poate schimba live; doar schimbarea bazei îl reîncarcă. */
export function LabDragon({
  recipe,
  animation,
  paused = false,
  background = '#00000000',
  fixedViewport,
  follow,
  pad,
  className,
  style,
  onReady,
}: LabDragonProps) {
  const host = useRef<HTMLDivElement>(null);
  const dragon = useRef<LabController | null>(null);
  const latest = useRef({ recipe, animation, paused, background, fixedViewport, follow, pad, onReady });
  latest.current = { recipe, animation, paused, background, fixedViewport, follow, pad, onReady };
  const [status, setStatus] = useState('loading');
  const key = sourceKey(recipe.base) + JSON.stringify(recipe.borrow ?? null);

  useEffect(() => {
    const abort = new AbortController();
    setStatus('loading');
    const l = latest.current;
    createLabDragon(
      host.current!,
      l.recipe,
      {
        animation: l.animation,
        paused: l.paused,
        background: l.background,
        fixedViewport: l.fixedViewport,
        follow: l.follow,
        pad: l.pad,
      },
      abort.signal,
    )
      .then((d) => {
        dragon.current = d;
        setStatus('ready');
        latest.current.onReady?.(d);
      })
      .catch((e: Error) => !abort.signal.aborted && setStatus(e.message || 'Dragonul nu a putut fi încărcat.'));
    return () => {
      abort.abort();
      dragon.current?.dispose();
      dragon.current = null;
    };
  }, [key]);

  useEffect(() => dragon.current?.setRecipe(recipe), [recipe]);
  useEffect(() => void (animation && dragon.current?.setAnimation(animation)), [animation]);
  useEffect(() => dragon.current?.setPaused(paused), [paused]);

  return (
    <div className={`dragon-player ${className ?? ''}`} style={{ background, ...style }}>
      {/* Ascuns cât se încarcă: altfel se vede ecranul de încărcare Spine (un pătrat negru). */}
      <div ref={host} className={`dragon-player-surface lab-fade${status === 'ready' ? ' ready' : ''}`} />
      {status === 'loading' && <div className="dragon-player-message">Se încarcă dragonul…</div>}
      {status !== 'loading' && status !== 'ready' && <div className="dragon-player-message error-text"><ThemeText>{status}</ThemeText></div>}
    </div>
  );
}
