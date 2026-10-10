// Arta clădirilor, în SVG izometric. Originea (0, 0) e centrul rombului de 2×2 pe sol; fiecare clădire
// stă pe o platformă înălțată. Pentru artă pictată: pune PNG-uri în public/world/<kind>-<element>.png
// și setează SPRITES mai jos — imaginea înlocuiește desenul vectorial.

import type { ReactNode } from 'react';
import type { ElementId } from '@shared/game';
import { DetailImage } from './DetailImage';
import { Bush, Mushroom, Pine, Rock, Tree } from './props';

/** Sprite-uri pictate opționale: cheia e `habitat-fire`, `farm`, `hatchery`, `den`. */
export const SPRITES: Record<
  string,
  { href: string; hd?: string; x: number; y: number; width: number; height: number }
> = Object.fromEntries(
  ['farm', 'hatchery', 'den', 'arena', 'outpost', 'forge'].map((kind) => [
    kind,
    {
      // 768 px implicit; HD (2048) doar când camera e foarte aproape (DetailContext)
      href: import.meta.env.BASE_URL + `world/${kind}-building.webp`,
      hd: import.meta.env.BASE_URL + `world/${kind}-building-hd.webp`,
      x: -140,
      y: -224,
      width: 280,
      height: 280,
    },
  ]),
);

const HWP = 86;
const HHP = 43;
const RAISE = 16;

