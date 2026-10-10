import { speciesOf } from './catalog';
import { claimDuel } from './arena';
import { countStat, findBuilding, findDino, GameError, spend } from './state';
import { EXPEDITION_MATERIALS, addMaterials, gearBonus, scaleMaterials } from './items';
import type { Dino, GameEvent, GameState } from './types';
import {
  ensureExpeditionBoard,
  expeditionRewards,
  expeditionTeamMatches,
  isRecovering,
  EXPEDITION_CHEST_TARGET,
} from './expeditions';

/**
 * Misiunile vechi de arenă (dinainte de dueluri). Nu se mai pot porni; rămân doar ca o echipă plecată într-o
 * salvare veche să poată fi adusă înapoi cu recompensa ei.
 */
export const MISSIONS = [
  {
    id: 'arena-trial',
    kind: 'arena',
    name: 'Provocarea debutanților',
    level: 1,
    power: 16,
    seconds: 45,
    cost: 8,
    gold: 70,
    food: 0,
    gems: 0,
  },
  {
    id: 'arena-champions',
    kind: 'arena',
    name: 'Cupa campionilor',
    level: 2,
    power: 95,
    seconds: 180,
    cost: 25,
    gold: 260,
    food: 0,
    gems: 1,
  },
  {
    id: 'outpost-trail',
    kind: 'outpost',
    name: 'Poteca fosilelor',
    level: 1,
    power: 16,
    seconds: 90,
    cost: 5,
    gold: 35,
    food: 20,
    gems: 0,
  },
  {
    id: 'outpost-ruins',
    kind: 'outpost',
    name: 'Ruinele pierdute',
    level: 2,
    power: 80,
    seconds: 240,
    cost: 20,
    gold: 160,
    food: 60,
    gems: 1,
  },
] as const;

export const dinoPower = (d: Dino) => d.level * 10 + speciesOf(d.species).income + gearBonus(d).power;
export const onAdventure = (s: GameState, id: string, now?: number) =>
  s.buildings.some(
    (b) =>
      b.adventure?.dinoIds.includes(id) &&
      (now === undefined || (!b.adventure.expedition && !b.adventure.duel) || now < b.adventure.readyAt),
  );
export function dinoUnavailable(s: GameState, d: Dino, now: number) {
  return onAdventure(s, d.id, now) || isRecovering(d, now) || s.breeding?.a === d.id || s.breeding?.b === d.id;
}

export function startAdventure(
  s: GameState,
  buildingId: string,
  missionId: string,
  dinoIds: string[],
  now: number,
  day?: string,
) {
  const b = findBuilding(s, buildingId);
  ensureExpeditionBoard(s, now);
  const slot =
    b.kind === 'outpost'
      ? s.expeditionBoard!.slots.find((x) => x.mission.id === missionId && x.status === 'available')
      : undefined;
  if (slot && day !== undefined && day !== s.expeditionBoard!.day)
    throw new GameError('Lista zilnică s-a schimbat. Alege din nou expediția.');
  if (b.kind !== 'outpost') throw new GameError('Echipele pleacă doar din avanpost; în arenă alegi un duel.');
  const mission = slot?.mission;
  if (!mission) throw new GameError('Expediția nu mai este disponibilă.');
  if (b.adventure) throw new GameError('Clădirea are deja o echipă în misiune.');
  if (!dinoIds.length || dinoIds.length > 3 || new Set(dinoIds).size !== dinoIds.length)
    throw new GameError('Alege între 1 și 3 dinozauri diferiți.');
  const team = dinoIds.map((id) => findDino(s, id));
  if (team.some((d) => dinoUnavailable(s, d, now))) throw new GameError('Un dinozaur este ocupat sau în recuperare.');
  if (!expeditionTeamMatches(team, mission.requirements))
    throw new GameError('Echipa nu îndeplinește cerințele de specie și nivel.');
  spend(s, 'food', mission.cost);
  b.adventure = { missionId, dinoIds: [...dinoIds], readyAt: now + mission.seconds * 1000 };
  {
    slot.status = 'active';
    b.adventure.expedition = expeditionRewards(s, mission);
    b.adventure.expeditionDay = s.expeditionBoard!.day;
    b.adventure.slotId = slot.id;
    for (const d of team) {
      d.recoveryStartsAt = b.adventure.readyAt;
      d.recoveryUntil = b.adventure.readyAt + mission.recoverySeconds * 1000;
    }
  }
}

export function claimAdventure(s: GameState, buildingId: string, now: number, events: GameEvent[]) {
  const b = findBuilding(s, buildingId);
  if (b.adventure?.duel) return claimDuel(s, buildingId, now, events);
  if (!b.adventure || now < b.adventure.readyAt) throw new GameError('Echipa nu s-a întors încă.');
  const active = b.adventure;
  const mission = active.expedition ?? MISSIONS.find((m) => m.id === active.missionId && m.kind === b.kind);
  if (!mission) throw new GameError('Misiune necunoscută.');
  s.gold += mission.gold;
  s.food += mission.food;
  s.gems += mission.gems;
  const fragments = 'fragments' in mission ? mission.fragments : 0;
  s.fragments = (s.fragments ?? 0) + fragments;
  if (active.expedition) {
    // materialele de forjă: pe dificultate, cu bonusul talismanelor din echipă
    const loot = active.dinoIds.reduce((n, id) => n + gearBonus(s.dinos.find((d) => d.id === id) ?? {}).loot, 0);
    const found = scaleMaterials(EXPEDITION_MATERIALS[active.expedition.tier], 1 + loot);
    addMaterials(s, found);
    events.push({ type: 'materials', materials: found });
    countStat(s, 'expeditions');
  }
  if (active.expedition) {
    ensureExpeditionBoard(s, now);
    if (s.expeditionBoard!.day === active.expeditionDay) {
      const slot = s.expeditionBoard!.slots.find((x) => x.id === active.slotId);
      if (slot?.status === 'active') slot.status = 'completed';
      if (
        !s.expeditionBoard!.chestClaimed &&
        s.expeditionBoard!.slots.filter((x) => x.status === 'completed').length >= EXPEDITION_CHEST_TARGET
      ) {
        s.expeditionBoard!.chestClaimed = true;
        s.fragments += 15;
        s.gems += 2;
        events.push({ type: 'expeditionChest', fragments: 15, gems: 2 });
      }
    }
  }
  delete b.adventure;
  events.push({ type: 'adventureReward', gold: mission.gold, food: mission.food, gems: mission.gems, fragments });
}
