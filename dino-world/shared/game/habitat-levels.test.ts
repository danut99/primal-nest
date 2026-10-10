import { expect, it } from 'vitest';
import {
  ELEMENT_IDS,
  MAX_HABITAT_LEVEL,
  buildingUpgradeCost,
  habitatCapacity,
  newGame,
  residents,
  runCommand,
} from './index';
import { fillHabitat } from './test-helpers';

it.each(ELEMENT_IDS)('%s starts with two slots and reaches ten through five paid levels', (element) => {
  let state = newGame(1000, 1);
  state.gold = 1_000_000;
  state.fragments = 1000;
  state.items = { 'fossil-beam': 10, 'amber-lens': 10, 'meteor-core': 10 };
  const unlock = runCommand(state, { type: 'unlockWorld', element }, 1000);
  expect(unlock.ok).toBe(true);
  state = unlock.state;
  const id = state.buildings.find((b) => b.element === element)!.id;
  expect(habitatCapacity(state.buildings.find((b) => b.id === id)!)).toBe(2);
  for (let level = 2; level <= MAX_HABITAT_LEVEL; level++) {
    const before = state.buildings.find((b) => b.id === id)!;
    expect(runCommand(state, { type: 'upgrade', buildingId: id }, 1000).ok).toBe(false);
    fillHabitat(state, id);
    const cost = buildingUpgradeCost(before)!;
    const result = runCommand(state, { type: 'upgrade', buildingId: id }, 1000);
    expect(result.ok).toBe(true);
    expect(result.state.gold).toBe(state.gold - cost);
    const after = result.state.buildings.find((b) => b.id === id)!;
    expect(after.level).toBe(level);
    expect(habitatCapacity(after)).toBeGreaterThan(habitatCapacity(before));
    expect(habitatCapacity(after)).toBeLessThanOrEqual(10);
    state = result.state;
  }
  expect(habitatCapacity(state.buildings.find((b) => b.id === id)!)).toBe(10);
  expect(runCommand(state, { type: 'upgrade', buildingId: id }, 1000).ok).toBe(false);
});

it.each([1, 2, 3, 4, 5])('enforces level %i slots when moving and hatching', (level) => {
  const state = runCommand(newGame(1000, 1), { type: 'unlockWorld', element: 'fire' }, 1000).state;
  const home = state.buildings.find((b) => b.element === 'fire')!;
  home.level = level;
  const capacity = habitatCapacity(home);
  while (residents(state, home.id).length < capacity)
    state.dinos.push({ id: `resident-${state.dinos.length}`, species: 'ignisaur', level: 1, habitatId: home.id });
  state.dinos.push({
    id: 'nursery',
    species: 'ignisaur',
    level: 1,
    habitatId: state.buildings.find((b) => b.kind === 'hatchery')!.id,
  });
  state.eggs = [{ id: 'egg', species: 'ignisaur', hatchAt: 1000 }];
  for (const command of [
    { type: 'moveDino', dinoId: 'nursery', habitatId: home.id },
    { type: 'hatch', eggId: 'egg', habitatId: home.id },
  ] as const) {
    const result = runCommand(state, command, 1000);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  }
  state.dinos = state.dinos.filter((d) => d.id !== state.dinos[0].id);
  const result = runCommand(state, { type: 'hatch', eggId: 'egg', habitatId: home.id }, 1000);
  expect(result.ok).toBe(true);
  expect(residents(result.state, home.id)).toHaveLength(capacity);
});
