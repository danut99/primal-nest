// Creaturile, desenate în cod ca SVG. Patru planuri de corp (patruped, biped, înotător, zburător),
// cu detalii pe stadiu și ramură. Viewbox 100×100, privesc spre dreapta, picioarele pe y≈88.

import { type ReactNode, useId } from 'react';
import { RELICS, SPECIES, TYPES } from '@shared/game';
import { dinoArt } from '../content/art';

interface Palette {
  body: string;
  belly: string;
  accent: string;
  extra: string;
}

const PALETTES: Record<string, Palette> = {
  mugurel: { body: '#8bc34a', belly: '#f1f8c9', accent: '#4e8a2a', extra: '#b5e06a' },
  ferigosaur: { body: '#6fae3e', belly: '#e8f3c0', accent: '#3f7a24', extra: '#9fd45a' },
  codrodon: { body: '#5d9a3a', belly: '#e3eebb', accent: '#2f6a1c', extra: '#7cc04a' },
  spinodon: { body: '#6b8f3a', belly: '#eadfb0', accent: '#8e2f5a', extra: '#c04a7a' },
  scanteius: { body: '#f08a3c', belly: '#ffe2b8', accent: '#e2432a', extra: '#ffcf3a' },
  jarraptor: { body: '#e0662a', belly: '#ffd8a8', accent: '#c9302a', extra: '#ffb43a' },
  vulcanraptor: { body: '#5a2f2a', belly: '#e8a070', accent: '#ff7a1a', extra: '#ffd23a' },
  fumaripter: { body: '#c06a3a', belly: '#f3d2b0', accent: '#8c8a94', extra: '#ffb43a' },
  stropel: { body: '#5fb4e8', belly: '#e3f4ff', accent: '#2f7fc0', extra: '#a8dcff' },
  valusaur: { body: '#3f97d6', belly: '#d8efff', accent: '#1f62a8', extra: '#8fd0ff' },
  abisaurus: { body: '#2a5d9c', belly: '#bfe0f7', accent: '#173a6a', extra: '#5fa0d8' },
  fulgerin: { body: '#3a8ad6', belly: '#dff0ff', accent: '#f5d63a', extra: '#1f62a8' },
  pietroi: { body: '#b49a78', belly: '#efe2c8', accent: '#7e6a52', extra: '#cdb894' },
  scutosaur: { body: '#a08766', belly: '#eadcc0', accent: '#6b5942', extra: '#c4ab84' },
  cetatodon: { body: '#8e8070', belly: '#e2d8c6', accent: '#5e5448', extra: '#b8aa96' },
  buzduganix: { body: '#9a7a5a', belly: '#ead5b8', accent: '#5a3e2a', extra: '#c9a06a' },
  aripel: { body: '#9fd3ef', belly: '#ffffff', accent: '#f4a26a', extra: '#cfeaf8' },
  planorix: { body: '#7fc0e6', belly: '#f2fbff', accent: '#4f8fc0', extra: '#f4a26a' },
  furtunodactil: { body: '#4d6f9e', belly: '#dfe8f5', accent: '#f5d63a', extra: '#2f4a72' },
  norisaur: { body: '#a9d8f0', belly: '#ffffff', accent: '#6aa8d8', extra: '#f4a26a' },
};

const ALBINO: Palette = { body: '#f3efe6', belly: '#ffffff', accent: '#f4b3bd', extra: '#fbe3e6' };
const INK = '#2b1d14';

interface Props {
  speciesId: string;
  albino?: boolean;
  size?: number;
  flip?: boolean;
  silhouette?: boolean;
  className?: string;
  title?: string;
  /** Aura luminoasă în culoarea tipului (implicit pornită). */
  aura?: boolean;
  /** Atins de Umbră: ceață violetă, culori stinse (inamicii din lupte). */
  shadowed?: boolean;
  /** Relicva purtată: plutește lângă creatură și strălucește. */
  relic?: string;
}

