// Comenzile jucătorului. runCommand lucrează pe o copie: la eroare, starea rămâne neschimbată.

import { rushCost } from './catalog';
import { claimAdventure, onAdventure, startAdventure } from './adventures';
import { startDuel, skipDuelAnimation, trainArenaAbility, dailyArena } from './arena';
import { ensureExpeditionBoard, swapExpedition, improveExpeditions } from './expeditions';
import {
  buyEgg,
  buyHabitatEgg,
  cancelBreeding,
  feed,
  finishBreeding,
  hatch,
  moveDino,
  rename,
  sellDino,
  startBreeding,
} from './dinos';
import { GameError, findBuilding, spend } from './state';
import {
  build,
  buildAt,
  collect,
  collectAll,
  harvest,
  move,
  moveBuilding,
  plant,
  rushPlot,
  unlockWorld,
  upgrade,
} from './world';
import type { BuildingKind, ElementId, GameEvent, GameState, GearSlot } from './types';
import { collectCraft, craft, equip, unequip, useItem, type ItemTarget } from './forge';
import { claimAtlas, claimGoal } from './goals';

export type Command =
  | { type: 'startDuel'; buildingId: string; challengeId: string; dinoId: string; day: string }
  | { type: 'skipDuelAnimation'; buildingId: string }
  | { type: 'trainArenaAbility'; dinoId: string }
  | { type: 'moveBuilding'; buildingId: string; position: { x: number; y: number } }
  | { type: 'buildAt'; kind: BuildingKind; position: { x: number; y: number } }
  | { type: 'swapExpedition'; slotId: string; reserveId: string; day: string }
  | { type: 'improveExpeditions' }
  | { type: 'unlockWorld'; element: ElementId }
  | { type: 'startAdventure'; buildingId: string; missionId: string; dinoIds: string[]; day?: string }
  | { type: 'claimAdventure'; buildingId: string }
  | { type: 'build'; kind: BuildingKind; slot: string; element?: ElementId }
  | { type: 'move'; buildingId: string; slot: string }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'collect'; buildingId: string }
  | { type: 'collectAll' }
  | { type: 'plant'; farmId: string; cropId: string; plot?: number }
  | { type: 'harvest'; farmId: string; plot?: number }
  | { type: 'buyEgg'; species: string }
  | { type: 'buyHabitatEgg'; element: ElementId }
  | { type: 'hatch'; eggId: string; habitatId: string }
  | { type: 'feed'; dinoId: string }
  | { type: 'moveDino'; dinoId: string; habitatId: string }
  | { type: 'rename'; dinoId: string; nickname: string }
  | { type: 'sellDino'; dinoId: string }
  | { type: 'breed'; a: string; b: string }
  | { type: 'finishBreed' }
  | { type: 'cancelBreed' }
  /** Termină acum un temporizator, cu nestemate. */
  | { type: 'rush'; target: { egg: string } | { farm: string; plot?: number } | { forge: string } | 'breeding' }
  | { type: 'craft'; forgeId: string; itemId: string }
  | { type: 'collectCraft'; forgeId: string }
  | { type: 'equip'; dinoId: string; itemId: string }
  | { type: 'unequip'; dinoId: string; slot: GearSlot }
  | { type: 'useItem'; itemId: string; target: ItemTarget }
  | { type: 'claimGoal'; goalId: string }
  | { type: 'claimAtlas'; species: string };

export type CommandResult =
  { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: string };

export function runCommand(state: GameState, cmd: Command, now: number): CommandResult {
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  try {
    ensureExpeditionBoard(next, now);
    next.arenaBoard = dailyArena(next, now);
    apply(next, cmd, now, events);
    return { ok: true, state: next, events };
  } catch (e) {
    if (e instanceof GameError) return { ok: false, state, error: e.message };
    throw e;
  }
}

