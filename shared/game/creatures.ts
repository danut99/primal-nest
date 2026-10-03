// Dinozauri: statistici, nivel, hrănire, atașament și evoluție (Năpârlire).

import {
  BRANCH_INFO,
  EVOLUTION,
  FULLNESS_DECAY_PER_MIN,
  ITEMS,
  MAX_LEVEL,
  RELICS,
  SPECIES,
  TEMPERAMENTS,
  levelXp,
} from './catalog';
import { GameError } from './errors';
import { itemCount, markOwned, removeItems, skillLevel } from './state';
import type { Branch, Diet, Dino, GameEvent, GameState, ItemId, Stats } from './types';

export function species(dino: Pick<Dino, 'speciesId'>) {
  const s = SPECIES[dino.speciesId];
  if (!s) throw new GameError('NOT_FOUND', 'Specie necunoscută.');
  return s;
}

/** Formula în stil Pokémon: bază, gene, nivel, plus temperamentul. */
export function computeStats(dino: Pick<Dino, 'speciesId' | 'level' | 'genes' | 'temperament'> & { relic?: string }): Stats {
  const s = species(dino);
  const t = TEMPERAMENTS[dino.temperament];
  const calc = (key: keyof Stats) => {
    const raw = ((s.base[key] * 2 + dino.genes[key]) * dino.level) / 50;
    let value = key === 'hp' ? Math.floor(raw) + dino.level + 10 : Math.floor(raw) + 5;
    if (t.up === key) value = Math.floor(value * 1.1);
    if (t.down === key) value = Math.floor(value * 0.95);
    const relic = dino.relic ? RELICS[dino.relic] : undefined;
    if (relic?.bonus[key]) value = Math.floor(value * (1 + relic.bonus[key]!));
    return value;
  };
  return { hp: calc('hp'), atk: calc('atk'), def: calc('def'), spd: calc('spd') };
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= levelXp(level + 1)) level++;
  return level;
}

export function addDinoXp(dino: Dino, xp: number, events: GameEvent[]) {
  if (dino.level >= MAX_LEVEL) return;
  dino.xp += xp;
  const level = levelFromXp(dino.xp);
  if (level > dino.level) {
    dino.level = level;
    events.push({ kind: 'levelup', text: `${dino.nickname} a crescut la nivelul ${level}!`, dinoId: dino.id });
  }
}

export function currentFullness(dino: Dino, now: number): number {
  const minutes = Math.max(0, now - dino.fullAt) / 60000;
  return Math.max(0, dino.fullness - minutes * FULLNESS_DECAY_PER_MIN);
}

export function findDino(state: GameState, id: string): Dino {
  const dino = state.dinos.find((d) => d.id === id);
  if (!dino) throw new GameError('NOT_FOUND', 'Dinozaurul nu există.');
  return dino;
}

export function feed(state: GameState, dinoId: string, itemId: ItemId, now: number, events: GameEvent[]) {
  const dino = findDino(state, dinoId);
  const food = ITEMS[itemId]?.food;
  if (!food) throw new GameError('VALIDATION', 'Asta nu se mănâncă.');
  if (itemCount(state, itemId) < 1) throw new GameError('INSUFFICIENT_ITEMS', `Nu mai ai ${ITEMS[itemId].name}.`);
  const fullness = currentFullness(dino, now);
  if (fullness >= 100) throw new GameError('FULL', `${dino.nickname} e sătul. Mai așteaptă puțin.`);

  removeItems(state, { [itemId]: 1 });
  const loves = species(dino).diet === food.diet;
  dino.fullness = Math.min(100, fullness + food.fill);
  dino.fullAt = now;
  dino.bond = Math.min(100, dino.bond + food.bond * (loves ? 2 : 1));
  dino.diets = [...dino.diets, food.diet].slice(-20);
  events.push({
    kind: 'info',
    text: loves ? `${dino.nickname} adoră ${ITEMS[itemId].name}! ❤️❤️` : `${dino.nickname} a mâncat ${ITEMS[itemId].name}. ❤️`,
    dinoId,
  });
  addDinoXp(dino, food.xp, events);
}

export function dominantDiet(dino: Dino): Diet | null {
  if (dino.diets.length === 0) return null;
  const counts: Record<Diet, number> = { plante: 0, carne: 0, insecte: 0 };
  for (const d of dino.diets) counts[d]++;
  const best = Math.max(...Object.values(counts));
  const winners = (Object.keys(counts) as Diet[]).filter((d) => counts[d] === best);
  return winners.length === 1 ? winners[0] : null;
}

