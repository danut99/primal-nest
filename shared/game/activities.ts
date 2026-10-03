// Activitatea curentă (una singură, ca în MilkyWay): cules/săpături, bucătărie sau expediție.
// Timpul curge și offline; revendicarea calculează exact câte acțiuni s-au terminat.

import {
  ALPHA_FIRST_DIAMONDS,
  ALPHA_REPEAT_DIAMONDS,
  EXPEDITION_CAP_SECONDS,
  WIN_DIAMOND_CHANCE,
  GATHER_ACTIONS,
  GATHER_CAP_SECONDS,
  ITEMS,
  MAX_COOK_BATCH,
  MAX_GATHER_COUNT,
  QUEUE_MAX,
  PROPERTY_LEVELS,
  RECIPES,
  RELICS,
  RETREAT_AFTER_LOSSES,
  ZONES,
  SPECIES,
  type Zone,
} from './catalog';
import { type BattleResult, findZone, fromDino, rollEnemies, simulateBattle } from './battle';
import { addDinoXp, findDino, relicLevel } from './creatures';
import { GameError } from './errors';
import { createRng, mixSeed, randInt, weighted } from './rng';
import {
  addItem,
  addSkillXp,
  hasItems,
  itemCount,
  makeEgg,
  markSeen,
  markTutorial,
  removeItems,
  skillLevel,
} from './state';
import type { Activity, GameEvent, GameState, ItemId, QueuedAction, Rarity } from './types';

/** Ce s-a strâns la o revendicare; interfața îl arată ca popup. */
export interface Haul {
  items: Partial<Record<ItemId, number>>;
  eggs: string[];
  relic?: string;
  wins: number;
  losses: number;
  sparks: number;
  diamonds: number;
}

const emptyHaul = (): Haul => ({ items: {}, eggs: [], wins: 0, losses: 0, sparks: 0, diamonds: 0 });
const addToHaul = (haul: Haul, item: ItemId, qty: number) => (haul.items[item] = (haul.items[item] ?? 0) + qty);

export function activityDuration(activity: Activity): number {
  if (activity.kind === 'gather') return findAction(activity.actionId).seconds;
  if (activity.kind === 'cook') return findRecipe(activity.recipeId).seconds;
  return findZone(activity.zoneId).seconds;
}

/** Câte acțiuni sunt gata de revendicat acum (pentru bara de progres). */
export function readyCount(activity: Activity, now: number): number {
  const dur = activityDuration(activity) * 1000;
  const cap = (activity.kind === 'expedition' ? EXPEDITION_CAP_SECONDS : GATHER_CAP_SECONDS) * 1000;
  const n = Math.floor(Math.min(Math.max(0, now - activity.startedAt), cap) / dur);
  if (activity.kind === 'cook') return Math.min(activity.count, n) - activity.done;
  if (activity.kind === 'gather' && activity.limit) return Math.min(n, activity.limit - activity.index);
  return n;
}

export function findAction(id: string) {
  const action = GATHER_ACTIONS.find((a) => a.id === id);
  if (!action) throw new GameError('NOT_FOUND', 'Acțiune necunoscută.');
  return action;
}

export function findRecipe(id: string) {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new GameError('NOT_FOUND', 'Rețetă necunoscută.');
  return recipe;
}

/** Avansează începutul activității după n pași; peste plafon, restul timpului se pierde. */
function advance(activity: Activity & { startedAt: number }, n: number, durMs: number, capMs: number, now: number) {
  if (now - activity.startedAt > capMs) activity.startedAt = now;
  else activity.startedAt += n * durMs;
}

function rollEgg(state: GameState, seed: number, rarities: { value: Rarity; weight: number }[], speciesId: string | null) {
  const rng = createRng(seed);
  const egg = makeEgg(state, rng, speciesId, weighted(rng, rarities));
  state.eggs.push(egg);
  return egg;
}

// ---------- Cules și săpături ----------

