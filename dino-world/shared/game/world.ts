// Insula: clădirile pe grilă, habitatele care produc aur și fermele care produc hrană.

import {
  BUILDINGS,
  CROPS,
  FARM_PLOTS,
  FINAL_LEVEL_FRAGMENTS,
  HABITAT_CAPACITY,
  HABITAT_GOLD_CAP,
  HABITAT_UPGRADE_COST,
  SLOTS,
  SLOTS_BY_ID,
  WORLD_UNLOCK_COST,
  incomeAt,
  speciesOf,
} from './catalog';
import { GameError, countStat, findBuilding, makeId, spend } from './state';
import { ITEMS, buildingUpgradeParts, gearBonus } from './items';
import { FREE_BUILDING_SCALE, buildingPositionError, positionError, type BuildingPosition } from './building-placement';
import type { Building, BuildingKind, Dino, ElementId, FarmPlot, GameEvent, GameState } from './types';

// ---------- locuri ----------

/** Se poate pune o clădire `kind` pe locul `slot`? `ignore` = clădirea care se mută. */
export function canPlace(state: GameState, kind: BuildingKind, slot: string, ignore?: string): boolean {
  const s = SLOTS_BY_ID.get(slot);
  if (!s || !s.accepts.includes(kind)) return false;
  return !state.buildings.some((b) => b.slot === slot && b.id !== ignore);
}

export const freeSlots = (state: GameState, kind: BuildingKind, ignore?: string) =>
  SLOTS.filter((s) => canPlace(state, kind, s.id, ignore));

export function unlockWorld(state: GameState, element: ElementId, now: number) {
  if (!(element in WORLD_UNLOCK_COST)) throw new GameError('Lume necunoscută.');
  if (state.buildings.some((b) => b.kind === 'habitat' && b.element === element))
    throw new GameError('Lumea este deja deblocată.');
  const slot = freeSlots(state, 'habitat').find((s) => s.id.startsWith('world'));
  if (!slot) throw new GameError('Nu mai sunt locuri pentru lumi.');
  spend(state, 'gold', WORLD_UNLOCK_COST[element]);
  const b: Building = {
    id: makeId(state, 'b'),
    kind: 'habitat',
    element,
    level: 1,
    slot: slot.id,
    stored: 0,
    since: now,
  };
  state.buildings.push(b);
  const nursery = state.buildings.find((b) => b.kind === 'hatchery');
  for (const d of state.dinos
    .filter((d) => d.habitatId === nursery?.id && speciesOf(d.species).elements.includes(element))
    .slice(0, habitatCapacity(b)))
    d.habitatId = b.id;
}

export function build(state: GameState, kind: BuildingKind, slot: string, now: number, element?: ElementId): Building {
  if (!['farm', 'arena', 'outpost', 'forge', 'den'].includes(kind))
    throw new GameError('Clădirea aceasta nu se poate construi.');
  if (kind === 'habitat' && !element) throw new GameError('Alege elementul habitatului.');
  const lock = buildLock(state, kind);
  if (lock) throw new GameError(`Încă blocată: ${lock}.`);
  const same = state.buildings.filter((b) => b.kind === kind && (kind !== 'habitat' || b.element === element));
  if (same.length >= BUILDINGS[kind].limit) throw new GameError('Ai atins limita pentru clădirea aceasta.');
  if (!canPlace(state, kind, slot)) throw new GameError('Locul e ocupat.');
  spend(state, 'gold', BUILDINGS[kind].cost[0]);
  const b: Building = { id: makeId(state, 'b'), kind, level: 1, slot, stored: 0, since: now };
  if (element) b.element = element;
  state.buildings.push(b);
  return b;
}

/**
 * Clădirile care nu apar de la început: se construiesc din Extinde după ce îndeplinești condiția.
 * Fermele sunt mereu disponibile.
 */
/** Unde te duce pasul în Extinde: un tab sau cardul unei clădiri. */
export type BuildStepGo = 'worlds' | 'eggs' | BuildingKind;
export const BUILD_UNLOCKS: Partial<
  Record<
    BuildingKind,
    { label: string; how: string; met: (s: GameState) => boolean; after?: BuildingKind; go?: BuildStepGo }
  >
