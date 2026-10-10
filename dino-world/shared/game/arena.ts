import { ARENA_MATERIALS, addMaterials, gearBonus } from './items';
import { ELEMENT_IDS, SPECIES, speciesOf } from './catalog';
import { dinoUnavailable } from './adventures';
import { expeditionDay } from './expeditions';
import { createRng, mixSeed } from './rng';
import { countStat, findBuilding, findDino, GameError, spend } from './state';
import type { ArenaBoard, ArenaDuel, ArenaFrame, Dino, ElementId, GameEvent, GameState } from './types';

export const ARENA_STEP_MS = 700;
export const ARENA_TRAINING_COST = [15, 35, 70];
export const ARENA_RECOVERY_MS = { win: 5 * 60_000, loss: 10 * 60_000 };
const counters: Record<ElementId, ElementId> = {
  fire: 'plant',
  plant: 'earth',
  earth: 'storm',
  storm: 'water',
  water: 'ice',
  ice: 'fire',
};
const hash = (text: string) => [...text].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0);

export function elementAdvantage(a: string, b: string): number {
  const attack = speciesOf(a).elements,
    defend = speciesOf(b).elements;
  const wins = attack.some((e) => defend.includes(counters[e]));
  const loses = defend.some((e) => attack.includes(counters[e]));
  return wins === loses ? 1 : wins ? 1.25 : 0.8;
}
export function arenaAbility(species: string) {
  const kind = ['strike', 'shield', 'heal', 'swift'][hash(species) % 4] as 'strike' | 'shield' | 'heal' | 'swift';
  const names = { strike: 'Lovitură primordială', shield: 'Scut ancestral', heal: 'Regenerare', swift: 'Atac fulger' };
  const descriptions = {
    strike: 'O lovitură cu 80% mai multă forță.',
    shield: 'Atac normal și protecție: următoarea lovitură primită este redusă la jumătate.',
    heal: 'Atac normal și refacerea a 16% din viața maximă.',
    swift: 'Două lovituri rapide, cu 40% mai multă forță în total.',
  };
  return { kind, name: names[kind], description: descriptions[kind] };
}
export function arenaStats(d: Dino) {
  return { hp: 120 + d.level * 28, attack: 18 + d.level * 6 + speciesOf(d.species).income + gearBonus(d).power };
}
export function dailyArena(s: GameState, now: number): ArenaBoard {
  const day = expeditionDay(now);
  if (s.arenaBoard?.day === day) return s.arenaBoard;
  const rng = createRng(mixSeed(s.seed, hash('arena-' + day)));
  const top = Math.max(1, ...s.dinos.map((d) => d.level));
  const tiers = ['easy', 'medium', 'hard'] as const;
  const elements = [...ELEMENT_IDS].sort();
  for (let i = elements.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [elements[i], elements[j]] = [elements[j], elements[i]];
  }
  return {
    day,
    challenges: tiers.map((tier, i) => {
      const pool = SPECIES.filter((sp) => sp.elements.length === 1 && sp.elements[0] === elements[i]);
      return {
        id: `duel-${i}`,
        species: pool[Math.floor(rng() * pool.length)].id,
        level: [Math.max(1, top - 1), top, Math.min(10, top + 2)][i],
        tier,
        gold: [80, 180, 350][i],
        medals: [5, 10, 18][i],
        cost: [5, 10, 15][i],
        claimed: false,
        attempts: 0,
      };
    }),
  };
}
export function simulateDuel(player: Dino, enemy: Dino, seed: number) {
  const stats = [arenaStats(player), arenaStats(enemy)],
    dinos = [player, enemy];
  const hp = stats.map((s) => s.hp),
    shields = [false, false],
    turns = [0, 0];
  const rng = createRng(seed),
    frames: ArenaFrame[] = [];
  let actor =
    arenaAbility(player.species).kind === 'swift'
      ? 0
      : arenaAbility(enemy.species).kind === 'swift'
        ? 1
        : rng() < 0.5
          ? 0
          : 1;
  for (let i = 0; i < 40 && hp[0] > 0 && hp[1] > 0; i++) {
    const target = 1 - actor,
      d = dinos[actor],
      special = ++turns[actor] % 3 === 0;
    const ability = arenaAbility(d.species),
      bonus = 1 + (d.arenaRank ?? 0) * 0.15;
    let force = stats[actor].attack * elementAdvantage(d.species, dinos[target].species) * (0.9 + rng() * 0.2);
    if (special) {
      if (ability.kind === 'strike') force *= 1 + 0.8 * bonus;
      if (ability.kind === 'swift') force *= 1 + 0.4 * bonus;
      if (ability.kind === 'shield') shields[actor] = true;
      if (ability.kind === 'heal')
        hp[actor] = Math.min(stats[actor].hp, hp[actor] + Math.round(stats[actor].hp * 0.16 * bonus));
    }
    if (shields[target]) {
      force *= Math.max(0.25, 0.5 - (dinos[target].arenaRank ?? 0) * 0.075);
      shields[target] = false;
    }
    const damage = Math.max(1, Math.round(force));
    hp[target] = Math.max(0, hp[target] - damage);
    frames.push({
      actor: actor === 0 ? 'player' : 'enemy',
      playerHp: hp[0],
      enemyHp: hp[1],
      text: `${speciesOf(d.species).name}: ${special ? ability.name : 'Atac'} · −${damage} viață`,
      ability: special,
    });
    actor = target;
  }
  // A capped fight is resolved by remaining health percentage; ties favor the defender.
  const won = hp[1] <= 0 || (hp[0] > 0 && hp[0] / stats[0].hp > hp[1] / stats[1].hp);
  return { frames, won, playerMaxHp: stats[0].hp, enemyMaxHp: stats[1].hp };
}
export function startDuel(
  s: GameState,
  buildingId: string,
  challengeId: string,
  dinoId: string,
  day: string,
  now: number,
) {
  const b = findBuilding(s, buildingId);
  if (b.kind !== 'arena' || b.adventure) throw new GameError('Arena este ocupată sau clădirea nu este o arenă.');
  s.arenaBoard = dailyArena(s, now);
  if (day !== s.arenaBoard.day) throw new GameError('Adversarii zilei s-au schimbat. Alege din nou.');
  const challenge = s.arenaBoard.challenges.find((c) => c.id === challengeId);
  if (!challenge || challenge.claimed) throw new GameError('Adversarul nu mai este disponibil.');
  const fighter = findDino(s, dinoId);
  if (dinoUnavailable(s, fighter, now)) throw new GameError('Luptătorul este ocupat sau în recuperare.');
  const enemy: Dino = { id: 'opponent', species: challenge.species, level: challenge.level, habitatId: b.id };
  const result = simulateDuel(fighter, enemy, mixSeed(s.seed, hash(day + challenge.id + challenge.attempts)));
  spend(s, 'food', challenge.cost);
  challenge.attempts++;
  const duel: ArenaDuel = {
    ...result,
    day,
    challengeId,
    fighter: { ...fighter },
    enemy,
    startedAt: now,
    gold: challenge.gold,
    medals: challenge.medals,
    materials: ARENA_MATERIALS[challenge.tier],
  };
  b.adventure = {
    missionId: challengeId,
    dinoIds: [dinoId],
    readyAt: now + (result.frames.length + 1) * ARENA_STEP_MS,
    duel,
  };
  fighter.recoveryStartsAt = b.adventure.readyAt;
  fighter.recoveryUntil = b.adventure.readyAt + ARENA_RECOVERY_MS[result.won ? 'win' : 'loss'];
}
export function skipDuelAnimation(s: GameState, buildingId: string, now: number) {
  const b = findBuilding(s, buildingId),
    active = b.adventure;
  if (b.kind !== 'arena' || !active?.duel) throw new GameError('Nu există un duel în desfășurare.');
  if (active.readyAt <= now) return;
  const d = findDino(s, active.dinoIds[0]);
  active.readyAt = now;
  d.recoveryStartsAt = now;
  d.recoveryUntil = now + ARENA_RECOVERY_MS[active.duel.won ? 'win' : 'loss'];
}
export function claimDuel(s: GameState, buildingId: string, now: number, events: GameEvent[]) {
  const b = findBuilding(s, buildingId),
    active = b.adventure;
  if (b.kind !== 'arena' || !active?.duel || active.readyAt > now) throw new GameError('Duelul nu s-a încheiat încă.');
  const duel = active.duel;
  if (duel.won) {
    s.gold += duel.gold;
    s.medals = (s.medals ?? 0) + duel.medals;
    countStat(s, 'duelsWon');
    if (duel.materials) {
      addMaterials(s, duel.materials);
      events.push({ type: 'materials', materials: duel.materials });
    }
    s.arenaBoard = dailyArena(s, now);
    if (s.arenaBoard.day === duel.day) {
      const challenge = s.arenaBoard.challenges.find((c) => c.id === duel.challengeId);
      if (challenge) challenge.claimed = true;
    }
  }
  delete b.adventure;
  events.push({
    type: 'arenaReward',
    won: duel.won,
    gold: duel.won ? duel.gold : 0,
    medals: duel.won ? duel.medals : 0,
  });
}
export function trainArenaAbility(s: GameState, dinoId: string, now: number) {
  const d = findDino(s, dinoId),
    cost = ARENA_TRAINING_COST[d.arenaRank ?? 0];
  if (cost === undefined) throw new GameError('Abilitatea este la nivel maxim.');
  if (s.buildings.some((b) => b.adventure?.dinoIds.includes(dinoId) && b.adventure.readyAt > now))
    throw new GameError('Așteaptă întoarcerea dinozaurului.');
  if ((s.medals ?? 0) < cost) throw new GameError(`Ai nevoie de ${cost} medalii.`);
  s.medals = (s.medals ?? 0) - cost;
  d.arenaRank = (d.arenaRank ?? 0) + 1;
}
