// Piese mici de interfață, comune ecranelor.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ELEMENTS, RARITIES, type ElementId, type EvolutionStage, type Rarity } from '@shared/game';
import { recipeFor } from '../dino-lab/recipes';
import { readyThumbnail, thumbnail, thumbnailBounds } from '../dino-lab/thumbnails';
import type { DinoRecipe } from '../dino-lab/engine';
import { useNav, type NavTarget } from './nav';

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export const formatNumber = (n: number) => Math.floor(n).toLocaleString('ro-RO');

export function Modal({
  title,
  onClose,
  children,
  wide,
  className = '',
  bare,
  corner,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  /** Fără antet și fără corp: conținutul își face singur așezarea (rămâne doar butonul de închidere). */
  bare?: boolean;
  /** Fără antet: butoane puse în colț, chiar lângă ✕ (ex. „Mută”). */
  corner?: ReactNode;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal ${wide ? 'wide' : ''} ${bare ? 'bare' : ''} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {bare ? (
          <>
            <div className="modal-corner">
              {corner}
              <button className="corner-button close" onClick={onClose} aria-label="Închide">
                ✕
              </button>
            </div>
            {children}
          </>
        ) : (
          <>
            <header className="modal-head">
              <h2>{title}</h2>
              <button className="icon-button" onClick={onClose} aria-label="Închide">
                ✕
              </button>
            </header>
            <div className="modal-body">{children}</div>
          </>
        )}
      </section>
    </div>
  );
}

export function ElementBadge({ element }: { element: ElementId }) {
  const e = ELEMENTS[element];
  return (
    <span className="element-badge" style={{ '--el': e.color } as React.CSSProperties} title={e.name}>
      {e.icon} {e.name}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const r = RARITIES[rarity];
  return (
    <span className="rarity-badge" style={{ color: r.color }}>
      {r.name}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** URL-ul miniaturii (PNG) unei rețete; gol cât se desenează. */
export function useThumbnail(recipe: DinoRecipe, size = 256, enabled = true): string | undefined {
  const ready = enabled ? readyThumbnail(recipe, size) : undefined;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!enabled || ready) return;
    let live = true;
    thumbnail(recipe, size)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [recipe, size, enabled, ready]);
  return ready ?? url;
}

/** Imagine statică a speciei (din generator). `hidden` = siluetă, pentru speciile nedescoperite. */
export function DinoThumb({
  species,
  hidden,
  stage,
  lazy = false,
  tight = false,
  className = '',
}: {
  species: string;
  hidden?: boolean;
  stage?: EvolutionStage;
  lazy?: boolean;
  tight?: boolean;
  className?: string;
}) {
  const recipe = useMemo(() => recipeFor(species, stage), [species, stage]);
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [lazy, visible]);
  const url = useThumbnail(recipe, 256, !lazy || visible);
  const bounds = tight ? thumbnailBounds(recipe) : undefined;
  return (
    <span ref={host} className={`dino-thumb ${hidden ? 'silhouette' : ''} ${className}`}>
      {url ? (
        bounds ? (
          <svg
            className="dino-thumb-cropped"
            viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
            aria-hidden="true"
          >
            <image href={url} width={bounds.imageWidth} height={bounds.imageHeight} />
          </svg>
        ) : (
          <img src={url} alt="" draggable={false} />
        )
      ) : (
        <span className="dino-thumb-wait" />
      )}
    </span>
  );
}

/** Sub un buton stins: ce lipsește (roșu) și de unde se obține. */
export function Need({ what, how, go }: { what: ReactNode; how?: ReactNode; go?: NavTarget }) {
  const nav = useNav();
  return (
    <p className="need">
      <strong>{what}</strong>
      {how && <small>{how}</small>}
      {go && (
        <button type="button" className="need-go" onClick={() => nav(go)}>
          Du-mă acolo →
        </button>
      )}
    </p>
  );
}