> = {
  outpost: {
    label: 'Deblochează o lume',
    how: 'Extinde → Lumi',
    met: (s) => s.buildings.some((b) => b.kind === 'habitat'),
    go: 'worlds',
  },
  arena: {
    label: 'Un dinozaur la nivelul 3',
    how: 'Hrănește-l din lumea lui (🍖 Hrănește)',
    met: (s) => s.dinos.some((d) => d.level >= 3),
  },
  forge: {
    label: 'Construiește avanpostul',
    how: 'Extinde → Clădiri → Avanpostul',
    met: (s) => s.buildings.some((b) => b.kind === 'outpost'),
    // avanpostul are și el o condiție: pașii se arată toți, în ordine
    after: 'outpost',
    go: 'outpost',
  },
  den: {
    label: 'Doi dinozauri',
    how: 'Cumpără un ou, apoi eclozează-l în Incubator',
    met: (s) => s.dinos.length >= 2,
    go: 'eggs',
  },
};

/** Toți pașii până poți construi `kind` (inclusiv condițiile clădirilor cerute), în ordine. */
export function buildSteps(
  state: GameState,
  kind: BuildingKind,
): { label: string; how: string; done: boolean; go?: BuildStepGo }[] {
  const unlock = BUILD_UNLOCKS[kind];
  if (!unlock) return [];
  return [
    ...(unlock.after ? buildSteps(state, unlock.after) : []),
    { label: unlock.label, how: unlock.how, done: unlock.met(state), go: unlock.go },
  ];
}

/** Ce lipsește ca să poți construi `kind`; null = se poate. */
export function buildLock(state: GameState, kind: BuildingKind): string | null {
  const unlock = BUILD_UNLOCKS[kind];
  return unlock && !unlock.met(state) ? unlock.label : null;
}

/** Construiește o clădire a insulei principale oriunde pe insulă (fără loc prestabilit). */
export function buildAt(state: GameState, kind: BuildingKind, position: BuildingPosition, now: number): Building {
  if (!['farm', 'arena', 'outpost', 'forge', 'den'].includes(kind))
    throw new GameError('Clădirea aceasta nu se poate construi.');
  const lock = buildLock(state, kind);
  if (lock) throw new GameError(`Încă blocată: ${lock}.`);
  if (state.buildings.filter((b) => b.kind === kind).length >= BUILDINGS[kind].limit)
    throw new GameError('Ai atins limita pentru clădirea aceasta.');
  const error = positionError(state, position, FREE_BUILDING_SCALE);
  if (error) throw new GameError(error);
  spend(state, 'gold', BUILDINGS[kind].cost[0]);
  const id = makeId(state, 'b');
  // locul e doar un nume unic: poziția liberă hotărăște unde stă
  const b: Building = { id, kind, level: 1, slot: `free-${id}`, stored: 0, since: now, position: { ...position } };
  state.buildings.push(b);
  return b;
}

export function canMove(state: GameState, id: string, slot: string): boolean {
  const b = state.buildings.find((b) => b.id === id);
  if (!b) return false;
  if (canPlace(state, b.kind, slot, id)) return true;
  const other = state.buildings.find((b) => b.slot === slot && b.id !== id);
  return (
    !!other &&
    b.kind !== 'habitat' &&
    other.kind !== 'habitat' &&
    !!SLOTS_BY_ID.get(slot)?.accepts.includes(b.kind) &&
    !!SLOTS_BY_ID.get(b.slot)?.accepts.includes(other.kind)
  );
}

export function move(state: GameState, id: string, slot: string) {
  const b = findBuilding(state, id);
  if (!canMove(state, id, slot)) throw new GameError('Locul nu este disponibil.');
  const other = state.buildings.find((other) => other.slot === slot && other.id !== id);
  if (other) {
    other.slot = b.slot;
    delete other.position;
  }
  b.slot = slot;
  delete b.position;
}

export function moveBuilding(state: GameState, id: string, position: BuildingPosition) {
  const error = buildingPositionError(state, id, position);
  if (error) throw new GameError(error);
  findBuilding(state, id).position = { x: position.x, y: position.y };
}

/**
 * Ce trebuie să ai înainte de nivelul următor (pe lângă cost); null = se poate.
 * Lumea crește doar când e plină, iar ferma ține pasul cu cea mai mare lume.
 */
