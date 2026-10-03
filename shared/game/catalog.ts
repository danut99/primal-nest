// Conținutul jocului: specii, tipuri, obiecte, ouă, skill-uri, zone. Aici se face echilibrarea.
// Valorile sunt ipoteze de pornire, nu cifre validate.

import type { Branch, Diet, DinoType, GameState, ItemId, LifetimeStats, Rarity, SkillId, Stage, Stats, Temperament, Temperature } from './types';

// ---------- Tipuri ----------

export const TYPES: Record<DinoType, { name: string; color: string; icon: string }> = {
  jungla: { name: 'Junglă', color: '#5aa83c', icon: '🌿' },
  foc: { name: 'Foc', color: '#e8622c', icon: '🔥' },
  apa: { name: 'Apă', color: '#3a8fd8', icon: '💧' },
  piatra: { name: 'Piatră', color: '#9a8466', icon: '🪨' },
  aer: { name: 'Aer', color: '#8ec5e8', icon: '🌪️' },
};

/** Pe cine bate fiecare tip (×1.5). Invers, tipul atacat rezistă (×0.67). */
export const BEATS: Record<DinoType, DinoType[]> = {
  jungla: ['apa', 'piatra'],
  foc: ['jungla'],
  apa: ['foc', 'piatra'],
  piatra: ['foc', 'aer'],
  aer: ['jungla'],
};

export function effectiveness(attack: DinoType | null, defender: readonly DinoType[]): number {
  if (!attack) return 1;
  let mult = 1;
  for (const def of defender) {
    if (BEATS[attack].includes(def)) mult *= 1.5;
    else if (BEATS[def].includes(attack)) mult *= 0.67;
  }
  return mult;
}

// ---------- Specii ----------

export interface Move {
  name: string;
  power: number;
  type: DinoType | null;
}

export interface Species {
  id: string;
  name: string;
  line: string;
  stage: Stage;
  types: DinoType[];
  base: Stats;
  /** Dieta preferată: dublează atașamentul la hrănire. */
  diet: Diet;
  basic: Move;
  special: Move;
  /** Pui → juvenil. */
  evolvesTo?: string;
  /** Juvenil → adult, după dieta dominantă. */
  branches?: Partial<Record<Branch, string>>;
  defaultBranch?: Branch;
  branch?: Branch;
  blurb: string;
}

function line(
  lineId: string,
  types: DinoType,
  diet: Diet,
  basicName: string,
  forms: [
    id: string,
    name: string,
    base: [number, number, number, number],
    special: string,
    blurb: string,
    branch?: Branch,
    extraType?: DinoType,
  ][],
  defaultBranch: Branch,
): Species[] {
  const [pui, juv, ...adults] = forms;
  const make = (f: (typeof forms)[number], stage: Stage, power: number): Species => {
    const [id, name, [hp, atk, def, spd], special, blurb, branch, extraType] = f;
    const allTypes = extraType ? [types, extraType] : [types];
    return {
      id,
      name,
      line: lineId,
      stage,
      types: allTypes,
      base: { hp, atk, def, spd },
      diet,
      basic: { name: basicName, power: 40, type: null },
      special: { name: special, power, type: extraType ?? types },
      branch,
      blurb,
    };
  };
  const branches: Partial<Record<Branch, string>> = {};
  for (const a of adults) branches[a[5]!] = a[0];
  return [
    { ...make(pui, 'pui', 60), evolvesTo: juv[0] },
    { ...make(juv, 'juvenil', 75), branches, defaultBranch },
    ...adults.map((a) => make(a, 'adult', 95)),
  ];
}