export function DinoSprite({ speciesId, albino, size = 96, flip, silhouette, className, title, aura = true, shadowed, relic }: Props) {
  const uid = useId().replace(/:/g, '');
  const species = SPECIES[speciesId];
  if (!species) return null;
  const base = PALETTES[speciesId] ?? PALETTES.mugurel;
  const p: Palette = silhouette
    ? { body: '#3a3a44', belly: '#3a3a44', accent: '#3a3a44', extra: '#3a3a44' }
    : albino
      ? ALBINO
      : base;
  // Imagine locală pentru specie (src/local-art/dinos/<id>.png), altfel desenul din cod.
  const art = dinoArt(speciesId);
  const eye = albino ? '#d23a4a' : INK;
  const stage = species.stage;
  const ctx: Ctx = { p, eye, stage, id: speciesId, silhouette: !!silhouette };
  const body =
    species.line === 'raptor'
      ? raptor(ctx)
      : species.line === 'plesio'
        ? plesio(ctx)
        : species.line === 'ptero'
          ? ptero(ctx)
          : species.line === 'ankylo'
            ? ankylo(ctx)
            : ceratops(ctx);
  // Puii sunt mici și rotunzi; adulții umplu cadrul.
  // Imaginile randate au deja mărimea pe stadiu; desenele din cod o primesc aici.
  const scale = art ? 1 : stage === 'pui' ? 0.84 : stage === 'juvenil' ? 0.92 : 1;
  // Lumina creaturii: culoarea tipului, violet pentru Umbră, alb-roz pentru albino.
  const glow = shadowed ? '#9b5cff' : albino ? '#ffd6e4' : TYPES[species.types[0]].color;
  const lit = aura && !silhouette;
  // Fără drop-shadow: e scump la redesenare. Strălucirea vine din aura în gradient.
  const glowFilter = shadowed ? 'saturate(.7) brightness(.85)' : undefined;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? species.name}
      style={{ overflow: 'visible' }}
    >
      {lit && (
        <defs>
          <radialGradient id={`aura${uid}`}>
            <stop offset="0" stopColor={glow} stopOpacity={shadowed ? 0.55 : 0.5} />
            <stop offset="0.55" stopColor={glow} stopOpacity="0.16" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`pool${uid}`}>
            <stop offset="0" stopColor={shadowed ? '#2a0f4a' : '#fff6c8'} stopOpacity="0.75" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {lit && <ellipse className="dino-aura" cx="50" cy="60" rx="50" ry="44" fill={`url(#aura${uid})`} />}
      {lit ? (
        <ellipse cx="50" cy="91" rx={36 * scale} ry="6" fill={`url(#pool${uid})`} />
      ) : (
        <ellipse cx="50" cy="91" rx={30 * scale} ry="4" fill="rgba(0,0,0,.25)" />
      )}
      <g
        transform={`translate(50 90) scale(${flip ? -scale : scale} ${scale}) translate(-50 -90)`}
        stroke={silhouette ? 'none' : INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: glowFilter }}
      >
        {art ? (
          <image
            href={art}
            x="-8"
            y="-6"
            width="116"
            height="98"
            preserveAspectRatio="xMidYMax meet"
            stroke="none"
            style={
              silhouette
                ? { filter: 'brightness(0) opacity(.75)' }
                : albino
                  ? { filter: 'saturate(0) brightness(1.55) sepia(.15) hue-rotate(300deg)' }
                  : undefined
            }
          />
        ) : (
          body
        )}
      </g>
      {relic && RELICS[relic] && !silhouette && <RelicArt relic={relic} x={flip ? 12 : 88} y={stage === 'pui' ? 40 : 26} />}
      {shadowed && (
        <g className="umbra-wisps" fill="#7b3fe4" opacity=".5">
          <ellipse cx="22" cy="82" rx="14" ry="5" />
          <ellipse cx="74" cy="84" rx="16" ry="5" />
          <ellipse cx="50" cy="88" rx="22" ry="5" />
        </g>
      )}
    </svg>
  );
}

interface Ctx {
  p: Palette;
  eye: string;
  stage: 'pui' | 'juvenil' | 'adult';
  id: string;
  silhouette: boolean;
}

function Eye({ cx, cy, r, color, sil }: { cx: number; cy: number; r: number; color: string; sil: boolean }) {
  if (sil) return <circle cx={cx} cy={cy} r={r * 0.5} fill="#fff" stroke="none" opacity=".85" />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <circle cx={cx + r * 0.25} cy={cy + r * 0.05} r={r * 0.62} fill={color} stroke="none" />
      <circle cx={cx + r * 0.45} cy={cy - r * 0.3} r={r * 0.25} fill="#fff" stroke="none" />
    </g>
  );
}

function Blush({ cx, cy, sil }: { cx: number; cy: number; sil: boolean }) {
  if (sil) return null;
  return <ellipse cx={cx} cy={cy} rx="4" ry="2.4" fill="#ff8fa3" opacity=".55" stroke="none" />;
}

