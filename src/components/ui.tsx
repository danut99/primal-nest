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

/** Peisaj preistoric la amurg: vulcan activ, creste cu palmieri, ceață și jar. Stă în spatele întregului joc. */
export function Sky() {
  const embers = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 37) % 100,
        top: 45 + ((i * 53) % 55),
        delay: (i * 0.73) % 9,
        dur: 8 + ((i * 1.7) % 6),
        size: 2 + (i % 3),
        hue: i % 3 === 0 ? '#ffd27a' : i % 3 === 1 ? '#ff9a3a' : '#ff6a1a',
      })),
    [],
  );
  return (
    <div className="sky" aria-hidden="true">
      <div className="sky-sun" />
      <svg className="sky-land" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="sky-crater" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffb347" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#ff6a1a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sky-smoke" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#3a2a2c" stopOpacity="0.85" />
            <stop offset="1" stopColor="#3a2a2c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sky-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b2228" />
            <stop offset="1" stopColor="#24161b" />
          </linearGradient>
          <linearGradient id="sky-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c86a3a" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c86a3a" stopOpacity="0.16" />
            <stop offset="1" stopColor="#c86a3a" stopOpacity="0" />
          </linearGradient>
          <symbol id="sky-palm" viewBox="0 0 100 200">
            <path d="M47 200 Q44 120 53 42 L58 42 Q51 120 57 200 Z" />
            <path d="M56 42 Q30 30 2 54 Q30 38 55 47 Z" />
            <path d="M56 42 Q82 26 100 50 Q78 36 57 47 Z" />
            <path d="M56 42 Q38 12 14 10 Q40 22 54 45 Z" />
            <path d="M56 42 Q72 10 94 16 Q70 24 58 45 Z" />
            <path d="M56 42 Q54 16 64 0 Q60 22 58 45 Z" />
          </symbol>
        </defs>

        {/* fum din vulcan */}
        <g className="sky-smoke">
          <ellipse cx="1120" cy="150" rx="70" ry="50" fill="url(#sky-smoke)" />
          <ellipse cx="1150" cy="95" rx="95" ry="60" fill="url(#sky-smoke)" />
          <ellipse cx="1195" cy="40" rx="130" ry="70" fill="url(#sky-smoke)" opacity="0.7" />
        </g>
        <ellipse className="sky-crater" cx="1112" cy="212" rx="90" ry="55" fill="url(#sky-crater)" />

        {/* munți îndepărtați + vulcanul */}
        <path
          fill="url(#sky-far)"
          d="M0 380 L120 330 L230 360 L340 300 L460 350 L560 320 L680 370 L820 340 L960 300 L1085 214 L1100 220 L1125 216 L1140 212 L1260 310 L1360 290 L1480 340 L1600 310 L1600 600 L0 600 Z"
        />
        <path className="sky-lava" fill="none" stroke="#ff7a1a" strokeWidth="2.5" strokeLinecap="round" d="M1108 220 Q1100 250 1080 275 Q1066 292 1050 300 M1128 218 Q1140 245 1162 262" />

        {/* ceață */}
        <rect className="sky-mist" x="-200" y="330" width="2000" height="110" fill="url(#sky-mist)" />

        {/* creasta din mijloc, cu palmieri */}
        <g fill="#1a1013">
          <path d="M0 450 Q140 410 280 435 T560 425 Q700 400 840 430 T1120 420 Q1280 395 1420 430 T1600 420 L1600 600 L0 600 Z" />
          <use href="#sky-palm" x="150" y="330" width="70" height="140" />
          <use href="#sky-palm" x="205" y="355" width="55" height="110" />
          <use href="#sky-palm" x="640" y="320" width="75" height="150" transform="scale(-1 1) translate(-1355 0)" />
          <use href="#sky-palm" x="980" y="340" width="60" height="120" />
          <use href="#sky-palm" x="1330" y="300" width="80" height="160" transform="scale(-1 1) translate(-2740 0)" />
          <use href="#sky-palm" x="1395" y="345" width="55" height="110" />
        </g>

        {/* prim-plan: pământ și ferigi */}
        <g fill="#0b0708">
          <path d="M0 520 Q200 490 420 515 T860 505 Q1100 485 1300 510 T1600 500 L1600 600 L0 600 Z" />
          <path d="M0 600 L0 380 Q30 430 40 470 Q60 400 110 360 Q90 430 92 480 Q130 430 190 420 Q140 470 130 530 Q170 500 230 500 Q170 540 160 600 Z" />
          <path d="M1600 600 L1600 400 Q1570 440 1560 480 Q1540 410 1490 380 Q1510 440 1508 490 Q1470 450 1410 440 Q1460 480 1470 535 Q1430 510 1370 512 Q1430 545 1440 600 Z" />
        </g>
      </svg>
      {embers.map((f, i) => (
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