export const SPECIES_LIST: Species[] = [
  ...line(
    'sauropod',
    'jungla',
    'plante',
    'Lovitură de coadă',
    [
      ['mugurel', 'Mugurel', [50, 45, 55, 40], 'Frunze tăioase', 'Gât lung și picioare scurte. Ajunge deja la ferigile cele mai fragede.'],
      ['ferigosaur', 'Ferigosaur', [72, 68, 82, 58], 'Bici de liană', 'Își întinde gâtul peste ferigi ca să vadă cine vine.'],
      ['codrodon', 'Codrodon', [110, 90, 120, 60], 'Pădurea vie', 'Pe spatele lui cresc copaci mici. Păsările își fac cuib acolo.', 'colos'],
      ['spinodon', 'Spinodon', [85, 120, 90, 85], 'Ghimpi otrăvitori', 'Spinii de pe gât și coadă îl fac greu de mușcat. Nu-l mângâia pe la spate.', 'pradator'],
    ],
    'colos',
  ),
  ...line(
    'raptor',
    'foc',
    'carne',
    'Mușcătură',
    [
      ['scanteius', 'Scânteiuș', [42, 55, 38, 55], 'Scânteie', 'Strănută scântei când e emoționat. Ține-l departe de fân.'],
      ['jarraptor', 'Jarraptor', [62, 88, 55, 75], 'Mușcătură arzătoare', 'Vânează în haită. Creasta lui arde mai tare când aleargă.'],
      ['vulcanraptor', 'Vulcanraptor', [75, 125, 70, 110], 'Erupție', 'Prin solzi i se vede lava. Pașii lui lasă urme fumegânde.', 'pradator'],
      ['fumaripter', 'Fumaripter', [78, 100, 72, 130], 'Vârtej de cenușă', 'Penele de fum îl ridică deasupra vulcanilor.', 'special', 'aer'],
    ],
    'pradator',
  ),
  ...line(
    'ankylo',
    'piatra',
    'plante',
    'Lovitură de coadă',
    [
      ['pietroi', 'Pietroi', [55, 40, 65, 30], 'Rostogolire', 'Se face ghem și se rostogolește la vale. Uneori intenționat.'],
      ['scutosaur', 'Scutosaur', [80, 65, 100, 35], 'Ploaie de pietre', 'Plăcile de pe spate sunt mai tari decât bazaltul.'],
      ['cetatodon', 'Cetatodon', [110, 80, 150, 40], 'Zid de bazalt', 'Arată ca o cetate mică. Puii se ascund printre crenelurile lui.', 'colos'],
      ['buzduganix', 'Buzduganix', [95, 125, 115, 45], 'Buzdugan seismic', 'Coada lui cutremură pământul. Literalmente.', 'pradator'],
    ],
    'colos',
  ),
  ...line(
    'ptero',
    'aer',
    'insecte',
    'Ciupitură',
    [
      ['aripel', 'Aripel', [40, 48, 37, 65], 'Adiere', 'Încă nu știe să zboare, dar sare foarte convingător.'],
      ['planorix', 'Planorix', [60, 72, 55, 93], 'Picaj', 'Planează ore întregi fără să bată din aripi.'],
      ['furtunodactil', 'Furtunodactil', [70, 115, 65, 130], 'Uragan', 'Unde zboară el, se strâng norii de furtună.', 'pradator'],
      ['norisaur', 'Norisaur', [95, 90, 90, 105], 'Ploaie de nori', 'Aripi pufoase ca norii. Plouă mărunt în jurul lui.', 'special', 'apa'],
    ],
    'pradator',
  ),
];

export const SPECIES: Record<string, Species> = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));
export const BABY_SPECIES = SPECIES_LIST.filter((s) => s.stage === 'pui').map((s) => s.id);
export const STARTERS = ['mugurel', 'scanteius', 'pietroi'] as const;

export const BRANCH_INFO: Record<Branch, { name: string; diet: Diet; hint: string }> = {
  pradator: { name: 'Prădător', diet: 'carne', hint: 'Atac și viteză' },
  colos: { name: 'Colos', diet: 'plante', hint: 'Viață și apărare' },
  special: { name: 'Special', diet: 'insecte', hint: 'Tip dublu' },
};

export const DIET_INFO: Record<Diet, { name: string; icon: string }> = {
  plante: { name: 'Plante', icon: '🌿' },
  carne: { name: 'Carne', icon: '🍖' },
  insecte: { name: 'Insecte', icon: '🐞' },
};

// ---------- Creștere ----------

export const MAX_LEVEL = 50;
/** XP total pentru a ajunge la nivelul L. */
export const levelXp = (level: number) => 30 * (level - 1) ** 2;

export const EVOLUTION = {
  juvenil: { level: 10, bond: 50, seconds: 2 * 3600, item: null as ItemId | null },
  adult: { level: 25, bond: 80, seconds: 8 * 3600, item: 'cristal' as ItemId | null },
};

/** Sațietate: hrana o umple, scade cu 2 puncte pe minut. */
export const FULLNESS_DECAY_PER_MIN = 2;

export const TEMPERATURES: Record<Temperature, { name: string; icon: string; temperament: Temperament }> = {
  cald: { name: 'Nisip fierbinte', icon: '🔥', temperament: 'fioros' },
  rece: { name: 'Peșteră rece', icon: '❄️', temperament: 'calm' },
  fluctuant: { name: 'Vânt schimbător', icon: '🌪️', temperament: 'agitat' },
};

export const TEMPERAMENTS: Record<Temperament, { name: string; up: keyof Stats; down: keyof Stats; text: string }> = {
  fioros: { name: 'Fioros', up: 'atk', down: 'def', text: '+10% Atac, −5% Apărare' },
  calm: { name: 'Calm', up: 'def', down: 'spd', text: '+10% Apărare, −5% Viteză' },
  agitat: { name: 'Agitat', up: 'spd', down: 'hp', text: '+10% Viteză, −5% Viață' },
};

