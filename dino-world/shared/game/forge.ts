// Forja: făurești obiecte din aur și materiale, unul pe rând; apoi le pui pe dinozauri (echipament), le
// folosești o dată (consumabile) sau le dai la îmbunătățirea clădirilor (piese).

import { GameError, countStat, findBuilding, spend } from './state';
import { ITEMS, MATERIAL_IDS, TOTEM_MS, buildingUpgradeParts, hasMaterials } from './items';
import { farmPlots, settle } from './world';
import { onAdventure } from './adventures';
import type { Building, Dino, GameEvent, GameState, GearSlot } from './types';

export const itemCount = (s: GameState, id: string) => s.items?.[id] ?? 0;
function takeItem(s: GameState, id: string, n = 1) {
  if (itemCount(s, id) < n) throw new GameError(`Îți trebuie ${ITEMS[id]?.name ?? 'obiectul'} din forjă.`);
  s.items![id] -= n;
}
function giveItem(s: GameState, id: string, n = 1) {
  s.items ??= {};
  s.items[id] = (s.items[id] ?? 0) + n;
}

/** Are jucătorul piesele cerute de următorul nivel al clădirii? */
export const hasUpgradeParts = (s: GameState, b: Building) =>
  Object.entries(buildingUpgradeParts(b)).every(([id, n]) => itemCount(s, id) >= n);
// ---------- făurire ----------

export function craft(s: GameState, forgeId: string, itemId: string, now: number) {
  const b = findBuilding(s, forgeId);
  if (b.kind !== 'forge') throw new GameError('Doar forja făurește obiecte.');
  if (b.craft) throw new GameError('Forja lucrează deja la ceva.');
  const item = ITEMS[itemId];
  if (!item) throw new GameError('Rețetă necunoscută.');
  if (item.level > b.level) throw new GameError(`Rețeta cere forja la nivelul ${item.level}.`);
  if (!hasMaterials(s, item.materials))
    throw new GameError('Nu ai destule materiale. Le aduci din expediții și arenă.');
  spend(s, 'gold', item.gold);
  s.materials ??= {};
  for (const k of MATERIAL_IDS) if (item.materials[k]) s.materials[k]! -= item.materials[k]!;
  b.craft = { itemId, readyAt: now + item.seconds * 1000 };
}

export function collectCraft(s: GameState, forgeId: string, now: number, events: GameEvent[]) {
  const b = findBuilding(s, forgeId);
  if (!b.craft) throw new GameError('Forja nu lucrează la nimic.');
  if (b.craft.readyAt > now) throw new GameError('Obiectul nu e gata.');
  giveItem(s, b.craft.itemId);
  countStat(s, 'crafted');
  events.push({ type: 'crafted', itemId: b.craft.itemId });
  delete b.craft;
}

// ---------- echipament ----------

function dinoHome(s: GameState, d: Dino) {
  return s.buildings.find((b) => b.id === d.habitatId);
}

export function equip(s: GameState, dinoId: string, itemId: string, now: number) {
  const d = s.dinos.find((x) => x.id === dinoId);
  if (!d) throw new GameError('Dinozaurul nu există.');
  const item = ITEMS[itemId];
  if (!item || item.kind !== 'gear' || !item.slot) throw new GameError('Obiectul nu se poate purta.');
  if (onAdventure(s, d.id, now)) throw new GameError('Dinozaurul e plecat.');
  takeItem(s, itemId);
  const home = dinoHome(s, d);
  if (home) settle(s, home, now);
  d.gear ??= {};
  const old = d.gear[item.slot];
  if (old) giveItem(s, old);
  d.gear[item.slot] = itemId;
}

export function unequip(s: GameState, dinoId: string, slot: GearSlot, now: number) {
  const d = s.dinos.find((x) => x.id === dinoId);
  const id = d?.gear?.[slot];
  if (!d || !id) throw new GameError('Locul e gol.');
  if (onAdventure(s, d.id, now)) throw new GameError('Dinozaurul e plecat.');
  const home = dinoHome(s, d);
  if (home) settle(s, home, now);
  delete d.gear![slot];
  giveItem(s, id);
}

// ---------- consumabile ----------

export type ItemTarget = { farm: string; plot: number } | { dino: string } | { egg: string } | { habitat: string };

export function useItem(s: GameState, itemId: string, target: ItemTarget, now: number) {
  if (ITEMS[itemId]?.kind !== 'consumable') throw new GameError('Obiectul nu se folosește așa.');
  if (itemCount(s, itemId) < 1) throw new GameError(`Îți trebuie ${ITEMS[itemId].name} din forjă.`);
  if (itemId === 'fertilizer' && 'farm' in target) {
    const b = findBuilding(s, target.farm);
    const plots = farmPlots(b);
    const plot = plots[target.plot];
    if (b.kind !== 'farm' || !plot || plot.readyAt <= now) throw new GameError('Stratul nu are nimic în creștere.');
    plot.readyAt = now;
    b.plots = plots;
    delete b.crop;
  } else if (itemId === 'elixir' && 'dino' in target) {
    const d = s.dinos.find((x) => x.id === target.dino);
    if (!d?.recoveryUntil || d.recoveryUntil <= now) throw new GameError('Dinozaurul nu se odihnește.');
    d.recoveryUntil = now;
  } else if (itemId === 'warm-stone' && 'egg' in target) {
    const egg = s.eggs.find((e) => e.id === target.egg);
    if (!egg || egg.hatchAt <= now) throw new GameError('Oul e deja gata.');
    egg.hatchAt = now;
  } else if (itemId === 'gold-totem' && 'habitat' in target) {
    const b = findBuilding(s, target.habitat);
    if (b.kind !== 'habitat') throw new GameError('Totemul se pune într-o lume.');
    settle(s, b, now);
    const active = b.boost && b.boost.until > now;
    b.boost = { from: active ? b.boost!.from : now, until: (active ? b.boost!.until : now) + TOTEM_MS };
  } else throw new GameError('Obiectul nu se poate folosi aici.');
  takeItem(s, itemId);
}
