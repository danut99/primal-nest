// Grija pentru haită: hrănirea tuturor, troaca (mănâncă singuri, și offline) și eliberarea dinozaurilor.

import { ITEMS, RELEASE_STAGE_SPARKS, TROUGH_CAPACITY, TROUGH_HOURS } from './catalog';
import { applyMeal, bestFood, currentFullness, findDino, isBreeding } from './creatures';
import { GameError } from './errors';
import { geneStars } from './nest';
import { addItem, itemCount, removeItems } from './state';
import { SPECIES } from './catalog';
import type { Dino, GameEvent, GameState, ItemId } from './types';

const HOUR = 3600 * 1000;

// ---------- Hrănește toată haita ----------

/** Fiecare dino care nu e sătul primește o masă: mâncarea lui preferată, cea mai hrănitoare. */
export function feedAll(state: GameState, now: number, events: GameEvent[]) {
  const inner: GameEvent[] = [];
  let fed = 0;
  let missing = 0;
  for (const dino of state.dinos) {
    if (currentFullness(dino, now) >= 100) continue;
    const food = bestFood(dino, state.inventory);
    if (!food) {
      missing++;
      continue;
    }
    removeItems(state, { [food]: 1 });
    applyMeal(state, dino, food, now, inner);
    fed++;
  }
  if (fed === 0) throw new GameError(missing ? 'INSUFFICIENT_ITEMS' : 'FULL', missing ? 'N-ai mâncare în rucsac.' : 'Toată haita e sătulă.');
  events.push(...inner.filter((e) => e.kind === 'levelup'));
  events.push({ kind: 'info', text: `Ai hrănit ${fed} ${fed === 1 ? 'dinozaur' : 'dinozauri'}. ❤️${missing ? ` (${missing} n-au avut ce mânca)` : ''}` });
}

// ---------- Troaca ----------

export function troughTotal(state: GameState): number {
  return Object.values(state.trough).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function troughDeposit(state: GameState, itemId: ItemId, qty: number) {
  if (!ITEMS[itemId]?.food) throw new GameError('VALIDATION', 'În troacă merge doar mâncare.');
  if (!Number.isInteger(qty) || qty < 1) throw new GameError('VALIDATION', 'Cantitate invalidă.');
  const room = TROUGH_CAPACITY - troughTotal(state);
  if (room <= 0) throw new GameError('FULL', `Troaca e plină (${TROUGH_CAPACITY}).`);
  const n = Math.min(qty, room, itemCount(state, itemId));
  if (n < 1) throw new GameError('INSUFFICIENT_ITEMS', `Nu mai ai ${ITEMS[itemId].name}.`);
  removeItems(state, { [itemId]: n });
  state.trough[itemId] = (state.trough[itemId] ?? 0) + n;
}

export function troughWithdraw(state: GameState, itemId: ItemId) {
  const n = state.trough[itemId] ?? 0;
  if (n < 1) throw new GameError('NOT_FOUND', 'Nu e în troacă.');
  delete state.trough[itemId];
  addItem(state, itemId, n);
}

/** Cine n-a mâncat de TROUGH_HOURS ore mănâncă din troacă, la momentul în care i s-a făcut foame (și offline). */
export function troughDue(state: GameState, now: number): boolean {
  return troughTotal(state) > 0 && state.dinos.some((d) => now - d.fullAt >= TROUGH_HOURS * HOUR);
}

export function feedFromTrough(state: GameState, now: number, events: GameEvent[]) {
  if (troughTotal(state) === 0) return;
  const inner: GameEvent[] = [];
  let meals = 0;
  for (const dino of state.dinos) {
    // Câte mese ar fi luat cât ai lipsit, cât timp mai e mâncare.
    for (let guard = 0; guard < 100 && now - dino.fullAt >= TROUGH_HOURS * HOUR; guard++) {
      const food = bestFood(dino, state.trough);
      if (!food) break;
      state.trough[food]! -= 1;
      if (state.trough[food] === 0) delete state.trough[food];
      applyMeal(state, dino, food, dino.fullAt + TROUGH_HOURS * HOUR, inner);
      meals++;
    }
  }
  if (meals) {
    events.push(...inner.filter((e) => e.kind === 'levelup'));
    events.push({ kind: 'info', text: `🥣 Haita a mâncat din troacă: ${meals} ${meals === 1 ? 'masă' : 'mese'}.` });
  }
}

// ---------- Eliberarea ----------

export function releaseReward(dino: Dino): number {
  return 10 * dino.level + 40 * geneStars(dino.genes) + RELEASE_STAGE_SPARKS[SPECIES[dino.speciesId].stage];
}

export function releaseDino(state: GameState, dinoId: string, events: GameEvent[]) {
  const dino = findDino(state, dinoId);
  if (isBreeding(state, dinoId)) throw new GameError('BUSY', `${dino.nickname} e în Bârlog.`);
  if (dino.molt) throw new GameError('BUSY', `${dino.nickname} năpârlește.`);
  if (state.workers.some((w) => w.dinoId === dinoId)) throw new GameError('BUSY', `${dino.nickname} e la muncă. Cheamă-l acasă mai întâi.`);
  if (state.activity?.kind === 'expedition' && state.party.includes(dinoId)) throw new GameError('BUSY', `${dino.nickname} e în expediție.`);
  const reward = releaseReward(dino);
  state.dinos = state.dinos.filter((d) => d.id !== dinoId);
  state.party = state.party.filter((id) => id !== dinoId);
  state.backRow = state.backRow.filter((id) => id !== dinoId);
  state.sparks += reward;
  state.stats.releases++;
  events.push({ kind: 'reward', text: `${dino.nickname} s-a întors liber în junglă. Saurok îți dă +${reward} ✨ pentru grija ta.` });
}