export const STAT_NAMES: Record<keyof Stats, string> = { hp: 'Viață', atk: 'Atac', def: 'Apărare', spd: 'Viteză' };

// ---------- Ouă ----------

export const RARITIES: Record<
  Rarity,
  { name: string; seconds: number; geneMin: number; sell: number; hatchXp: number; shell: string; spot: string }
> = {
  comun: { name: 'Comun', seconds: 15 * 60, geneMin: 0, sell: 40, hatchXp: 20, shell: '#efe2bf', spot: '#b9a06a' },
  neobisnuit: { name: 'Neobișnuit', seconds: 3600, geneMin: 2, sell: 120, hatchXp: 50, shell: '#d9ecc4', spot: '#5c9a3c' },
  rar: { name: 'Rar', seconds: 4 * 3600, geneMin: 4, sell: 350, hatchXp: 120, shell: '#cfe4f6', spot: '#2f76c0' },
  epic: { name: 'Epic', seconds: 12 * 3600, geneMin: 6, sell: 900, hatchXp: 300, shell: '#e3d3f3', spot: '#7a45b8' },
  legendar: { name: 'Legendar', seconds: 24 * 3600, geneMin: 8, sell: 2500, hatchXp: 600, shell: '#f7d98a', spot: '#d7861c' },
};
export const TUTORIAL_EGG_SECONDS = 120;
export const ALBINO_CHANCE = 1 / 512;

// ---------- Împerechere ----------

export const BREED_SECONDS = 6 * 3600;
export const BREED_MAX = 3;
export const BREED_SKILL_LEVEL = 5;
/** Raritatea oului, după stelele genelor medii ale părinților (0–3): părinți mai buni, ou mai rar. */
export const BREED_RARITIES: Record<number, { value: Rarity; weight: number }[]> = {
  0: [
    { value: 'neobisnuit', weight: 80 },
    { value: 'rar', weight: 20 },
  ],
  1: [
    { value: 'neobisnuit', weight: 45 },
    { value: 'rar', weight: 45 },
    { value: 'epic', weight: 10 },
  ],
  2: [
    { value: 'rar', weight: 50 },
    { value: 'epic', weight: 40 },
    { value: 'legendar', weight: 10 },
  ],
  3: [
    { value: 'epic', weight: 60 },
    { value: 'legendar', weight: 40 },
  ],
};
/** Șansa ca o genă să sufere o mutație de ±2 (și cât de mare poate fi). */
export const MUTATION_CHANCE = 0.3;
export const MUTATION_RANGE = 2;
export const TURN_COOLDOWN_SECONDS = 30 * 60;
export const TURN_BONUS = 0.05;

// ---------- Obiecte ----------

export interface ItemDef {
  name: string;
  icon: string;
  sell: number;
  food?: { diet: Diet; xp: number; bond: number; fill: number };
  blurb: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  ferigi: { name: 'Ferigă', icon: '🌿', sell: 2, food: { diet: 'plante', xp: 8, bond: 2, fill: 12 }, blurb: 'Gustarea preferată a ierbivorelor.' },
  fructe: { name: 'Fruct de cicadă', icon: '🍒', sell: 4, food: { diet: 'plante', xp: 12, bond: 3, fill: 15 }, blurb: 'Dulce și zemos.' },
  insecte: { name: 'Insecte', icon: '🐞', sell: 4, food: { diet: 'insecte', xp: 12, bond: 3, fill: 12 }, blurb: 'Crocante. Pentru unii.' },
  carne: { name: 'Carne crudă', icon: '🍖', sell: 5, food: { diet: 'carne', xp: 12, bond: 3, fill: 18 }, blurb: 'Adusă din expediții.' },
  salata: { name: 'Salată de ferigi', icon: '🥗', sell: 12, food: { diet: 'plante', xp: 45, bond: 6, fill: 30 }, blurb: 'Gătită cu grijă. Mult mai hrănitoare.' },
  friptura: { name: 'Friptură', icon: '🍗', sell: 15, food: { diet: 'carne', xp: 50, bond: 6, fill: 35 }, blurb: 'Prădătorii o adoră.' },
  mix_insecte: { name: 'Mix de insecte', icon: '🍡', sell: 15, food: { diet: 'insecte', xp: 50, bond: 6, fill: 30 }, blurb: 'Prăjite crocant.' },
  lut: { name: 'Lut', icon: '🟫', sell: 3, blurb: 'Bun pentru cuiburi trainice.' },
  os: { name: 'Os vechi', icon: '🦴', sell: 6, blurb: 'Saurok le preface în scântei la forjă.' },
  bazalt: { name: 'Bazalt', icon: '🪨', sell: 8, blurb: 'Piatră vulcanică, foarte tare.' },
  fosila: { name: 'Fosilă', icon: '🐚', sell: 40, blurb: 'Urmă a unei creaturi străvechi.' },
  chihlimbar: { name: 'Chihlimbar', icon: '🟠', sell: 60, blurb: 'În el au supraviețuit ultimele ouă, 66 de milioane de ani.' },
  cristal: { name: 'Cristal Stelar', icon: '💎', sell: 150, blurb: 'Fragment din steaua care a schimbat dinozaurii. Necesar pentru evoluția în adult.' },
  os_alfa: { name: 'Os de Alfa', icon: '🗝️', sell: 80, blurb: 'Cheia spre craterul unde domnește Alfa Umbrei.' },
};

