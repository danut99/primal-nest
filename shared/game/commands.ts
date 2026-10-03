// Comenzile jucătorului. runCommand lucrează pe o copie: la eroare, starea rămâne neschimbată.

import { type Haul, claimActivity, dequeueActivity, enqueueActivity, liveBattle, startCook, startExpedition, startGather, stopActivity } from './activities';
import type { BattleResult } from './battle';
import { ITEMS, PROPERTY_LEVELS } from './catalog';
import { equipRelic, feed, finishEvolution, renameDino, setParty, startEvolution, upgradeRelic } from './creatures';
import { GameError } from './errors';
import { candleEgg, discardEggs, hatchEgg, placeEgg, sellEggs, turnEgg } from './nest';
import { hasItems, itemCount, removeItems } from './state';
import { assignWork, collectWork, unassignWork } from './work';
import { cancelBreeding, finishBreeding, startBreeding } from './breeding';
import { bringBack, processNeglect } from './neglect';
import { feedAll, releaseDino, troughDeposit, troughWithdraw } from './care';
import { claimAchievement, claimDailyBonus, claimQuest, ensureDaily } from './daily';
import { setRow } from './creatures';
import type { GameEvent, GameState, ItemId, QueuedAction, Temperature } from './types';

export type Command =
  | { type: 'placeEgg'; eggId: string; temperature: Temperature }
  | { type: 'turnEgg'; eggId: string }
  | { type: 'candleEgg'; eggId: string }
  | { type: 'hatch'; eggId: string }
  | { type: 'sellEgg'; eggId: string }
  | { type: 'sellEggs'; eggIds: string[] }
  | { type: 'discardEggs'; eggIds: string[] }
  | { type: 'feed'; dinoId: string; itemId: ItemId }
  | { type: 'rename'; dinoId: string; nickname: string }
  | { type: 'evolve'; dinoId: string }
  | { type: 'finishEvolve'; dinoId: string }
  | { type: 'setParty'; ids: string[] }
  | { type: 'gather'; actionId: string; count?: number }
  | { type: 'enqueue'; item: QueuedAction }
  | { type: 'dequeue'; index: number }
  | { type: 'cook'; recipeId: string; count: number }
  | { type: 'expedition'; zoneId: string }
  | { type: 'claim' }
  | { type: 'stop' }
  | { type: 'battle'; zoneId: string; alpha?: boolean }
  | { type: 'equip'; dinoId: string; relicId: string | null }
  | { type: 'upgradeRelic'; relicId: string }
  | { type: 'assignWork'; dinoId: string; jobId: string }
  | { type: 'unassignWork'; dinoId: string }
  | { type: 'collectWork' }
  | { type: 'tick' }
  | { type: 'feedAll' }
  | { type: 'troughDeposit'; itemId: ItemId; qty: number }
  | { type: 'troughWithdraw'; itemId: ItemId }
  | { type: 'release'; dinoId: string }
  | { type: 'claimQuest'; questId: string }
  | { type: 'claimDailyBonus' }
  | { type: 'claimAchievement'; achievementId: string }
  | { type: 'setRow'; dinoId: string; back: boolean }
  | { type: 'bringBack'; dinoId: string }
  | { type: 'breed'; a: string; b: string }
  | { type: 'finishBreed' }
  | { type: 'cancelBreed' }
  | { type: 'sell'; itemId: ItemId; qty: number }
  | { type: 'upgrade' };

export interface CommandResult {
  state: GameState;
  events: GameEvent[];
  haul?: Haul | null;
  battle?: BattleResult;
  hatchedId?: string;
}

