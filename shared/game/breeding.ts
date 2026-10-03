// Împerecherea: doi dinozauri din aceeași linie lasă un ou cu genele lor. Așa se nasc liniile de sânge.

import { ALBINO_CHANCE, BREED_MAX, BREED_RARITIES, BREED_SECONDS, BREED_SKILL_LEVEL, MUTATION_CHANCE, MUTATION_RANGE, SPECIES } from './catalog';
import { findDino } from './creatures';
import { GameError } from './errors';
import { createRng, mixSeed, randInt, weighted } from './rng';
import { addSkillXp, makeId, skillLevel } from './state';
import { geneStars } from './nest';
import type { Dino, Egg, GameEvent, GameState, Rarity, StatKey, Stats } from './types';

export function generation(dino: Pick<Dino, 'lineage'>): number {
  return dino.lineage?.generation ?? 1;
}

const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd'];
const clampGene = (g: number) => Math.max(0, Math.min(15, g));

/** Stelele „perechii”: ale genelor medii ale celor doi părinți. Decid raritatea oului. */
export function pairStars(a: Pick<Dino, 'genes'>, b: Pick<Dino, 'genes'>): number {
  const avg = { hp: 0, atk: 0, def: 0, spd: 0 } as Stats;
  for (const k of STAT_KEYS) avg[k] = (a.genes[k] + b.genes[k]) / 2;
  return geneStars(avg);
}

export function breedRarities(a: Pick<Dino, 'genes'>, b: Pick<Dino, 'genes'>) {
  return BREED_RARITIES[pairStars(a, b)];
}

export interface BreedForecast {
  /** Intervalul posibil pentru fiecare genă, cu tot cu mutații. */
  genes: Record<StatKey, [number, number]>;
  /** Stelele puiului: cel mai rău și cel mai bun caz. */
  stars: [number, number];
  /** Șansele de raritate ale oului, în procente. */
  rarities: { rarity: Rarity; pct: number }[];
}

/** Ce poate ieși dintr-o pereche, arătat înainte s-o trimiți în Bârlog. */
export function breedForecast(a: Pick<Dino, 'genes'>, b: Pick<Dino, 'genes'>): BreedForecast {
  const genes = {} as Record<StatKey, [number, number]>;
  const low = {} as Stats;
  const high = {} as Stats;
  for (const k of STAT_KEYS) {
    low[k] = clampGene(Math.min(a.genes[k], b.genes[k]) - MUTATION_RANGE);
    high[k] = clampGene(Math.max(a.genes[k], b.genes[k]) + MUTATION_RANGE);
    genes[k] = [low[k], high[k]];
  }
  const weights = breedRarities(a, b);
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  return {
    genes,
    stars: [geneStars(low), geneStars(high)],
    rarities: weights.map((w) => ({ rarity: w.value, pct: Math.round((w.weight / total) * 100) })),
  };
}

/** De ce nu se pot împerechea cei doi (listă goală = se pot). */
export function breedProblems(state: GameState, a: Dino, b: Dino): string[] {
  const problems: string[] = [];
  if (skillLevel(state, 'imblanzire') < BREED_SKILL_LEVEL) problems.push(`Îmblânzire nivel ${BREED_SKILL_LEVEL}`);
  if (a.id === b.id) problems.push('doi dinozauri diferiți');
  if (SPECIES[a.speciesId].line !== SPECIES[b.speciesId].line) problems.push('aceeași linie');
  for (const d of [a, b]) {
    if (SPECIES[d.speciesId].stage === 'pui') problems.push(`${d.nickname} e încă pui`);
    if ((d.breeds ?? 0) >= BREED_MAX) problems.push(`${d.nickname} s-a împerecheat deja de ${BREED_MAX} ori`);
    if (d.molt) problems.push(`${d.nickname} năpârlește`);
    if (state.workers.some((w) => w.dinoId === d.id)) problems.push(`${d.nickname} e la muncă`);
  }
  if (state.breeding) problems.push('Bârlogul e deja ocupat');
  return problems;
}

export function startBreeding(state: GameState, aId: string, bId: string, now: number, events: GameEvent[]) {
  const a = findDino(state, aId);
  const b = findDino(state, bId);
  const problems = breedProblems(state, a, b);
  if (problems.length) throw new GameError('LOCKED', `Nu se pot împerechea: ${problems.join(', ')}.`);
  if (state.activity?.kind === 'expedition' && (state.party.includes(aId) || state.party.includes(bId))) {
    throw new GameError('BUSY', 'Unul dintre ei e în expediție. Oprește-o mai întâi.');
  }
  state.party = state.party.filter((id) => id !== aId && id !== bId);
  state.breeding = { a: aId, b: bId, startedAt: now, endsAt: now + BREED_SECONDS * 1000, seed: mixSeed(state.rngSeed, state.nextId++) };
  events.push({ kind: 'info', text: `${a.nickname} și ${b.nickname} s-au retras în Bârlog… 💞` });
}

export function cancelBreeding(state: GameState) {
  if (!state.breeding) throw new GameError('NOT_FOUND', 'Bârlogul e gol.');
  state.breeding = null;
}

export function finishBreeding(state: GameState, now: number, events: GameEvent[]): Egg {
  const br = state.breeding;
  if (!br) throw new GameError('NOT_FOUND', 'Bârlogul e gol.');
  if (now < br.endsAt) throw new GameError('NOT_READY', 'Oul nu e gata încă.');
  const a = findDino(state, br.a);
  const b = findDino(state, br.b);
  const rng = createRng(br.seed);
  const line = SPECIES[a.speciesId].line;
  const baby = Object.values(SPECIES).find((s) => s.line === line && s.stage === 'pui')!;
  // Fiecare genă vine de la un părinte; uneori apare o mutație de ±2.
  const genes = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const k of STAT_KEYS) {
    const g = (rng() < 0.5 ? a : b).genes[k] + (rng() < MUTATION_CHANCE ? randInt(rng, -MUTATION_RANGE, MUTATION_RANGE) : 0);
    genes[k] = clampGene(g);
  }
  const albinoChance = a.variant === 'albino' || b.variant === 'albino' ? 1 / 32 : ALBINO_CHANCE;
  const egg: Egg = {
    id: makeId(state, 'egg'),
    speciesId: baby.id,
    rarity: weighted(rng, breedRarities(a, b)),
    genes,
    variant: rng() < albinoChance ? 'albino' : 'normal',
    lineage: { parents: [a.nickname, b.nickname], generation: Math.max(generation(a), generation(b)) + 1 },
  };
  state.eggs.push(egg);
  a.breeds = (a.breeds ?? 0) + 1;
  b.breeds = (b.breeds ?? 0) + 1;
  state.breeding = null;
  state.stats.breeds++;
  events.push({ kind: 'egg', text: `${a.nickname} și ${b.nickname} au lăsat un ou! Generația ${egg.lineage!.generation}. 🥚`, eggId: egg.id });
  addSkillXp(state, 'imblanzire', 40, events);
  return egg;
}