// ---------- Skill-uri ----------

export const SKILLS: Record<SkillId, { name: string; icon: string; blurb: string }> = {
  cules: { name: 'Cules', icon: '🌿', blurb: 'Ferigi, fructe și insecte pentru hrană.' },
  sapaturi: { name: 'Săpături', icon: '⛏️', blurb: 'Fosile, minerale și, uneori, ouă.' },
  bucatarie: { name: 'Bucătărie', icon: '🍳', blurb: 'Hrană gătită: mai mult XP și atașament.' },
  incubatie: { name: 'Incubație', icon: '🥚', blurb: 'Ouă mai rapide (−1% timp/nivel, max −30%).' },
  imblanzire: { name: 'Îmblânzire', icon: '🦖', blurb: 'Haită mai mare și mai multe ouă sălbatice.' },
};
export const MAX_SKILL_LEVEL = 20;
export const skillXp = (level: number) => 50 * (level - 1) ** 2;

export interface GatherAction {
  id: string;
  skill: 'cules' | 'sapaturi';
  name: string;
  icon: string;
  level: number;
  seconds: number;
  xp: number;
  drops: { value: ItemId; weight: number }[];
  egg?: { chance: number; rarities: { value: Rarity; weight: number }[] };
}

export const GATHER_ACTIONS: GatherAction[] = [
  { id: 'ferigi', skill: 'cules', name: 'Ferigi', icon: '🌿', level: 1, seconds: 6, xp: 4, drops: [{ value: 'ferigi', weight: 1 }] },
  { id: 'fructe', skill: 'cules', name: 'Fructe de cicadă', icon: '🍒', level: 3, seconds: 10, xp: 7, drops: [{ value: 'fructe', weight: 1 }] },
  { id: 'insecte', skill: 'cules', name: 'Insecte', icon: '🐞', level: 5, seconds: 12, xp: 9, drops: [{ value: 'insecte', weight: 1 }] },
  {
    id: 'nisip',
    skill: 'sapaturi',
    name: 'Strat de nisip',
    icon: '🏜️',
    level: 1,
    seconds: 10,
    xp: 6,
    drops: [
      { value: 'lut', weight: 55 },
      { value: 'os', weight: 40 },
      { value: 'chihlimbar', weight: 5 },
    ],
    egg: { chance: 0.02, rarities: [{ value: 'comun', weight: 1 }] },
  },
  {
    id: 'lut',
    skill: 'sapaturi',
    name: 'Strat de lut',
    icon: '🧱',
    level: 5,
    seconds: 14,
    xp: 10,
    drops: [
      { value: 'lut', weight: 35 },
      { value: 'os', weight: 35 },
      { value: 'fosila', weight: 20 },
      { value: 'chihlimbar', weight: 10 },
    ],
    egg: {
      chance: 0.03,
      rarities: [
        { value: 'comun', weight: 80 },
        { value: 'neobisnuit', weight: 20 },
      ],
    },
  },
  {
    id: 'bazalt',
    skill: 'sapaturi',
    name: 'Strat de bazalt',
    icon: '🌋',
    level: 10,
    seconds: 20,
    xp: 16,
    drops: [
      { value: 'bazalt', weight: 50 },
      { value: 'os', weight: 20 },
      { value: 'fosila', weight: 15 },
      { value: 'chihlimbar', weight: 12 },
      { value: 'cristal', weight: 3 },
    ],
    egg: {
      chance: 0.04,
      rarities: [
        { value: 'neobisnuit', weight: 70 },
        { value: 'rar', weight: 30 },
      ],
    },
  },
];
export const GATHER_CAP_SECONDS = 8 * 3600;

export interface Recipe {
  id: string;
  name: string;
  output: ItemId;
  level: number;
  seconds: number;
  xp: number;
  inputs: Partial<Record<ItemId, number>>;
}