function Platform({
  top,
  left,
  right,
  rim,
  children,
}: {
  top: string;
  left: string;
  right: string;
  rim?: string;
  children?: ReactNode;
}) {
  const t = `0,${-HHP - RAISE} ${HWP},${-RAISE} 0,${HHP - RAISE} ${-HWP},${-RAISE}`;
  return (
    <g>
      <ellipse cx={0} cy={10} rx={HWP + 10} ry={HHP + 6} fill="rgba(0,30,0,0.25)" />
      <polygon
        points={`${-HWP},${-RAISE} 0,${HHP - RAISE} 0,${HHP} ${-HWP},0`}
        fill={left}
        stroke={left}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${HHP - RAISE} ${HWP},${-RAISE} ${HWP},0 0,${HHP}`}
        fill={right}
        stroke={right}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <polygon points={t} fill={top} stroke={rim ?? top} strokeWidth={8} strokeLinejoin="round" />
      {children}
    </g>
  );
}

/** O formă de romb mai mică, pe platformă (lac, cuptor de lavă etc.). */
const inner = (k: number, dy = 0) =>
  `0,${-HHP * k - RAISE + dy} ${HWP * k},${-RAISE + dy} 0,${HHP * k - RAISE + dy} ${-HWP * k},${-RAISE + dy}`;

// ---------- habitate ----------

function FireHabitat() {
  return (
    <Platform top="#4a3530" left="#2e201d" right="#1f1513" rim="#5e4339">
      {/* vulcanul din spate */}
      <g transform="translate(-6,-62)">
        <path d="M-58,30 L-16,-34 L16,-34 L58,30 Z" fill="#3b2b28" />
        <path d="M-16,-34 L16,-34 L58,30 L18,30 Z" fill="#2a1d1b" />
        <path d="M-16,-34 L16,-34 L10,-26 L-10,-26 Z" fill="#ff7a1a" />
        <path d="M-6,-30 L-12,0 L-4,4 L0,-10 L6,12 L10,-28 Z" fill="#ff8f2a" className="lava-glow" />
        <circle cx={-4} cy={-48} r={10} fill="#6d6d6d" opacity={0.6} className="smoke" />
        <circle cx={6} cy={-60} r={13} fill="#7d7d7d" opacity={0.45} className="smoke delay" />
      </g>
      {/* lacul de lavă */}
      <polygon
        points={inner(0.42, 10)}
        fill="#ff6a00"
        stroke="#3b2b28"
        strokeWidth={8}
        strokeLinejoin="round"
        transform="translate(20,0)"
      />
      <polygon points={inner(0.26, 10)} fill="#ffc23d" className="lava-glow" transform="translate(20,0)" />
      {/* stânci zimțate */}
      <path d="M-74,-10 L-62,-44 L-50,-14 Z" fill="#2a1d1b" />
      <path d="M-62,-44 L-50,-14 L-56,-14 Z" fill="#ff7a1a" opacity={0.7} />
      <path d="M56,-6 L66,-36 L78,-8 Z" fill="#2a1d1b" />
      <path d="M-30,24 L-22,4 L-12,22 Z" fill="#34241f" />
      <path d="M-44,8 l20,-2 M-40,14 l10,8" stroke="#ff8f2a" strokeWidth={3} strokeLinecap="round" />
    </Platform>
  );
}

function WaterHabitat() {
  return (
    <Platform top="#e9d59c" left="#b89a5a" right="#9c7f45" rim="#f3e3b4">
      <polygon points={inner(0.66, 4)} fill="#2f8fd8" stroke="#8fd3f0" strokeWidth={6} strokeLinejoin="round" />
      <polygon points={inner(0.48, 6)} fill="#47b0ec" />
      <ellipse cx={-10} cy={-10} rx={22} ry={10} fill="none" stroke="#d6f3ff" strokeWidth={2} className="ripple" />
      <ellipse cx={24} cy={0} rx={16} ry={7} fill="none" stroke="#d6f3ff" strokeWidth={2} className="ripple delay" />
      {/* nuferi */}
      <path d="M-34,6 a10,5 0 1,0 12,-4 l-6,2 Z" fill="#5cb85c" />
      <path d="M28,-26 a9,4.5 0 1,0 11,-3 l-5,2 Z" fill="#4caf50" />
      <circle cx={-27} cy={3} r={3} fill="#ff8fab" />
      {/* stânci și trestii */}
      <g transform="translate(-62,-14) scale(0.55)">
        <Rock />
      </g>
      <g transform="translate(58,-4)" stroke="#6b8e23" strokeWidth={3} strokeLinecap="round">
        <path d="M0,0 L-2,-30 M6,0 L8,-24 M-6,0 L-10,-22" />
        <ellipse cx={-2} cy={-32} rx={3} ry={7} fill="#8d6e63" stroke="none" />
      </g>
    </Platform>
  );
}

function EarthHabitat() {
  return (
    <Platform top="#d9a86b" left="#a46f3a" right="#8a5a2c" rim="#e8bf86">
      {/* mese de piatră stratificate */}
      <g transform="translate(-30,-40)">
        <path d="M-30,30 L-26,-24 L22,-30 L30,26 Z" fill="#b5652f" />
        <path d="M-26,-24 L22,-30 L30,-18 L-20,-12 Z" fill="#e0955a" />
        <path d="M-28,4 L28,0 M-29,16 L29,12" stroke="#8a4b22" strokeWidth={3} />
        <path d="M22,-30 L30,26 L36,24 L30,-20 Z" fill="#8a4b22" />
      </g>
      <g transform="translate(40,-30) scale(0.7)">
        <path d="M-24,30 L-20,-30 L18,-36 L24,26 Z" fill="#c2733a" />
        <path d="M-20,-30 L18,-36 L24,-26 L-16,-20 Z" fill="#eda46a" />
        <path d="M-22,0 L22,-4" stroke="#8a4b22" strokeWidth={3} />
      </g>
      <g transform="translate(36,18) scale(0.6)">
        <Rock />
      </g>
      {/* oase */}
      <path d="M-50,18 L-26,12" stroke="#fff8e7" strokeWidth={5} strokeLinecap="round" />
      <circle cx={-51} cy={16} r={4} fill="#fff8e7" />
      <circle cx={-25} cy={10} r={4} fill="#fff8e7" />
      <circle cx={6} cy={6} r={3} fill="#a46f3a" />
      <circle cx={-6} cy={26} r={2} fill="#a46f3a" />
    </Platform>
  );
}

function PlantHabitat() {
  return (
    <Platform top="#4caf50" left="#2e7d32" right="#1b5e20" rim="#66bb6a">
      <g transform="translate(-36,-30) scale(0.9)">
        <Tree />
      </g>
      <g transform="translate(44,-24) scale(0.75)">
        <Tree />
      </g>
      {/* ferigi */}
      {[
        [-60, 4],
        [8, -44],
        [62, 8],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`} fill="#7cb342">
          <path d="M0,0 Q-24,-8 -30,-24 Q-12,-14 0,0" />
          <path d="M0,0 Q24,-8 30,-24 Q12,-14 0,0" />
          <path d="M0,0 Q-6,-24 0,-36 Q6,-24 0,0" fill="#9ccc65" />
        </g>
      ))}
      <g transform="translate(-10,18) scale(0.6)">
        <Bush />
      </g>
      {[
        [20, 22, '#ffe066'],
        [-30, 30, '#ff8fab'],
        [34, -2, '#ffffff'],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={4} fill={c as string} />
      ))}
    </Platform>
  );
}

