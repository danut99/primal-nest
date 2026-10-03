// Stare nouă și ajutoare comune: inventar, skill-uri, id-uri, generarea ouălor.

import {
  ALBINO_CHANCE,
  BABY_SPECIES,
  MAX_SKILL_LEVEL,
  RARITIES,
  SPECIES,
  START_SPARKS,
  STARTERS,
  TEMPERATURES,
  skillXp,
} from './catalog';
import { GameError } from './errors';
import { type Rng, createRng, pick, randInt } from './rng';
import type { Egg, GameEvent, GameState, ItemId, Rarity, SkillId, Temperature } from './types';

export function newGame(
  playerName: string,
  starter: (typeof STARTERS)[number],
  temperature: Temperature,
  now: number,
  seed: number,
): GameState {
  const name = playerName.trim();
  if (name.length < 2 || name.length > 16) throw new GameError('VALIDATION', 'Numele trebuie să aibă 2–16 caractere.');
  if (!STARTERS.includes(starter)) throw new GameError('VALIDATION', 'Ou de start necunoscut.');
  if (!TEMPERATURES[temperature]) throw new GameError('VALIDATION', 'Temperatură necunoscută.');

  const state: GameState = {
    version: 1,
    playerName: name,
    createdAt: now,
    sparks: START_SPARKS,
    inventory: { ferigi: 6 },
    eggs: [],
    dinos: [],
    party: [],
    skills: { cules: 0, sapaturi: 0, bucatarie: 0, incubatie: 0, imblanzire: 0 },
    property: 0,
    activity: null,
    atlas: {},
    nextId: 1,
    rngSeed: seed >>> 0,
    tutorialDone: [],
    alphas: [],
    relics: [],
  };
  // Oul de start: neobișnuit, dar eclozează în 2 minute.
  const egg = makeEgg(state, createRng(state.rngSeed), starter, 'neobisnuit');
  egg.tutorial = true;
  // Puiul de start nu poate fi albino; varianta rară trebuie găsită.
  egg.variant = 'normal';
  state.eggs.push(egg);
  return state;
}

export function makeId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function makeEgg(state: GameState, rng: Rng, speciesId: string | null, rarity: Rarity): Egg {
  const species = speciesId ?? pick(rng, BABY_SPECIES);
  if (SPECIES[species]?.stage !== 'pui') throw new GameError('VALIDATION', 'Oul trebuie să conțină un pui.');
  const min = RARITIES[rarity].geneMin;
  return {
    id: makeId(state, 'egg'),
    speciesId: species,
    rarity,
    genes: { hp: randInt(rng, min, 15), atk: randInt(rng, min, 15), def: randInt(rng, min, 15), spd: randInt(rng, min, 15) },
    variant: rng() < ALBINO_CHANCE ? 'albino' : 'normal',
  };
}

// ---------- Inventar ----------

export function itemCount(state: GameState, item: ItemId): number {
  return state.inventory[item] ?? 0;
}

export function addItem(state: GameState, item: ItemId, qty: number) {
  if (qty <= 0) return;
  state.inventory[item] = itemCount(state, item) + qty;
}

export function hasItems(state: GameState, cost: Partial<Record<ItemId, number>>, times = 1): boolean {
  return Object.entries(cost).every(([item, qty]) => itemCount(state, item as ItemId) >= (qty ?? 0) * times);
}

export function removeItems(state: GameState, cost: Partial<Record<ItemId, number>>, times = 1) {
  if (!hasItems(state, cost, times)) throw new GameError('INSUFFICIENT_ITEMS', 'Nu ai destule materiale.');
  for (const [item, qty] of Object.entries(cost)) {
    const left = itemCount(state, item as ItemId) - (qty ?? 0) * times;
    if (left > 0) state.inventory[item as ItemId] = left;
    else delete state.inventory[item as ItemId];
  }
}

// ---------- Skill-uri ----------

export function skillLevel(state: GameState, skill: SkillId): number {
  const xp = state.skills[skill];
  let level = 1;
  while (level < MAX_SKILL_LEVEL && xp >= skillXp(level + 1)) level++;
  return level;
}

export function addSkillXp(state: GameState, skill: SkillId, xp: number, events: GameEvent[]) {
  const before = skillLevel(state, skill);
  state.skills[skill] += xp;
  const after = skillLevel(state, skill);
  if (after > before) events.push({ kind: 'levelup', text: `${skillName(skill)} a ajuns la nivelul ${after}!` });
}

const SKILL_NAMES: Record<SkillId, string> = {
  cules: 'Cules',
  sapaturi: 'Săpături',
  bucatarie: 'Bucătărie',
  incubatie: 'Incubație',
  imblanzire: 'Îmblânzire',
};
const skillName = (skill: SkillId) => SKILL_NAMES[skill];

// ---------- Atlas ----------

export function markSeen(state: GameState, speciesId: string) {
  state.atlas[speciesId] = { ...state.atlas[speciesId], seen: true, owned: state.atlas[speciesId]?.owned ?? false };
}

export function markOwned(state: GameState, speciesId: string, albino: boolean) {
  const prev = state.atlas[speciesId];
  state.atlas[speciesId] = { seen: true, owned: true, albino: prev?.albino || albino };
}

export function markTutorial(state: GameState, key: string) {
  if (!state.tutorialDone.includes(key)) state.tutorialDone.push(key);
}