export const RECIPES: Recipe[] = [
  { id: 'salata', name: 'Salată de ferigi', output: 'salata', level: 1, seconds: 8, xp: 6, inputs: { ferigi: 3 } },
  { id: 'mix_insecte', name: 'Mix de insecte', output: 'mix_insecte', level: 2, seconds: 10, xp: 9, inputs: { insecte: 3 } },
  { id: 'friptura', name: 'Friptură', output: 'friptura', level: 3, seconds: 10, xp: 9, inputs: { carne: 2 } },
];
export const MAX_COOK_BATCH = 50;
/** Câte activități pot aștepta în coadă după cea curentă. */
export const QUEUE_MAX = 2;
export const MAX_GATHER_COUNT = 1000;

// ---------- Relicve (inspirate din armele străvechi din Dinoblade) ----------

/** Relicvele se câștigă eliberând un Alfa. Un dinozaur poartă una; la forjă poate fi întărită până la nivelul 5. */
export interface Relic {
  id: string;
  name: string;
  icon: string;
  color: string;
  bonus: Partial<Record<keyof Stats, number>>;
  blurb: string;
}

export const RELICS: Record<string, Relic> = {
  colti_licurici: {
    id: 'colti_licurici',
    name: 'Colții Licuricilor',
    icon: '🗡️',
    color: '#d9ff6a',
    bonus: { atk: 0.15 },
    blurb: 'Doi colți de lumină verde, smulși de la Alfa Junglei.',
  },
  lama_junglei: {
    id: 'lama_junglei',
    name: 'Lama de Chihlimbar',
    icon: '⚔️',
    color: '#ffb347',
    bonus: { atk: 0.15, spd: 0.1 },
    blurb: 'Chihlimbar din pereții canionului, șlefuit de Saurok într-o lamă. Taie prin ceața Umbrei.',
  },
  pana_furtunii: {
    id: 'pana_furtunii',
    name: 'Pana Furtunii',
    icon: '🪶',
    color: '#8fd8ff',
    bonus: { spd: 0.2, def: 0.1 },
    blurb: 'Pana Alfei Furtunii. Cine o poartă se mișcă iute ca fulgerul.',
  },
  coroana_vulcanului: {
    id: 'coroana_vulcanului',
    name: 'Coroana Vulcanului',
    icon: '👑',
    color: '#ffb347',
    bonus: { hp: 0.2, atk: 0.2, def: 0.2, spd: 0.2 },
    blurb: 'Purtată de Alfa Umbrei. Cine o poartă comandă respectul tuturor prădătorilor.',
  },
};

export const MAX_RELIC_LEVEL = 5;

/** Bonusul unei relicve la un nivel: fiecare nivel peste 1 adaugă +25% din bonusul de bază (nivelul 5 = dublu). */
export function relicBonus(relic: Relic, key: keyof Stats, level: number): number {
  return (relic.bonus[key] ?? 0) * (1 + 0.25 * (level - 1));
}

/** Costul întăririi, după nivelul curent al relicvei. */
export const RELIC_UPGRADES: Record<number, { sparks: number; cost: Partial<Record<ItemId, number>> }> = {
  1: { sparks: 100, cost: { bazalt: 3 } },
  2: { sparks: 200, cost: { bazalt: 6, fosila: 2 } },
  3: { sparks: 300, cost: { bazalt: 9, cristal: 1 } },
  4: { sparks: 400, cost: { bazalt: 12, cristal: 2 } },
};

// ---------- Regiuni și Alfa ----------

export interface Alpha {
  speciesId: string;
  title: string;
  level: number;
  hpMult: number;
  /** Cheie consumată la fiecare încercare (doar pentru Alfa final). */
  key?: ItemId;
  sparks: number;
  rewards: Partial<Record<ItemId, number>>;
  egg: Rarity;
  relic: string;
}

export interface Zone {
  id: string;
  name: string;
  icon: string;
  levels: [number, number];
  enemies: string[];
  count: [number, number];
  seconds: number;
  tier: number;
  drops: { item: ItemId; chance: number; qty: [number, number] }[];
  egg: { chance: number; rarities: { value: Rarity; weight: number }[] };
  /** Regiunea se deschide după ce învingi Alfa regiunii anterioare. */
  requires?: string;
  /** Alfa care păzește drumul mai departe. */
  alpha: Alpha;
  blurb: string;
}