function claimGather(state: GameState, activity: Extract<Activity, { kind: 'gather' }>, now: number, events: GameEvent[], haul: Haul) {
  const action = findAction(activity.actionId);
  const n = readyCount(activity, now);
  for (let i = 0; i < n; i++) {
    const seed = mixSeed(activity.seed, activity.index + i);
    const rng = createRng(seed);
    const item = weighted(rng, action.drops);
    addItem(state, item, 1);
    addToHaul(haul, item, 1);
    const firstDig = action.skill === 'sapaturi' && !state.tutorialDone.includes('first-dig-egg');
    if (action.egg && (firstDig || rng() < action.egg.chance)) {
      const egg = rollEgg(state, mixSeed(seed, 7), firstDig ? [{ value: 'comun', weight: 1 }] : action.egg.rarities, null);
      haul.eggs.push(egg.id);
      markTutorial(state, 'first-dig-egg');
      events.push({ kind: 'egg', text: `Ai găsit un ou ${eggAdjective(egg.rarity)} în ${action.name.toLowerCase()}! 🥚`, eggId: egg.id });
    }
  }
  if (n > 0) addSkillXp(state, action.skill, action.xp * n, events);
  state.stats.gathers += n;
  activity.index += n;
  advance(activity, n, action.seconds * 1000, GATHER_CAP_SECONDS * 1000, now);
}

export function eggAdjective(rarity: Rarity): string {
  return { comun: 'comun', neobisnuit: 'neobișnuit', rar: 'RAR', epic: 'EPIC', legendar: 'LEGENDAR' }[rarity];
}

// ---------- Bucătărie ----------

function claimCook(state: GameState, activity: Extract<Activity, { kind: 'cook' }>, now: number, events: GameEvent[], haul: Haul) {
  const recipe = findRecipe(activity.recipeId);
  const n = readyCount(activity, now);
  if (n <= 0) return;
  addItem(state, recipe.output, n);
  addToHaul(haul, recipe.output, n);
  activity.done += n;
  state.stats.cooks += n;
  markTutorial(state, 'first-cook');
  addSkillXp(state, 'bucatarie', recipe.xp * n, events);
}

// ---------- Lupte ----------

export function partyDinos(state: GameState) {
  return state.party.map((id) => findDino(state, id)).filter((d) => !d.molt);
}

/** Aplică rezultatul unei lupte: XP, drop-uri, ouă, Atlas. */
export function applyBattle(state: GameState, zone: Zone, result: BattleResult, seed: number, events: GameEvent[], haul: Haul, alpha = false) {
  for (const c of result.start) if (c.side === 'enemy') markSeen(state, c.speciesId);
  if (!result.win) {
    haul.losses++;
    return;
  }
  haul.wins++;
  state.stats.wins++;
  markTutorial(state, 'first-win');
  const rng = createRng(mixSeed(seed, 99));
  const enemies = result.start.filter((c) => c.side === 'enemy');
  const xp = enemies.reduce((sum, e) => sum + e.level * 5 * (e.boss ? 3 : 1), 0);
  for (const c of result.start) if (c.dinoId) addDinoXp(findDino(state, c.dinoId), xp, events);
  addSkillXp(state, 'imblanzire', 10 * zone.tier, events);

  for (const drop of zone.drops) {
    if (rng() < drop.chance) {
      const qty = randInt(rng, drop.qty[0], drop.qty[1]);
      addItem(state, drop.item, qty);
      addToHaul(haul, drop.item, qty);
    }
  }
  if (alpha) {
    const a = zone.alpha;
    for (const [item, qty] of Object.entries(a.rewards)) {
      addItem(state, item as ItemId, qty!);
      addToHaul(haul, item as ItemId, qty!);
    }
    state.sparks += a.sparks;
    haul.sparks += a.sparks;
    const first = !state.alphas.includes(zone.id);
    const gems = first ? ALPHA_FIRST_DIAMONDS : ALPHA_REPEAT_DIAMONDS;
    state.diamonds += gems;
    haul.diamonds += gems;
    if (first) {
      state.alphas.push(zone.id);
      if (zone.id === 'vulcan') markTutorial(state, 'alfa');
      events.push({ kind: 'evolve', text: `${a.title} a căzut! Umbra se retrage din ${zone.name}. ⚔️` });
      const next = ZONES.find((z) => z.requires === zone.id);
      if (next) events.push({ kind: 'info', text: `Drumul spre ${next.name} e deschis! ${next.icon}` });
    }
    if (!state.relics.includes(a.relic)) {
      state.relics.push(a.relic);
      haul.relic = a.relic;
      events.push({ kind: 'reward', text: `Ai primit relicva ${RELICS[a.relic].name}! ${RELICS[a.relic].icon}` });
    }
    const egg = rollEgg(state, mixSeed(seed, 5), [{ value: a.egg, weight: 1 }], null);
    haul.eggs.push(egg.id);
    events.push({ kind: 'egg', text: `În bârlogul lui ${a.title} ai găsit un ou ${eggAdjective(egg.rarity)}! 🥚`, eggId: egg.id });
    return;
  }
  if (rng() < WIN_DIAMOND_CHANCE) {
    state.diamonds++;
    haul.diamonds++;
    events.push({ kind: 'reward', text: 'Ai găsit un diamant în cuibul prădătorului! 💎' });
  }
  // Ouă sălbatice: din linia unuia dintre inamici; Îmblânzirea crește șansa.
  const chance = zone.egg.chance + (skillLevel(state, 'imblanzire') - 1) * 0.001;
  if (rng() < chance) {
    const enemy = enemies[Math.floor(rng() * enemies.length)];
    const baby = Object.values(SPECIES).find((s) => s.line === SPECIES[enemy.speciesId].line && s.stage === 'pui')!;
    const egg = rollEgg(state, mixSeed(seed, 6), zone.egg.rarities, baby.id);
    haul.eggs.push(egg.id);
    events.push({ kind: 'egg', text: `Ai găsit un ou de ${baby.name} în cuibul unui prădător învins! 🥚`, eggId: egg.id });
  }
}

