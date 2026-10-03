// Piese mici, reutilizabile: tipuri, bare, modale, obiecte.

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ITEMS, TYPES, type DinoType, type ItemId } from '@shared/game';
import { focusDragons } from '../dragon-lab/engine';
import { ItemArt } from './AssetIcon';

export function TypeBadge({ type, small }: { type: DinoType; small?: boolean }) {
  const t = TYPES[type];
  return (
    <span className={`type-badge${small ? ' small' : ''}`} style={{ background: t.color }}>
      {t.icon} {t.name}
    </span>
  );
}

export function Bar({ value, max, color, label, thin }: { value: number; max: number; color?: string; label?: ReactNode; thin?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Hearts({ bond }: { bond: number }) {
  const full = Math.round(bond / 20);
  return (
    <span className="hearts" title={`Atașament ${bond}/100`} aria-label={`Atașament ${bond} din 100`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'on' : 'off'}>
          ♥
        </span>
      ))}
    </span>
  );
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n} din ${max} stele`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ItemChip({ item, qty, have }: { item: ItemId; qty?: number; have?: number }) {
  const def = ITEMS[item];
  const short = have !== undefined && qty !== undefined && have < qty;
  return (
    <span className={`item-chip${short ? ' short' : ''}`} title={def.blurb}>
      <span className="item-icon"><ItemArt item={item} /></span>
      {qty !== undefined && <b>{have !== undefined ? `${have}/${qty}` : `×${qty}`}</b>}
      <span className="item-name">{def.name}</span>
    </span>
  );
}

export function Modal({ children, onClose, wide, className }: { children: ReactNode; onClose?: () => void; wide?: boolean; className?: string }) {
  // Cât e deschis, dragonii animați din spatele lui nu se mai randează (doar cei din modal).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => focusDragons(box.current!), []);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={box} className={`modal${wide ? ' wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Antetul unui tab: ce e locul acesta, ce faci aici și cifrele cheie, la vedere. */
export function PageHeader({
  icon,
  title,
  subtitle,
  stats,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  stats?: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'gold' }[];
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <span className="page-head-icon">{icon}</span>
      <div className="page-head-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {(stats?.length || actions) && (
        <div className="page-head-side">
          {stats?.map((s) => (
            <span key={s.label} className={`page-stat${s.tone ? ` ${s.tone}` : ''}`}>
              <b>{s.value}</b>
              <small>{s.label}</small>
            </span>
          ))}
          {actions}
        </div>
      )}
    </header>
  );
}

export function Panel({ title, icon, children, right, className }: { title?: ReactNode; icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {title && (
        <header className="panel-head">
          <h2>
            {icon && <span className="panel-icon">{icon}</span>}
            {title}
          </h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** Saurok, ultimul Spinosaurus: bătrân, cu cicatrici, făurarul lamelor străvechi. Ghidul jucătorului. */
export function Saurok({ size = 64 }: { size?: number }) {
  return <img className="guide saurok-portrait" src="/art/characters/saurok.png" width={size} height={size} alt="Saurok, ghidul și făurarul cuibului" />;
}

/** Scântei care urcă: pentru ouă gata, eclozări, evoluții. */
export function Sparkles({ count = 10, color = '#ffe98a' }: { count?: number; color?: string }) {
  return (
    <span className="sparkle-field" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i * 0.37) % 2.2}s`, background: color, color }}
        />
      ))}
    </span>
  );
}
