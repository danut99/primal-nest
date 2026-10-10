import { describe, expect, it } from 'vitest';
import { dailyExpeditions, expeditionTeamMatches, runCommand, type Command, type GameState } from './index';
import { newGameWithServices } from './test-helpers';

const now = 1_000_000;
function apply(s: GameState, cmd: Command, time = now) {
  const r = runCommand(s, cmd, time);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
/** Joc nou, cu expediția ușoară pe care o poate face puiul de start (garantată în fiecare zi). */
function setup() {
  const s = newGameWithServices(now, 1);
  const outpost = s.buildings.find((b) => b.kind === 'outpost')!.id;
  const board = dailyExpeditions(s, now);
  const slot = board.slots.find(
    (x) => x.mission.tier === 'easy' && expeditionTeamMatches(s.dinos, x.mission.requirements),
  )!;
  return {
    s,
    outpost,
    arena: s.buildings.find((b) => b.kind === 'arena')!.id,
    dinoId: s.dinos[0].id,
    mission: slot.mission,
    day: board.day,
  };
}
describe('adventures', () => {
  it('builds the two new services in their own slots and respects their limits', () => {
    let { s } = setup();
    s.buildings = s.buildings.filter((b) => b.kind !== 'arena' && b.kind !== 'outpost');
    s.dinos[0].level = 3; // arena se deblochează cu un dinozaur de nivel 3
    s.gold = 10_000;
    s = apply(s, { type: 'unlockWorld', element: 'fire' }); // avanpostul, cu o lume
    s = apply(s, { type: 'build', kind: 'arena', slot: 'arena' });
    s = apply(s, { type: 'build', kind: 'outpost', slot: 'outpost' });
    expect(s.buildings.filter((b) => b.kind === 'arena' || b.kind === 'outpost')).toHaveLength(2);
    expect(runCommand(s, { type: 'build', kind: 'arena', slot: 'p1' }, now).ok).toBe(false);
  });
  it('charges entry once, prevents early claims, and grants rewards exactly once', () => {
    const { s, outpost, dinoId, mission, day } = setup();
    const active = apply(s, {
      type: 'startAdventure',
      buildingId: outpost,
      missionId: mission.id,
      dinoIds: [dinoId],
      day,
    });
    expect(active.food).toBe(s.food - mission.cost);
    const back = now + mission.seconds * 1000;
    expect(runCommand(active, { type: 'claimAdventure', buildingId: outpost }, back - 1).ok).toBe(false);
    const done = apply(active, { type: 'claimAdventure', buildingId: outpost }, back);
    expect(done.gold).toBeGreaterThanOrEqual(s.gold + mission.gold);
    expect(done.buildings.find((b) => b.id === outpost)!.adventure).toBeUndefined();
    const repeated = runCommand(done, { type: 'claimAdventure', buildingId: outpost }, back);
    expect(repeated.ok).toBe(false);
    expect(repeated.state).toBe(done);
  });
  it('rejects duplicate teams, unknown routes and teams sent from the arena, atomically', () => {
    const { s, outpost, arena, dinoId, mission, day } = setup();
    for (const [buildingId, missionId, dinoIds] of [
      [outpost, mission.id, [dinoId, dinoId]],
      [outpost, 'nowhere', [dinoId]],
      [arena, 'arena-trial', [dinoId]],
      [arena, mission.id, [dinoId]],
    ] as [string, string, string[]][]) {
      const r = runCommand(s, { type: 'startAdventure', buildingId, missionId, dinoIds, day }, now);
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
  });
  it('locks an assigned dinosaur across feeding, selling, breeding, and the arena', () => {
    const { s, outpost, arena, dinoId, mission, day } = setup();
    const active = apply(s, {
      type: 'startAdventure',
      buildingId: outpost,
      missionId: mission.id,
      dinoIds: [dinoId],
      day,
    });
    expect(runCommand(active, { type: 'feed', dinoId }, now).ok).toBe(false);
    expect(runCommand(active, { type: 'sellDino', dinoId }, now).ok).toBe(false);
    expect(runCommand(active, { type: 'breed', a: dinoId, b: dinoId }, now).ok).toBe(false);
    const challenge = active.arenaBoard!.challenges[0];
    expect(
      runCommand(
        active,
        { type: 'startDuel', buildingId: arena, challengeId: challenge.id, dinoId, day: active.arenaBoard!.day },
        now,
      ).ok,
    ).toBe(false);
  });
});
