import { describe, expect, it } from 'vitest';
import {
  runCommand,
  dailyArena,
  dailyExpeditions,
  expeditionDay,
  nextExpeditionReset,
  expeditionTeamMatches,
  isRecovering,
  type Command,
  type GameState,
} from './index';
import { newGameWithServices } from './test-helpers';

const now = Date.parse('2026-10-09T08:00:00Z');
function apply(s: GameState, command: Command, time = now) {
  const result = runCommand(s, command, time);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function setup() {
  const s = newGameWithServices(now, 123);
  s.food = 10000;
  s.gold = 10000;
  s.gems = 30;
  // A known route isolates command tests from the day's rotating difficulty.
  s.expeditionBoard!.slots[0].mission = {
    ...s.expeditionBoard!.slots[0].mission,
    element: 'fire',
    tier: 'easy',
    seconds: 1200,
    recoverySeconds: 1800,
    cost: 10,
    gold: 100,
    food: 80,
    gems: 0,
    fragments: 5,
    requirements: [{ element: 'fire', level: 1 }],
  };
  s.expeditionBoard!.reserves[0] = {
    ...s.expeditionBoard!.slots[0].mission,
    id: 'test-reserve',
  };
  return { s, id: s.buildings.find((b) => b.kind === 'outpost')!.id };
}
function launch(s: GameState, id: string, index = 0, time = now) {
  const board = dailyExpeditions(s, time),
    mission = board.slots[index].mission;
  return apply(
    s,
    { type: 'startAdventure', buildingId: id, missionId: mission.id, dinoIds: [s.dinos[0].id], day: board.day },
    time,
  );
}
describe('daily expeditions', () => {
  it('persists six unique missions, including with only one unlocked habitat', () => {
    const { s } = setup();
    delete s.expeditionBoard;
    const first = dailyExpeditions(s, now);
    expect(dailyExpeditions(JSON.parse(JSON.stringify(s)), now)).toEqual(first);
    s.buildings.push({ id: 'fire', kind: 'habitat', element: 'fire', level: 1, slot: 'fire', stored: 0, since: now });
    const board = dailyExpeditions(s, now);
    expect(board.slots).toHaveLength(6);
    expect(new Set(board.slots.map((x) => x.mission.element)).size).toBe(6);
    expect(new Set([...board.slots.map((x) => x.mission.id), ...board.reserves.map((x) => x.id)]).size).toBe(12);
    for (const tier of ['easy', 'medium', 'hard'])
      expect(board.slots.filter((s) => s.mission.tier === tier)).toHaveLength(2);
    for (const slot of board.slots.filter((s) => s.mission.tier !== 'easy')) {
      expect(new Set(slot.mission.requirements.map((r) => r.element ?? r.species)).size).toBe(
        slot.mission.requirements.length,
      );
      expect(slot.mission.requirements).toHaveLength(slot.mission.tier === 'hard' ? 3 : 2);
    }
    s.expeditionBoard = board;
    s.dinos = [];
    expect(dailyExpeditions(s, now)).toBe(board);
  });
  it('resets at Bucharest midnight, including the daylight saving transition', () => {
    expect(expeditionDay(Date.parse('2026-10-09T21:00:00Z'))).toBe('2026-10-10');
    expect(nextExpeditionReset(now)).toBe(Date.parse('2026-10-09T21:00:00Z'));
    expect(nextExpeditionReset(Date.parse('2026-10-25T00:00:00Z'))).toBe(Date.parse('2026-10-25T22:00:00Z'));
  });
  it('preserves active and completed routes when upgrading an older three-route save', () => {
    const { s } = setup();
    const previous = s.expeditionBoard!;
    previous.slots = previous.slots.slice(0, 3);
    previous.slots[0].status = 'active';
    previous.slots[1].status = 'completed';
    const migrated = dailyExpeditions(s, now);
    expect(migrated.slots).toHaveLength(6);
    expect(new Set(migrated.slots.map((slot) => slot.id)).size).toBe(6);
    for (const old of previous.slots) expect(migrated.slots.find((slot) => slot.id === old.id)).toMatchObject(old);
    s.expeditionBoard = migrated;
    expect(dailyExpeditions(s, now)).toBe(migrated);
  });
  it('rejects replacing a route with a reserve from another element without charging gems', () => {
    const { s } = setup();
    const board = s.expeditionBoard!;
    const result = runCommand(
      s,
      { type: 'swapExpedition', slotId: board.slots[0].id, reserveId: board.reserves[1].id, day: board.day },
      now,
    );
    expect(result.ok).toBe(false);
    expect(result.state.gems).toBe(s.gems);
  });
  it('requires separate dinosaurs for overlapping species and element requirements', () => {
    const { s } = setup();
    const d = { ...s.dinos[0], level: 7 };
    const requirements = [
      { species: d.species, level: 4 },
      { element: 'fire' as const, level: 3 },
    ];
    expect(expeditionTeamMatches([d], requirements)).toBe(false);
    expect(expeditionTeamMatches([d, { ...d, id: 'second' }], requirements)).toBe(true);
  });
  it('starts recovery on return without requiring a reward claim and blocks arena and breeding', () => {
    const { s, id } = setup();
    s.dinos[0].level = 7;
    s.dinos.push({ ...s.dinos[0], id: 'second' });
    const active = launch(s, id),
      d = active.dinos[0],
      returned = active.buildings.find((b) => b.id === id)!.adventure!.readyAt;
    expect(isRecovering(d, returned - 1)).toBe(false);
    expect(isRecovering(d, returned)).toBe(true);
    expect(runCommand(active, { type: 'feed', dinoId: d.id }, returned).ok).toBe(true);
    expect(runCommand(active, { type: 'breed', a: d.id, b: 'second' }, returned).ok).toBe(false);
    const arena = active.buildings.find((b) => b.kind === 'arena')!.id;
    const duel = (time: number) => {
      const board = dailyArena(active, time);
      return runCommand(
        active,
        { type: 'startDuel', buildingId: arena, challengeId: board.challenges[0].id, dinoId: d.id, day: board.day },
        time,
      ).ok;
    };
    expect(duel(returned)).toBe(false);
    expect(duel(d.recoveryUntil!)).toBe(true);
    const claimed = apply(active, { type: 'claimAdventure', buildingId: id }, returned + 10000);
    expect(claimed.dinos[0].recoveryUntil).toBe(d.recoveryUntil);
    expect(runCommand(claimed, { type: 'claimAdventure', buildingId: id }, returned + 10000).ok).toBe(false);
  });
  it('charges swaps once and rejects used reserves, active slots, and stale days atomically', () => {
    const { s, id } = setup();
    const b = s.expeditionBoard!,
      reserve = b.reserves[0].id;
    const swapped = apply(s, { type: 'swapExpedition', slotId: 'slot-0', reserveId: reserve, day: b.day });
    expect(swapped.gems).toBe(s.gems - 5);
    expect(swapped.expeditionBoard!.reserves).toHaveLength(5);
    for (const day of [b.day, '2000-01-01']) {
      const result = runCommand(swapped, { type: 'swapExpedition', slotId: 'slot-0', reserveId: reserve, day }, now);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(swapped);
    }
    const active = launch(swapped, id);
    expect(
      runCommand(
        active,
        { type: 'swapExpedition', slotId: 'slot-0', reserveId: active.expeditionBoard!.reserves[0].id, day: b.day },
        now,
      ).ok,
    ).toBe(false);
  });
  it('awards the daily chest once after four completed slots and cannot replay them', () => {
    let { s, id } = setup();
    s.expeditionBoard!.slots.forEach((slot, i) => {
      slot.mission = { ...s.expeditionBoard!.slots[0].mission, id: `test-${i}` };
    });
    let time = now;
    for (let i = 0; i < 4; i++) {
      s = launch(s, id, i, time);
      const d = s.dinos[0];
      s = apply(s, { type: 'claimAdventure', buildingId: id }, d.recoveryStartsAt!);
      time = d.recoveryUntil!;
    }
    expect(s.fragments).toBe(35);
    expect(s.gems).toBe(32);
    expect(s.expeditionBoard!.chestClaimed).toBe(true);
    expect(
      runCommand(s, { type: 'startAdventure', buildingId: id, missionId: 'test-0', dinoIds: [s.dinos[0].id] }, time).ok,
    ).toBe(false);
  });
  it('keeps old-day rewards without completing a slot on the new day', () => {
    const { s, id } = setup();
    const active = launch(s, id);
    const done = apply(active, { type: 'claimAdventure', buildingId: id }, nextExpeditionReset(now) + 1);
    expect(done.fragments).toBe(5);
    expect(done.expeditionBoard!.slots.every((x) => x.status === 'available')).toBe(true);
    expect(isRecovering(done.dinos[0], nextExpeditionReset(now) + 1)).toBe(false);
  });
  it('spends fragments on permanent bonuses and freezes rewards at launch', () => {
    const { s, id } = setup();
    s.fragments = 200;
    const active = launch(s, id),
      upgraded = apply(active, { type: 'improveExpeditions' });
    expect(upgraded.fragments).toBe(175);
    expect(upgraded.expeditionTraining).toBe(1);
    const done = apply(upgraded, { type: 'claimAdventure', buildingId: id }, upgraded.dinos[0].recoveryStartsAt!);
    expect(done.fragments).toBe(180);
    let max = apply(apply(done, { type: 'improveExpeditions' }), { type: 'improveExpeditions' });
    expect(max.expeditionTraining).toBe(3);
    expect(runCommand(max, { type: 'improveExpeditions' }, now).ok).toBe(false);
  });
  it('supports pending legacy outpost missions', () => {
    const { s, id } = setup();
    delete s.fragments;
    delete s.expeditionBoard;
    s.buildings.find((b) => b.id === id)!.adventure = {
      missionId: 'outpost-trail',
      dinoIds: [s.dinos[0].id],
      readyAt: now,
    };
    const done = apply(s, { type: 'claimAdventure', buildingId: id });
    expect(done.gold).toBe(s.gold + 35);
    expect(done.fragments).toBe(0);
  });
});

describe('daily board for a new player', () => {
  it('always has an easy expedition the starting dinosaur can do', () => {
    for (let day = 0; day < 60; day++) {
      const now = Date.UTC(2026, 0, 1) + day * 86_400_000;
      const s = newGameWithServices(now, 7 + day);
      const board = dailyExpeditions(s, now);
      expect(
        board.slots.some(
          (slot) => slot.mission.tier === 'easy' && expeditionTeamMatches(s.dinos, slot.mission.requirements),
        ),
      ).toBe(true);
    }
  });
});
