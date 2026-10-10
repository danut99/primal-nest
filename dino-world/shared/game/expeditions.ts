import { ELEMENTS, ELEMENT_IDS, speciesOf } from './catalog';
import { HABITAT_SPECIES } from './habitat-species';
import { createRng, mixSeed } from './rng';
import { GameError, spend } from './state';
import type { Dino, ExpeditionBoard, ExpeditionMission, ExpeditionRequirement, GameState } from './types';

export const EXPEDITION_SWAP_COST = 5;
export const EXPEDITION_CHEST_TARGET = 4;
export const EXPEDITION_TRAINING_COST = [25, 60, 100];
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function expeditionDay(now: number) {
  const parts = dayFormatter.formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)!.value).join('-');
}
const resets = new Map<string, number>();
export function nextExpeditionReset(now: number) {
  const day = expeditionDay(now);
  if (!resets.has(day)) {
    let lo = now,
      hi = now + 26 * 3600 * 1000;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (expeditionDay(mid) === day) lo = mid;
      else hi = mid;
    }
    resets.set(day, hi);
    if (resets.size > 4) resets.delete(resets.keys().next().value!);
  }
  return resets.get(day)!;
}
const settings = {
  easy: { seconds: 20 * 60, recoverySeconds: 30 * 60, cost: 10, gold: 100, food: 80, gems: 0, fragments: 5 },
  medium: { seconds: 45 * 60, recoverySeconds: 90 * 60, cost: 25, gold: 280, food: 220, gems: 1, fragments: 12 },
  hard: { seconds: 90 * 60, recoverySeconds: 180 * 60, cost: 50, gold: 650, food: 450, gems: 2, fragments: 22 },
};
const places: Record<string, [string, string]> = {
  fire: ['Urme în cenușă', 'Inima calderei'],
  water: ['Comoara recifului', 'Abisul primordial'],
  earth: ['Canionul fosilelor', 'Mormântul titanilor'],
  plant: ['Poteca ferigilor', 'Sanctuarul verde'],
  ice: ['Urme sub zăpadă', 'Comoara ghețarului'],
  storm: ['Semnale în furtună', 'Ochiul furtunii'],
};
function shuffled<T>(values: T[], rng: () => number) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function dailyExpeditions(state: GameState, now: number): ExpeditionBoard {
  const day = expeditionDay(now);
  const previous = state.expeditionBoard?.day === day ? state.expeditionBoard : undefined;
  if (previous?.slots.length === 6) return previous;
  const seed = [...day].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 0),
    rng = createRng(mixSeed(state.seed, seed));
  const tiers = shuffled<ExpeditionMission['tier']>(['easy', 'easy', 'medium', 'medium', 'hard', 'hard'], rng);
  // La început ai dinozauri dintr-un singur element: măcar o expediție ușoară e pe un element pe care îl ai,
  // altfel n-ai de unde aduce materiale pentru forjă (și lumile nu trec de nivelul 2).
  const owned = new Set(state.dinos.flatMap((d) => speciesOf(d.species).elements));
  if (owned.size && !ELEMENT_IDS.some((e, i) => tiers[i] === 'easy' && owned.has(e))) {
    const mine = ELEMENT_IDS.findIndex((e) => owned.has(e));
    const easy = tiers.indexOf('easy');
    [tiers[mine], tiers[easy]] = [tiers[easy], tiers[mine]];
  }
  const make = (element: (typeof ELEMENT_IDS)[number], i: number, reserve: boolean): ExpeditionMission => {
    const tier = tiers[i];
    const other = shuffled(
      ELEMENT_IDS.filter((e) => e !== element),
      rng,
    );
    const specialist = shuffled(
      HABITAT_SPECIES.filter((s) => s.elements[0] === element),
      rng,
    )[0];
    return {
      id: `daily-${element}-${reserve ? 'reserve' : 'main'}`,
      element,
      name: places[element][reserve ? 1 : 0],
      description: `Explorează ținutul de ${ELEMENTS[element].name.toLowerCase()} cu o echipă adaptată traseului.`,
      tier,
      ...settings[tier],
      requirements:
        tier === 'easy'
          ? [{ element, level: 1 }]
          : tier === 'medium'
            ? [
                { element, level: 3 },
                { element: other[0], level: 2 },
              ]
            : [
                { species: specialist.id, level: 5 },
                { element: other[0], level: 4 },
                { element: other[1], level: 3 },
              ],
    };
  };
  const board: ExpeditionBoard = {
    day,
    slots: ELEMENT_IDS.map((element, i) => ({
      id: `slot-${i}`,
      mission: make(element, i, false),
      status: 'available',
    })),
    reserves: ELEMENT_IDS.map((element, i) => make(element, i, true)),
    chestClaimed: false,
  };
  // Preserve in-flight missions, completed routes and purchased swaps from older saves.
  if (previous && (previous.slots.some((s) => s.status !== 'available') || previous.reserves.length < 3)) {
    const used = new Set<number>();
    previous.slots.forEach((slot, i) => {
      const element =
        slot.mission.element ??
        slot.mission.requirements[0].element ??
        (slot.mission.requirements[0].species
          ? speciesOf(slot.mission.requirements[0].species).elements[0]
          : ELEMENT_IDS[i]);
      let index = board.slots.findIndex((s, j) => s.mission.element === element && !used.has(j));
      if (index < 0) index = board.slots.findIndex((_, j) => !used.has(j));
      used.add(index);
      board.slots[index] = { ...slot, mission: { ...slot.mission, element } };
    });
    // IDs used by active adventures must remain stable; added routes need unique IDs.
    const ids = new Set(previous.slots.map((s) => s.id));
    board.slots.forEach((slot) => {
      if (
        !previous.slots.some((s) => s === slot || (s.id === slot.id && s.mission.id === slot.mission.id)) &&
        ids.has(slot.id)
      )
        slot.id = `slot-added-${slot.mission.element}`;
    });
    board.chestClaimed = previous.chestClaimed;
    board.reserves = board.slots.map((slot, i) => ({
      ...board.reserves[i],
      id: `daily-reserve-${slot.id}`,
      element: slot.mission.element,
      name: places[slot.mission.element!][1],
      tier: slot.mission.tier,
      ...settings[slot.mission.tier],
      requirements: slot.mission.requirements,
    }));
  }
  return board;
}