export function upgradeLock(state: GameState, b: Building): string | null {
  if (b.kind === 'habitat') {
    const seats = habitatCapacity(b);
    return residents(state, b.id).length < seats ? `Umple lumea: ${seats} dinozauri` : null;
  }
  if (b.kind === 'farm') {
    const top = Math.max(0, ...state.buildings.filter((h) => h.kind === 'habitat').map((h) => h.level));
    return top <= b.level ? `O lume la Nv. ${b.level + 1}` : null;
  }
  return null;
}

export function upgrade(state: GameState, id: string, now: number, events: GameEvent[] = []) {
  const b = findBuilding(state, id);
  const cost = buildingUpgradeCost(b);
  if (cost === undefined) throw new GameError('Clădirea e la nivelul maxim.');
  const lock = upgradeLock(state, b);
  if (lock) throw new GameError(`Încă nu: ${lock}.`);
  const fragments = buildingUpgradeFragments(b);
  if ((state.fragments ?? 0) < fragments)
    throw new GameError(`Ultimul nivel cere ${fragments} fragmente ancestrale (din expediții).`);
  const parts = Object.entries(buildingUpgradeParts(b));
  if (parts.some(([id, n]) => (state.items?.[id] ?? 0) < n))
    throw new GameError(`Îți trebuie din forjă: ${parts.map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(', ')}.`);
  if (b.kind === 'habitat') settle(state, b, now);
  spend(state, 'gold', cost);
  state.fragments = (state.fragments ?? 0) - fragments;
  for (const [id, n] of parts) state.items![id] -= n;
  b.level += 1;
  events.push({ type: 'upgraded', buildingId: b.id, kind: b.kind, level: b.level });
}

// ---------- habitate ----------

export const habitatCapacity = (b: Building) => HABITAT_CAPACITY[b.element ?? 'fire'][b.level - 1];
const upgradeCosts = (b: Building) =>
  b.kind === 'habitat' ? HABITAT_UPGRADE_COST[b.element ?? 'fire'] : BUILDINGS[b.kind].cost;
export const buildingUpgradeCost = (b: Building): number | undefined => upgradeCosts(b)[b.level];
/** Fragmentele cerute de următorul nivel: doar pentru ultimul. */
export const buildingUpgradeFragments = (b: Building): number =>
  b.level + 1 === upgradeCosts(b).length ? FINAL_LEVEL_FRAGMENTS[b.kind] : 0;
export const goldCap = (b: Building) => HABITAT_GOLD_CAP[b.level - 1];
export const residents = (state: GameState, habitatId: string) => state.dinos.filter((d) => d.habitatId === habitatId);

/** Aur pe minut al unui habitat. */
export function habitatRate(state: GameState, habitatId: string): number {
  return residents(state, habitatId).reduce((sum, d) => sum + dinoIncome(d), 0);
}

/** Aur pe minut al unui dinozaur, cu echipamentul lui. */
export function dinoIncome(d: Pick<Dino, 'species' | 'level' | 'gear'>) {
  return Math.round(incomeAt(speciesOf(d.species), d.level) * (1 + gearBonus(d).income));
}

/** Aurul strâns acum (fără să schimbe starea). */
export function pendingGold(state: GameState, b: Building, now: number): number {
  let minutes = Math.max(0, now - b.since) / 60_000;
  // Totemul de aur: minutele din interval se numără de două ori
  if (b.boost) minutes += Math.max(0, Math.min(now, b.boost.until) - Math.max(b.since, b.boost.from)) / 60_000;
  return Math.min(goldCap(b), Math.floor(b.stored + habitatRate(state, b.id) * minutes));
}

/** Înainte să se schimbe ritmul (dinozaur nou, nivel nou), aurul de până acum se trece în `stored`. */
export function settle(state: GameState, b: Building, now: number) {
  if (b.kind !== 'habitat') return;
  b.stored = pendingGold(state, b, now);
  b.since = now;
}

export function collect(state: GameState, id: string, now: number, events: GameEvent[]) {
  const b = findBuilding(state, id);
  if (b.kind !== 'habitat') throw new GameError('Doar habitatele produc aur.');
  const gold = pendingGold(state, b, now);
  state.gold += gold;
  b.stored = 0;
  b.since = now;
  if (gold > 0) events.push({ type: 'collected', gold });
}

