// Componenta React pentru un dragon animat (Spine). Folosire:
//   <DragonPlayer source={{ model: 'nerion', stage: 'adult' }} animation="fly" />
//   <DragonPlayer source={{ archive: 'basic_2725_dragon_polargeneral_3_HD_spine-3-8-59_dxt5.zip' }} />

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createDragon, sourceKey, type DragonController, type DragonOptions, type DragonSource } from './runtime';

export interface DragonPlayerProps extends DragonOptions {
  source: DragonSource;
  className?: string;
  style?: CSSProperties;
  /** Primește controller-ul după încărcare (lista de animații, snapshot PNG etc.). */
  onReady?: (dragon: DragonController) => void;
}

export function DragonPlayer({
  source,
  animation = 'breathe',
  speed = 1,
  paused = false,
  background = '#101e30',
  zoom = 1,
  framing = 'animation',
  className,
  style,
  onReady,
}: DragonPlayerProps) {
  const host = useRef<HTMLDivElement>(null);
  const dragon = useRef<DragonController | null>(null);
  const latest = useRef({ animation, speed, paused, background, zoom, framing, onReady });
  latest.current = { animation, speed, paused, background, zoom, framing, onReady };
  const [status, setStatus] = useState<'loading' | 'ready' | string>('loading');
  const key = sourceKey(source);

  useEffect(() => {
    const abort = new AbortController();
    setStatus('loading');
    createDragon(host.current!, source, latest.current, abort.signal)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => dragon.current?.setAnimation(animation), [animation]);
  useEffect(() => dragon.current?.setSpeed(speed), [speed]);
  useEffect(() => dragon.current?.setPaused(paused), [paused]);
  useEffect(() => dragon.current?.setBackground(background), [background]);
  useEffect(() => dragon.current?.setZoom(zoom), [zoom]);
  useEffect(() => dragon.current?.setFraming(framing), [framing]);

  return (
    <div className={`dragon-player ${className ?? ''}`} style={{ background, ...style }}>
      <div ref={host} className="dragon-player-surface" />
      {status === 'loading' && <div className="dragon-player-message">Se încarcă dragonul…</div>}
      {status !== 'loading' && status !== 'ready' && <div className="dragon-player-message error-text">{status}</div>}
    </div>
  );
}