function IceHabitat() {
  return (
    <Platform top="#eef8ff" left="#a9d4ee" right="#86bcdf" rim="#ffffff">
      <polygon points={inner(0.36, 14)} fill="#bfe6fb" stroke="#ffffff" strokeWidth={4} transform="translate(-20,0)" />
      {[
        [-48, -26, 1.1],
        [-24, -40, 1.5],
        [40, -26, 1.2],
        [58, -6, 0.8],
        [12, -44, 0.9],
      ].map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${k})`}>
          <path d="M-10,8 L-6,-30 L0,-40 L6,-30 L10,8 Z" fill="#9fdcff" opacity={0.92} />
          <path d="M0,-40 L6,-30 L10,8 L2,8 Z" fill="#62b6e7" opacity={0.9} />
          <path d="M-4,-26 L-2,0" stroke="#ffffff" strokeWidth={2} opacity={0.8} />
        </g>
      ))}
      <ellipse cx={30} cy={18} rx={26} ry={10} fill="#ffffff" />
      <ellipse cx={-56} cy={8} rx={18} ry={7} fill="#ffffff" />
      <circle cx={-6} cy={-60} r={2.5} fill="#ffffff" className="snow" />
      <circle cx={26} cy={-70} r={2} fill="#ffffff" className="snow delay" />
    </Platform>
  );
}

function StormHabitat() {
  return (
    <Platform top="#3a2b5c" left="#251a40" right="#1a1230" rim="#5a438a">
      {/* cercul de rune */}
      <ellipse
        cx={0}
        cy={-4}
        rx={48}
        ry={24}
        fill="none"
        stroke="#64ffda"
        strokeWidth={3}
        opacity={0.8}
        className="rune"
      />
      <ellipse
        cx={0}
        cy={-4}
        rx={34}
        ry={17}
        fill="none"
        stroke="#b388ff"
        strokeWidth={2}
        strokeDasharray="6 6"
        className="rune"
      />
      {/* cristale plutitoare */}
      {[
        [-50, -40, 1],
        [46, -44, 1.2],
        [0, -70, 0.8],
      ].map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${k})`}>
          <g className={`float ${i % 2 ? 'delay' : ''}`}>
            <path d="M0,-26 L12,-4 L0,22 L-12,-4 Z" fill="#9b6bff" />
            <path d="M0,-26 L12,-4 L0,22 Z" fill="#6a3fd1" />
            <path d="M0,-26 L-4,-4 L0,10" stroke="#e0d0ff" strokeWidth={2} fill="none" />
          </g>
        </g>
      ))}
      <path
        d="M8,-120 L-6,-92 L6,-92 L-8,-62"
        stroke="#ffffa8"
        strokeWidth={4}
        fill="none"
        strokeLinejoin="round"
        className="bolt"
      />
      <path d="M-74,-6 L-64,-30 L-54,-6 Z" fill="#251a40" />
      <path d="M60,4 L70,-22 L80,4 Z" fill="#251a40" />
    </Platform>
  );
}

const HABITATS: Record<ElementId, () => ReactNode> = {
  fire: FireHabitat,
  water: WaterHabitat,
  earth: EarthHabitat,
  plant: PlantHabitat,
  ice: IceHabitat,
  storm: StormHabitat,
};

// ---------- fermă, incubator, bârlog ----------

function Farm({ stage }: { stage: 'empty' | 'growing' | 'ready' }) {
  const rows = [-2, -1, 0, 1, 2];
  return (
    <Platform top="#8d5a2b" left="#6d4320" right="#573417" rim="#a06a36">
      {rows.map((r) => (
        <path
          key={r}
          d={`M${-62 + r * 14},${-22 + r * 7 - 6} l${60},${30}`}
          stroke="#6d4320"
          strokeWidth={8}
          strokeLinecap="round"
          transform="translate(10,-4)"
        />
      ))}
      {stage !== 'empty' &&
        rows.flatMap((r) =>
          [0, 1, 2].map((c) => {
            const x = -48 + r * 14 + c * 22;
            const y = -26 + r * 7 + c * 11;
            return (
              <g key={`${r}${c}`} transform={`translate(${x},${y}) scale(${stage === 'ready' ? 1 : 0.6})`}>
                <circle cx={0} cy={-8} r={9} fill="#4caf50" />
                <circle cx={-5} cy={-12} r={6} fill="#66bb6a" />
                {stage === 'ready' && (
                  <>
                    <circle cx={4} cy={-6} r={3.5} fill="#e53935" />
                    <circle cx={-3} cy={-3} r={3} fill="#e53935" />
                  </>
                )}
              </g>
            );
          }),
        )}
      {/* gardul */}
      <g stroke="#c8a165" strokeWidth={4} strokeLinecap="round">
        <path d="M-86,-16 L0,27 L86,-16" fill="none" />
        {[0.1, 0.35, 0.6, 0.85].flatMap((t) => [
          <path key={`l${t}`} d={`M${-86 + 86 * t},${-16 + 43 * t} l0,-12`} />,
          <path key={`r${t}`} d={`M${86 * t},${27 - 43 * t} l0,-12`} />,
        ])}
      </g>
      {/* sperietoarea */}
      <g transform="translate(58,-44)">
        <path d="M0,10 L0,-30 M-14,-18 L14,-18" stroke="#8d6e63" strokeWidth={4} strokeLinecap="round" />
        <circle cx={0} cy={-34} r={7} fill="#f3d27a" />
        <path d="M-10,-38 L10,-38 L4,-46 L-4,-46 Z" fill="#c62828" />
      </g>
    </Platform>
  );
}

