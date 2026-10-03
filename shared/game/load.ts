// Validarea salvării locale. O salvare stricată nu trebuie să blocheze jocul.

import { SPECIES, START_DIAMONDS } from './catalog';
import { emptyStats } from './daily';
import type { GameState } from './types';

export function loadState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (s.version !== 1 || typeof s.playerName !== 'string' || !Array.isArray(s.dinos) || !Array.isArray(s.eggs)) return null;
  migrateRemovedSpecies(s as GameState);
  migrateZones(s as GameState);
  if (s.dinos.some((d) => !SPECIES[d.speciesId]) || s.eggs.some((e) => !SPECIES[e.speciesId])) return null;
  const state = s as GameState;
  state.party = (state.party ?? []).filter((id) => state.dinos.some((d) => d.id === id));
  state.tutorialDone ??= [];
  state.alphas ??= [];
  state.relics ??= [];
  state.relicLevels ??= {};
  state.queue ??= [];
  state.breeding ??= null;
  state.diamonds ??= START_DIAMONDS;
  state.wild ??= [];
  state.trough ??= {};
  state.stats = { ...emptyStats(), ...state.stats };
  state.daily ??= null;
  state.streak ??= { count: 0, lastDay: -1 };
  state.achievements ??= [];
  state.backRow ??= [];
  state.workers = (state.workers ?? []).filter((w) => state.dinos.some((d) => d.id === w.dinoId));
  state.atlas ??= {};
  state.inventory ??= {};
  return state;
}

/** Speciile scoase din joc și cu ce le înlocuim (același stadiu, linia de Junglă). */
const REMOVED_SPECIES: Record<string, string> = {
  stropel: 'mugurel',
  valusaur: 'ferigosaur',
  abisaurus: 'codrodon',
  fulgerin: 'spinodon',
};

function migrateRemovedSpecies(s: GameState) {
  const swap = (id: string) => REMOVED_SPECIES[id] ?? id;
  for (const d of s.dinos) {
    d.speciesId = swap(d.speciesId);
    if (d.molt) d.molt.targetSpeciesId = swap(d.molt.targetSpeciesId);
  }
  for (const e of s.eggs) e.speciesId = swap(e.speciesId);
  for (const w of s.wild ?? []) w.dino.speciesId = swap(w.dino.speciesId);
  for (const id of Object.keys(REMOVED_SPECIES)) {
    const old = s.atlas?.[id];
    if (!old) continue;
    const to = REMOVED_SPECIES[id];
    s.atlas[to] = { seen: old.seen || !!s.atlas[to]?.seen, owned: old.owned || !!s.atlas[to]?.owned, albino: old.albino || s.atlas[to]?.albino };
    delete s.atlas[id];
  }
}

/** Harta veche avea 3 regiuni (mlaștină, junglă, vulcan); acum sunt 4 (junglă, canion, piscuri, vulcan). */
function migrateZones(s: GameState) {
  if ((s.zonesVersion ?? 1) >= 2) return;
  const OLD: Record<string, string> = { mlastina: 'jungla', jungla: 'canion' };
  const swap = (id: string) => OLD[id] ?? id;
  const alphas = (s.alphas ?? []).map(swap);
  // Cine învinsese deja Alfa Umbrei are drumul deschis peste tot.
  if (alphas.includes('vulcan') && !alphas.includes('piscuri')) alphas.push('piscuri');
  s.alphas = alphas;
  if (s.activity?.kind === 'expedition') s.activity.zoneId = swap(s.activity.zoneId);
  for (const q of s.queue ?? []) if (q.kind === 'expedition') q.zoneId = swap(q.zoneId);
  s.zonesVersion = 2;
}
