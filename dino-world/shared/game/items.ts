// Forja: materialele, rețetele și ce face fiecare obiect. Doar date și calcule pure (fără comenzi), ca să le
// poată folosi și puterea dinozaurilor, aurul habitatelor și recompensele, fără importuri circulare.

import type { Building, Dino, GameState, GearSlot, Materials, MaterialId } from './types';

export const MATERIALS: Record<MaterialId, { name: string; icon: string }> = {
  bone: { name: 'Os', icon: '🦴' },
  amber: { name: 'Chihlimbar', icon: '🔶' },
  crystal: { name: 'Cristal', icon: '💠' },
  meteor: { name: 'Fier de meteorit', icon: '☄️' },
};
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export const GEAR_SLOTS: Record<GearSlot, { name: string; icon: string }> = {
  head: { name: 'Cap', icon: '🪖' },
  body: { name: 'Corp', icon: '🛡️' },
  charm: { name: 'Talisman', icon: '🔮' },
};

export type ItemKind = 'gear' | 'consumable' | 'part';
export interface Item {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  /** Echipament: pe ce loc se pune. */
  slot?: GearSlot;
  /** Nivelul forjei de la care se poate face. */
  level: number;
  seconds: number;
  gold: number;
  materials: Materials;
  /** Echipament: putere în plus; venit și materiale din expediții în plus (fracție, 0.2 = +20%). */
  power?: number;
  income?: number;
  loot?: number;
  /** Ce face, pe scurt (pentru fișă). */
  effect: string;
}

const min = 60;
const list: Item[] = [
  // echipament
  {
    id: 'bone-helm',
    name: 'Coif de os',
    icon: '🪖',
    kind: 'gear',
    slot: 'head',
    level: 1,
    seconds: 5 * min,
    gold: 150,
    materials: { bone: 6 },
    power: 12,
    effect: '+12 putere',
  },
  {
    id: 'amber-armor',
    name: 'Armură de chihlimbar',
    icon: '🛡️',
    kind: 'gear',
    slot: 'body',
    level: 2,
    seconds: 15 * min,
    gold: 400,
    materials: { amber: 5, bone: 4 },
    income: 0.2,
    effect: '+20% aur',
  },
  {
    id: 'crystal-charm',
    name: 'Talisman de cristal',
    icon: '🔮',
    kind: 'gear',
    slot: 'charm',
    level: 2,
    seconds: 20 * min,
    gold: 600,
    materials: { crystal: 3, amber: 2 },
    loot: 0.25,
    effect: '+25% materiale din expediții',
  },
  {
    id: 'meteor-fangs',
    name: 'Colți de meteorit',
    icon: '🗡️',
    kind: 'gear',
    slot: 'head',
    level: 3,
    seconds: 45 * min,
    gold: 1200,
    materials: { meteor: 2, crystal: 2 },
    power: 30,
    effect: '+30 putere',
  },
  {
    id: 'meteor-plate',
    name: 'Platoșă de meteorit',
    icon: '⛓️',
    kind: 'gear',
    slot: 'body',
    level: 3,
    seconds: 60 * min,
    gold: 1500,
    materials: { meteor: 3, amber: 4 },
    income: 0.4,
    power: 10,
    effect: '+40% aur · +10 putere',
  },
  // consumabile
  {
    id: 'fertilizer',
    name: 'Fertilizator',
    icon: '🧪',
    kind: 'consumable',
    level: 1,
    seconds: 2 * min,
    gold: 40,
    materials: { bone: 2 },
    effect: 'Un strat al fermei e gata pe loc',
  },
  {
    id: 'elixir',
    name: 'Elixir de odihnă',
    icon: '🍵',
    kind: 'consumable',
    level: 1,
    seconds: 3 * min,
    gold: 80,
    materials: { amber: 1, bone: 1 },
    effect: 'Un dinozaur iese din odihnă',
  },
  {
    id: 'warm-stone',
    name: 'Piatră caldă',
    icon: '♨️',
    kind: 'consumable',
    level: 2,
    seconds: 8 * min,
    gold: 150,
    materials: { crystal: 1, amber: 1 },
    effect: 'Un ou eclozează pe loc',
  },
  {
    id: 'gold-totem',
    name: 'Totem de aur',
    icon: '🗿',
    kind: 'consumable',
    level: 2,
    seconds: 10 * min,
    gold: 250,
    materials: { crystal: 1, amber: 2 },
    effect: 'O lume dă aur dublu o oră',
  },
  // piese pentru clădiri
  {
    id: 'fossil-beam',
    name: 'Grindă de fosilă',
    icon: '🪵',
    kind: 'part',
    level: 1,
    seconds: 6 * min,
    gold: 120,
    materials: { bone: 8 },
    effect: 'Piesă pentru îmbunătățiri',
  },
  {
    id: 'amber-lens',
    name: 'Lentilă de chihlimbar',
    icon: '🔆',
    kind: 'part',
    level: 2,
    seconds: 15 * min,
    gold: 400,
    materials: { amber: 6, crystal: 1 },
    effect: 'Piesă pentru îmbunătățiri',
  },
  {
    id: 'meteor-core',
    name: 'Miez de meteorit',
    icon: '⚙️',
    kind: 'part',
    level: 3,
    seconds: 40 * min,
    gold: 1000,
    materials: { meteor: 3, crystal: 2 },
    effect: 'Piesă pentru îmbunătățiri',
  },
];
export const ITEMS: Record<string, Item> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ITEM_LIST = list;

