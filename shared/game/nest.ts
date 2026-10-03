// Cuibul: plasare, rotire, lumânare și eclozare.

import { PROPERTY_LEVELS, canFight, RARITIES, SPECIES, TEMPERATURES, TURN_BONUS, TURN_COOLDOWN_SECONDS, TUTORIAL_EGG_SECONDS } from './catalog';
import { GameError } from './errors';
import { addSkillXp, makeId, markOwned, markTutorial, skillLevel } from './state';
import type { Dino, Egg, GameEvent, GameState, Stats, Temperature } from './types';

export function nestSlots(state: GameState): number {
  return PROPERTY_LEVELS[state.property].nestSlots;
}

export function eggsInNest(state: GameState): Egg[] {
  return state.eggs.filter((e) => e.incubation);
}

export function findEgg(state: GameState, id: string): Egg {
  const egg = state.eggs.find((e) => e.id === id);
  if (!egg) throw new GameError('NOT_FOUND', 'Oul nu există.');
  return egg;
}

/** Durata incubării, cu bonusul de Incubație (−1%/nivel peste 1, maximum −30%). */
export function incubationSeconds(state: GameState, egg: Egg): number {
  if (egg.tutorial) return TUTORIAL_EGG_SECONDS;
  const bonus = Math.min(0.3, (skillLevel(state, 'incubatie') - 1) * 0.01);
  return Math.round(RARITIES[egg.rarity].seconds * (1 - bonus));
}

export function placeEgg(state: GameState, eggId: string, temperature: Temperature, now: number, events: GameEvent[]) {
  const egg = findEgg(state, eggId);
  if (egg.incubation) throw new GameError('BUSY', 'Oul e deja în cuib.');
  if (!TEMPERATURES[temperature]) throw new GameError('VALIDATION', 'Temperatură necunoscută.');
  if (eggsInNest(state).length >= nestSlots(state)) throw new GameError('FULL', 'Cuibul e plin. Extinde tabăra pentru mai multe locuri.');
  const seconds = incubationSeconds(state, egg);
  egg.incubation = { temperature, startedAt: now, endsAt: now + seconds * 1000 };
  events.push({ kind: 'info', text: `Oul e la ${TEMPERATURES[temperature].name.toLowerCase()} în cuib. 🥚`, eggId });
}

export function canTurn(egg: Egg, now: number): boolean {
  const inc = egg.incubation;
  if (!inc || now >= inc.endsAt) return false;
  return !inc.lastTurnedAt || now - inc.lastTurnedAt >= TURN_COOLDOWN_SECONDS * 1000;
}

/** Rotirea scurtează timpul rămas cu 5% din durata totală, o dată la 30 de minute. */
export function turnEgg(state: GameState, eggId: string, now: number, events: GameEvent[]) {
  const egg = findEgg(state, eggId);
  const inc = egg.incubation;
  if (!inc) throw new GameError('NOT_READY', 'Oul nu e în cuib.');
  if (!canTurn(egg, now)) throw new GameError('NOT_READY', 'Oul a fost rotit de curând.');
  const cut = Math.round((inc.endsAt - inc.startedAt) * TURN_BONUS);
  inc.endsAt = Math.max(now, inc.endsAt - cut);
  inc.lastTurnedAt = now;
  events.push({ kind: 'info', text: 'Ai rotit oul cu grijă. Pare mulțumit. ✨', eggId });
  addSkillXp(state, 'incubatie', 5, events);
}

const HINTS: Record<keyof Stats, string> = {
  hp: 'Embrionul pare mare și rotofei.',
  atk: 'Se zbate puternic înăuntru!',
  def: 'Coaja e neobișnuit de groasă.',
  spd: 'Se mișcă foarte repede prin ou.',
};

/** Indiciul de la lumânare: cea mai bună genă și o impresie generală. */
export function candleHint(egg: Egg): { best: keyof Stats; text: string; quality: string } {
  const keys = Object.keys(egg.genes) as (keyof Stats)[];
  const best = keys.reduce((a, b) => (egg.genes[b] > egg.genes[a] ? b : a));
  const total = keys.reduce((sum, k) => sum + egg.genes[k], 0);
  const quality = total >= 48 ? 'Strălucește puternic în lumină! ⭐⭐⭐' : total >= 36 ? 'Strălucește frumos. ⭐⭐' : total >= 24 ? 'Lumină caldă, obișnuită. ⭐' : 'Lumină slabă.';
  return { best, text: HINTS[best], quality };
}