export function ensureExpeditionBoard(s: GameState, now: number) {
  s.expeditionBoard = dailyExpeditions(s, now);
}
export function matchesRequirement(d: Dino, r: ExpeditionRequirement) {
  return (
    d.level >= r.level &&
    (!r.species || d.species === r.species) &&
    (!r.element || speciesOf(d.species).elements.includes(r.element))
  );
}
// A dinosaur can fill only one requirement, even when species and element overlap.
export function expeditionTeamMatches(team: Dino[], requirements: ExpeditionRequirement[]): boolean {
  function assign(index: number, used: Set<string>): boolean {
    if (index === requirements.length) return true;
    return team.some(
      (d) =>
        !used.has(d.id) && matchesRequirement(d, requirements[index]) && assign(index + 1, new Set([...used, d.id])),
    );
  }
  return assign(0, new Set());
}
export function requirementLabel(r: ExpeditionRequirement) {
  return `${r.species ? speciesOf(r.species).name : `Un dinozaur de ${ELEMENTS[r.element!].name.toLowerCase()}`} · nivel ${r.level}+`;
}
export const isRecovering = (d: Dino, now: number) =>
  !!d.recoveryUntil && (d.recoveryStartsAt ?? 0) <= now && now < d.recoveryUntil;
export function swapExpedition(s: GameState, slotId: string, reserveId: string, day: string, now: number) {
  ensureExpeditionBoard(s, now);
  const board = s.expeditionBoard!;
  if (day !== board.day) throw new GameError('Lista zilnică s-a schimbat. Alege din nou.');
  const slot = board.slots.find((x) => x.id === slotId),
    index = board.reserves.findIndex((x) => x.id === reserveId);
  if (!slot || slot.status !== 'available' || index < 0) throw new GameError('Expediția nu mai poate fi înlocuită.');
  const reserve = board.reserves[index];
  if (slot.mission.element && (reserve.element !== slot.mission.element || reserve.tier !== slot.mission.tier))
    throw new GameError('Alege o rezervă pentru același element și aceeași dificultate.');
  spend(s, 'gems', EXPEDITION_SWAP_COST);
  slot.mission = board.reserves.splice(index, 1)[0];
}
export function improveExpeditions(s: GameState) {
  const rank = s.expeditionTraining ?? 0,
    cost = EXPEDITION_TRAINING_COST[rank];
  if (cost === undefined) throw new GameError('Echipamentul este la nivel maxim.');
  if ((s.fragments ?? 0) < cost) throw new GameError(`Ai nevoie de ${cost} fragmente ancestrale.`);
  s.fragments = (s.fragments ?? 0) - cost;
  s.expeditionTraining = rank + 1;
}
export function expeditionRewards(s: GameState, mission: ExpeditionMission) {
  const factor = 1 + (s.expeditionTraining ?? 0) * 0.1;
  return {
    ...mission,
    gold: Math.round(mission.gold * factor),
    food: Math.round(mission.food * factor),
    fragments: Math.round(mission.fragments * factor),
  };
}
