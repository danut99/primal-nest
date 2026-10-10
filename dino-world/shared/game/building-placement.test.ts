import { expect, it } from 'vitest';
import { runCommand, buildingPosition, buildingPositionError } from './index';
import { newGameWithServices } from './test-helpers';

it('moves to continuous coordinates without charging or interrupting an active mission', () => {
  const s = newGameWithServices(1000, 1),
    b = s.buildings.find((b) => b.kind === 'arena')!;
  b.adventure = { missionId: 'arena-trial', dinoIds: [s.dinos[0].id], readyAt: 99000 };
  const position = { x: 831.25, y: 523.75 };
  const result = runCommand(s, { type: 'moveBuilding', buildingId: b.id, position }, 2000);
  expect(result.ok).toBe(true);
  const moved = result.state.buildings.find((x) => x.id === b.id)!;
  expect(moved.position).toEqual(position);
  expect(moved.adventure).toEqual(b.adventure);
  expect(moved.slot).toBe(b.slot);
  expect(result.state.gold).toBe(s.gold);
  expect(s.buildings.find((x) => x.id === b.id)!.position).toBeUndefined();
  expect(buildingPosition(JSON.parse(JSON.stringify(moved)))).toMatchObject(position);
});
it('rejects cliffs, overlaps, invalid numbers, habitats, and unknown buildings atomically', () => {
  const s = newGameWithServices(1000, 1),
    b = s.buildings.find((b) => b.kind === 'farm')!,
    other = buildingPosition(s.buildings.find((b) => b.kind === 'den')!);
  for (const p of [{ x: 0, y: 0 }, { x: 768, y: 1000 }, other, { x: NaN, y: 500 }, { x: 800, y: Infinity }]) {
    const result = runCommand(s, { type: 'moveBuilding', buildingId: b.id, position: p }, 2000);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(s);
  }
  expect(buildingPositionError(s, 'unknown', { x: 800, y: 500 })).toBeTruthy();
  s.buildings.push({ ...b, id: 'hab', kind: 'habitat', element: 'fire', slot: 'world0' });
  expect(runCommand(s, { type: 'moveBuilding', buildingId: 'hab', position: { x: 800, y: 500 } }, 2000).ok).toBe(false);
});
it('uses original positions for old saves and clears custom coordinates on legacy slot moves', () => {
  const s = newGameWithServices(1000, 1),
    b = s.buildings.find((b) => b.kind === 'farm')!;
  expect(buildingPosition(b)).toMatchObject({ x: 550, y: 710 });
  b.position = { x: 820, y: 520 };
  const result = runCommand(s, { type: 'move', buildingId: b.id, slot: 'p1' }, 2000);
  expect(result.ok).toBe(true);
  expect(result.state.buildings.find((x) => x.id === b.id)!.position).toBeUndefined();
});
