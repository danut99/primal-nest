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
}

export type Activity =
  | { kind: 'gather'; actionId: string; startedAt: number; seed: number; index: number }
  | { kind: 'cook'; recipeId: string; startedAt: number; count: number; done: number }
  | { kind: 'expedition'; zoneId: string; startedAt: number; seed: number; index: number; losses?: number };

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
}

export interface GameEvent {
  kind: 'info' | 'reward' | 'levelup' | 'hatch' | 'evolve' | 'egg' | 'warning';
  text: string;
  dinoId?: string;
  eggId?: string;
}
