// Insulele: imaginea pictată și unde stă fiecare loc (SLOTS din regulile jocului) pe ea, în pixeli de imagine.
// Pentru o insulă nouă: imaginea 4K în public/world, sursa în art/, centrele parcelelor aici, apoi
// `python scripts/world-images.py` (varianta 2K implicită, cea gri pentru nedescoperite și umbra).

import { MAIN_BUILDING_POSITIONS, type ElementId } from '@shared/game';

const WORLD = import.meta.env.BASE_URL + 'world/';
/** Imaginile unei insule: 2K (implicit), 4K (doar la zoom mare), gri (nedescoperită), umbra pre-estompată. */
const art = (name: string) => ({
  image: `${WORLD}${name}-island-2k.webp`,
  hd: `${WORLD}${name}-island-4k.webp`,
  locked: `${WORLD}${name}-island-locked.webp`,
  shadow: `${WORLD}${name}-island-shadow.webp`,
});
export type IslandArt = ReturnType<typeof art>;

/**
 * Unde stau lucrurile pe imaginea unei insule (pixeli din imaginea de 1100 × 734), pentru formele care nu sunt
 * ovalul obișnuit. Lipsă = pozițiile comune (`habitatSpot` din WorldScreen).
 */
export interface IslandLayout {
  /** Locurile dinozaurilor, în ordinea în care se umplu (primele, la mijloc). */
  spots: { x: number; y: number }[];
  /** Cât de departe se plimbă dinozaurii (doar pe teren). */
  area: { x0: number; y0: number; x1: number; y1: number };
}

/** Semiluna: nisip în mijloc și în față, laguna și cascada în spate, recif pe margini. */
const CRESCENT: IslandLayout = {
  spots: [
    { x: 440, y: 380 },
    { x: 660, y: 380 },
    { x: 550, y: 455 },
    { x: 550, y: 305 },
    { x: 330, y: 315 },
    { x: 770, y: 315 },
    { x: 295, y: 410 },
    { x: 805, y: 410 },
    { x: 415, y: 465 },
    { x: 685, y: 465 },
  ],
  area: { x0: 290, y0: 290, x1: 810, y1: 470 },
};

/** Clear ground shared by the five new silhouettes; keep residents away from the rear landmarks and cliffs. */
const PLATEAU: IslandLayout = {
  spots: [
    { x: 440, y: 390 },
    { x: 660, y: 390 },
    { x: 550, y: 450 },
    { x: 550, y: 340 },
    { x: 350, y: 345 },
    { x: 750, y: 345 },
    { x: 320, y: 425 },
    { x: 780, y: 425 },
    { x: 430, y: 475 },
    { x: 670, y: 475 },
  ],
  area: { x0: 310, y0: 340, x1: 790, y1: 480 },
};

export const HABITAT_ISLANDS: Record<
  ElementId,
  IslandArt & { name: string; x: number; y: number; layout?: IslandLayout }
> = {
  fire: { name: 'Caldera de jar', ...art('fire'), x: 2485, y: 779, layout: PLATEAU },
  water: { name: 'Laguna primordială', ...art('water'), x: 789, y: 1999, layout: CRESCENT },
  earth: { name: 'Canionul fosilelor', ...art('earth'), x: 1978, y: 1769, layout: PLATEAU },
  plant: { name: 'Jungla pierdută', ...art('jungle'), x: 897, y: -180, layout: PLATEAU },
  ice: { name: 'Valea ghețarilor', ...art('ice'), x: -481, y: 579, layout: PLATEAU },
  storm: { name: 'Crestele tunetului', ...art('storm'), x: -347, y: 1799, layout: PLATEAU },
};
/** Umbra pre-estompată se întinde dincolo de insulă cu atâtea unități (vezi SHADOW în world-images.py). */
export const SHADOW_PAD = 90;

/**
 * Insula principală e „părintele”: mai mare decât lumile din jur (scale 1 față de lumile de 1100 px). Lumile sunt
 * așezate în jurul ei cu aceeași distanță între margini; dacă schimbi mărimea, mută-le radial (vezi istoricul).
 */
export const MAIN_ISLAND_POSITION = { x: 712, y: 757, scale: 1 };

export interface SlotPosition {
  /** Centrul parcelei pe imagine. */
  x: number;
  y: number;
  /** Mărimea clădirii (1 = platforma de 172 px lățime). */
  scale: number;
}

export interface Island extends IslandArt {
  id: string;
  /** Varianta mică de pornire (doar insula principală). */
  lite?: string;
  name: string;
  width: number;
  height: number;
  slots: Record<string, SlotPosition>;
}

export const JUNGLE_ISLAND: Island = {
  id: 'jungle',
  name: 'Insula Junglei',
  ...art('jungle'),
  width: 1536,
  height: 1024,
  slots: {
    ...Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [
        `world${i}`,
        { x: 350 + (i % 6) * 160, y: 300 + Math.floor(i / 6) * 130, scale: 0.8 },
      ]),
    ),
    p0: { x: 598, y: 266, scale: 1.22 },
    p1: { x: 1025, y: 312, scale: 1.22 },
    p2: { x: 1195, y: 535, scale: 1.22 },
    p3: { x: 350, y: 428, scale: 1.22 },
    p4: { x: 512, y: 578, scale: 1.22 },
    hatchery: { x: 262, y: 322, scale: 0.95 },
    den: { x: 1328, y: 432, scale: 0.9 },
  },
};

export const MAIN_ISLAND: Island = {
  ...JUNGLE_ISLAND,
  id: 'main',
  name: 'Insula expediției',
  ...art('main'),
  // varianta mică de la pornire (o imagine mai ușoară = harta apare mai repede); 2K o înlocuiește
  lite: `${WORLD}main-island-lite.webp`,
  slots: MAIN_BUILDING_POSITIONS,
};
