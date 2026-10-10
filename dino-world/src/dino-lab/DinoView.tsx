// <DinoView recipe={...} />: un dinozaur animat, după rețetă. Rețeta se poate schimba live.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createDino, type DinoController, type DinoOptions, type DinoRecipe } from './engine';

interface Props extends DinoOptions {
  recipe: DinoRecipe;
  className?: string;
  style?: CSSProperties;
  onReady?: (dino: DinoController) => void;
  /** Atingerea pornește atacul (o dată); atingerile alternează mușcătura și ultimata. */
  tapToAttack?: boolean;
}

export function DinoView({ recipe, className = '', style, onReady, tapToAttack, ...opts }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const dino = useRef<DinoController | null>(null);
  const latest = useRef({ recipe, onReady, opts });
  latest.current = { recipe, onReady, opts };
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const taps = useRef(0);
  const tap = () => {
    const d = dino.current;
    if (!d) return;
    const move = taps.current++ % 2 && d.animations.includes('ultimate') ? 'ultimate' : 'attack';
    d.playOnce(move);
  };

  // Scheletul se încarcă o singură dată pe schelet; restul rețetei se aplică live.
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setReady(false);
    createDino(host.current!, latest.current.recipe, latest.current.opts, abort.signal)
      .then((d) => {
        dino.current = d;
        d.setRecipe(latest.current.recipe);
        latest.current.onReady?.(d);
        // apare cu fade după primul cadru desenat, nu ca un canvas gol
        requestAnimationFrame(() => requestAnimationFrame(() => !abort.signal.aborted && setReady(true)));
      })
      .catch((e) => !abort.signal.aborted && setError(String(e?.message ?? e)));
    return () => {
      abort.abort();
      dino.current?.dispose();
      dino.current = null;
    };
  }, [recipe.base.rig]);

  useEffect(() => dino.current?.setRecipe(recipe), [recipe]);
  useEffect(() => {
    if (opts.animation) dino.current?.setAnimation(opts.animation);
  }, [opts.animation]);

  return (
    <div
      ref={host}
      className={`dino-view ${ready ? 'ready' : ''} ${className}`}
      style={style}
      onClick={tapToAttack ? tap : undefined}
    >
      {error && <span className="dino-error">{error}</span>}
    </div>
  );
}