function claimExpedition(state: GameState, activity: Extract<Activity, { kind: 'expedition' }>, now: number, events: GameEvent[], haul: Haul) {
  const zone = findZone(activity.zoneId);
  const n = readyCount(activity, now);
  let fought = 0;
  for (let i = 0; i < n; i++) {
    const party = partyDinos(state).map((d, i) => fromDino(d, i, relicLevel(state, d.relic), state.backRow.includes(d.id)));
    if (party.length === 0) break;
    const seed = mixSeed(activity.seed, activity.index + i);
    const enemies = rollEnemies(createRng(mixSeed(seed, 1)), zone, party, !state.tutorialDone.includes('first-win'));
    const result = simulateBattle(party, enemies, seed);
    applyBattle(state, zone, result, seed, events, haul);
    fought++;
    // O înfrângere nu oprește expediția: haita se odihnește și reîncearcă.
    // După câteva înfrângeri la rând, se întoarce acasă.
    activity.losses = result.win ? 0 : (activity.losses ?? 0) + 1;
    if (activity.losses >= RETREAT_AFTER_LOSSES) {
      state.activity = null;
      events.push({
        kind: 'warning',
        text: `Haita a fost zdrobită de ${RETREAT_AFTER_LOSSES} ori în ${zone.name} și s-a retras rănită. Devino mai puternic sau alege altă zonă.`,
      });
      return;
    }
  }
  activity.index += fought;
  advance(activity, fought, zone.seconds * 1000, EXPEDITION_CAP_SECONDS * 1000, now);
}

// ---------- Comenzi ----------

/** Momentul în care s-a terminat activitatea, sau null dacă încă merge (expedițiile nu se termină singure). */
function finishedAt(activity: Activity): number | null {
  if (activity.kind === 'cook' && activity.done >= activity.count) return activity.startedAt + activity.count * activityDuration(activity) * 1000;
  // La cules, startedAt a fost avansat exact până la ultima acțiune terminată.
  if (activity.kind === 'gather' && activity.limit && activity.index >= activity.limit) return activity.startedAt;
  return null;
}

function claimOne(state: GameState, activity: Activity, now: number, events: GameEvent[], haul: Haul) {
  if (activity.kind === 'gather') claimGather(state, activity, now, events, haul);
  else if (activity.kind === 'cook') claimCook(state, activity, now, events, haul);
  else claimExpedition(state, activity, now, events, haul);
}