/** Ramura de adult: dieta dominantă dacă specia o are, altfel ramura implicită. */
export function adultTarget(dino: Dino): { speciesId: string; branch: Branch; byDiet: boolean } | null {
  const s = species(dino);
  if (s.stage !== 'juvenil' || !s.branches) return null;
  const diet = dominantDiet(dino);
  const branch = (Object.keys(BRANCH_INFO) as Branch[]).find((b) => BRANCH_INFO[b].diet === diet);
  if (branch && s.branches[branch]) return { speciesId: s.branches[branch]!, branch, byDiet: true };
  const fallback = s.defaultBranch!;
  return { speciesId: s.branches[fallback]!, branch: fallback, byDiet: false };
}

export function evolutionTarget(dino: Dino): string | null {
  const s = species(dino);
  if (s.stage === 'pui') return s.evolvesTo ?? null;
  return adultTarget(dino)?.speciesId ?? null;
}

export function evolutionRequirement(dino: Dino) {
  const s = species(dino);
  if (s.stage === 'adult') return null;
  return s.stage === 'pui' ? EVOLUTION.juvenil : EVOLUTION.adult;
}

export function canEvolve(state: GameState, dino: Dino): { ok: boolean; reasons: string[] } {
  const req = evolutionRequirement(dino);
  if (!req) return { ok: false, reasons: ['Este deja adult.'] };
  const reasons: string[] = [];
  if (dino.molt) reasons.push('Năpârlește deja.');
  if (dino.level < req.level) reasons.push(`Nivel ${req.level} (acum ${dino.level})`);
  if (dino.bond < req.bond) reasons.push(`Atașament ${req.bond} (acum ${dino.bond})`);
  if (req.item && itemCount(state, req.item) < 1) reasons.push(`1 ${ITEMS[req.item].name}`);
  if (state.activity?.kind === 'expedition' && state.party.includes(dino.id)) reasons.push('E plecat în expediție.');
  return { ok: reasons.length === 0, reasons };
}

export function startEvolution(state: GameState, dinoId: string, now: number, events: GameEvent[]) {
  const dino = findDino(state, dinoId);
  const check = canEvolve(state, dino);
  if (!check.ok) throw new GameError('LOCKED', `Încă nu poate evolua: ${check.reasons.join(', ')}.`);
  const req = evolutionRequirement(dino)!;
  const target = evolutionTarget(dino)!;
  if (req.item) removeItems(state, { [req.item]: 1 });
  dino.molt = { targetSpeciesId: target, startedAt: now, endsAt: now + req.seconds * 1000 };
  state.party = state.party.filter((id) => id !== dinoId);
  events.push({ kind: 'info', text: `${dino.nickname} a început să năpârlească…`, dinoId });
}

export function finishEvolution(state: GameState, dinoId: string, now: number, events: GameEvent[]) {
  const dino = findDino(state, dinoId);
  if (!dino.molt) throw new GameError('NOT_READY', 'Nu năpârlește.');
  if (now < dino.molt.endsAt) throw new GameError('NOT_READY', 'Năpârlirea nu s-a terminat.');
  const from = species(dino).name;
  const keepNick = dino.nickname !== from;
  dino.speciesId = dino.molt.targetSpeciesId;
  dino.molt = undefined;
  const to = species(dino).name;
  if (!keepNick) dino.nickname = to;
  markOwned(state, dino.speciesId, dino.variant === 'albino');
  events.push({ kind: 'evolve', text: `${from} a evoluat în ${to}!`, dinoId });
}

export function partySize(state: GameState): number {
  return skillLevel(state, 'imblanzire') >= 5 ? 3 : 2;
}

export function setParty(state: GameState, ids: string[]) {
  if (state.activity?.kind === 'expedition') throw new GameError('BUSY', 'Haita e în expediție. Oprește-o mai întâi.');
  const unique = [...new Set(ids)];
  if (unique.length > partySize(state)) throw new GameError('FULL', `Haita are maximum ${partySize(state)} locuri.`);
  for (const id of unique) {
    const dino = findDino(state, id);
    if (dino.molt) throw new GameError('BUSY', `${dino.nickname} năpârlește.`);
  }
  state.party = unique;
}

export function renameDino(state: GameState, dinoId: string, nickname: string) {
  const name = nickname.trim();
  if (name.length < 1 || name.length > 14) throw new GameError('VALIDATION', 'Numele trebuie să aibă 1–14 caractere.');
  findDino(state, dinoId).nickname = name;
}

/** Pune (sau scoate, cu null) o relicvă. O relicvă poate fi purtată de un singur dinozaur. */
export function equipRelic(state: GameState, dinoId: string, relicId: string | null) {
  const dino = findDino(state, dinoId);
  if (relicId === null) {
    dino.relic = undefined;
    return;
  }
  if (!RELICS[relicId] || !state.relics.includes(relicId)) throw new GameError('NOT_FOUND', 'Nu ai această relicvă.');
  for (const d of state.dinos) if (d.relic === relicId) d.relic = undefined;
  dino.relic = relicId;
}
