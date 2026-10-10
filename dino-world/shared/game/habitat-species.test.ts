import { expect, it } from 'vitest';
import { HABITAT_SPECIES } from './habitat-species';
import { newGame, runCommand, SPECIES_BY_ID } from './index';
import { recipeFor } from '../../src/dino-lab/recipes';
import type { ElementId, EvolutionStage } from './types';

// Scheletele ilustrate ale speciilor de habitat se refac în rig-lab/; până atunci folosesc rețeta generată.
it('registers two species per habitat, each with a recipe for every age', () => {
  for (const element of ['fire', 'water', 'earth', 'plant', 'ice', 'storm']) {
    expect(HABITAT_SPECIES.filter((s) => s.elements.includes(element as ElementId))).toHaveLength(2);
  }
  for (const species of HABITAT_SPECIES) {
    expect(SPECIES_BY_ID.get(species.id)).toEqual(species);
    for (const age of ['pui', 'juvenil', 'adult'] as EvolutionStage[])
      expect(recipeFor(species.id, age).base.rig).toBeTruthy();
  }
});

it.each(HABITAT_SPECIES)('$name hatches only into its matching unlocked habitat', (species) => {
  let state = newGame(1000, 2);
  state.gold = 100000;
  for (const element of ['fire', 'water', 'earth', 'plant', 'ice', 'storm'] as const) {
    const result = runCommand(state, { type: 'unlockWorld', element }, 1000);
    if (result.ok) state = result.state;
  }
  // rarele nu se cumpără: oul lor vine din Bârlog; aici îl punem direct în incubator
  const bought = runCommand(state, { type: 'buyEgg', species: species.id }, 1000);
  expect(bought.ok).toBe(species.rarity === 'common');
  if (!bought.ok) state.eggs.push({ id: 'den-egg', species: species.id, hatchAt: 1000 });
  const purchase = bought.ok ? bought : { ok: true as const, state, events: [] };
  const egg = purchase.state.eggs.at(-1)!;
  const home = purchase.state.buildings.find((b) => b.kind === 'habitat' && b.element === species.elements[0])!;
  const wrong = purchase.state.buildings.find((b) => b.kind === 'habitat' && b.element !== species.elements[0])!;
  const now = egg.hatchAt + 1;
  expect(runCommand(purchase.state, { type: 'hatch', eggId: egg.id, habitatId: wrong.id }, now).ok).toBe(false);
  const hatched = runCommand(purchase.state, { type: 'hatch', eggId: egg.id, habitatId: home.id }, now);
  expect(hatched.ok).toBe(true);
  if (hatched.ok)
    expect(hatched.state.dinos.some((d) => d.species === species.id && d.habitatId === home.id)).toBe(true);
});
