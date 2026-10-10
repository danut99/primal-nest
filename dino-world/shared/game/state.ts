// Starea inițială și ajutoare comune (id-uri, căutări, erori).

import { migrateRemovedSpecies } from './species-migration';
import { SLOTS, START } from './catalog';
import { recordEvolution } from './evolution';
import { ensureExpeditionBoard } from './expeditions';
import { dailyArena } from './arena';
import type { Building, BuildingKind, Dino, GameState } from './types';

export class GameError extends Error {}

export function makeId(state: GameState, prefix: string): string {
  state.counter += 1;
  return `${prefix}${state.counter}`;
}

export function newGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const state: GameState = {
    version: 1,
    seed,
    counter: 0,
    ...START,
    buildings: [],
    dinos: [],
    eggs: [],
    breeding: null,
    discovered: ['ignisaur'],
  };
  const add = (kind: BuildingKind, slot: string, extra: Partial<Building> = {}) => {
    const b: Building = { id: makeId(state, 'b'), kind, level: 1, slot, stored: 0, since: now, ...extra };
    state.buildings.push(b);
    return b;
  };
  // Începi doar cu incubatorul și o fermă; puiul stă în incubator până deblochezi lumea de foc.
  // Bârlogul, avanpostul, arena și forja se construiesc din Extinde, când se deblochează.
  const nursery = add('hatchery', 'hatchery');
  add('farm', 'p4');
  state.dinos.push({ id: makeId(state, 'd'), species: 'ignisaur', level: 1, habitatId: nursery.id });
  // după pui: lista zilnică de expediții ține cont de elementele pe care le ai
  ensureMainBuildings(state, now);
  return state;
}

/** Completează salvările vechi cu câmpurile noi, fără să schimbe progresul. */
export function ensureMainBuildings(state: GameState, now: number): GameState {
  migrateRemovedSpecies(state);
  state.fragments ??= 0;
  state.materials ??= {};
  state.items ??= {};
  state.medals ??= 0;
  state.arenaBoard = dailyArena(state, now);
  state.expeditionTraining ??= 0;
  ensureExpeditionBoard(state, now);
  for (const d of state.dinos) recordEvolution(state, d.species, d.level);
  return state;
}

export function findBuilding(state: GameState, id: string): Building {
  const b = state.buildings.find((x) => x.id === id);
  if (!b) throw new GameError('Clădirea nu există.');
  return b;
}

export function findDino(state: GameState, id: string): Dino {
  const d = state.dinos.find((x) => x.id === id);
  if (!d) throw new GameError('Dinozaurul nu există.');
  return d;
}

export function spend(state: GameState, currency: 'gold' | 'food' | 'gems', amount: number) {
  if (state[currency] < amount) {
    const label = { gold: 'aur', food: 'hrană', gems: 'nestemate' }[currency];
    throw new GameError(`Nu ai destul(ă) ${label} (ai nevoie de ${amount}).`);
  }
  state[currency] -= amount;
}

export const buildingOf = (state: GameState, kind: BuildingKind) => state.buildings.find((b) => b.kind === kind);

/** Contoarele pentru obiective: doar cresc (nu se pierd dacă vinzi sau cheltui ceva). */
export function countStat(s: GameState, key: keyof NonNullable<GameState['stats']>) {
  s.stats ??= {};
  s.stats[key] = (s.stats[key] ?? 0) + 1;
}