/** Cât durează Totemul de aur. */
export const TOTEM_MS = 60 * 60_000;

/** Materialele din expediții, pe dificultate (înainte de bonusul talismanelor). */
export const EXPEDITION_MATERIALS: Record<'easy' | 'medium' | 'hard', Materials> = {
  easy: { bone: 4, amber: 1 },
  medium: { bone: 4, amber: 2, crystal: 1 },
  hard: { amber: 2, crystal: 2, meteor: 1 },
};
/** Materialele unei victorii în arenă, pe adversar. */
export const ARENA_MATERIALS: Record<'easy' | 'medium' | 'hard', Materials> = {
  easy: { bone: 2 },
  medium: { bone: 2, amber: 1 },
  hard: { bone: 3, meteor: 1 },
};

/**
 * Piesele cerute de următorul nivel al clădirii. Primele niveluri merg doar cu aur; cele mari cer piese
 * din forjă (și ultimul, fragmente: FINAL_LEVEL_FRAGMENTS).
 */
export function buildingUpgradeParts(b: Pick<Building, 'kind' | 'level'>): Record<string, number> {
  const next = b.level + 1;
  switch (b.kind) {
    case 'habitat':
      return next === 3
        ? { 'fossil-beam': 1 }
        : next === 4
          ? { 'amber-lens': 1 }
          : next === 5
            ? { 'meteor-core': 1 }
            : {};
    case 'farm':
      return next === 3 ? { 'fossil-beam': 1 } : {};
    case 'hatchery':
      return next === 2 ? { 'amber-lens': 1 } : {};
    case 'arena':
    case 'outpost':
      return next === 2 ? { 'fossil-beam': 2 } : {};
    case 'forge':
      return next === 2 ? { 'fossil-beam': 2 } : next === 3 ? { 'amber-lens': 2 } : {};
    default:
      return {};
  }
}

/** Suma bonusurilor din echipamentul unui dinozaur. */
export function gearBonus(d: Pick<Dino, 'gear'>) {
  let power = 0,
    income = 0,
    loot = 0;
  for (const id of Object.values(d.gear ?? {})) {
    const item = id ? ITEMS[id] : undefined;
    power += item?.power ?? 0;
    income += item?.income ?? 0;
    loot += item?.loot ?? 0;
  }
  return { power, income, loot };
}

/** `m` înmulțit cu `factor`, rotunjit în sus (orice bonus aduce cel puțin o bucată în plus). */
export function scaleMaterials(m: Materials, factor: number): Materials {
  return Object.fromEntries(
    Object.entries(m).map(([k, n]) => [k, factor === 1 ? n : Math.ceil((n ?? 0) * factor)]),
  ) as Materials;
}

export const hasMaterials = (s: GameState, m: Materials) =>
  MATERIAL_IDS.every((k) => (s.materials?.[k] ?? 0) >= (m[k] ?? 0));

export function addMaterials(s: GameState, m: Materials) {
  s.materials ??= {};
  for (const k of MATERIAL_IDS) if (m[k]) s.materials[k] = (s.materials[k] ?? 0) + m[k]!;
}
