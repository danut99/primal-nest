// Validarea salvării locale. O salvare stricată nu trebuie să blocheze jocul.

import { SPECIES } from './catalog';
import type { GameState } from './types';

export function loadState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (s.version !== 1 || typeof s.playerName !== 'string' || !Array.isArray(s.dinos) || !Array.isArray(s.eggs)) return null;
  if (s.dinos.some((d) => !SPECIES[d.speciesId]) || s.eggs.some((e) => !SPECIES[e.speciesId])) return null;
  const state = s as GameState;
  state.party = (state.party ?? []).filter((id) => state.dinos.some((d) => d.id === id));
  state.tutorialDone ??= [];
  state.alphas ??= [];
  state.relics ??= [];
  state.atlas ??= {};
  state.inventory ??= {};
  return state;
}
