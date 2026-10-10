import { describe, expect, it } from 'vitest';
import {
  runCommand,
  dailyArena,
  expeditionDay,
  nextExpeditionReset,
  arenaAbility,
  simulateDuel,
  arenaStats,
  elementAdvantage,
  isRecovering,
  ARENA_RECOVERY_MS,
  type Command,
  type Dino,
  type GameState,
} from './index';
import { newGameWithServices } from './test-helpers';

const now = Date.parse('2026-10-09T08:00:00Z');
function setup() {
  const s = newGameWithServices(now, 123);
  s.food = 1000;
  s.gold = 1000;
  s.medals = 200;
  const id = s.buildings.find((b) => b.kind === 'arena')!.id;
  // Guarantee a victory so persistence and rewards tests don't depend on matchup balance.
  s.dinos[0].level = 10;
  s.arenaBoard!.challenges[0].species = 'ignisaur';
  s.arenaBoard!.challenges[0].level = 1;
  return { s, id, dinoId: s.dinos[0].id };
}
function apply(s: GameState, cmd: Command, time = now) {
  const r = runCommand(s, cmd, time);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function launch(s: GameState, id: string, dinoId: string, time = now) {
  const board = dailyArena(s, time);
  return apply(
    s,
    { type: 'startDuel', buildingId: id, challengeId: board.challenges[0].id, dinoId, day: board.day },
    time,
  );
}
describe('single-fighter arena', () => {
  it('generates three daily opponents, freezes their levels and resets at Bucharest midnight', () => {
    const { s } = setup();
    delete s.arenaBoard;
    const board = dailyArena(s, now);
    expect(board.challenges.map((c) => c.tier)).toEqual(['easy', 'medium', 'hard']);
    expect(new Set(board.challenges.map((c) => c.species)).size).toBe(3);
    expect(dailyArena(JSON.parse(JSON.stringify(s)), now)).toEqual(board);
    s.arenaBoard = board;
    s.dinos[0].level = 1;
    expect(dailyArena(s, now)).toBe(board);
    const reset = nextExpeditionReset(now);
    expect(dailyArena(s, reset).day).toBe(expeditionDay(reset));
    expect(dailyArena(s, reset).challenges.every((c) => !c.claimed && c.attempts === 0)).toBe(true);
  });
  it('applies counter elements and cancels reciprocal advantages for mixed species', () => {
    expect(elementAdvantage('ignisaur', 'silvosteg')).toBe(1.25);
    expect(elementAdvantage('silvosteg', 'ignisaur')).toBe(0.8);
    expect(elementAdvantage('ignisaur', 'ignisaur')).toBe(1);
  });
  it('simulates deterministic damage, ability triggers and bounded health', () => {
    const { s } = setup(),
      player = { ...s.dinos[0], level: 5 },
      enemy = { ...player, id: 'enemy', species: 'cineraptor' };
    const fight = simulateDuel(player, enemy, 99);
    expect(simulateDuel(player, enemy, 99)).toEqual(fight);
    expect(fight.frames.length).toBeGreaterThan(3);
    expect(fight.frames.some((f) => f.ability)).toBe(true);
    for (const f of fight.frames) {
      expect(f.playerHp).toBeGreaterThanOrEqual(0);
      expect(f.playerHp).toBeLessThanOrEqual(arenaStats(player).hp);
      expect(f.enemyHp).toBeGreaterThanOrEqual(0);
      expect(f.enemyHp).toBeLessThanOrEqual(arenaStats(enemy).hp);
    }
    expect(fight.frames.length).toBeLessThanOrEqual(40);
    expect(arenaAbility(player.species).name).toBeTruthy();
  });
  it('persists the fight, charges entry once, blocks early claims and awards a victory once', () => {
    const { s, id, dinoId } = setup(),
      challenge = s.arenaBoard!.challenges[0];
    const active = launch(s, id, dinoId),
      battle = active.buildings.find((b) => b.id === id)!.adventure!;
    expect(battle.dinoIds).toEqual([dinoId]);
    expect(battle.duel!.won).toBe(true);
    expect(active.food).toBe(s.food - challenge.cost);
    expect(runCommand(active, { type: 'claimAdventure', buildingId: id }, battle.readyAt - 1).ok).toBe(false);
    expect(runCommand(active, { type: 'feed', dinoId }, now).ok).toBe(false);
    expect(
      runCommand(active, { type: 'startDuel', buildingId: id, challengeId: 'duel-1', dinoId, day: challenge.id }, now)
        .ok,
    ).toBe(false);
    const done = apply(JSON.parse(JSON.stringify(active)), { type: 'claimAdventure', buildingId: id }, battle.readyAt);
    expect(done.gold).toBe(s.gold + challenge.gold);
    expect(done.medals).toBe(s.medals! + challenge.medals);
    expect(done.arenaBoard!.challenges[0].claimed).toBe(true);
    expect(runCommand(done, { type: 'claimAdventure', buildingId: id }, battle.readyAt).ok).toBe(false);
    expect(
      runCommand(
        done,
        { type: 'startDuel', buildingId: id, challengeId: challenge.id, dinoId, day: done.arenaBoard!.day },
        battle.readyAt + ARENA_RECOVERY_MS.win,
      ).ok,
    ).toBe(false);
  });
  it('starts fatigue on return offline and blocks expeditions, breeding and duel entry during recovery', () => {
    const { s, id, dinoId } = setup(),
      active = launch(s, id, dinoId),
      d = active.dinos[0],
      end = d.recoveryStartsAt!;
    expect(isRecovering(d, end - 1)).toBe(false);
    expect(isRecovering(d, end)).toBe(true);
    expect(d.recoveryUntil).toBe(end + ARENA_RECOVERY_MS.win);
    const done = apply(active, { type: 'claimAdventure', buildingId: id }, end + 10000);
    expect(done.dinos[0].recoveryUntil).toBe(d.recoveryUntil);
    const outpost = done.buildings.find((b) => b.kind === 'outpost')!.id;
    done.expeditionBoard!.slots[0].mission.requirements = [{ species: d.species, level: 1 }];
    const mission = done.expeditionBoard!.slots[0].mission;
    expect(
      runCommand(done, { type: 'startAdventure', buildingId: outpost, missionId: mission.id, dinoIds: [dinoId] }, end)
        .ok,
    ).toBe(false);
    done.dinos.push({ ...d, id: 'second', recoveryStartsAt: undefined, recoveryUntil: undefined });
    expect(runCommand(done, { type: 'breed', a: dinoId, b: 'second' }, end).ok).toBe(false);
    expect(
      runCommand(
        done,
        { type: 'startDuel', buildingId: id, challengeId: 'duel-1', dinoId, day: done.arenaBoard!.day },
        end,
      ).ok,
    ).toBe(false);
    expect(
      runCommand(
        done,
        { type: 'startDuel', buildingId: id, challengeId: 'duel-1', dinoId, day: done.arenaBoard!.day },
        d.recoveryUntil!,
      ).ok,
    ).toBe(true);
  });
  it('skips only the animation, preserving the outcome and moving fatigue to the actual finish time', () => {
    const { s, id, dinoId } = setup(),
      active = launch(s, id, dinoId);
    const snapshot = active.buildings.find((b) => b.id === id)!.adventure!.duel;
    const skipped = apply(active, { type: 'skipDuelAnimation', buildingId: id }, now + 1000);
    expect(skipped.buildings.find((b) => b.id === id)!.adventure!.duel).toEqual(snapshot);
    expect(skipped.dinos[0].recoveryStartsAt).toBe(now + 1000);
    expect(skipped.dinos[0].recoveryUntil).toBe(now + 1000 + ARENA_RECOVERY_MS.win);
    expect(runCommand(skipped, { type: 'claimAdventure', buildingId: id }, now + 1000).ok).toBe(true);
    const again = apply(skipped, { type: 'skipDuelAnimation', buildingId: id }, now + 2000);
    expect(again.dinos[0].recoveryUntil).toBe(skipped.dinos[0].recoveryUntil);
  });
  it('grants no rewards for defeat, keeps the opponent available and allows retry after recovery', () => {
    const { s, id, dinoId } = setup();
    s.dinos[0].level = 1;
    s.arenaBoard!.challenges[0].level = 10;
    const active = launch(s, id, dinoId),
      end = active.dinos[0].recoveryStartsAt!;
    expect(active.buildings.find((b) => b.id === id)!.adventure!.duel!.won).toBe(false);
    const done = apply(active, { type: 'claimAdventure', buildingId: id }, end);
    expect(done.gold).toBe(s.gold);
    expect(done.medals).toBe(s.medals);
    expect(done.arenaBoard!.challenges[0].claimed).toBe(false);
    const retry = launch(done, id, dinoId, done.dinos[0].recoveryUntil!);
    expect(retry.arenaBoard!.challenges[0].attempts).toBe(2);
  });
  it('keeps yesterday rewards without marking todays opponent defeated', () => {
    const { s, id, dinoId } = setup(),
      active = launch(s, id, dinoId);
    const done = apply(active, { type: 'claimAdventure', buildingId: id }, nextExpeditionReset(now) + 1);
    expect(done.medals).toBe(s.medals! + s.arenaBoard!.challenges[0].medals);
    expect(done.arenaBoard!.challenges.every((c) => !c.claimed)).toBe(true);
  });
  it('spends medals on permanent ability ranks, rejects busy training and max rank atomically', () => {
    const { s, id, dinoId } = setup(),
      active = launch(s, id, dinoId);
    expect(runCommand(active, { type: 'trainArenaAbility', dinoId }, now).ok).toBe(false);
    let trained = s;
    for (let i = 0; i < 3; i++) trained = apply(trained, { type: 'trainArenaAbility', dinoId });
    expect(trained.dinos[0].arenaRank).toBe(3);
    expect(trained.medals).toBe(80);
    const rejected = runCommand(trained, { type: 'trainArenaAbility', dinoId }, now);
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(trained);
    s.medals = 0;
    expect(runCommand(s, { type: 'trainArenaAbility', dinoId }, now).state).toBe(s);
  });
  it('rejects invalid buildings, stale days and multiple fighters through the legacy arena command', () => {
    const { s, id, dinoId } = setup(),
      outpost = s.buildings.find((b) => b.kind === 'outpost')!.id;
    expect(
      runCommand(
        s,
        { type: 'startDuel', buildingId: outpost, challengeId: 'duel-0', dinoId, day: s.arenaBoard!.day },
        now,
      ).ok,
    ).toBe(false);
    expect(
      runCommand(s, { type: 'startDuel', buildingId: id, challengeId: 'duel-0', dinoId, day: '2000-01-01' }, now).ok,
    ).toBe(false);
    s.dinos.push({ ...s.dinos[0], id: 'second' });
    expect(
      runCommand(
        s,
        { type: 'startAdventure', buildingId: id, missionId: 'arena-trial', dinoIds: [dinoId, 'second'] },
        now,
      ).ok,
    ).toBe(false);
  });
});