export function runCommand(current: GameState, cmd: Command, now: number): CommandResult {
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const result: CommandResult = { state, events };
  // Înainte de orice: cine a fost neglijat prea mult fuge.
  processNeglect(state, now, events);
  ensureDaily(state, now);

  switch (cmd.type) {
    case 'tick':
      break;
    case 'feedAll':
      feedAll(state, now, events);
      break;
    case 'troughDeposit':
      troughDeposit(state, cmd.itemId, cmd.qty);
      break;
    case 'troughWithdraw':
      troughWithdraw(state, cmd.itemId);
      break;
    case 'release':
      releaseDino(state, cmd.dinoId, events);
      break;
    case 'claimQuest':
      claimQuest(state, cmd.questId, events);
      break;
    case 'claimDailyBonus':
      claimDailyBonus(state, events);
      break;
    case 'claimAchievement':
      claimAchievement(state, cmd.achievementId, events);
      break;
    case 'setRow':
      setRow(state, cmd.dinoId, cmd.back);
      break;
    case 'bringBack':
      bringBack(state, cmd.dinoId, now, events);
      break;
    case 'placeEgg':
      placeEgg(state, cmd.eggId, cmd.temperature, now, events);
      break;
    case 'turnEgg':
      turnEgg(state, cmd.eggId, now, events);
      break;
    case 'candleEgg':
      candleEgg(state, cmd.eggId, events);
      break;
    case 'hatch':
      result.hatchedId = hatchEgg(state, cmd.eggId, now, events).id;
      break;
    case 'sellEgg':
      sellEggs(state, [cmd.eggId], events);
      break;
    case 'sellEggs':
      sellEggs(state, cmd.eggIds, events);
      break;
    case 'discardEggs':
      discardEggs(state, cmd.eggIds, events);
      break;
    case 'feed':
      feed(state, cmd.dinoId, cmd.itemId, now, events);
      break;
    case 'rename':
      renameDino(state, cmd.dinoId, cmd.nickname);
      break;
    case 'evolve':
      startEvolution(state, cmd.dinoId, now, events);
      break;
    case 'finishEvolve':
      finishEvolution(state, cmd.dinoId, now, events);
      break;
    case 'setParty':
      setParty(state, cmd.ids);
      break;
    case 'gather':
      result.haul = startGather(state, cmd.actionId, now, events, cmd.count);
      break;
    case 'enqueue':
      enqueueActivity(state, cmd.item, now, events);
      break;
    case 'dequeue':
      dequeueActivity(state, cmd.index);
      break;
    case 'cook':
      result.haul = startCook(state, cmd.recipeId, cmd.count, now, events);
      break;
    case 'expedition':
      result.haul = startExpedition(state, cmd.zoneId, now, events);
      break;
    case 'claim':
      result.haul = claimActivity(state, now, events);
      break;
    case 'stop':
      result.haul = stopActivity(state, now, events);
      break;
    case 'battle': {
      const { result: battle, haul } = liveBattle(state, cmd.zoneId, !!cmd.alpha, events);
      result.battle = battle;
      result.haul = haul;
      break;
    }
    case 'equip':
      equipRelic(state, cmd.dinoId, cmd.relicId);
      break;
    case 'sell':
      sellItem(state, cmd.itemId, cmd.qty, events);
      break;
    case 'assignWork':
      assignWork(state, cmd.dinoId, cmd.jobId, now, events);
      break;
    case 'unassignWork':
      unassignWork(state, cmd.dinoId, now, events);
      break;
    case 'collectWork':
      collectWork(state, now, events);
      break;
    case 'breed':
      startBreeding(state, cmd.a, cmd.b, now, events);
      break;
    case 'finishBreed':
      finishBreeding(state, now, events);
      break;
    case 'cancelBreed':
      cancelBreeding(state);
      break;
    case 'upgradeRelic':
      upgradeRelic(state, cmd.relicId, events);
      break;
    case 'upgrade':
      upgradeProperty(state, events);
      break;
    default:
      throw new GameError('VALIDATION', 'Comandă necunoscută.');
  }
  return result;
}

function sellItem(state: GameState, itemId: ItemId, qty: number, events: GameEvent[]) {
  const item = ITEMS[itemId];
  if (!item) throw new GameError('NOT_FOUND', 'Obiect necunoscut.');
  if (!Number.isInteger(qty) || qty < 1) throw new GameError('VALIDATION', 'Cantitate invalidă.');
  if (itemCount(state, itemId) < qty) throw new GameError('INSUFFICIENT_ITEMS', `Nu ai ${qty} × ${item.name}.`);
  removeItems(state, { [itemId]: qty });
  state.sparks += item.sell * qty;
  events.push({ kind: 'reward', text: `Saurok a topit ${qty} × ${item.name}: +${item.sell * qty} scântei. ✨` });
}

function upgradeProperty(state: GameState, events: GameEvent[]) {
  const next = PROPERTY_LEVELS[state.property + 1];
  if (!next) throw new GameError('LOCKED', 'Tabăra e deja la nivelul maxim în această versiune.');
  if (state.sparks < next.sparks) throw new GameError('INSUFFICIENT_FUNDS', `Îți trebuie ${next.sparks} scântei.`);
  if (!hasItems(state, next.cost)) throw new GameError('INSUFFICIENT_ITEMS', 'Nu ai destule materiale.');
  removeItems(state, next.cost);
  state.sparks -= next.sparks;
  state.property++;
  events.push({ kind: 'levelup', text: `Ai construit ${next.name}! ${next.unlocks}. 🏕️` });
}
