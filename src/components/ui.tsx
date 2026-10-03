// Piese mici, reutilizabile: tipuri, bare, modale, obiecte.

import { useEffect, useMemo, type ReactNode } from 'react';
import { ITEMS, TYPES, type DinoType, type ItemId } from '@shared/game';

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
      <span className="item-icon">{def.icon}</span>
      {qty !== undefined && <b>{have !== undefined ? `${have}/${qty}` : `×${qty}`}</b>}
      <span className="item-name">{def.name}</span>
    </span>
  );
}

export function Modal({ children, onClose, wide, className }: { children: ReactNode; onClose?: () => void; wide?: boolean; className?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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

export function Panel({ title, icon, children, right, className }: { title?: ReactNode; icon?: string; children: ReactNode; right?: ReactNode; className?: string }) {
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
  return (
    <svg className="guide" width={size} height={size} viewBox="0 0 64 64" aria-label="Saurok" role="img">
      <defs>
        <radialGradient id="saurok-bg" cx=".35" cy=".4">
          <stop offset="0" stopColor="#5a2a12" />
          <stop offset="1" stopColor="#140b08" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#saurok-bg)" stroke="#ff9a3c" strokeWidth="2" />
      <path d="M14 34 L16 12 L20 26 L24 8 L28 24 L32 6 L35 24 L40 12 L41 30 Z" fill="#3b2a22" stroke="#ff8a2a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 32 L16 13 M24 30 L24 10 M32 28 L32 8" stroke="#ff6a1a" strokeWidth=".8" opacity=".6" />
      <path d="M12 46 Q12 32 26 30 Q40 28 50 34 L60 38 Q61 41 58 42 L44 44 Q40 50 30 52 Q16 54 12 46 Z" fill="#55636b" stroke="#12181c" strokeWidth="2" strokeLinejoin="round" />
      <path d="M44 44 L58 42" stroke="#12181c" strokeWidth="1.6" />
      <path d="M47 43.6 l1 2 l1.2 -2 M52 43 l1 2 l1.2 -2" fill="#efe6d2" stroke="none" />
      <ellipse cx="34" cy="36" rx="4" ry="3" fill="#ffb02e" className="guide-eye" />
      <ellipse cx="34.6" cy="36" rx="1.1" ry="2.6" fill="#1a0a04" />
      <path d="M29 30 L40 41" stroke="#c9a28a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30.5 32 l2 -1 M33.5 35 l2 -1 M36.5 38 l2 -1" stroke="#c9a28a" strokeWidth="1.2" />
      <path d="M18 44 q6 3 14 1" stroke="#3a464c" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

/** Cerul nopții cu aurora, stele și licurici. Stă în spatele întregului joc. */
export function Sky() {
  const flies = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        delay: (i * 0.73) % 9,
        dur: 7 + ((i * 1.7) % 6),
        size: 3 + (i % 3) * 2,
        hue: i % 4 === 0 ? '#ffe98a' : i % 4 === 1 ? '#9ff7c8' : i % 4 === 2 ? '#a9e4ff' : '#f6c1ff',
      })),
    [],
  );
  return (
    <div className="sky" aria-hidden="true">
      <div className="starfield" />
      <div className="aurora a1" />
      <div className="aurora a2" />
      <div className="aurora a3" />
      {flies.map((f, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            background: f.hue,
            color: f.hue,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.dur}s`,
          }}
        />
      ))}
      <div className="horizon" />
    </div>
  );
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
