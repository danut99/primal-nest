// Neglijarea: un dinozaur nehrănit prea mult fuge în sălbăticie. Nu moare; îl poți aduce înapoi cu diamante.

import { HUNGRY_WARN_HOURS, RETURN_COST, RUNAWAY_HOURS, SPECIES } from './catalog';
import { feedFromTrough } from './care';
import { GameError } from './errors';
import type { Dino, GameEvent, GameState } from './types';

const HOUR = 3600 * 1000;

/** Câte ore au trecut de la ultima masă (sau de la eclozare). */
export function hoursSinceMeal(dino: Pick<Dino, 'fullAt'>, now: number): number {
  return Math.max(0, now - dino.fullAt) / HOUR;
}

/** null = e bine; altfel câte ore mai are până fuge. */
export function runawayIn(dino: Pick<Dino, 'fullAt'>, now: number): number | null {
  const h = hoursSinceMeal(dino, now);
  return h >= HUNGRY_WARN_HOURS ? Math.max(0, RUNAWAY_HOURS - h) : null;
}

export function returnCost(dino: Pick<Dino, 'speciesId'>): number {
  return RETURN_COST[SPECIES[dino.speciesId].stage];
}

export function dinosToRunAway(state: GameState, now: number): Dino[] {
  return state.dinos.filter((d) => hoursSinceMeal(d, now) >= RUNAWAY_HOURS);
}

/** Mută în sălbăticie dinozaurii neglijați. Rulează la fiecare comandă și periodic din interfață. */
export function processNeglect(state: GameState, now: number, events: GameEvent[]) {
  feedFromTrough(state, now, events);
  for (const dino of dinosToRunAway(state, now)) {
    const leftAt = dino.fullAt + RUNAWAY_HOURS * HOUR;
    state.dinos = state.dinos.filter((d) => d !== dino);
    state.party = state.party.filter((id) => id !== dino.id);
    state.workers = state.workers.filter((w) => w.dinoId !== dino.id);
    if (state.breeding && (state.breeding.a === dino.id || state.breeding.b === dino.id)) state.breeding = null;
    // Relicva rămâne în tabără; o poate purta altcineva.
    const rest = { ...dino };
    delete rest.relic;
    state.wild.push({ dino: rest, leftAt });
    events.push({
      kind: 'warning',
      text: `${dino.nickname} n-a mai primit de mâncare de ${RUNAWAY_HOURS / 24} zile și a fugit în sălbăticie! 💔`,
      dinoId: dino.id,
    });
  }
}

export function bringBack(state: GameState, dinoId: string, now: number, events: GameEvent[]) {
  const entry = state.wild.find((w) => w.dino.id === dinoId);
  if (!entry) throw new GameError('NOT_FOUND', 'Dinozaurul nu e în sălbăticie.');
  const cost = returnCost(entry.dino);
  if (state.diamonds < cost) throw new GameError('INSUFFICIENT_FUNDS', `Îți trebuie ${cost} 💎 ca să-l aduci înapoi.`);
  state.diamonds -= cost;
  state.wild = state.wild.filter((w) => w !== entry);
  // Se întoarce flămând și puțin mai sălbatic.
  state.dinos.push({ ...entry.dino, fullness: 0, fullAt: now, bond: Math.max(0, entry.dino.bond - 20) });
  events.push({ kind: 'reward', text: `${entry.dino.nickname} s-a întors acasă! Hrănește-l repede. 🦖`, dinoId });
}