/** „Strânge”: aurul din toate habitatele și recoltele gata din toate fermele. */
export function collectAll(state: GameState, now: number, events: GameEvent[]) {
  let total = 0;
  for (const b of state.buildings) {
    if (b.kind !== 'habitat') continue;
    total += pendingGold(state, b, now);
    b.stored = 0;
    b.since = now;
  }
  state.gold += total;
  if (total > 0) events.push({ type: 'collected', gold: total });
  let food = 0;
  for (const b of state.buildings) {
    if (b.kind !== 'farm' || !farmPlots(b).some((p) => p && p.readyAt <= now)) continue;
    const picked: GameEvent[] = [];
    harvest(state, b.id, now, picked);
    for (const e of picked) if (e.type === 'harvested') food += e.food;
  }
  if (food > 0) events.push({ type: 'harvested', food });
}

/** Habitatele unde poate locui specia: element comun și loc liber. */
export function homesFor(state: GameState, speciesId: string, ignoreDino?: string): Building[] {
  const s = speciesOf(speciesId);
  return state.buildings.filter(
    (b) =>
      b.kind === 'habitat' &&
      s.elements.includes(b.element!) &&
      residents(state, b.id).filter((d) => d.id !== ignoreDino).length < habitatCapacity(b),
  );
}

// ---------- ferme ----------

export const farmPlotCount = (b: Building) => FARM_PLOTS[b.level - 1] ?? FARM_PLOTS[0];

/** Straturile deblocate ale fermei (null = liber). Salvările vechi aveau un singur `crop`. */
export function farmPlots(b: Building): (FarmPlot | null)[] {
  const saved = b.plots ?? (b.crop ? [b.crop] : []);
  return Array.from({ length: farmPlotCount(b) }, (_, i) => saved[i] ?? null);
}

function farm(state: GameState, farmId: string) {
  const b = findBuilding(state, farmId);
  if (b.kind !== 'farm') throw new GameError('Doar fermele cresc hrană.');
  const plots = farmPlots(b);
  // de aici înainte ferma folosește doar `plots`
  b.plots = plots;
  delete b.crop;
  return { b, plots };
}

/** Plantează pe stratul `plot` sau, fără el, pe primul strat liber. */
export function plant(state: GameState, farmId: string, cropId: string, now: number, plot?: number) {
  const { plots } = farm(state, farmId);
  const i = plot ?? plots.findIndex((p) => !p);
  if (i < 0) throw new GameError('Toate straturile sunt ocupate.');
  if (i >= plots.length) throw new GameError('Stratul nu e deblocat.');
  if (plots[i]) throw new GameError('Stratul e deja ocupat.');
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) throw new GameError('Cultură necunoscută.');
  spend(state, 'gold', crop.cost);
  plots[i] = { id: crop.id, readyAt: now + crop.seconds * 1000 };
}

/** Recoltează stratul `plot` sau, fără el, toate straturile gata. */
export function harvest(state: GameState, farmId: string, now: number, events: GameEvent[], plot?: number) {
  const { plots } = farm(state, farmId);
  const picked = plot === undefined ? plots.map((_, i) => i) : [plot];
  if (!picked.some((i) => plots[i])) throw new GameError('Nu crește nimic aici.');
  const ready = picked.filter((i) => plots[i] && plots[i]!.readyAt <= now);
  if (!ready.length) throw new GameError('Recolta nu e gata.');
  let food = 0;
  for (const i of ready) {
    food += CROPS.find((c) => c.id === plots[i]!.id)!.food;
    plots[i] = null;
  }
  state.food += food;
  countStat(state, 'harvested');
  events.push({ type: 'harvested', food });
}

/** Grăbește stratul `plot` sau, fără el, stratul care mai are cel mai puțin. */
export function rushPlot(state: GameState, farmId: string, now: number, plot?: number): FarmPlot {
  const { plots } = farm(state, farmId);
  const growing = plots.filter((p): p is FarmPlot => !!p && p.readyAt > now);
  const target = plot === undefined ? growing.sort((x, y) => x.readyAt - y.readyAt)[0] : plots[plot];
  if (!target) throw new GameError('Nu crește nimic aici.');
  return target;
}
