// Salvările vechi pot avea speciile scoase din joc (variantele pe scheletul T-Rex). La încărcare, fiecare devine
// specia de pe primul ei element: Ignisaur pentru foc, specia comună din habitat pentru celelalte.

import { HABITAT_SPECIES } from './habitat-species';
import type { ElementId, GameState } from './types';

/** Speciile scoase și primul lor element. */
const REMOVED: Record<string, ElementId> = {
  hidrodon: 'water',
  petrorex: 'earth',
  filodon: 'plant',
  criorex: 'ice',
  voltisaur: 'storm',
  magmadon: 'fire',
  glaciodon: 'ice',
  mlastinosaur: 'plant',
  fulgerex: 'storm',
  tufosaur: 'earth',
  viforex: 'ice',
  aburex: 'fire',
  taifunodon: 'water',
  astravor: 'earth',
};

const replacement = (element: ElementId) =>
  element === 'fire'
    ? 'ignisaur'
    : HABITAT_SPECIES.find((s) => s.elements[0] === element && s.rarity === 'common')!.id;

export function migrateRemovedSpecies(state: GameState) {
  const swap = (id: string) => (id in REMOVED ? replacement(REMOVED[id]) : id);
  for (const d of state.dinos) d.species = swap(d.species);
  for (const e of state.eggs) e.species = swap(e.species);
  if (state.breeding) state.breeding.species = swap(state.breeding.species);
  state.discovered = [...new Set(state.discovered.map(swap))];
  // recompensa unei linii vechi din Atlas nu trece pe specia nouă (o poți lua acolo)
  if (state.atlasClaimed) state.atlasClaimed = state.atlasClaimed.filter((id) => !(id in REMOVED));
  if (state.evolutionProgress)
    for (const [id, level] of Object.entries(state.evolutionProgress))
      if (id in REMOVED) {
        const to = swap(id);
        state.evolutionProgress[to] = Math.max(state.evolutionProgress[to] ?? 0, level);
        delete state.evolutionProgress[id];
      }
  // tablourile zilei (arenă, expediții) se refac oricum; aici doar nu mai pot cere specii care nu există
  for (const c of state.arenaBoard?.challenges ?? []) c.species = swap(c.species);
  const board = state.expeditionBoard;
  for (const mission of [...(board?.slots.map((s) => s.mission) ?? []), ...(board?.reserves ?? [])])
    for (const r of mission.requirements) if (r.species) r.species = swap(r.species);
  return state;
}
