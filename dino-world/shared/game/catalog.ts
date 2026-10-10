// Echilibrarea jocului: elemente, specii, clădiri, culturi. Doar date; regulile stau în celelalte fișiere.

import type { BuildingKind, ElementId, Rarity, Species } from './types';
import { HABITAT_SPECIES } from './habitat-species';

export const ELEMENTS: Record<ElementId, { name: string; color: string; icon: string }> = {
  fire: { name: 'Foc', color: '#e8572a', icon: '🔥' },
  water: { name: 'Apă', color: '#2f8fd8', icon: '💧' },
  earth: { name: 'Pământ', color: '#a8743a', icon: '⛰️' },
  plant: { name: 'Junglă', color: '#4caf50', icon: '🌿' },
  ice: { name: 'Gheață', color: '#8fd3f0', icon: '❄️' },
  storm: { name: 'Furtună', color: '#9b6bff', icon: '⚡' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS) as ElementId[];
export const WORLD_UNLOCK_COST: Record<ElementId, number> = {
  fire: 100,
  water: 300,
  earth: 500,
  plant: 750,
  ice: 1000,
  storm: 1500,
};

export const RARITIES: Record<Rarity, { name: string; color: string; breedWeight: number }> = {
  common: { name: 'Comun', color: '#b8c4b0', breedWeight: 100 },
  rare: { name: 'Rar', color: '#4fb3ff', breedWeight: 35 },
  epic: { name: 'Epic', color: '#c77dff', breedWeight: 10 },
  legendary: { name: 'Legendar', color: '#ffc845', breedWeight: 3 },
};

const min = 60;
const hour = 3600;

/**
 * Speciile: cele douăsprezece din habitate (două pe element, schelete pictate în rig-lab/tempest-studio) și Ignisaur,
 * puiul de la început (schelet propriu, scripts/build-ignisaur.mjs).
 */
export const SPECIES: Species[] = [
  ...HABITAT_SPECIES,
  // De bază: un singur element, se cumpără din magazin.
  {
    id: 'ignisaur',
    name: 'Ignisaur',
    elements: ['fire'],
    rarity: 'common',
    rig: 'ignisaur-adult',
    income: 6,
    hatchSeconds: 30,
    breedSeconds: 30,
    shopPrice: 100,
    description: 'Solzi de jar și respirație fierbinte.',
  },
];

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesOf(id: string): Species {
  const s = SPECIES_BY_ID.get(id);
  if (!s) throw new Error(`Specie necunoscută: ${id}`);
  return s;
}

// ---------- dinozauri ----------

export const MAX_LEVEL = 10;
/** Nivelul minim pentru împerechere. */
export const BREED_LEVEL = 4;
/**
 * Hrana pentru trecerea de la nivelul n la n+1 (index = nivelul curent). Primii pași sunt ieftini (puiul crește
 * repede), apoi fiecare vârstă cere tot mai mult: juvenil ~155, adult ~1.600, nivelul 10 ~7.900 în total.
 */
export const FEED_COST = [0, 15, 40, 100, 220, 450, 800, 1300, 2000, 3000];

/** Aur pe minut: crește cu 40% pe nivel. */
export const incomeAt = (species: Species, level: number) => Math.round(species.income * (1 + 0.4 * (level - 1)));

// ---------- clădiri ----------

export interface BuildingSpec {
  name: string;
  /** Cost pe nivel (index = nivelul la care ajungi - 1). */
  cost: number[];
  /** Cât se pot construi (habitatele: pe element). */
  limit: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingSpec> = {
  arena: { name: 'Arena dinozaurilor', cost: [200, 800], limit: 1 },
  outpost: { name: 'Avanpostul expedițiilor', cost: [250, 800], limit: 1 },
  habitat: { name: 'Lume', cost: [100, 500, 2000, 5000, 10000], limit: 1 },
  farm: { name: 'Fermă', cost: [50, 600, 2500], limit: 4 },
  hatchery: { name: 'Incubator', cost: [0, 1000], limit: 1 },
  den: { name: 'Bârlogul împerecherii', cost: [300], limit: 1 },
  forge: { name: 'Forja', cost: [400, 1500, 4000], limit: 1 },
};

/** Habitat: locuri și aur maxim strâns, pe nivel. */
export const MAX_HABITAT_LEVEL = 5;
export const HABITAT_CAPACITY: Record<ElementId, number[]> = {
  fire: [2, 3, 4, 6, 10],
  water: [2, 3, 5, 7, 10],
  earth: [2, 4, 6, 8, 10],
  plant: [2, 4, 7, 9, 10],
  ice: [2, 5, 7, 9, 10],
  storm: [2, 5, 8, 9, 10],
};
/** Later unlocks grow faster, with upgrade prices scaled by their unlock tier. */
export const HABITAT_UPGRADE_COST = Object.fromEntries(
  ELEMENT_IDS.map((element, tier) => [
    element,
    [
      WORLD_UNLOCK_COST[element],
      ...[1000, 3500, 8000, 15000].map((cost) => Math.round((cost * (1 + tier * 0.25)) / 50) * 50),
    ],
  ]),
) as Record<ElementId, number[]>;
export const HABITAT_GOLD_CAP = [300, 1200, 5000, 10000, 20000];
/** Incubator: ouă deodată, pe nivel. */
export const HATCHERY_SLOTS = [2, 3];
/** Ultimul nivel al unei clădiri cere și fragmente ancestrale (din expediții), pe lângă aur. */
export const FINAL_LEVEL_FRAGMENTS: Record<BuildingKind, number> = {
  habitat: 40,
  farm: 15,
  hatchery: 25,
  den: 0,
  arena: 30,
  outpost: 30,
  forge: 30,
};
/** Fermă: straturi de cultură pe nivel. */
export const FARM_PLOTS = [1, 2, 3];

export interface Crop {
  id: string;
  name: string;
  cost: number;
  seconds: number;
  food: number;
}

export const CROPS: Crop[] = [
  { id: 'ferigi', name: 'Ferigi', cost: 10, seconds: 30, food: 10 },
  { id: 'cicade', name: 'Cicade', cost: 50, seconds: 5 * min, food: 40 },
  { id: 'ginkgo', name: 'Ginkgo', cost: 200, seconds: 30 * min, food: 150 },
  { id: 'carne', name: 'Carne afumată', cost: 800, seconds: 2 * hour, food: 500 },
];

// ---------- lume ----------

export interface Slot {
  id: string;
  /** Ce se poate construi aici. */
  accepts: BuildingKind[];
}

/**
 * Locurile de pe insulă (ca în Dragon City): parcelele de pământ primesc habitate sau ferme; incubatorul și
 * bârlogul au locurile lor. Pozițiile pe imagine stau în src/world/islands.ts.
 */
const MAIN_BUILDING_KINDS: BuildingKind[] = ['farm', 'hatchery', 'den', 'arena', 'outpost', 'forge'];
export const SLOTS: Slot[] = [
  { id: 'arena', accepts: MAIN_BUILDING_KINDS },
  { id: 'outpost', accepts: MAIN_BUILDING_KINDS },
  ...Array.from({ length: 18 }, (_, i): Slot => ({ id: `world${i}`, accepts: ['habitat'] })),
  { id: 'p0', accepts: ['habitat'] },
  { id: 'p1', accepts: ['habitat', ...MAIN_BUILDING_KINDS] },
  { id: 'p2', accepts: ['habitat', ...MAIN_BUILDING_KINDS] },
  { id: 'p3', accepts: ['habitat', ...MAIN_BUILDING_KINDS] },
  { id: 'p4', accepts: ['habitat', ...MAIN_BUILDING_KINDS] },
  { id: 'hatchery', accepts: MAIN_BUILDING_KINDS },
  { id: 'den', accepts: MAIN_BUILDING_KINDS },
];
export const SLOTS_BY_ID = new Map(SLOTS.map((s) => [s.id, s]));

/** Prețul în nestemate pentru a termina acum un temporizator: 1 pe fiecare 5 minute rămase. */
export const rushCost = (msLeft: number) => Math.max(1, Math.ceil(msLeft / (5 * 60_000)));

export const START = { gold: 500, food: 50, gems: 20 };
