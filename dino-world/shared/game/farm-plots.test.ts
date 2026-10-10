import { expect, it } from 'vitest';
import { CROPS, FINAL_LEVEL_FRAGMENTS, farmPlots, newGame, runCommand, type GameState } from './index';

const NOW = 1000;
const ferigi = CROPS.find((c) => c.id === 'ferigi')!;

function rich(): { state: GameState; id: string } {
  const state = newGame(NOW, 1);
  state.gold = 100_000;
  state.gems = 100;
  state.fragments = 100;
  state.items = { 'fossil-beam': 10, 'amber-lens': 10, 'meteor-core': 10 };
  // ferma ține pasul cu cea mai mare lume
  state.buildings.push({ id: 'world', kind: 'habitat', element: 'fire', level: 5, slot: 'world0', stored: 0, since: NOW });
  return { state, id: state.buildings.find((b) => b.kind === 'farm')!.id };
}
function ok(state: GameState, cmd: Parameters<typeof runCommand>[1], now = NOW) {
  const r = runCommand(state, cmd, now);
  expect(r.ok, r.ok ? '' : r.error).toBe(true);
  return r.state;
}
const farm = (s: GameState, id: string) => s.buildings.find((b) => b.id === id)!;

it('unlocks one more plot per farm level, up to three', () => {
  let { state, id } = rich();
  expect(farmPlots(farm(state, id))).toHaveLength(1);
  state = ok(state, { type: 'upgrade', buildingId: id });
  expect(farmPlots(farm(state, id))).toHaveLength(2);
  state = ok(state, { type: 'upgrade', buildingId: id });
  expect(farmPlots(farm(state, id))).toHaveLength(3);
  expect(runCommand(state, { type: 'upgrade', buildingId: id }, NOW).ok).toBe(false);
});

it('grows crops on separate plots and harvests every ready plot at once', () => {
  let { state, id } = rich();
  state = ok(state, { type: 'upgrade', buildingId: id });
  state = ok(state, { type: 'upgrade', buildingId: id });
  for (let i = 0; i < 3; i++) state = ok(state, { type: 'plant', farmId: id, cropId: 'ferigi' });
  expect(farmPlots(farm(state, id)).every((p) => p?.id === 'ferigi')).toBe(true);
  expect(runCommand(state, { type: 'plant', farmId: id, cropId: 'ferigi' }, NOW).ok).toBe(false);

  const later = NOW + ferigi.seconds * 1000;
  const food = state.food;
  state = ok(state, { type: 'harvest', farmId: id }, later);
  expect(state.food).toBe(food + 3 * ferigi.food);
  expect(farmPlots(farm(state, id)).every((p) => p === null)).toBe(true);
});

it('plants, rushes and harvests a single chosen plot', () => {
  let { state, id } = rich();
  state = ok(state, { type: 'upgrade', buildingId: id });
  expect(runCommand(state, { type: 'plant', farmId: id, cropId: 'ferigi', plot: 2 }, NOW).ok).toBe(false);
  state = ok(state, { type: 'plant', farmId: id, cropId: 'ferigi', plot: 1 });
  expect(farmPlots(farm(state, id))[0]).toBeNull();
  state = ok(state, { type: 'rush', target: { farm: id, plot: 1 } });
  state = ok(state, { type: 'harvest', farmId: id, plot: 1 });
  expect(farmPlots(farm(state, id))[1]).toBeNull();
});

it('keeps the crop of a save from before plots existed', () => {
  const { state, id } = rich();
  const b = farm(state, id);
  b.crop = { id: 'ferigi', readyAt: NOW };
  delete b.plots;
  expect(farmPlots(b)[0]).toEqual({ id: 'ferigi', readyAt: NOW });
  const after = ok(state, { type: 'harvest', farmId: id });
  expect(after.food).toBe(state.food + ferigi.food);
  expect(farm(after, id).crop).toBeUndefined();
});

it('asks for ancestral fragments only on the final level', () => {
  let { state, id } = rich();
  state.fragments = 0;
  state = ok(state, { type: 'upgrade', buildingId: id });
  const blocked = runCommand(state, { type: 'upgrade', buildingId: id }, NOW);
  expect(blocked.ok).toBe(false);
  state.fragments = FINAL_LEVEL_FRAGMENTS.farm;
  state = ok(state, { type: 'upgrade', buildingId: id });
  expect(state.fragments).toBe(0);
  expect(farm(state, id).level).toBe(3);
});

it('grows only as far as the biggest world', () => {
  const state = newGame(NOW, 1);
  state.gold = 100_000;
  const id = state.buildings.find((b) => b.kind === 'farm')!.id;
  expect(runCommand(state, { type: 'upgrade', buildingId: id }, NOW).ok).toBe(false);
  state.buildings.push({ id: 'world', kind: 'habitat', element: 'fire', level: 2, slot: 'world0', stored: 0, since: NOW });
  expect(farm(ok(state, { type: 'upgrade', buildingId: id }), id).level).toBe(2);
});