export const ZONES: Zone[] = [
  {
    id: 'jungla',
    name: 'Jungla Cețurilor',
    icon: '🌿',
    levels: [1, 8],
    enemies: ['mugurel', 'aripel', 'pietroi', 'scanteius'],
    count: [1, 2],
    seconds: 45,
    tier: 1,
    drops: [
      { item: 'carne', chance: 0.5, qty: [1, 1] },
      { item: 'os', chance: 0.3, qty: [1, 1] },
      { item: 'ferigi', chance: 0.3, qty: [1, 3] },
    ],
    egg: { chance: 0.015, rarities: [{ value: 'neobisnuit', weight: 1 }] },
    alpha: { speciesId: 'ferigosaur', title: 'Alfa Junglei', level: 10, hpMult: 3, sparks: 120, rewards: { fosila: 1 }, egg: 'rar', relic: 'colti_licurici' },
    blurb: 'Copaci uriași, ferigi cât casa și licurici în ceața dimineții. Puii corupți vânează aici în grupuri mici.',
  },
  {
    id: 'canion',
    name: 'Canionul de Chihlimbar',
    icon: '🦴',
    levels: [9, 16],
    enemies: ['ferigosaur', 'jarraptor', 'scutosaur', 'planorix'],
    count: [2, 3],
    seconds: 60,
    tier: 2,
    requires: 'jungla',
    drops: [
      { item: 'carne', chance: 0.7, qty: [1, 2] },
      { item: 'os', chance: 0.5, qty: [1, 2] },
      { item: 'fosila', chance: 0.15, qty: [1, 1] },
      { item: 'chihlimbar', chance: 0.08, qty: [1, 1] },
      { item: 'os_alfa', chance: 0.04, qty: [1, 1] },
    ],
    egg: {
      chance: 0.02,
      rarities: [
        { value: 'neobisnuit', weight: 40 },
        { value: 'rar', weight: 60 },
      ],
    },
    alpha: { speciesId: 'scutosaur', title: 'Alfa Canionului', level: 18, hpMult: 4, sparks: 250, rewards: { cristal: 1 }, egg: 'rar', relic: 'lama_junglei' },
    blurb: 'Stânci roșii cu schelete uriașe în pereți și chihlimbar care strălucește în piatră. Aici se găsesc Oase de Alfa.',
  },
  {
    id: 'piscuri',
    name: 'Piscurile Furtunii',
    icon: '⛈️',
    levels: [17, 24],
    enemies: ['planorix', 'jarraptor', 'scutosaur', 'furtunodactil'],
    count: [2, 3],
    seconds: 65,
    tier: 3,
    requires: 'canion',
    drops: [
      { item: 'carne', chance: 0.8, qty: [2, 3] },
      { item: 'os', chance: 0.4, qty: [1, 2] },
      { item: 'bazalt', chance: 0.25, qty: [1, 1] },
      { item: 'os_alfa', chance: 0.05, qty: [1, 1] },
      { item: 'cristal', chance: 0.02, qty: [1, 1] },
    ],
    egg: {
      chance: 0.02,
      rarities: [
        { value: 'rar', weight: 80 },
        { value: 'epic', weight: 20 },
      ],
    },
    alpha: { speciesId: 'furtunodactil', title: 'Alfa Furtunii', level: 25, hpMult: 4, sparks: 350, rewards: { cristal: 1, bazalt: 3 }, egg: 'epic', relic: 'pana_furtunii' },
    blurb: 'Piscuri deasupra norilor, cuiburi goale și fulgere. Zburătorii corupți atacă din vânt.',
  },
  {
    id: 'vulcan',
    name: 'Inima Vulcanului',
    icon: '🌋',
    levels: [25, 32],
    enemies: ['spinodon', 'codrodon', 'cetatodon', 'furtunodactil', 'fumaripter'],
    count: [2, 3],
    seconds: 75,
    tier: 4,
    requires: 'piscuri',
    drops: [
      { item: 'carne', chance: 0.9, qty: [2, 4] },
      { item: 'bazalt', chance: 0.5, qty: [1, 2] },
      { item: 'chihlimbar', chance: 0.15, qty: [1, 1] },
      { item: 'cristal', chance: 0.03, qty: [1, 1] },
    ],
    egg: {
      chance: 0.02,
      rarities: [
        { value: 'rar', weight: 70 },
        { value: 'epic', weight: 30 },
      ],
    },
    alpha: {
      speciesId: 'vulcanraptor',
      title: 'Alfa Umbrei',
      level: 33,
      hpMult: 5,
      key: 'os_alfa',
      sparks: 500,
      rewards: { cristal: 2 },
      egg: 'epic',
      relic: 'coroana_vulcanului',
    },
    blurb: 'Craterul unde a căzut steaua. Aici domnește Alfa Umbrei, cel mai vechi prădător corupt. Învinge-l sau vei fi devorat.',
  },
];

