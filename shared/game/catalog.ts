// Conținutul jocului: specii, tipuri, obiecte, ouă, skill-uri, zone. Aici se face echilibrarea.
// Valorile sunt ipoteze de pornire, nu cifre validate.

import type { Branch, Diet, DinoType, ItemId, Rarity, SkillId, Stage, Stats, Temperament, Temperature } from './types';

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
    'ceratops',
    'jungla',
    'plante',
    'Împunsătură',
    [
      ['mugurel', 'Mugurel', [50, 45, 55, 40], 'Frunze tăioase', 'Doarme sub ferigi. Mugurele din frunte crește când e fericit.'],
      ['ferigosaur', 'Ferigosaur', [72, 68, 82, 58], 'Coarne de liană', 'Gulerul lui de frunze se deschide când se sperie.'],
      ['codrodon', 'Codrodon', [110, 90, 120, 60], 'Pădurea vie', 'Pe spatele lui cresc copaci mici. Păsările își fac cuib acolo.', 'colos'],
      ['spinodon', 'Spinodon', [85, 120, 90, 85], 'Ghimpi otrăvitori', 'Gulerul s-a umplut de spini. Nu-l mângâia pe la spate.', 'pradator'],
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
    'plesio',
    'apa',
    'insecte',
    'Val mic',
    [
      ['stropel', 'Stropel', [55, 45, 45, 45], 'Stropitoare', 'Face baloane când râde. Râde des.'],
      ['valusaur', 'Valusaur', [85, 70, 65, 60], 'Val', 'Gâtul lung îl ajută să prindă libelule deasupra apei.'],
      ['abisaurus', 'Abisaurus', [125, 95, 105, 55], 'Tsunami', 'Când se scufundă, nivelul lagunei scade vizibil.', 'colos'],
      ['fulgerin', 'Fulgerin', [90, 110, 75, 105], 'Fulger marin', 'Aripioarele lui strălucesc ca fulgerele în furtună.', 'special', 'aer'],
    ],
    'colos',
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
export const STARTERS = ['mugurel', 'scanteius', 'stropel'] as const;

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

// ---------- Relicve (inspirate din armele străvechi din Dinoblade) ----------

/** Relicvele se câștigă eliberând un Alfa. Un dinozaur poartă una; ea plutește lângă el și strălucește. */
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
    blurb: 'Doi colți de lumină verde, smulși de la Alfa Mlaștinii.',
  },
  lama_junglei: {
    id: 'lama_junglei',
    name: 'Lama Junglei',
    icon: '⚔️',
    color: '#5cffb0',
    bonus: { atk: 0.15, spd: 0.1 },
    blurb: 'Lamă de cristal stelar, forjată de Saurok. Taie prin ceața Umbrei.',
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
    id: 'mlastina',
    name: 'Mlaștina Licuricilor',
    icon: '🪷',
    levels: [1, 8],
    enemies: ['mugurel', 'stropel', 'aripel', 'pietroi', 'scanteius'],
    count: [1, 2],
    seconds: 45,
    tier: 1,
    drops: [
      { item: 'carne', chance: 0.5, qty: [1, 1] },
      { item: 'os', chance: 0.3, qty: [1, 1] },
      { item: 'ferigi', chance: 0.3, qty: [1, 3] },
    ],
    egg: { chance: 0.015, rarities: [{ value: 'neobisnuit', weight: 1 }] },
    alpha: { speciesId: 'ferigosaur', title: 'Alfa Mlaștinii', level: 10, hpMult: 3, sparks: 120, rewards: { fosila: 1 }, egg: 'rar', relic: 'colti_licurici' },
    blurb: 'Ceață joasă, licurici uriași și pui corupți care vânează în grupuri mici.',
  },
  {
    id: 'jungla',
    name: 'Jungla Cețurilor',
    icon: '🌴',
    levels: [9, 16],
    enemies: ['ferigosaur', 'jarraptor', 'planorix', 'scutosaur', 'valusaur'],
    count: [2, 3],
    seconds: 60,
    tier: 2,
    requires: 'mlastina',
    drops: [
      { item: 'carne', chance: 0.8, qty: [2, 3] },
      { item: 'os', chance: 0.4, qty: [1, 2] },
      { item: 'fosila', chance: 0.1, qty: [1, 1] },
      { item: 'os_alfa', chance: 0.04, qty: [1, 1] },
    ],
    egg: {
      chance: 0.02,
      rarities: [
        { value: 'neobisnuit', weight: 40 },
        { value: 'rar', weight: 60 },
      ],
    },
    alpha: { speciesId: 'jarraptor', title: 'Alfa Junglei', level: 18, hpMult: 4, sparks: 250, rewards: { cristal: 1 }, egg: 'rar', relic: 'lama_junglei' },
    blurb: 'O junglă deasă, învăluită în ceață. Haite întregi de juvenili corupți. Aici se găsesc Oase de Alfa.',
  },
  {
    id: 'vulcan',
    name: 'Inima Vulcanului',
    icon: '🌋',
    levels: [22, 30],
    enemies: ['spinodon', 'abisaurus', 'cetatodon', 'furtunodactil', 'fumaripter'],
    count: [2, 3],
    seconds: 75,
    tier: 3,
    requires: 'jungla',
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
      level: 30,
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
}

export const PROPERTY_LEVELS: PropertyLevel[] = [
  { name: 'Cuib de ferigi', nestSlots: 2, cost: {}, sparks: 0, unlocks: '2 locuri în cuib' },
  { name: 'Cuib de lut', nestSlots: 3, cost: { lut: 15 }, sparks: 100, unlocks: '3 locuri în cuib și Bucătăria' },
  { name: 'Bârlog de piatră', nestSlots: 4, cost: { bazalt: 20, os: 15 }, sparks: 1500, unlocks: '4 locuri în cuib' },
];

export const START_SPARKS = 150;
