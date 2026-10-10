import { expect, it } from 'vitest';
import { habitatCapacity, newGame, runCommand, WORLD_UNLOCK_COST } from './index';

it('begins with only the main island and a nursery dinosaur', () => {
  const s = newGame(1000, 1);
  expect(s.buildings.some((b) => b.kind === 'habitat')).toBe(false);
  expect(s.buildings.find((b) => b.id === s.dinos[0].habitatId)!.kind).toBe('hatchery');
});
it('charges the world price once and moves the nursery dinosaur into its compatible world', () => {
  const s = newGame(1000, 1);
  const r = runCommand(s, { type: 'unlockWorld', element: 'fire' }, 2000);
  expect(r.ok).toBe(true);
  const world = r.state.buildings.find((b) => b.element === 'fire')!;
  expect(world.slot).toMatch(/^world/);
  expect(habitatCapacity(world)).toBe(2);
  expect(r.state.dinos[0].habitatId).toBe(world.id);
  expect(r.state.gold).toBe(s.gold - WORLD_UNLOCK_COST.fire);
  const twice = runCommand(r.state, { type: 'unlockWorld', element: 'fire' }, 2000);
  expect(twice.ok).toBe(false);
  expect(twice.state).toBe(r.state);
});
it('cannot unlock an unaffordable world or construct habitat duplicates', () => {
  const s = newGame(1000, 1);
  expect(runCommand(s, { type: 'unlockWorld', element: 'storm' }, 2000).ok).toBe(false);
  expect(s.gold).toBe(500);
  expect(runCommand(s, { type: 'build', kind: 'habitat', slot: 'world0', element: 'fire' }, 2000).ok).toBe(false);
});
it('leaves the nursery dinosaur in place when unlocking a different element', () => {
  const s = newGame(1000, 1);
  const r = runCommand(s, { type: 'unlockWorld', element: 'water' }, 2000);
  expect(r.ok).toBe(true);
  expect(r.state.dinos[0].habitatId).toBe(s.dinos[0].habitatId);
});
