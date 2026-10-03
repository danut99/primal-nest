// Tipurile comune ale jocului. Fără React, fără DOM: aceleași reguli vor rula și pe server.

export type DinoType = 'jungla' | 'foc' | 'apa' | 'piatra' | 'aer';
export type Stage = 'pui' | 'juvenil' | 'adult';
export type Branch = 'pradator' | 'colos' | 'special';
export type Diet = 'plante' | 'carne' | 'insecte';
export type Rarity = 'comun' | 'neobisnuit' | 'rar' | 'epic' | 'legendar';
export type Temperature = 'cald' | 'rece' | 'fluctuant';
export type Temperament = 'fioros' | 'calm' | 'agitat';
export type Variant = 'normal' | 'albino';
export type StatKey = 'hp' | 'atk' | 'def' | 'spd';
export type Stats = Record<StatKey, number>;

export type SkillId = 'cules' | 'sapaturi' | 'bucatarie' | 'incubatie' | 'imblanzire';

export type ItemId =
  | 'ferigi'
  | 'fructe'
  | 'insecte'
  | 'carne'
  | 'salata'
  | 'friptura'
  | 'mix_insecte'
  | 'lut'
  | 'os'
  | 'bazalt'
  | 'fosila'
  | 'chihlimbar'
  | 'cristal'
  | 'os_alfa';

export interface Egg {
  id: string;
  /** Specia puiului care va ieși (mereu stadiul „pui”). */
  speciesId: string;
  rarity: Rarity;
  /** Ascunse până la eclozare; lumânarea dezvăluie un indiciu. */
  genes: Stats;
  variant: Variant;
  /** Oul de tutorial eclozează mai repede. */
  tutorial?: boolean;
  candled?: boolean;
  /** Doar la ouăle din împerechere. */
  lineage?: Lineage;
  /** Prezent doar când oul e în cuib. */
  incubation?: {
    temperature: Temperature;
    startedAt: number;
    endsAt: number;
    lastTurnedAt?: number;
  };
}

export interface Dino {
  id: string;
  speciesId: string;
  nickname: string;
  level: number;
  xp: number;
  bond: number;
  genes: Stats;
  temperament: Temperament;
  variant: Variant;
  /** Ultimele 20 de diete; decid ramura de adult. */
  diets: Diet[];
  /** Sațietate 0–100 la momentul fullAt; scade în timp. */
  fullness: number;
  fullAt: number;
  hatchedAt: number;
  /** Relicva purtată (id din RELICS). */
  relic?: string;
  /** Năpârlirea: evoluția pe timp. */
  molt?: { targetSpeciesId: string; startedAt: number; endsAt: number };
  /** Părinții și generația, pentru dinozaurii din împerechere. */
  lineage?: Lineage;
  /** De câte ori s-a împerecheat (maximum BREED_MAX). */
  breeds?: number;
  /** Raritatea oului din care a ieșit (lipsește la dinozaurii vechi). */
  rarity?: Rarity;
}

/** Contoare pe toată viața jocului: misiunile și realizările se uită la ele. */
export interface LifetimeStats {
  feeds: number;
  wins: number;
  hatches: number;
  gathers: number;
  cooks: number;
  work: number;
  breeds: number;
  releases: number;
}

export interface DailyState {
  day: number;
  /** Contoarele de la începutul zilei; progresul = acum − base. */
  base: LifetimeStats;
  quests: string[];
  claimed: string[];
  bonusClaimed: boolean;
}

export interface Lineage {
  parents: [string, string];
  generation: number;
}

export interface Breeding {
  a: string;
  b: string;
  startedAt: number;
  endsAt: number;
  seed: number;
}

export type Activity =
  | { kind: 'gather'; actionId: string; startedAt: number; seed: number; index: number; limit?: number }
  | { kind: 'cook'; recipeId: string; startedAt: number; count: number; done: number }
  | { kind: 'expedition'; zoneId: string; startedAt: number; seed: number; index: number; losses?: number };

/** O activitate care așteaptă în coadă; pornește când se termină cea curentă. */
export type QueuedAction =
  | { kind: 'gather'; actionId: string; count: number }
  | { kind: 'cook'; recipeId: string; count: number }
  | { kind: 'expedition'; zoneId: string };

/** Un dinozaur pus la muncă într-un post din Tabără. */
export interface Worker {
  dinoId: string;
  jobId: string;
  startedAt: number;
  seed: number;
  index: number;
}

export interface AtlasEntry {
  seen: boolean;
  owned: boolean;
  albino?: boolean;
}

export interface GameState {
  version: 1;
  playerName: string;
  createdAt: number;
  sparks: number;
  inventory: Partial<Record<ItemId, number>>;
  eggs: Egg[];
  dinos: Dino[];
  /** Id-urile dinozaurilor din haită, în ordinea de luptă. */
  party: string[];
  skills: Record<SkillId, number>; // XP total per skill
  property: number; // index în PROPERTY_LEVELS
  activity: Activity | null;
  atlas: Record<string, AtlasEntry>;
  /** Contor pentru id-uri deterministe. */
  nextId: number;
  /** Seed de bază pentru ouăle găsite în afara activităților. */
  rngSeed: number;
  tutorialDone: string[];
  /** Regiunile al căror Alfa a fost învins. */
  alphas: string[];
  /** Relicvele câștigate (fiecare e unică). */
  relics: string[];
  /** Nivelul fiecărei relicve întărite (lipsă = 1). */
  relicLevels: Record<string, number>;
  workers: Worker[];
  queue: QueuedAction[];
  breeding: Breeding | null;
  /** Diamante: moneda rară, câștigată din Alfa și, rar, din lupte. */
  diamonds: number;
  /** Dinozaurii care au fugit în sălbăticie de foame. */
  wild: { dino: Dino; leftAt: number }[];
  /** Mâncarea din troacă: dinozaurii flămânzi mănâncă singuri din ea. */
  trough: Partial<Record<ItemId, number>>;
  stats: LifetimeStats;
  daily: DailyState | null;
  streak: { count: number; lastDay: number };
  achievements: string[];
  /** Dinozaurii din haită care stau în rândul din spate. */
  backRow: string[];
  /** Versiunea hărții de expediții (2 = cele 4 regiuni: junglă, canion, piscuri, vulcan). */
  zonesVersion?: number;
}

export interface GameEvent {
  kind: 'info' | 'reward' | 'levelup' | 'hatch' | 'evolve' | 'egg' | 'warning';
  text: string;
  dinoId?: string;
  eggId?: string;
}