export const EXPEDITION_CAP_SECONDS = 10 * 3600;
export const MAX_BATTLE_ROUNDS = 30;
export const RETREAT_AFTER_LOSSES = 3;
export const SPECIAL_COOLDOWN = 3;
/** Sălbaticii au statistici reduse; haita crescută cu grijă are avantaj la nivel egal. */
export const WILD_STAT_MULT = 0.75;

// ---------- Tabăra ----------

export interface PropertyLevel {
  name: string;
  nestSlots: number;
  cost: Partial<Record<ItemId, number>>;
  sparks: number;
  unlocks: string;
  /** Câte posturi de muncă are Tabăra la acest nivel. */
  workSlots: number;
}

export const PROPERTY_LEVELS: PropertyLevel[] = [
  { name: 'Cuib de ferigi', nestSlots: 2, workSlots: 1, cost: {}, sparks: 0, unlocks: '2 locuri în cuib, 1 post de muncă' },
  { name: 'Cuib de lut', nestSlots: 3, workSlots: 2, cost: { lut: 15 }, sparks: 100, unlocks: '3 locuri în cuib, 2 posturi de muncă și Bucătăria' },
  { name: 'Bârlog de piatră', nestSlots: 4, workSlots: 3, cost: { bazalt: 20, os: 15 }, sparks: 1500, unlocks: '4 locuri în cuib, 3 posturi de muncă' },
];

// ---------- Haita la muncă ----------

export interface WorkJob {
  id: string;
  name: string;
  icon: string;
  /** Skill-ul jucătorului care primește XP din munca haitei. */
  skill: SkillId;
  /** Secunde pe bucată pentru un pui de nivel 1, fără bonusuri. */
  seconds: number;
  xp: number;
  dinoXp: number;
  /** Tipurile care lucrează cu +50% mai repede. */
  types: DinoType[];
  drops: { value: ItemId; weight: number }[];
  blurb: string;
}

export const WORK_JOBS: WorkJob[] = [
  {
    id: 'culegator',
    name: 'Culegător',
    icon: '🌿',
    skill: 'cules',
    seconds: 45,
    xp: 2,
    dinoXp: 3,
    types: ['jungla', 'apa'],
    drops: [
      { value: 'ferigi', weight: 50 },
      { value: 'fructe', weight: 30 },
      { value: 'insecte', weight: 20 },
    ],
    blurb: 'Adună ferigi, fructe și insecte de pe malul mlaștinii.',
  },
  {
    id: 'sapator',
    name: 'Săpător',
    icon: '⛏️',
    skill: 'sapaturi',
    seconds: 90,
    xp: 4,
    dinoXp: 4,
    types: ['piatra'],
    drops: [
      { value: 'lut', weight: 40 },
      { value: 'os', weight: 35 },
      { value: 'bazalt', weight: 12 },
      { value: 'fosila', weight: 9 },
      { value: 'chihlimbar', weight: 4 },
    ],
    blurb: 'Râcâie pământul după lut, oase și, uneori, chihlimbar.',
  },
  {
    id: 'vanator',
    name: 'Vânător',
    icon: '🍖',
    skill: 'imblanzire',
    seconds: 90,
    xp: 3,
    dinoXp: 5,
    types: ['foc', 'aer'],
    drops: [
      { value: 'carne', weight: 75 },
      { value: 'os', weight: 25 },
    ],
    blurb: 'Pândește prada la marginea junglei și aduce carne în tabără.',
  },
];
export const WORK_CAP_SECONDS = 8 * 3600;

export const START_SPARKS = 150;

// ---------- Foame și diamante ----------

/** După atâtea ore fără mâncare, Haita te avertizează. */
export const HUNGRY_WARN_HOURS = 24;
/** După atâtea ore fără mâncare, dinozaurul fuge în sălbăticie. */
export const RUNAWAY_HOURS = 72;
/** Câte diamante costă să aduci înapoi un dinozaur fugit, după stadiu. */
export const RETURN_COST: Record<Stage, number> = { pui: 3, juvenil: 5, adult: 8 };
export const START_DIAMONDS = 5;
export const ALPHA_FIRST_DIAMONDS = 10;
export const ALPHA_REPEAT_DIAMONDS = 1;
/** Șansa ca o victorie obișnuită să dea un diamant. */
export const WIN_DIAMOND_CHANCE = 0.01;

// ---------- Troaca și eliberarea ----------

/** Din troacă, un dino mănâncă singur după atâtea ore fără masă. */
export const TROUGH_HOURS = 12;
export const TROUGH_CAPACITY = 200;
export const RELEASE_STAGE_SPARKS: Record<Stage, number> = { pui: 0, juvenil: 60, adult: 200 };

// ---------- Formația ----------