function Hatchery({ eggs, ready }: { eggs: number; ready: boolean }) {
  return (
    <g>
      <ellipse cx={0} cy={10} rx={92} ry={48} fill="rgba(0,30,0,0.25)" />
      {/* zidul circular */}
      <ellipse cx={0} cy={0} rx={84} ry={42} fill="#cfc2a6" />
      <ellipse cx={0} cy={-8} rx={84} ry={42} fill="#e6dcc3" stroke="#b8a888" strokeWidth={4} />
      <ellipse cx={0} cy={-8} rx={66} ry={33} fill="#7cb342" />
      {/* turnul */}
      <g transform="translate(0,-14)">
        <path d="M-40,0 L-36,-120 L36,-120 L40,0 Q0,22 -40,0 Z" fill="#d8ccb0" />
        <path d="M0,10 L0,-120 L36,-120 L40,0 Q20,14 0,10 Z" fill="#bfb093" />
        {[-30, -60, -90].map((y) => (
          <path key={y} d={`M-38,${y} Q0,${y + 14} 38,${y}`} stroke="#a8977a" strokeWidth={2} fill="none" />
        ))}
        <path d="M-12,4 L-12,-26 Q0,-38 12,-26 L12,6 Z" fill="#5d4037" />
        <path
          d="M-44,-120 L-44,-134 L-32,-134 L-32,-126 L-18,-126 L-18,-134 L-6,-134 L-6,-126 L6,-126 L6,-134 L18,-134 L18,-126 L32,-126 L32,-134 L44,-134 L44,-120 Z"
          fill="#e6dcc3"
        />
        <ellipse cx={0} cy={-122} rx={44} ry={14} fill="#bfb093" />
        {/* cuibul de sus */}
        <ellipse cx={0} cy={-126} rx={34} ry={11} fill="#8d6e63" />
        <ellipse cx={0} cy={-129} rx={28} ry={8} fill="#a1887f" />
        {Array.from({ length: Math.min(eggs, 3) }, (_, i) => (
          <ellipse
            key={i}
            cx={-14 + i * 14}
            cy={-138}
            rx={7}
            ry={10}
            fill={ready ? '#ffe082' : '#fff3e0'}
            stroke="#d7ccc8"
            className={ready ? 'egg-shake' : ''}
          />
        ))}
      </g>
      <g transform="translate(-62,-12) scale(0.5)">
        <Bush />
      </g>
      <g transform="translate(64,-4) scale(0.45)">
        <Bush />
      </g>
    </g>
  );
}

function Den({ busy }: { busy: boolean }) {
  return (
    <Platform top="#e8c9a0" left="#c19a6b" right="#a37f53" rim="#f3dcbb">
      {/* arcada de piatră */}
      <g transform="translate(0,-30)">
        <path d="M-56,26 L-50,-40 Q0,-96 50,-40 L56,26 L32,26 L30,-24 Q0,-58 -30,-24 L-32,26 Z" fill="#a1887f" />
        <path d="M50,-40 L56,26 L32,26 L30,-24 Z" fill="#8d6e63" />
        <path d="M-50,-40 Q0,-96 50,-40" stroke="#7cb342" strokeWidth={8} fill="none" />
        <circle cx={-30} cy={-62} r={5} fill="#ff8fab" />
        <circle cx={22} cy={-66} r={5} fill="#ff8fab" />
        <circle cx={0} cy={-74} r={4} fill="#ffffff" />
        {/* inima */}
        <path
          d="M0,-18 C-6,-30 -24,-26 -18,-12 L0,4 L18,-12 C24,-26 6,-30 0,-18 Z"
          fill={busy ? '#ff4d8d' : '#f8bbd0'}
          className={busy ? 'pulse' : ''}
        />
      </g>
      <g transform="translate(-66,0) scale(0.5)">
        <Mushroom />
      </g>
      <g transform="translate(64,4) scale(0.55)">
        <Pine />
      </g>
    </Platform>
  );
}

