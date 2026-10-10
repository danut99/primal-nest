// Generatorul de dinozauri: din elemente + raritate + seed iese o rețetă completă (culori pe părți, proporții,
// mișcare). Același seed dă același dinozaur. Laboratorul pornește de aici și salvează doar ce ajustezi de mână.

import type { DinoRecipe, MotionSettings, PartSettings } from './engine';

export type ElementKey = 'fire' | 'water' | 'earth' | 'plant' | 'ice' | 'storm';
export type RarityKey = 'common' | 'rare' | 'epic' | 'legendary';

/** Paleta fiecărui element: principală (corp), secundară (coadă, brațe), accent (cap, efecte). */
export const PALETTES: Record<ElementKey, { main: string; second: string; accent: string }> = {
  fire: { main: '#c8401c', second: '#f08a24', accent: '#ffd23f' },
  water: { main: '#1f6fb8', second: '#38b6c9', accent: '#a9f0ff' },
  earth: { main: '#7a5232', second: '#a8743a', accent: '#e0b36b' },
  plant: { main: '#2f7d32', second: '#7cb342', accent: '#d4e157' },
  ice: { main: '#7fb8d8', second: '#d6f1ff', accent: '#ffffff' },
  storm: { main: '#4b2f8f', second: '#7e57c2', accent: '#64ffda' },
};

/** Cum se mișcă fiecare element: se aplică peste mișcarea scheletului. */
const TEMPERAMENT: Record<
  ElementKey,
  { speed: number; tail: PartSettings; motion: MotionSettings; body?: PartSettings }
> = {
  fire: { speed: 1.15, tail: { wave: 6, waveSpeed: 1.2 }, motion: { warp: 0.15 } },
  water: {
    speed: 0.95,
    tail: { wave: 14, waveSpeed: 0.6, waveLag: 1, inertia: 0.5 },
    motion: { sway: 2, swaySpeed: 0.25 },
  },
  earth: { speed: 0.8, tail: { wave: 3, waveSpeed: 0.4 }, motion: {}, body: { width: 1.12 } },
  plant: { speed: 0.9, tail: { wave: 8, waveSpeed: 0.5, inertia: 0.35 }, motion: { sway: 3, swaySpeed: 0.2 } },
  ice: { speed: 0.75, tail: { wave: 4, waveSpeed: 0.35, inertia: 0.6 }, motion: { warp: 0.1 } },
  storm: { speed: 1.2, tail: { wave: 10, waveSpeed: 1.6 }, motion: { warp: 0.35, bob: 6, bobSpeed: 1.2 } },
};

/** Cât de departe poate ieși dinozaurul de forma de bază: rarii arată mai neobișnuit. */
const VARIETY: Record<RarityKey, number> = { common: 0.5, rare: 0.8, epic: 1.1, legendary: 1.4 };

export interface GenerateInput {
  id: string;
  name: string;
  elements: ElementKey[];
  rarity: RarityKey;
  /** Scheletul (id din manifest). */
  rig: string;
  /** Lipsă: se calculează din id, ca fiecare specie să arate mereu la fel. */
  seed?: number;
  description?: string;
}

export function generateDino(input: GenerateInput): DinoRecipe {
  const rand = rng(input.seed ?? hash(input.id));
  const v = VARIETY[input.rarity];
  /** Un număr în jurul lui 1: ±spread·variety. */
  const around = (spread: number) => round(1 + (rand() * 2 - 1) * spread * v);
  const between = (lo: number, hi: number) => round(lo + rand() * (hi - lo));

  const [first, second = first] = input.elements;
  const a = PALETTES[first];
  const b = PALETTES[second];
  const t = TEMPERAMENT[first];
  const mixed = first !== second;
  const amount = (base: number) => round(Math.min(1, base + rand() * 0.15));
  const tone = (base: number) => round(base + (rand() * 2 - 1) * 0.12);

  const parts: Record<string, PartSettings> = {
    corp: {
      colorize: a.main,
      colorizeAmount: amount(0.7),
      lightness: tone(-0.05),
      width: around(0.08) * (t.body?.width ?? 1),
    },
    sold: { colorize: a.main, colorizeAmount: amount(0.7), lightness: tone(-0.1) },
    cap: { colorize: mixed ? a.second : a.main, colorizeAmount: amount(0.6), scale: around(0.12), lightness: tone(0) },
    coada: {
      colorize: mixed ? b.main : a.second,
      colorizeAmount: amount(0.65),
      length: around(0.2),
      width: around(0.08),
      ...scaleWave(t.tail, v),
    },
    picioare: { colorize: a.main, colorizeAmount: amount(0.65), lightness: tone(-0.2), length: around(0.06) },
    brate: { colorize: mixed ? b.second : a.second, colorizeAmount: amount(0.6), scale: around(0.25) },
    efecte: { colorize: mixed ? b.accent : a.accent, colorizeAmount: 1 },
    podoabe: { colorize: a.accent, colorizeAmount: amount(0.8) },
  };
  // Efectele atacului (cristale, unde) apar doar la speciile epice și legendare.
  if (input.rarity === 'common' || input.rarity === 'rare') parts.efecte.hidden = true;

  const motion: MotionSettings = {
    ...t.motion,
    speed: round(t.speed * between(0.92, 1.08)),
    zoom: round({ common: 0.85, rare: 0.92, epic: 1, legendary: 1.05 }[input.rarity]),
  };
  if (mixed) {
    // Al doilea element adaugă din temperamentul lui (de ex. furtuna dă ritm neregulat oricărui hibrid).
    const extra = TEMPERAMENT[second].motion;
    if (extra.warp) motion.warp = round(Math.max(motion.warp ?? 0, extra.warp * 0.7));
    if (extra.sway) motion.sway = extra.sway;
  }

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    base: { rig: input.rig },
    parts,
    motion,
    animations: { attack: { speed: round(between(0.9, 1.15)) } },
  };
}

function scaleWave(p: PartSettings, v: number): PartSettings {
  return { ...p, wave: p.wave ? round(p.wave * (0.7 + v * 0.4)) : undefined };
}

// ---------- seed ----------

const round = (n: number) => Math.round(n * 100) / 100;

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