function spikes(cx: number, cy: number, r: number, from: number, to: number, n: number, len: number, fill: string) {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    const w = 0.22;
    const x1 = cx + Math.cos(a - w) * r;
    const y1 = cy + Math.sin(a - w) * r;
    const x2 = cx + Math.cos(a + w) * r;
    const y2 = cy + Math.sin(a + w) * r;
    const xt = cx + Math.cos(a) * (r + len);
    const yt = cy + Math.sin(a) * (r + len);
    out.push(<path key={i} d={`M${x1} ${y1} L${xt} ${yt} L${x2} ${y2} Z`} fill={fill} />);
  }
  return out;
}

// ---------- Ceratops: patruped cu guler și coarne ----------

function ceratops({ p, eye, stage, id, silhouette: sil }: Ctx) {
  const pui = stage === 'pui';
  const headR = pui ? 15 : 13;
  const hx = pui ? 72 : 76;
  const hy = pui ? 54 : 52;
  const frillR = pui ? 10 : stage === 'juvenil' ? 15 : 19;
  return (
    <>
      {/* coada și picioarele din spate */}
      <path d="M26 60 Q8 60 6 72 Q16 70 28 70 Z" fill={p.body} />
      <rect x="30" y="68" width="10" height="18" rx="4" fill={p.accent} />
      <rect x="58" y="68" width="10" height="18" rx="4" fill={p.accent} />
      {/* corpul */}
      <ellipse cx="48" cy="62" rx={pui ? 24 : 28} ry={pui ? 18 : 19} fill={p.body} />
      <ellipse cx="50" cy="70" rx={pui ? 16 : 20} ry="8" fill={p.belly} stroke="none" />
      {id === 'codrodon' && (
        <g>
          <rect x="38" y="30" width="5" height="16" fill="#7a5230" />
          <circle cx="40" cy="28" r="10" fill={p.extra} />
          <circle cx="33" cy="33" r="6" fill={p.extra} />
          <circle cx="48" cy="33" r="6" fill={p.extra} />
        </g>
      )}
      {!pui && <ellipse cx="44" cy="50" rx="14" ry="5" fill={p.extra} stroke="none" opacity=".7" />}
      <rect x="38" y="70" width="10" height="17" rx="4" fill={p.body} />
      <rect x="64" y="70" width="10" height="17" rx="4" fill={p.body} />
      {/* gulerul */}
      {id === 'spinodon' && spikes(hx - 6, hy - 6, frillR, 180, 330, 7, 10, p.accent)}
      {id === 'codrodon' && spikes(hx - 6, hy - 6, frillR, 180, 330, 6, 7, p.extra)}
      <circle cx={hx - 6} cy={hy - 6} r={frillR} fill={id === 'spinodon' ? p.extra : p.accent} />
      {!pui && <circle cx={hx - 6} cy={hy - 6} r={frillR * 0.6} fill={p.extra} stroke="none" opacity=".8" />}
      {/* capul */}
      <ellipse cx={hx} cy={hy} rx={headR + 2} ry={headR} fill={p.body} />
      <ellipse cx={hx + 9} cy={hy + 5} rx="8" ry="6" fill={p.belly} />
      {/* coarne */}
      {pui ? (
        <path d={`M${hx + 10} ${hy - 4} l3 -7 l3 6 Z`} fill={p.extra} />
      ) : (
        <>
          <path d={`M${hx + 12} ${hy - 1} l4 -10 l3 9 Z`} fill="#f6eedc" />
          <path d={`M${hx - 2} ${hy - 11} l${id === 'spinodon' ? 10 : 6} -${id === 'spinodon' ? 16 : 11} l1 13 Z`} fill="#f6eedc" />
        </>
      )}
      {id === 'mugurel' && <path d={`M${hx - 3} ${hy - 14} q-3 -8 4 -10 q1 7 -4 10 Z`} fill="#b5e06a" />}
      <Eye cx={hx + 2} cy={hy - 3} r={pui ? 5 : 4} color={eye} sil={sil} />
      {pui && <Blush cx={hx + 4} cy={hy + 6} sil={sil} />}
      {!sil && <path d={`M${hx + 10} ${hy + 7} q3 2 6 0`} fill="none" strokeWidth="1.6" />}
    </>
  );
}

// ---------- Ankylo: patruped jos, cu plăci și buzdugan ----------

