// Misiunile zilnice (cu serie de zile) și realizările. Ambele se sprijină pe contoarele din state.stats.

import { ACHIEVEMENTS, DAILY_QUESTS, MAX_RELIC_LEVEL, QUESTS_PER_DAY, SPECIES, type Achievement, type DailyQuest } from './catalog';
import { generation } from './breeding';
import { GameError } from './errors';
import { geneStars } from './nest';
import { createRng, mixSeed } from './rng';
import type { GameEvent, GameState, LifetimeStats } from './types';

const DAY = 24 * 3600 * 1000;

export const dayIndex = (now: number) => Math.floor(now / DAY);

export function emptyStats(): LifetimeStats {
  return { feeds: 0, wins: 0, hatches: 0, gathers: 0, cooks: 0, work: 0, breeds: 0, releases: 0 };
}

/** La prima comandă dintr-o zi nouă se aleg 3 misiuni noi. Alegerea e deterministă după zi. */
export function ensureDaily(state: GameState, now: number) {
  const day = dayIndex(now);
  if (state.daily?.day === day) return;
  const pool = DAILY_QUESTS.filter((q) => !q.requires || q.requires(state));
  const rng = createRng(mixSeed(state.rngSeed, day));
  const picked: string[] = [];
  while (picked.length < Math.min(QUESTS_PER_DAY, pool.length)) {
    const q = pool[Math.floor(rng() * pool.length)];
    if (!picked.includes(q.id)) picked.push(q.id);
  }
  state.daily = { day, base: { ...state.stats }, quests: picked, claimed: [], bonusClaimed: false };
}

export function findQuest(id: string): DailyQuest {
  const q = DAILY_QUESTS.find((x) => x.id === id);
  if (!q) throw new GameError('NOT_FOUND', 'Misiune necunoscută.');
  return q;
}

export function questProgress(state: GameState, id: string): number {
  const q = findQuest(id);
  return Math.min(q.goal, state.stats[q.stat] - (state.daily?.base[q.stat] ?? 0));
}

export function claimQuest(state: GameState, id: string, events: GameEvent[]) {
  const daily = state.daily;
  if (!daily?.quests.includes(id)) throw new GameError('NOT_FOUND', 'Misiunea nu e azi.');
  if (daily.claimed.includes(id)) throw new GameError('VALIDATION', 'Ai luat deja răsplata.');
  const q = findQuest(id);
  if (questProgress(state, id) < q.goal) throw new GameError('NOT_READY', 'Misiunea nu e gata.');
  daily.claimed.push(id);
  state.sparks += q.sparks;
  state.diamonds += q.diamonds;
  events.push({ kind: 'reward', text: `Misiune îndeplinită: ${q.title}! +${q.sparks} ✨ · +${q.diamonds} 💎` });
}

/** Bonusul zilei crește cu fiecare zi la rând (până la 7). */
export function streakBonus(streak: number): number {
  return 2 + Math.min(streak, 7);
}

export function claimDailyBonus(state: GameState, events: GameEvent[]) {
  const daily = state.daily;
  if (!daily) throw new GameError('NOT_READY', 'Nu ai misiuni azi.');
  if (daily.bonusClaimed) throw new GameError('VALIDATION', 'Ai luat deja cufărul zilei.');
  if (daily.claimed.length < daily.quests.length) throw new GameError('NOT_READY', 'Termină toate misiunile zilei.');
  const streak = state.streak.lastDay === daily.day - 1 ? state.streak.count + 1 : 1;
  state.streak = { count: streak, lastDay: daily.day };
  daily.bonusClaimed = true;
  const gems = streakBonus(streak);
  state.diamonds += gems;
  events.push({ kind: 'reward', text: `Cufărul zilei: +${gems} 💎 · serie de ${streak} ${streak === 1 ? 'zi' : 'zile'}! 🔥` });
}

// ---------- Realizări ----------

export function findAchievement(id: string): Achievement {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new GameError('NOT_FOUND', 'Realizare necunoscută.');
  return a;
}

/** Valoarea curentă pentru o realizare (ca să arătăm progresul). */
export function achievementValue(state: GameState, a: Achievement): number {
  const all = [...state.dinos, ...state.wild.map((w) => w.dino)];
  switch (a.measure) {
    case 'species':
      return Object.values(state.atlas).filter((e) => e.owned).length;
    case 'albino':
      return Object.values(state.atlas).some((e) => e.albino) ? 1 : 0;
    case 'generation':
      return Math.max(1, ...all.map(generation));
    case 'alphas':
      return state.alphas.length;
    case 'adult':
      return all.some((d) => SPECIES[d.speciesId].stage === 'adult') ? 1 : 0;
    case 'relicMax':
      return Object.values(state.relicLevels).some((l) => l >= MAX_RELIC_LEVEL) ? 1 : 0;
    case 'threeStars':
      return all.some((d) => geneStars(d.genes) >= 3) ? 1 : 0;
    default:
      return state.stats[a.measure];
  }
}

export function achievementDone(state: GameState, a: Achievement): boolean {
  return achievementValue(state, a) >= a.goal;
}

export function claimAchievement(state: GameState, id: string, events: GameEvent[]) {
  const a = findAchievement(id);
  if (state.achievements.includes(id)) throw new GameError('VALIDATION', 'Ai luat deja răsplata.');
  if (!achievementDone(state, a)) throw new GameError('NOT_READY', 'Încă nu ai reușit asta.');
  state.achievements.push(id);
  state.diamonds += a.diamonds;
  events.push({ kind: 'reward', text: `Realizare: ${a.icon} ${a.title}! +${a.diamonds} 💎` });
}
