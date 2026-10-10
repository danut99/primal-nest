import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS, homesFor, newGame, runCommand, SPECIES_BY_ID, stageForLevel } from './index';
import { recipeFor } from '../../src/dino-lab/recipes';

describe('Ignisaur', () => {
  it('selects a separate painted skeleton at both evolution thresholds', () => {
    expect([1, 3, 4, 6, 7, 10].map((level) => recipeFor('ignisaur', stageForLevel(level)).base.rig))
      .toEqual(['ignisaur-pui', 'ignisaur-pui', 'ignisaur-juvenil', 'ignisaur-juvenil', 'ignisaur-adult', 'ignisaur-adult']);
  });

  it('offers only fire as a home and rejects moves into every other world', () => {
    const state = newGame(1000, 1);
    for (const element of ELEMENT_IDS) state.buildings.push({
      id: `home-${element}`, kind: 'habitat', element, level: 5, slot: `world-${element}`, stored: 0, since: 1000,
    });
    expect(SPECIES_BY_ID.get('ignisaur')!.elements).toEqual(['fire']);
    expect(homesFor(state, 'ignisaur').map((home) => home.element)).toEqual(['fire']);
    const id = state.dinos[0].id;
    for (const element of ELEMENT_IDS.filter((element) => element !== 'fire'))
      expect(runCommand(state, { type: 'moveDino', dinoId: id, habitatId: `home-${element}` }, 1000).ok).toBe(false);
    expect(runCommand(state, { type: 'moveDino', dinoId: id, habitatId: 'home-fire' }, 1000).ok).toBe(true);
  });
});
