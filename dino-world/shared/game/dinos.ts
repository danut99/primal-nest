// Ouă, incubator, eclozare, hrănire și împerechere.

import { BREED_LEVEL, FEED_COST, HATCHERY_SLOTS, MAX_LEVEL, SPECIES, speciesOf } from './catalog';
import { DEN_RECIPES, EGG_SPECIES } from './habitat-species';
import { createRng, mixSeed, weighted } from './rng';
import { recordEvolution } from './evolution';
import { GameError, buildingOf, countStat, findBuilding, findDino, makeId, spend } from './state';
import { habitatCapacity, residents, settle } from './world';
import type { Dino, ElementId, GameEvent, GameState, Species } from './types';
import { isRecovering } from './expeditions';

// ---------- incubator ----------

export function hatcherySlots(state: GameState): number {
  const h = buildingOf(state, 'hatchery');
  return h ? HATCHERY_SLOTS[h.level - 1] : 0;
}

function addEgg(state: GameState, species: Species, now: number, element?: ElementId) {
  if (state.eggs.length >= hatcherySlots(state)) throw new GameError('Incubatorul e plin.');
  state.eggs.push({
    id: makeId(state, 'e'),
    species: species.id,
    hatchAt: now + species.hatchSeconds * 1000,
    ...(element ? { element } : {}),
  });
}

// ---------- ouă de habitat ----------

/** Prețul oului fiecărui habitat. */
export const HABITAT_EGG_PRICE: Record<ElementId, number> = {
  fire: 150,
  water: 250,
  earth: 350,
  plant: 450,
  ice: 550,
  storm: 700,
};

/** Ce iese dintr-un ou de habitat: mereu specia de bază a lumii (rarele vin doar din Bârlog). */
export function habitatEggOdds(element: ElementId): { species: Species; pct: number }[] {
  return [{ species: speciesOf(EGG_SPECIES[element]), pct: 100 }];
}

/** Oul unui habitat: specia se alege acum (determinist), dar rămâne ascunsă până la eclozare. */
export function buyHabitatEgg(state: GameState, element: ElementId, now: number) {
  if (!state.buildings.some((b) => b.kind === 'habitat' && b.element === element))
    throw new GameError('Deblochează întâi lumea acestui element.');
  if (state.eggs.length >= hatcherySlots(state)) throw new GameError('Incubatorul e plin.');
  const rng = createRng(mixSeed(state.seed, state.counter++));
  const species = weighted(
    rng,
    habitatEggOdds(element).map((o) => ({ value: o.species, weight: o.pct })),
  );
  spend(state, 'gold', HABITAT_EGG_PRICE[element]);
  addEgg(state, species, now, element);
}

export function buyEgg(state: GameState, speciesId: string, now: number) {
  const s = speciesOf(speciesId);
  if (!s.shopPrice) throw new GameError('Specia aceasta se obține doar prin împerechere.');
  if (state.eggs.length >= hatcherySlots(state)) throw new GameError('Incubatorul e plin.');
  spend(state, 'gold', s.shopPrice);
  addEgg(state, s, now);
}

/** Puiul iese din ou direct în habitatul ales. */
export function hatch(state: GameState, eggId: string, habitatId: string, now: number, events: GameEvent[]): Dino {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg) throw new GameError('Oul nu există.');
  if (now < egg.hatchAt) throw new GameError('Oul nu e gata.');
  const home = findBuilding(state, habitatId);
  checkHome(state, egg.species, home.id);
  settle(state, home, now);
  state.eggs = state.eggs.filter((e) => e !== egg);
  const dino: Dino = { id: makeId(state, 'd'), species: egg.species, level: 1, habitatId: home.id };
  state.dinos.push(dino);
  recordEvolution(state, dino.species, dino.level);
  events.push({ type: 'hatched', dinoId: dino.id, species: dino.species });
  countStat(state, 'hatched');
  if (!state.discovered.includes(dino.species)) {
    state.discovered.push(dino.species);
    events.push({ type: 'discovered', species: dino.species });
  }
  return dino;
}

function checkHome(state: GameState, speciesId: string, habitatId: string, ignoreDino?: string) {
  const home = findBuilding(state, habitatId);
  const s = speciesOf(speciesId);
  if (home.kind !== 'habitat' || !s.elements.includes(home.element!))
    throw new GameError(`${s.name} nu poate locui în acest habitat.`);
  if (residents(state, home.id).filter((d) => d.id !== ignoreDino).length >= habitatCapacity(home))
    throw new GameError('Habitatul e plin.');
}

// ---------- dinozauri ----------

export function feed(state: GameState, dinoId: string, now: number, events: GameEvent[]) {
  const d = findDino(state, dinoId);
  if (d.level >= MAX_LEVEL) throw new GameError('E deja la nivelul maxim.');
  spend(state, 'food', FEED_COST[d.level]);
  settle(state, findBuilding(state, d.habitatId), now);
  d.level += 1;
  recordEvolution(state, d.species, d.level);
  events.push({ type: 'levelUp', dinoId: d.id, level: d.level });
}

export function moveDino(state: GameState, dinoId: string, habitatId: string, now: number) {
  const d = findDino(state, dinoId);
  if (d.habitatId === habitatId) return;
  checkHome(state, d.species, habitatId, d.id);
  settle(state, findBuilding(state, d.habitatId), now);
  settle(state, findBuilding(state, habitatId), now);
  d.habitatId = habitatId;
}