/** Revendică activitatea curentă; dacă s-a terminat, pornește următoarea din coadă exact de când s-a terminat. */
export function claimActivity(state: GameState, now: number, events: GameEvent[]): Haul {
  if (!state.activity) throw new GameError('NOT_READY', 'Nu ai nicio activitate pornită.');
  const haul = emptyHaul();
  for (let guard = 0; state.activity && guard <= QUEUE_MAX + 1; guard++) {
    claimOne(state, state.activity, now, events, haul);
    if (!state.activity) {
      // Retragere din expediție: coada continuă de acum.
      startNextQueued(state, now, events);
      break;
    }
    const end = finishedAt(state.activity);
    if (end === null) break;
    state.activity = null;
    startNextQueued(state, Math.min(end, now), events);
  }
  return haul;
}

function startQueued(state: GameState, item: QueuedAction, at: number, events: GameEvent[]) {
  if (item.kind === 'gather') startGather(state, item.actionId, at, events, item.count);
  else if (item.kind === 'cook') startCook(state, item.recipeId, item.count, at, events);
  else startExpedition(state, item.zoneId, at, events);
}

function queuedName(item: QueuedAction): string {
  if (item.kind === 'gather') return findAction(item.actionId).name;
  if (item.kind === 'cook') return findRecipe(item.recipeId).name;
  return findZone(item.zoneId).name;
}

function startNextQueued(state: GameState, at: number, events: GameEvent[]) {
  while (!state.activity && state.queue.length) {
    const item = state.queue.shift()!;
    try {
      startQueued(state, item, at, events);
      events.push({ kind: 'info', text: `Din coadă: a pornit ${queuedName(item)}.` });
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      events.push({ kind: 'warning', text: `Coada a sărit peste ${queuedName(item)}: ${e.message}` });
    }
  }
}

export function enqueueActivity(state: GameState, item: QueuedAction, now: number, events: GameEvent[]) {
  validateQueued(state, item);
  if (!state.activity) {
    startQueued(state, item, now, events);
    return;
  }
  if (state.queue.length >= QUEUE_MAX) throw new GameError('FULL', `Coada are maximum ${QUEUE_MAX} activități.`);
  state.queue.push(item);
  if (state.activity.kind === 'expedition' || (state.activity.kind === 'gather' && !state.activity.limit)) {
    events.push({ kind: 'info', text: 'Activitatea curentă nu are sfârșit: coada pornește când o oprești.' });
  }
}

export function dequeueActivity(state: GameState, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= state.queue.length) throw new GameError('NOT_FOUND', 'Nu există în coadă.');
  state.queue.splice(index, 1);
}

function validateQueued(state: GameState, item: QueuedAction) {
  if (item.kind === 'gather') {
    findAction(item.actionId);
    if (!Number.isInteger(item.count) || item.count < 1 || item.count > MAX_GATHER_COUNT) throw new GameError('VALIDATION', `Poți pune 1–${MAX_GATHER_COUNT} acțiuni.`);
  } else if (item.kind === 'cook') {
    findRecipe(item.recipeId);
    if (!Number.isInteger(item.count) || item.count < 1 || item.count > MAX_COOK_BATCH) throw new GameError('VALIDATION', `Poți găti 1–${MAX_COOK_BATCH} porții.`);
  } else assertUnlocked(state, findZone(item.zoneId));
}

/** Oprirea manuală trece la următoarea activitate din coadă. */
export function stopActivity(state: GameState, now: number, events: GameEvent[], next = true): Haul {
  const haul = claimActivity(state, now, events);
  const activity = state.activity;
  if (activity?.kind === 'cook') {
    // Ingredientele pentru porțiile negătite se întorc în inventar.
    const recipe = findRecipe(activity.recipeId);
    for (const [item, qty] of Object.entries(recipe.inputs)) addItem(state, item as ItemId, qty! * (activity.count - activity.done));
  }
  state.activity = null;
  if (next) startNextQueued(state, now, events);
  return haul;
}

/** Pornirea unei activități noi oprește (și revendică) activitatea veche; coada rămâne pe loc. */
function replaceActivity(state: GameState, now: number, events: GameEvent[]): Haul | null {
  return state.activity ? stopActivity(state, now, events, false) : null;
}