function Forge({ busy }: { busy: boolean }) {
  return (
    <Platform top="#8d8378" left="#5d544b" right="#4a423a" rim="#a2978a">
      {/* atelierul de piatră, cu horn */}
      <g transform="translate(-8,-34)">
        <path d="M-50,26 L-50,-22 L0,-48 L50,-22 L50,26 Z" fill="#6d6259" />
        <path d="M0,-48 L50,-22 L50,26 L0,26 Z" fill="#584e46" />
        <path d="M-58,-20 L0,-56 L58,-20 L50,-14 L0,-44 L-50,-14 Z" fill="#7b4a2c" />
        <rect x={22} y={-78} width={16} height={40} fill="#4a423a" />
        <rect x={20} y={-82} width={20} height={8} fill="#3b342e" />
        <circle cx={30} cy={-92} r={8} fill="#8a8a8a" opacity={0.55} className="smoke" />
        <circle cx={36} cy={-106} r={11} fill="#9a9a9a" opacity={0.4} className="smoke delay" />
        {/* gura cuptorului */}
        <path d="M-30,26 L-30,-4 Q-14,-22 2,-4 L2,26 Z" fill="#2a1d18" />
        <path
          d="M-26,26 L-26,0 Q-14,-14 -2,0 L-2,26 Z"
          fill={busy ? '#ff7a1a' : '#a8461c'}
          className={busy ? 'lava-glow' : ''}
        />
      </g>
      {/* nicovala */}
      <g transform="translate(46,6)">
        <rect x={-6} y={-8} width={12} height={14} fill="#3b342e" />
        <path d="M-20,-18 L18,-18 L24,-12 L-14,-8 L-22,-12 Z" fill="#5f6b73" />
        <path d="M-20,-18 L18,-18 L14,-22 L-16,-22 Z" fill="#8a98a2" />
      </g>
      <g transform="translate(-64,6) scale(0.5)">
        <Rock />
      </g>
    </Platform>
  );
}

// ---------- intrarea ----------

export type BuildingVisual =
  | { kind: 'arena' | 'outpost'; busy: boolean }
  | { kind: 'habitat'; element: ElementId }
  | { kind: 'farm'; stage: 'empty' | 'growing' | 'ready' }
  | { kind: 'hatchery'; eggs: number; ready: boolean }
  | { kind: 'den'; busy: boolean }
  | { kind: 'forge'; busy: boolean };

export function BuildingArt({ visual }: { visual: BuildingVisual }) {
  const key = visual.kind === 'habitat' ? `habitat-${visual.element}` : visual.kind;
  const sprite = SPRITES[key];
  if (sprite)
    return (
      <DetailImage
        href={sprite.href}
        hd={sprite.hd}
        x={sprite.x}
        y={sprite.y}
        width={sprite.width}
        height={sprite.height}
      />
    );
  switch (visual.kind) {
    case 'habitat': {
      const Art = HABITATS[visual.element];
      return <Art />;
    }
    case 'farm':
      return <Farm stage={visual.stage} />;
    case 'hatchery':
      return <Hatchery eggs={visual.eggs} ready={visual.ready} />;
    case 'den':
      return <Den busy={visual.busy} />;
    case 'forge':
      return <Forge busy={visual.busy} />;
  }
}

/** Unde stau dinozaurii pe platforma unui habitat (până la 4). */
export const DINO_SPOTS = [
  { x: -34, y: 4 },
  { x: 34, y: 0 },
  { x: 0, y: 26 },
  { x: -4, y: -26 },
];

/** Clădirea desenată singură (în panouri și în magazin), în starea de repaus. */
export function BuildingPreview({ kind }: { kind: 'farm' | 'hatchery' | 'den' | 'arena' | 'outpost' | 'forge' }) {
  const visual: BuildingVisual =
    kind === 'farm'
      ? { kind, stage: 'growing' }
      : kind === 'hatchery'
        ? { kind, eggs: 1, ready: false }
        : { kind, busy: kind === 'forge' };
  // arta pictată, dacă există: o imagine simplă, se încadrează ca orice <img>
  const sprite = SPRITES[kind];
  if (sprite) return <img className="building-preview" src={sprite.href} alt="" draggable={false} />;
  return (
    <svg className="building-preview" viewBox="-150 -240 300 300" aria-hidden="true">
      <BuildingArt visual={visual} />
    </svg>
  );
}