export function rename(state: GameState, dinoId: string, nickname: string) {
  const d = findDino(state, dinoId);
  const name = nickname.trim().slice(0, 20);
  if (name) d.nickname = name;
  else delete d.nickname;
}

/** Vinde un dinozaur pentru aur (ultimul nu se poate vinde). */
export const sellPrice = (d: Dino) => Math.round((speciesOf(d.species).shopPrice ?? 300) * 0.5 * d.level);
export function sellDino(state: GameState, dinoId: string, now: number) {
  const sold = findDino(state, dinoId);
  recordEvolution(state, sold.species, sold.level);
  const d = findDino(state, dinoId);
  if (state.dinos.length <= 1) throw new GameError('Nu poți vinde ultimul dinozaur.');
  if (state.breeding && (state.breeding.a === d.id || state.breeding.b === d.id))
    throw new GameError('E în bârlog acum.');
  settle(state, findBuilding(state, d.habitatId), now);
  state.dinos = state.dinos.filter((x) => x !== d);
  state.gold += sellPrice(d);
  // echipamentul se întoarce în inventar
  state.items ??= {};
  for (const id of Object.values(d.gear ?? {})) if (id) state.items[id] = (state.items[id] ?? 0) + 1;
}

// ---------- împerechere ----------

/** Șansa (%) unei specii rare din perechea ei; doi adulți (nivel ADULT_LEVEL+) au în plus ADULT_BONUS. */
export const DEN_RARE_CHANCE = 25;
export const DEN_ADULT_BONUS = 10;
const ADULT_LEVEL = 7;
/** După ce oul e gata, părinții se odihnesc atâta (nu pot încerca la nesfârșit). */
export const DEN_REST_MS = 3 * 3600 * 1000;

/** Specia rară pe care o poate da perechea (în orice ordine), dacă există. */
export function denRecipeFor(a: string, b: string): string | undefined {
  return Object.keys(DEN_RECIPES).find((rare) => {
    const [x, y] = DEN_RECIPES[rare];
    return (x === a && y === b) || (x === b && y === a);
  });
}

/** Indiciul unei rețete încă nedescoperite: elementele părinților, nu speciile. */
export function denRecipeHint(rare: string): ElementId[] {
  return DEN_RECIPES[rare].map((id) => speciesOf(id).elements[0]);
}

/**
 * Ce iese din doi părinți: specia unuia dintre ei (jumătate-jumătate) sau, doar din perechea rețetei, specia rară
 * (DEN_RARE_CHANCE%, plus DEN_ADULT_BONUS dacă amândoi sunt adulți).
 */
export function breedOdds(a: Species, b: Species, adults = false): { species: Species; pct: number }[] {
  const rare = denRecipeFor(a.id, b.id);
  const rarePct = rare ? DEN_RARE_CHANCE + (adults ? DEN_ADULT_BONUS : 0) : 0;
  const parents = a.id === b.id ? [a] : [a, b];
  const rows = parents.map((p) => ({ species: p, pct: (100 - rarePct) / parents.length }));
  if (rare) rows.push({ species: speciesOf(rare), pct: rarePct });
  return rows.sort((x, y) => y.pct - x.pct);
}

export function startBreeding(state: GameState, aId: string, bId: string, now: number) {
  if (!buildingOf(state, 'den')) throw new GameError('Nu ai bârlog.');
  if (state.breeding) throw new GameError('Bârlogul e ocupat.');
  if (aId === bId) throw new GameError('Alege doi dinozauri diferiți.');
  const a = findDino(state, aId);
  const b = findDino(state, bId);
  if ([a, b].some((d) => isRecovering(d, now))) throw new GameError('Un părinte se odihnește încă.');
  if (a.level < BREED_LEVEL || b.level < BREED_LEVEL)
    throw new GameError(`Ambii părinți trebuie să fie cel puțin nivelul ${BREED_LEVEL}.`);
  const rng = createRng(mixSeed(state.seed, state.counter++));
  const odds = breedOdds(speciesOf(a.species), speciesOf(b.species), a.level >= ADULT_LEVEL && b.level >= ADULT_LEVEL);
  const child = weighted(
    rng,
    odds.map((o) => ({ value: o.species, weight: o.pct })),
  );
  const readyAt = now + child.breedSeconds * 1000;
  state.breeding = { a: a.id, b: b.id, species: child.id, readyAt };
  // după ce oul e gata, părinții se odihnesc (aceeași odihnă ca după expediții)
  for (const d of [a, b]) {
    d.recoveryStartsAt = readyAt;
    d.recoveryUntil = readyAt + DEN_REST_MS;
  }
}

/** Oul din bârlog trece în incubator. */
export function finishBreeding(state: GameState, now: number, events: GameEvent[]) {
  const br = state.breeding;
  if (!br) throw new GameError('Nu se împerechează nimeni.');
  if (now < br.readyAt) throw new GameError('Încă nu e gata.');
  addEgg(state, speciesOf(br.species), now);
  state.breeding = null;
  events.push({ type: 'bred', species: br.species });
  countStat(state, 'bred');
}

export function cancelBreeding(state: GameState) {
  state.breeding = null;
}