function apply(s: GameState, cmd: Command, now: number, events: GameEvent[]) {
  const lockedIds =
    ['feed', 'moveDino', 'sellDino'].includes(cmd.type) && 'dinoId' in cmd
      ? [cmd.dinoId]
      : cmd.type === 'breed'
        ? [cmd.a, cmd.b]
        : [];
  if (lockedIds.some((id) => onAdventure(s, id, now)))
    throw new GameError('Dinozaurul este în misiune. Așteaptă întoarcerea echipei.');
  switch (cmd.type) {
    case 'startDuel':
      return startDuel(s, cmd.buildingId, cmd.challengeId, cmd.dinoId, cmd.day, now);
    case 'skipDuelAnimation':
      return skipDuelAnimation(s, cmd.buildingId, now);
    case 'trainArenaAbility':
      return trainArenaAbility(s, cmd.dinoId, now);
    case 'moveBuilding':
      return moveBuilding(s, cmd.buildingId, cmd.position);
    case 'buildAt':
      return void buildAt(s, cmd.kind, cmd.position, now);
    case 'swapExpedition':
      return swapExpedition(s, cmd.slotId, cmd.reserveId, cmd.day, now);
    case 'improveExpeditions':
      return improveExpeditions(s);
    case 'unlockWorld':
      return unlockWorld(s, cmd.element, now);
    case 'startAdventure':
      return startAdventure(s, cmd.buildingId, cmd.missionId, cmd.dinoIds, now, cmd.day);
    case 'claimAdventure':
      return claimAdventure(s, cmd.buildingId, now, events);
    case 'build':
      return void build(s, cmd.kind, cmd.slot, now, cmd.element);
    case 'move':
      return move(s, cmd.buildingId, cmd.slot);
    case 'upgrade':
      return upgrade(s, cmd.buildingId, now, events);
    case 'collect':
      return collect(s, cmd.buildingId, now, events);
    case 'collectAll':
      return collectAll(s, now, events);
    case 'plant':
      return plant(s, cmd.farmId, cmd.cropId, now, cmd.plot);
    case 'harvest':
      return harvest(s, cmd.farmId, now, events, cmd.plot);
    case 'buyEgg':
      return buyEgg(s, cmd.species, now);
    case 'buyHabitatEgg':
      return buyHabitatEgg(s, cmd.element, now);
    case 'hatch':
      return void hatch(s, cmd.eggId, cmd.habitatId, now, events);
    case 'feed':
      return feed(s, cmd.dinoId, now, events);
    case 'moveDino':
      return moveDino(s, cmd.dinoId, cmd.habitatId, now);
    case 'rename':
      return rename(s, cmd.dinoId, cmd.nickname);
    case 'sellDino':
      return sellDino(s, cmd.dinoId, now);
    case 'breed':
      return startBreeding(s, cmd.a, cmd.b, now);
    case 'finishBreed':
      return finishBreeding(s, now, events);
    case 'cancelBreed':
      return cancelBreeding(s);
    case 'rush':
      return rush(s, cmd.target, now);
    case 'craft':
      return craft(s, cmd.forgeId, cmd.itemId, now);
    case 'collectCraft':
      return collectCraft(s, cmd.forgeId, now, events);
    case 'equip':
      return equip(s, cmd.dinoId, cmd.itemId, now);
    case 'unequip':
      return unequip(s, cmd.dinoId, cmd.slot, now);
    case 'useItem':
      return useItem(s, cmd.itemId, cmd.target, now);
    case 'claimGoal':
      return claimGoal(s, cmd.goalId, events);
    case 'claimAtlas':
      return claimAtlas(s, cmd.species, events);
  }
}

function rush(s: GameState, target: Extract<Command, { type: 'rush' }>['target'], now: number) {
  if (target === 'breeding') {
    if (!s.breeding) throw new GameError('Nu se împerechează nimeni.');
    spend(s, 'gems', rushCost(s.breeding.readyAt - now));
    s.breeding.readyAt = now;
  } else if ('egg' in target) {
    const egg = s.eggs.find((e) => e.id === target.egg);
    if (!egg) throw new GameError('Oul nu există.');
    spend(s, 'gems', rushCost(egg.hatchAt - now));
    egg.hatchAt = now;
  } else if ('forge' in target) {
    const forge = findBuilding(s, target.forge);
    if (!forge.craft) throw new GameError('Forja nu lucrează la nimic.');
    spend(s, 'gems', rushCost(forge.craft.readyAt - now));
    forge.craft.readyAt = now;
  } else {
    const plot = rushPlot(s, target.farm, now, target.plot);
    spend(s, 'gems', rushCost(plot.readyAt - now));
    plot.readyAt = now;
  }
}