function ankylo({ p, eye, stage, id, silhouette: sil }: Ctx) {
  const pui = stage === 'pui';
  const club = stage !== 'pui';
  const clubR = id === 'buzduganix' ? 10 : 6;
  return (
    <>
      <path d="M24 64 Q10 62 6 70 Q14 74 26 72 Z" fill={p.body} />
      {club && (
        <g>
          {id === 'buzduganix' && spikes(8, 68, clubR, 0, 360, 9, 6, p.extra)}
          <circle cx="8" cy="68" r={clubR} fill={p.accent} />
        </g>
      )}
      <rect x="28" y="70" width="10" height="16" rx="4" fill={p.accent} />
      <rect x="58" y="70" width="10" height="16" rx="4" fill={p.accent} />
      <ellipse cx="48" cy="66" rx={pui ? 26 : 32} ry={pui ? 17 : 16} fill={p.body} />
      <ellipse cx="50" cy="73" rx="20" ry="6" fill={p.belly} stroke="none" />
      {/* plăcile de pe spate */}
      {id === 'cetatodon' ? (
        <g fill={p.accent}>
          <path d="M22 56 v-10 h7 v5 h6 v-5 h7 v5 h6 v-5 h7 v5 h6 v-5 h7 v10 Q48 44 22 56 Z" />
        </g>
      ) : (
        <g fill={p.accent}>
          {(pui ? [30, 42, 54, 66] : [24, 34, 44, 54, 64]).map((x, i) => (
            <ellipse key={x} cx={x} cy={pui ? 52 - (i === 1 || i === 2 ? 3 : 0) : 52 - Math.sin((i / 4) * Math.PI) * 4} rx="5.5" ry="4" />
          ))}
        </g>
      )}
      {stage !== 'pui' && spikes(48, 66, 30, 150, 210, 3, 6, '#f6eedc')}
      <rect x="38" y="72" width="10" height="15" rx="4" fill={p.body} />
      <rect x="66" y="72" width="10" height="15" rx="4" fill={p.body} />
      <ellipse cx={pui ? 76 : 82} cy={pui ? 62 : 66} rx={pui ? 13 : 11} ry={pui ? 12 : 9} fill={p.body} />
      <ellipse cx={pui ? 84 : 89} cy={pui ? 67 : 69} rx="6" ry="4" fill={p.belly} />
      <Eye cx={pui ? 79 : 85} cy={pui ? 58 : 63} r={pui ? 4.6 : 3.4} color={eye} sil={sil} />
      {pui && <Blush cx={80} cy={67} sil={sil} />}
    </>
  );
}

// ---------- Raptor: biped cu creastă de flăcări ----------

function raptor({ p, eye, stage, id, silhouette: sil }: Ctx) {
  const pui = stage === 'pui';
  const hx = pui ? 64 : 70;
  const hy = pui ? 40 : 34;
  return (
    <>
      {id === 'fumaripter' && (
        <path d="M44 48 Q20 20 6 30 Q18 36 14 44 Q26 42 26 52 Q36 48 44 58 Z" fill={p.accent} />
      )}
      <path d={pui ? 'M34 62 Q14 62 8 74 Q22 72 36 70 Z' : 'M32 58 Q12 52 2 60 Q16 66 34 68 Z'} fill={p.body} />
      {/* picioare */}
      <path d="M38 66 l-4 20 h10" fill="none" strokeWidth="5" stroke={sil ? '#3a3a44' : p.accent} />
      <path d="M52 66 l2 20 h10" fill="none" strokeWidth="5" stroke={sil ? '#3a3a44' : p.body} />
      {!pui && <path d="M63 86 q4 -6 1 -9" fill="none" strokeWidth="2" />}
      <ellipse cx="46" cy={pui ? 62 : 58} rx={pui ? 18 : 20} ry={pui ? 17 : 15} fill={p.body} transform={pui ? undefined : 'rotate(-18 46 58)'} />
      <ellipse cx="50" cy={pui ? 66 : 62} rx={pui ? 11 : 12} ry="9" fill={p.belly} stroke="none" />
      {id === 'vulcanraptor' && (
        <g fill="none" stroke={p.accent} strokeWidth="2.6">
          <path d="M34 52 l6 6 l-2 6" />
          <path d="M46 46 l5 7 l-2 6" />
          <path d="M22 58 l6 3" />
        </g>
      )}
      {/* gât și cap */}
      {!pui && <path d="M54 50 Q60 40 66 36 L72 44 Q64 50 60 58 Z" fill={p.body} />}
      <path d={`M${hx - 2} ${hy - 6} q-4 -10 2 -16 q2 6 6 4 q0 -8 6 -10 q-1 8 4 12 Z`} fill={p.extra} />
      {stage === 'adult' && <path d={`M${hx - 8} ${hy - 2} q-8 -8 -4 -16 q4 6 8 6 Z`} fill={p.accent} />}
      <ellipse cx={hx} cy={hy} rx={pui ? 14 : 13} ry={pui ? 13 : 10} fill={p.body} />
      <ellipse cx={hx + (pui ? 9 : 12)} cy={hy + 3} rx={pui ? 8 : 10} ry={pui ? 6 : 5.5} fill={p.body} />
      {!pui && <path d={`M${hx + 8} ${hy + 6} l3 3 l3 -3 l3 3 l3 -3`} fill="none" stroke="#fff" strokeWidth="1.6" />}
      <path d="M58 62 q6 2 8 6" fill="none" strokeWidth="3" stroke={sil ? '#3a3a44' : p.body} />
      <Eye cx={hx + 2} cy={hy - 3} r={pui ? 5 : 3.8} color={eye} sil={sil} />
      {pui && <Blush cx={hx + 6} cy={hy + 6} sil={sil} />}
    </>
  );
}