export function candleEgg(state: GameState, eggId: string, events: GameEvent[]) {
  const egg = findEgg(state, eggId);
  if (egg.candled) throw new GameError('VALIDATION', 'Ai lumânat deja oul ăsta.');
  egg.candled = true;
  const hint = candleHint(egg);
  events.push({ kind: 'info', text: `🕯️ ${hint.text} ${hint.quality}`, eggId });
  addSkillXp(state, 'incubatie', 10, events);
}

/** Numărul de stele (0–3) pentru calitatea genelor. */
export function geneStars(genes: Stats): number {
  const total = genes.hp + genes.atk + genes.def + genes.spd;
  return total >= 48 ? 3 : total >= 36 ? 2 : total >= 24 ? 1 : 0;
}

export function hatchEgg(state: GameState, eggId: string, now: number, events: GameEvent[]): Dino {
  const egg = findEgg(state, eggId);
  const inc = egg.incubation;
  if (!inc) throw new GameError('NOT_READY', 'Oul nu e în cuib.');
  if (now < inc.endsAt) throw new GameError('NOT_READY', 'Oul nu e gata să eclozeze.');
  const species = SPECIES[egg.speciesId];
  const dino: Dino = {
    id: makeId(state, 'dino'),
    speciesId: egg.speciesId,
    nickname: species.name,
    level: 1,
    xp: 0,
    bond: 10,
    genes: { ...egg.genes },
    temperament: TEMPERATURES[inc.temperature].temperament,
    variant: egg.variant,
    diets: [],
    fullness: 0,
    fullAt: now,
    hatchedAt: now,
    rarity: egg.rarity,
    ...(egg.lineage ? { lineage: egg.lineage } : {}),
  };
  state.eggs = state.eggs.filter((e) => e.id !== eggId);
  state.dinos.push(dino);
  // Primii luptători intră automat în haită, cât e loc (puii nu luptă, deci așteaptă prima evoluție).
  if (canFight(dino.speciesId) && state.activity?.kind !== 'expedition' && state.party.length < 2) state.party.push(dino.id);
  markOwned(state, dino.speciesId, dino.variant === 'albino');
  markTutorial(state, 'first-hatch');
  state.stats.hatches++;
  events.push({
    kind: 'hatch',
    text: dino.variant === 'albino' ? `Incredibil! Un ${species.name} ALBINO a eclozat! 🤍` : `A eclozat un ${species.name}! 🐣`,
    dinoId: dino.id,
  });
  addSkillXp(state, 'incubatie', RARITIES[egg.rarity].hatchXp, events);
  return dino;
}

/** Ouăle lumânate valorează cu 25% mai mult: informația are preț. */
export function eggPrice(egg: Egg): number {
  return Math.round(RARITIES[egg.rarity].sell * (egg.candled ? 1.25 : 1));
}

/** Ouăle din rucsac care pot pleca (nu din cuib, nu oul de start). */
function bagEggs(state: GameState, eggIds: string[], verb: string): Egg[] {
  const ids = [...new Set(eggIds)];
  if (ids.length === 0) throw new GameError('VALIDATION', 'Niciun ou ales.');
  return ids.map((id) => {
    const egg = findEgg(state, id);
    if (egg.incubation) throw new GameError('BUSY', `Nu poți ${verb} un ou din cuib.`);
    if (egg.tutorial) throw new GameError('VALIDATION', `Oul de start nu se poate ${verb}.`);
    return egg;
  });
}

export function sellEggs(state: GameState, eggIds: string[], events: GameEvent[]) {
  const eggs = bagEggs(state, eggIds, 'vinde');
  const price = eggs.reduce((sum, e) => sum + eggPrice(e), 0);
  state.eggs = state.eggs.filter((e) => !eggs.includes(e));
  state.sparks += price;
  const what = eggs.length === 1 ? 'oul' : `${eggs.length} ouă`;
  events.push({ kind: 'reward', text: `Ai dat ${what} altui cuib: +${price} scântei. ✨` });
}

export function discardEggs(state: GameState, eggIds: string[], events: GameEvent[]) {
  const eggs = bagEggs(state, eggIds, 'arunca');
  state.eggs = state.eggs.filter((e) => !eggs.includes(e));
  events.push({ kind: 'info', text: eggs.length === 1 ? 'Ai lăsat oul în sălbăticie.' : `Ai lăsat ${eggs.length} ouă în sălbăticie.` });
}
