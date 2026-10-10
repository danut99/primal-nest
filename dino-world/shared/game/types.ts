// Tipurile jocului. Starea e un obiect JSON simplu: se salvează așa cum e (local acum, pe server mai târziu).
// Timpul e mereu în milisecunde (Date.now()), primit din afară: regulile nu citesc ceasul singure.

export type ElementId = 'fire' | 'water' | 'earth' | 'plant' | 'ice' | 'storm';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type EvolutionStage = 'pui' | 'juvenil' | 'adult';
/** Ce crește pe un strat al fermei și când e gata. */
export interface FarmPlot {
  id: string;
  readyAt: number;
}

export type BuildingKind = 'habitat' | 'farm' | 'hatchery' | 'den' | 'arena' | 'outpost' | 'forge';

/** Materialele de forjă, aduse din expediții și din arenă. */
export type MaterialId = 'bone' | 'amber' | 'crystal' | 'meteor';
export type Materials = Partial<Record<MaterialId, number>>;
/** O recompensă (obiective, Atlas): orice combinație de resurse. */
export interface Reward {
  gold?: number;
  food?: number;
  gems?: number;
  fragments?: number;
  materials?: Materials;
}
/** Locurile de echipament ale unui dinozaur. */
export type GearSlot = 'head' | 'body' | 'charm';

export interface Species {
  id: string;
  name: string;
  /** Primul element e cel principal (culoarea dominantă). */
  elements: ElementId[];
  rarity: Rarity;
  /** Scheletul animat din public/dinosaurs (manifest.json → rigs). */
  rig: string;
  description: string;
  /** Aur pe minut la nivelul 1. */
  income: number;
  hatchSeconds: number;
  breedSeconds: number;
  /** Se poate cumpăra ca ou din magazin (doar speciile de bază). */
  shopPrice?: number;
}

export interface Dino {
  id: string;
  species: string;
  nickname?: string;
  level: number;
  /** Clădirea (habitatul) în care stă. */
  habitatId: string;
  recoveryStartsAt?: number;
  recoveryUntil?: number;
  arenaRank?: number;
  /** Echipamentul făurit în forjă, pe locuri (id-uri din ITEMS). */
  gear?: Partial<Record<GearSlot, string>>;
}

export interface ArenaChallenge {
  id: string;
  species: string;
  level: number;
  tier: 'easy' | 'medium' | 'hard';
  gold: number;
  medals: number;
  cost: number;
  claimed: boolean;
  attempts: number;
}
export interface ArenaBoard {
  day: string;
  challenges: ArenaChallenge[];
}
export interface ArenaFrame {
  actor: 'player' | 'enemy';
  playerHp: number;
  enemyHp: number;
  text: string;
  ability: boolean;
}
export interface ArenaDuel {
  day: string;
  challengeId: string;
  fighter: Dino;
  enemy: Dino;
  startedAt: number;
  frames: ArenaFrame[];
  won: boolean;
  playerMaxHp: number;
  enemyMaxHp: number;
  gold: number;
  medals: number;
  /** Materialele câștigate la victorie (salvările vechi nu le au). */
  materials?: Materials;
}

export interface ExpeditionRequirement {
  species?: string;
  element?: ElementId;
  level: number;
}
export interface ExpeditionMission {
  element?: ElementId;
  id: string;
  name: string;
  description: string;
  tier: 'easy' | 'medium' | 'hard';
  seconds: number;
  recoverySeconds: number;
  cost: number;
  gold: number;
  food: number;
  gems: number;
  fragments: number;
  requirements: ExpeditionRequirement[];
}
export interface ExpeditionBoard {
  day: string;
  slots: { id: string; mission: ExpeditionMission; status: 'available' | 'active' | 'completed' }[];
  reserves: ExpeditionMission[];
  chestClaimed: boolean;
}

export interface Egg {
  id: string;
  species: string;
  hatchAt: number;
  /** Ou de habitat: elementul lui (culoarea oului); specia se vede abia la eclozare. */
  element?: ElementId;
}

export interface Building {
  id: string;
  kind: BuildingKind;
  /** Pentru habitate: elementul. */
  element?: ElementId;
  level: number;
  /** Locul de pe insulă (SLOTS). */
  slot: string;
  /** Free coordinates on the main island; old saves fall back to their original slot. */
  position?: { x: number; y: number };
  /** Habitat: aurul strâns până la `since`. */
  stored: number;
  since: number;
  /** Fermă: straturile (câte unul pe nivel, vezi FARM_PLOTS); null = strat liber. */
  plots?: (FarmPlot | null)[];
  /** Salvări vechi: ferma avea un singur strat. Se citește prin `farmPlots`. */
  crop?: FarmPlot;
  /** Forjă: obiectul în lucru. */
  craft?: { itemId: string; readyAt: number };
  /** Habitat: Totemul de aur dublează aurul în acest interval. */
  boost?: { from: number; until: number };
  adventure?: {
    missionId: string;
    dinoIds: string[];
    readyAt: number;
    expedition?: ExpeditionMission;
    expeditionDay?: string;
    slotId?: string;
    duel?: ArenaDuel;
  };
}

export interface Breeding {
  a: string;
  b: string;
  species: string;
  readyAt: number;
}

export interface GameState {
  version: 1;
  seed: number;
  /** Contor pentru id-uri și pentru seed-ul fiecărui eveniment aleator. */
  counter: number;
  gold: number;
  food: number;
  gems: number;
  buildings: Building[];
  dinos: Dino[];
  /** Ouăle din incubator. */
  eggs: Egg[];
  breeding: Breeding | null;
  /** Speciile văzute vreodată (pentru Atlas). */
  discovered: string[];
  /** Highest growth level discovered, retained after selling a dinosaur. */
  evolutionProgress?: Record<string, number>;
  expeditionBoard?: ExpeditionBoard;
  fragments?: number;
  expeditionTraining?: number;
  arenaBoard?: ArenaBoard;
  medals?: number;
  materials?: Materials;
  /** Obiectele făurite, nefolosite: id → câte. */
  items?: Record<string, number>;
  /** Contoare pentru obiective; doar cresc. */
  stats?: {
    expeditions?: number;
    duelsWon?: number;
    crafted?: number;
    bred?: number;
    hatched?: number;
    harvested?: number;
  };
  goalsClaimed?: string[];
  /** Speciile pentru care s-a luat recompensa liniei complete din Atlas. */
  atlasClaimed?: string[];
}

export type GameEvent =
  | { type: 'arenaReward'; won: boolean; gold: number; medals: number }
  | { type: 'adventureReward'; gold: number; food: number; gems: number; fragments?: number }
  | { type: 'expeditionChest'; fragments: number; gems: number }
  | { type: 'hatched'; dinoId: string; species: string }
  | { type: 'bred'; species: string }
  | { type: 'levelUp'; dinoId: string; level: number }
  | { type: 'upgraded'; buildingId: string; kind: BuildingKind; level: number }
  | { type: 'collected'; gold: number }
  | { type: 'harvested'; food: number }
  | { type: 'discovered'; species: string }
  | { type: 'materials'; materials: Materials }
  | { type: 'crafted'; itemId: string }
  | { type: 'reward'; title: string; icon: string; reward: Reward };
