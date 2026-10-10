// Doar pentru teste: un joc nou care are deja arena, avanpostul și bârlogul (în joc se construiesc din Extinde).
import { makeId } from './state';
import { newGame } from './state';
import { habitatCapacity, residents } from './world';
import type { GameState } from './types';

export function newGameWithServices(now: number, seed?: number): GameState {
  const s = newGame(now, seed);
  for (const kind of ['arena', 'outpost', 'den'] as const)
    s.buildings.push({ id: makeId(s, 'b'), kind, level: 1, slot: kind, stored: 0, since: now });
  return s;
}

/** Umple o lume până la capacitate (o lume crește doar plină). */
export function fillHabitat(s: GameState, habitatId: string) {
  const home = s.buildings.find((b) => b.id === habitatId)!;
  while (residents(s, habitatId).length < habitatCapacity(home))
    s.dinos.push({ id: `filler-${s.dinos.length}`, species: 'ignisaur', level: 1, habitatId });
  return s;
}