// ---------- Plesio: înotător cu gât lung ----------

function plesio({ p, eye, stage, id, silhouette: sil }: Ctx) {
  const pui = stage === 'pui';
  const hx = pui ? 70 : stage === 'juvenil' ? 74 : 78;
  const hy = pui ? 46 : stage === 'juvenil' ? 32 : 24;
  return (
    <>
      <path d="M24 70 Q8 68 4 76 Q14 78 26 76 Z" fill={p.body} />
      <ellipse cx="32" cy="80" rx="10" ry="4" fill={p.accent} transform="rotate(20 32 80)" />
      <ellipse cx="44" cy="68" rx={pui ? 22 : 26} ry={pui ? 15 : 16} fill={p.body} />
      <ellipse cx="46" cy="74" rx="18" ry="6" fill={p.belly} stroke="none" />
      {id === 'abisaurus' && (
        <g fill={p.accent}>
          <circle cx="32" cy="56" r="4" />
          <circle cx="42" cy="53" r="4.5" />
          <circle cx="53" cy="55" r="4" />
        </g>
      )}
      {id === 'fulgerin' && <path d="M30 62 l8 -4 l-2 6 l10 -5" fill="none" stroke={p.accent} strokeWidth="3" />}
      <ellipse cx="58" cy="80" rx="11" ry="4" fill={p.accent} transform="rotate(-15 58 80)" />
      {/* gâtul */}
      <path
        d={`M54 62 Q${hx - 6} ${(62 + hy) / 2 + 6} ${hx - 6} ${hy + 4} L${hx + 2} ${hy + 8} Q${hx + 2} ${(62 + hy) / 2 + 12} 64 70 Z`}
        fill={p.body}
      />
      {id === 'fulgerin' && <path d={`M${hx - 6} ${hy - 6} l4 -10 l2 6 l4 -8 l1 12 Z`} fill={p.accent} />}
      {stage === 'juvenil' && <path d={`M${hx - 6} ${hy - 4} q-2 -8 4 -10 q0 6 2 8 Z`} fill={p.accent} />}
      <ellipse cx={hx} cy={hy} rx={pui ? 13 : 11} ry={pui ? 12 : 9} fill={p.body} />
      <ellipse cx={hx + (pui ? 7 : 9)} cy={hy + 3} rx="6" ry="4" fill={p.belly} />
      <Eye cx={hx + 2} cy={hy - 2} r={pui ? 4.8 : 3.6} color={eye} sil={sil} />
      {pui && <Blush cx={hx + 5} cy={hy + 6} sil={sil} />}
      {!sil && (
        <path d="M14 88 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#7cc4ec" strokeWidth="2.4" opacity=".8" />
      )}
    </>
  );
}

// ---------- Ptero: zburător ----------