/** Rândul din spate e ferit cât timp cineva stă în față, dar lovește cu 15% mai slab. */
export const BACK_ROW_DAMAGE = 0.85;

// ---------- Misiuni zilnice ----------

export interface DailyQuest {
  id: string;
  title: string;
  icon: string;
  stat: keyof LifetimeStats;
  goal: number;
  sparks: number;
  diamonds: number;
  /** Apare doar când jucătorul o poate face. */
  requires?: (s: GameState) => boolean;
}

export const QUESTS_PER_DAY = 3;
export const DAILY_QUESTS: DailyQuest[] = [
  { id: 'feed5', title: 'Hrănește haita de 5 ori', icon: '🍖', stat: 'feeds', goal: 5, sparks: 40, diamonds: 1 },
  { id: 'gather40', title: 'Fă 40 de acțiuni de cules sau săpat', icon: '⛏️', stat: 'gathers', goal: 40, sparks: 50, diamonds: 1 },
  { id: 'win5', title: 'Câștigă 5 lupte', icon: '⚔️', stat: 'wins', goal: 5, sparks: 60, diamonds: 1, requires: (s) => s.dinos.length > 0 },
  { id: 'win20', title: 'Câștigă 20 de lupte', icon: '🗡️', stat: 'wins', goal: 20, sparks: 120, diamonds: 2, requires: (s) => s.dinos.length > 0 },
  { id: 'hatch1', title: 'Eclozează un ou', icon: '🐣', stat: 'hatches', goal: 1, sparks: 50, diamonds: 1 },
  { id: 'cook10', title: 'Gătește 10 porții', icon: '🍳', stat: 'cooks', goal: 10, sparks: 60, diamonds: 1, requires: (s) => s.property >= 1 },
  { id: 'work20', title: 'Strânge 20 de bucăți de la muncă', icon: '🦖', stat: 'work', goal: 20, sparks: 50, diamonds: 1, requires: (s) => s.dinos.length > 0 },
];

// ---------- Realizări ----------

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  text: string;
  measure: keyof LifetimeStats | 'species' | 'albino' | 'generation' | 'alphas' | 'adult' | 'relicMax' | 'threeStars';
  goal: number;
  diamonds: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'hatch1', title: 'Primul pui', icon: '🐣', text: 'Eclozează primul ou.', measure: 'hatches', goal: 1, diamonds: 2 },
  { id: 'hatch25', title: 'Mamă de dinozauri', icon: '🥚', text: 'Eclozează 25 de ouă.', measure: 'hatches', goal: 25, diamonds: 10 },
  { id: 'species5', title: 'Naturalist', icon: '📖', text: 'Deține 5 specii în Atlas.', measure: 'species', goal: 5, diamonds: 5 },
  { id: 'species12', title: 'Paleontolog', icon: '🦴', text: 'Deține 12 specii în Atlas.', measure: 'species', goal: 12, diamonds: 15 },
  { id: 'albino', title: 'Alb ca luna', icon: '🤍', text: 'Găsește un dinozaur albino.', measure: 'albino', goal: 1, diamonds: 10 },
  { id: 'adult', title: 'A crescut mare', icon: '🦖', text: 'Crește primul adult.', measure: 'adult', goal: 1, diamonds: 5 },
  { id: 'stars3', title: 'Sânge pur', icon: '⭐', text: 'Ai un dinozaur cu gene ⭐⭐⭐.', measure: 'threeStars', goal: 1, diamonds: 5 },
  { id: 'gen3', title: 'Linie de sânge', icon: '💞', text: 'Ajungi la generația 3.', measure: 'generation', goal: 3, diamonds: 10 },
  { id: 'gen5', title: 'Dinastie', icon: '👑', text: 'Ajungi la generația 5.', measure: 'generation', goal: 5, diamonds: 20 },
  { id: 'alpha1', title: 'Vânător de Alfa', icon: '⚔️', text: 'Învinge primul Alfa.', measure: 'alphas', goal: 1, diamonds: 5 },
  { id: 'alpha3', title: 'Umbra se retrage', icon: '🌋', text: 'Învinge toți cei 4 Alfa.', measure: 'alphas', goal: 4, diamonds: 20 },
  { id: 'relicmax', title: 'Forjat în stele', icon: '🔥', text: 'Întărește o relicvă la nivelul maxim.', measure: 'relicMax', goal: 1, diamonds: 10 },
  { id: 'wins100', title: 'Neînfricat', icon: '🗡️', text: 'Câștigă 100 de lupte.', measure: 'wins', goal: 100, diamonds: 10 },
  { id: 'feeds100', title: 'Bucătarul haitei', icon: '🍲', text: 'Hrănește de 100 de ori.', measure: 'feeds', goal: 100, diamonds: 5 },
];
