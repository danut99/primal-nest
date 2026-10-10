import { expect, it } from 'vitest';
import { buildLock, canMove, ensureMainBuildings, newGame, runCommand } from './index';
import { newGameWithServices } from './test-helpers';

it('starts with only the hatchery and one farm; den, arena, outpost and forge are built later', () => {
  const s = newGame(1000, 1);
  expect(
    s.buildings
      .filter((b) => b.kind !== 'habitat')
      .map((b) => b.kind)
      .sort(),
  ).toEqual(['farm', 'hatchery']);
  expect(buildLock(s, 'den')).not.toBeNull();
  expect(buildLock(s, 'outpost')).not.toBeNull();
  expect(buildLock(s, 'arena')).not.toBeNull();
  expect(buildLock(s, 'forge')).not.toBeNull();
  expect(buildLock(s, 'farm')).toBeNull();
});

it('unlocks the outpost with a world, the forge with the outpost and the arena with a level 3 dinosaur', () => {
  let s = newGame(1000, 1);
  s.gold = 10_000;
  const at = { x: 768, y: 470 };
  expect(runCommand(s, { type: 'buildAt', kind: 'outpost', position: at }, 1000).ok).toBe(false);
  s = runCommand(s, { type: 'unlockWorld', element: 'fire' }, 1000).state;
  const built = runCommand(s, { type: 'buildAt', kind: 'outpost', position: at }, 1000);
  expect(built.ok).toBe(true);
  s = built.state;
  expect(s.buildings.find((b) => b.kind === 'outpost')!.position).toEqual(at);
  expect(buildLock(s, 'forge')).toBeNull();
  expect(buildLock(s, 'arena')).not.toBeNull();
  s.dinos[0].level = 3;
  expect(buildLock(s, 'arena')).toBeNull();
});

it('places a new building anywhere on the island, but not off the island or on top of another', () => {
  let s = newGameWithServices(1000, 1);
  s.gold = 10_000;
  const farm = s.buildings.find((b) => b.kind === 'farm')!;
  const taken = { x: farm.position?.x ?? 550, y: farm.position?.y ?? 710 };
  expect(runCommand(s, { type: 'buildAt', kind: 'farm', position: { x: 5000, y: 5000 } }, 1000).ok).toBe(false);
  expect(runCommand(s, { type: 'buildAt', kind: 'farm', position: taken }, 1000).ok).toBe(false);
  s = runCommand(s, { type: 'buildAt', kind: 'farm', position: { x: 760, y: 520 } }, 1000).state;
  expect(s.buildings.filter((b) => b.kind === 'farm')).toHaveLength(2);
});

it('keeps old saves unchanged when loading', () => {
  const s = newGameWithServices(1000, 1);
  s.gold = 123;
  const before = JSON.stringify(s.buildings);
  ensureMainBuildings(s, 2000);
  expect(JSON.stringify(s.buildings)).toBe(before);
  expect(s.gold).toBe(123);
});

it('moves every headquarters building and swaps occupied plots while retaining active timers', () => {
  for (const kind of ['farm', 'hatchery', 'den', 'arena', 'outpost'] as const) {
    const s = newGameWithServices(1000, 1);
    const b = s.buildings.find((b) => b.kind === kind)!;
    if (kind === 'arena') b.adventure = { missionId: 'arena-trial', dinoIds: [s.dinos[0].id], readyAt: 99000 };
    const moved = runCommand(s, { type: 'move', buildingId: b.id, slot: 'p1' }, 2000);
    expect(moved.ok).toBe(true);
    expect(moved.state.buildings.find((x) => x.id === b.id)!.slot).toBe('p1');
    expect(moved.state.buildings.find((x) => x.id === b.id)!.adventure).toEqual(b.adventure);
    const other = moved.state.buildings.find((x) => x.kind === (kind === 'farm' ? 'hatchery' : 'farm'))!;
    const swapped = runCommand(moved.state, { type: 'move', buildingId: b.id, slot: other.slot }, 2000);
    expect(swapped.ok).toBe(true);
    expect(swapped.state.buildings.find((x) => x.id === other.id)!.slot).toBe('p1');
    expect(new Set(swapped.state.buildings.map((x) => x.slot)).size).toBe(swapped.state.buildings.length);
    expect(canMove(s, b.id, 'world0')).toBe(false);
    expect(canMove(s, b.id, 'p0')).toBe(false);
  }
});