export function startGather(state: GameState, actionId: string, now: number, events: GameEvent[], limit?: number) {
  const action = findAction(actionId);
  if (skillLevel(state, action.skill) < action.level) throw new GameError('LOCKED', `Necesită ${action.skill === 'cules' ? 'Cules' : 'Săpături'} nivel ${action.level}.`);
  const haul = replaceActivity(state, now, events);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_GATHER_COUNT)) {
    throw new GameError('VALIDATION', `Poți pune 1–${MAX_GATHER_COUNT} acțiuni.`);
  }
  state.activity = { kind: 'gather', actionId, startedAt: now, seed: mixSeed(state.rngSeed, state.nextId++), index: 0, ...(limit ? { limit } : {}) };
  return haul;
}

export function startCook(state: GameState, recipeId: string, count: number, now: number, events: GameEvent[]) {
  const recipe = findRecipe(recipeId);
  if (state.property < 1) throw new GameError('LOCKED', `Bucătăria se deblochează cu ${PROPERTY_LEVELS[1].name}.`);
  if (skillLevel(state, 'bucatarie') < recipe.level) throw new GameError('LOCKED', `Necesită Bucătărie nivel ${recipe.level}.`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COOK_BATCH) throw new GameError('VALIDATION', `Poți găti 1–${MAX_COOK_BATCH} porții.`);
  const haul = replaceActivity(state, now, events);
  if (!hasItems(state, recipe.inputs, count)) throw new GameError('INSUFFICIENT_ITEMS', `Nu ai ingrediente pentru ${count} × ${recipe.name}.`);
  removeItems(state, recipe.inputs, count);
  state.activity = { kind: 'cook', recipeId, startedAt: now, count, done: 0 };
  return haul;
}

export function maxCookable(state: GameState, recipeId: string): number {
  const recipe = findRecipe(recipeId);
  const counts = Object.entries(recipe.inputs).map(([item, qty]) => Math.floor(itemCount(state, item as ItemId) / qty!));
  return Math.min(MAX_COOK_BATCH, ...counts);
}

export function startExpedition(state: GameState, zoneId: string, now: number, events: GameEvent[]) {
  const zone = findZone(zoneId);
  assertUnlocked(state, zone);
  if (partyDinos(state).length === 0) throw new GameError('VALIDATION', 'Haita e goală. Alege cel puțin un dinozaur.');
  const haul = replaceActivity(state, now, events);
  state.activity = { kind: 'expedition', zoneId, startedAt: now, seed: mixSeed(state.rngSeed, state.nextId++), index: 0 };
  return haul;
}

/** Luptă directă, privită în timp real. Nu se poate în timpul unei expediții. */
export function zoneUnlocked(state: GameState, zone: Zone): boolean {
  return !zone.requires || state.alphas.includes(zone.requires);
}

function assertUnlocked(state: GameState, zone: Zone) {
  if (!zoneUnlocked(state, zone)) {
    const prev = findZone(zone.requires!);
    throw new GameError('LOCKED', `Drumul e păzit. Învinge-l mai întâi pe ${prev.alpha.title} din ${prev.name}.`);
  }
}

export function liveBattle(state: GameState, zoneId: string, alpha: boolean, events: GameEvent[]) {
  const zone = findZone(zoneId);
  if (state.activity?.kind === 'expedition') throw new GameError('BUSY', 'Haita e în expediție. Oprește expediția ca să lupți direct.');
  const party = partyDinos(state);
  if (party.length === 0) throw new GameError('VALIDATION', 'Haita e goală. Alege cel puțin un dinozaur.');
  assertUnlocked(state, zone);
  const key = alpha ? zone.alpha.key : undefined;
  if (key) {
    if (itemCount(state, key) < 1) throw new GameError('INSUFFICIENT_ITEMS', `Ai nevoie de un ${ITEMS[key].name}.`);
    removeItems(state, { [key]: 1 });
  }
  const seed = mixSeed(state.rngSeed, state.nextId++);
  const fighters = party.map((d, i) => fromDino(d, i, relicLevel(state, d.relic), state.backRow.includes(d.id)));
  const enemies = rollEnemies(createRng(mixSeed(seed, 1)), zone, fighters, !alpha && !state.tutorialDone.includes('first-win'), alpha);
  const result = simulateBattle(fighters, enemies, seed);
  const haul = emptyHaul();
  applyBattle(state, zone, result, seed, events, haul, alpha);
  return { result, haul };
}