function ptero({ p, eye, stage, id, silhouette: sil }: Ctx) {
  const pui = stage === 'pui';
  const span = pui ? 16 : stage === 'juvenil' ? 36 : 44;
  const wing = id === 'furtunodactil'
    ? `M44 52 L${50 - span} ${34} L${46 - span * 0.7} 46 L${50 - span * 0.8} 52 L${46 - span * 0.5} 58 L38 66 Z`
    : `M44 52 Q${50 - span} ${30} ${50 - span} ${46} Q${48 - span * 0.6} 60 38 66 Z`;
  const wingR = id === 'furtunodactil'
    ? `M56 52 L${50 + span} ${34} L${54 + span * 0.7} 46 L${50 + span * 0.8} 52 L${54 + span * 0.5} 58 L62 66 Z`
    : `M56 52 Q${50 + span} ${30} ${50 + span} ${46} Q${52 + span * 0.6} 60 62 66 Z`;
  return (
    <>
      <path d={wing} fill={p.accent === '#f4a26a' ? p.extra : p.accent} />
      {id === 'norisaur' && !sil && (
        <g fill="#fff">
          <circle cx={50 - span * 0.7} cy="44" r="5" />
          <circle cx={50 - span * 0.45} cy="40" r="6" />
        </g>
      )}
      <path d="M44 74 v12 M56 74 v12" fill="none" strokeWidth="4" stroke={sil ? '#3a3a44' : p.extra === '#f4a26a' ? p.extra : '#f4a26a'} />
      <ellipse cx="50" cy="62" rx={pui ? 17 : 13} ry={pui ? 17 : 16} fill={p.body} />
      <ellipse cx="50" cy="66" rx={pui ? 11 : 8} ry={pui ? 10 : 10} fill={p.belly} stroke="none" />
      {id === 'furtunodactil' && <path d="M46 56 l6 4 l-4 3 l6 4" fill="none" stroke={p.accent} strokeWidth="2.6" />}
      {/* creasta și capul */}
      <path d={`M54 ${pui ? 36 : 30} Q${pui ? 40 : 34} ${pui ? 26 : 16} ${pui ? 44 : 30} ${pui ? 22 : 12} Q${pui ? 52 : 50} ${pui ? 26 : 20} 60 ${pui ? 32 : 26} Z`} fill={stage === 'adult' ? p.accent : p.extra} />
      <circle cx="58" cy={pui ? 40 : 34} r={pui ? 13 : 11} fill={p.body} />
      <path d={`M66 ${pui ? 38 : 32} L${pui ? 80 : 92} ${pui ? 42 : 36} L66 ${pui ? 46 : 40} Z`} fill="#f4a26a" />
      <path d={wingR} fill={p.accent === '#f4a26a' ? p.extra : p.accent} opacity={pui ? 1 : 0.95} />
      {id === 'norisaur' && !sil && (
        <g fill="#fff">
          <circle cx={50 + span * 0.7} cy="44" r="5" />
          <circle cx={50 + span * 0.45} cy="40" r="6" />
        </g>
      )}
      <Eye cx={60} cy={pui ? 38 : 32} r={pui ? 5 : 3.8} color={eye} sil={sil} />
      {pui && <Blush cx={62} cy={47} sil={sil} />}
    </>
  );
}

/** Relicvele: arme străvechi din lumină stelară, care plutesc lângă purtător. */
function RelicArt({ relic, x, y }: { relic: string; x: number; y: number }) {
  const r = RELICS[relic];
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="20" fill={`url(#relicglow-${relic})`} />
      <defs>
        <radialGradient id={`relicglow-${relic}`}>
          <stop offset="0" stopColor={r.color} stopOpacity=".75" />
          <stop offset="1" stopColor={r.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="relic-float" stroke="#1a1208" strokeWidth="1.6" strokeLinejoin="round">
        {relic === 'colti_licurici' && (
          <>
            <path d="M-8 -12 Q-14 0 -6 12 Q-6 0 -3 -10 Z" fill={r.color} />
            <path d="M4 -12 Q-2 0 6 12 Q6 0 9 -10 Z" fill={r.color} />
          </>
        )}
        {relic === 'lama_junglei' && (
          <>
            <path d="M0 -20 L5 -6 L3 10 L-3 10 L-5 -6 Z" fill={r.color} />
            <path d="M0 -17 L0 8" stroke="#eafff4" strokeWidth="1" />
            <rect x="-8" y="10" width="16" height="3.5" rx="1.5" fill="#6b4a26" />
            <rect x="-2" y="13.5" width="4" height="8" rx="1.5" fill="#3b2a1a" />
          </>
        )}
        {relic === 'coroana_vulcanului' && (
          <>
            <path d="M-12 6 L-12 -8 L-6 -2 L0 -12 L6 -2 L12 -8 L12 6 Z" fill={r.color} />
            <circle cx="0" cy="0" r="2.6" fill="#ff4a2a" />
            <circle cx="-7" cy="2" r="1.6" fill="#ffe7a8" />
            <circle cx="7" cy="2" r="1.6" fill="#ffe7a8" />
          </>
        )}
      </g>
    </g>
  );
}
