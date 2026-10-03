// Haita la muncă: dinozaurii lucrează în posturile din Tabără, în paralel cu activitatea ta.
// Specia, nivelul și atașamentul decid cât de repede lucrează. Timpul curge și offline, cu plafon.

import { ITEMS, PROPERTY_LEVELS, WORK_CAP_SECONDS, WORK_JOBS, type WorkJob } from './catalog';
import { addDinoXp, findDino, isBreeding, species } from './creatures';
import { GameError } from './errors';
import { createRng, mixSeed, weighted } from './rng';
import { addItem, addSkillXp } from './state';
import type { Dino, GameEvent, GameState, ItemId, Worker } from './types';

export function findJob(id: string): WorkJob {
  const job = WORK_JOBS.find((j) => j.id === id);
  if (!job) throw new GameError('NOT_FOUND', 'Post de muncă necunoscut.');
  return job;
}

export function workSlots(state: GameState): number {
  return PROPERTY_LEVELS[state.property].workSlots;
}

export function workerOf(state: GameState, dinoId: string): Worker | undefined {
  return state.workers.find((w) => w.dinoId === dinoId);
}

/** Ce tipuri ale dinozaurului se potrivesc cu postul (pentru bonus și interfață). */
export function jobAffinity(dino: Pick<Dino, 'speciesId'>, job: WorkJob): boolean {
  return species(dino).types.some((t) => job.types.includes(t));
}

/** Multiplicatorul de viteză: +2%/nivel, +50% dacă tipul se potrivește, până la +25% din atașament. */
export function workSpeed(dino: Dino, job: WorkJob): number {
  return 1 + 0.02 * (dino.level - 1) + (jobAffinity(dino, job) ? 0.5 : 0) + dino.bond / 400;
}

export function workSeconds(dino: Dino, job: WorkJob): number {
  return job.seconds / workSpeed(dino, job);
}

/** Câte bucăți a adus deja muncitorul și așteaptă să fie strânse. */
export function workReady(state: GameState, worker: Worker, now: number): number {
  const dino = findDino(state, worker.dinoId);
  const elapsed = Math.min(Math.max(0, now - worker.startedAt), WORK_CAP_SECONDS * 1000);
  return Math.floor(elapsed / (workSeconds(dino, findJob(worker.jobId)) * 1000));
}

function collectOne(state: GameState, worker: Worker, now: number, events: GameEvent[], got: Partial<Record<ItemId, number>>) {
  const dino = findDino(state, worker.dinoId);
  const job = findJob(worker.jobId);
  const durMs = workSeconds(dino, job) * 1000;
  const n = workReady(state, worker, now);
  for (let i = 0; i < n; i++) {
    const item = weighted(createRng(mixSeed(worker.seed, worker.index + i)), job.drops);
    addItem(state, item, 1);
    got[item] = (got[item] ?? 0) + 1;
  }
  if (n > 0) {
    addDinoXp(dino, job.dinoXp * n, events);
    addSkillXp(state, job.skill, job.xp * n, events);
  }
  worker.index += n;
  state.stats.work += n;
  // Peste plafon, restul timpului se pierde (ca la activități).
  if (now - worker.startedAt > WORK_CAP_SECONDS * 1000) worker.startedAt = now;
  else worker.startedAt += n * durMs;
}

function summary(got: Partial<Record<ItemId, number>>): string {
  return Object.entries(got)
    .map(([item, qty]) => `${qty} ${ITEMS[item as ItemId].icon}`)
    .join(', ');
}

export function collectWork(state: GameState, now: number, events: GameEvent[]) {
  const got: Partial<Record<ItemId, number>> = {};
  for (const worker of state.workers) collectOne(state, worker, now, events, got);
  if (Object.keys(got).length === 0) throw new GameError('NOT_READY', 'Haita n-a adus nimic încă.');
  events.push({ kind: 'reward', text: `Haita a adus din muncă: ${summary(got)}.` });
}

export function assignWork(state: GameState, dinoId: string, jobId: string, now: number, events: GameEvent[]) {
  const dino = findDino(state, dinoId);
  const job = findJob(jobId);
  if (dino.molt) throw new GameError('BUSY', `${dino.nickname} năpârlește.`);
  if (isBreeding(state, dinoId)) throw new GameError('BUSY', `${dino.nickname} e în Bârlog.`);
  const current = workerOf(state, dinoId);
  if (current?.jobId === jobId) return;
  if (current) unassignWork(state, dinoId, now, events);
  else if (state.workers.length >= workSlots(state)) {
    throw new GameError('FULL', `Ai doar ${workSlots(state)} ${workSlots(state) === 1 ? 'post' : 'posturi'} de muncă. Construiește mai departe în Tabără.`);
  }
  if (state.party.includes(dinoId)) {
    if (state.activity?.kind === 'expedition') throw new GameError('BUSY', `${dino.nickname} e în expediție. Oprește-o mai întâi.`);
    state.party = state.party.filter((id) => id !== dinoId);
  }
  state.workers.push({ dinoId, jobId, startedAt: now, seed: mixSeed(state.rngSeed, state.nextId++), index: 0 });
  events.push({ kind: 'info', text: `${dino.nickname} a plecat la muncă: ${job.name} ${job.icon}`, dinoId });
}

export function unassignWork(state: GameState, dinoId: string, now: number, events: GameEvent[]) {
  const worker = workerOf(state, dinoId);
  if (!worker) throw new GameError('NOT_FOUND', 'Dinozaurul nu lucrează.');
  const got: Partial<Record<ItemId, number>> = {};
  collectOne(state, worker, now, events, got);
  if (Object.keys(got).length) events.push({ kind: 'reward', text: `${findDino(state, dinoId).nickname} a adus: ${summary(got)}.` });
  state.workers = state.workers.filter((w) => w !== worker);
}
