// Cum arată fiecare creatură: dragonii animați din public/dragons (Spine), descriși ca rețete din laborator.
// Cele 4 linii de specii folosesc cei 4 dragoni principali; Alfa fiecărei regiuni e unul dintre cei 4 boși.
// Imaginile statice (liste, cartonașe) sunt în public/dragons/stills, generate cu `npm run stills`.

import { SPECIES } from '@shared/game';
import type { DragonRecipe } from '../dragon-lab/engine';
import { DRAGON_BASE } from '../dragons/runtime';

/** Linia de specii → dragonul principal. */
export const LINE_DRAGON: Record<string, string> = {
  sauropod: 'nerion',
  raptor: 'pyron',
  ankylo: 'crystalis',
  ptero: 'solarys',
};

/** Regiunea → bossul ei (Alfa). */
export const ZONE_BOSS: Record<string, { model: string; stage: string; name: string }> = {
  jungla: { model: 'umbraxis', stage: 'adult', name: 'Umbraxis' },
  canion: { model: 'auralis', stage: 'adult', name: 'Auralis' },
  piscuri: { model: 'vortexion', stage: 'adult', name: 'Vortexion' },
  vulcan: { model: 'kronazar', stage: 'adult', name: 'Kronazar' },
};

/** Albino: culori stinse, aproape albe. */
const ALBINO = { saturation: 0.15, lightness: 0.35 };

/** Ce evoluție a dragonului corespunde speciei: pui, juvenil, iar cele două ramuri de adult → adult și subadult. */
export function dragonStage(speciesId: string): string {
  const s = SPECIES[speciesId];
  if (s.stage !== 'adult') return s.stage;
  const juvenil = Object.values(SPECIES).find((j) => j.line === s.line && j.stage === 'juvenil');
  return juvenil?.defaultBranch === s.branch ? 'adult' : 'subadult';
}

export function speciesRecipe(speciesId: string, albino = false): DragonRecipe {
  const s = SPECIES[speciesId];
  const model = LINE_DRAGON[s.line];
  const stage = dragonStage(speciesId);
  const recipe: DragonRecipe = { id: speciesId, name: s.name, base: { model, stage } };
  // Juvenilul lui Solarys folosește scheletul puiului, care n-are atac: îl împrumută de la adult.
  if (stage === 'juvenil' && model === 'solarys')
    recipe.borrow = { from: { model, stage: 'adult' }, animations: ['attack'] };
  if (albino) recipe.color = ALBINO;
  return recipe;
}

export function bossRecipe(zoneId: string): DragonRecipe {
  const boss = ZONE_BOSS[zoneId] ?? ZONE_BOSS.jungla;
  return { id: `boss-${zoneId}`, name: boss.name, base: { model: boss.model, stage: boss.stage } };
}

/** Imaginea statică (decupată, fundal transparent). */
export const speciesStill = (speciesId: string) => `${DRAGON_BASE}/stills/${speciesId}.webp`;
export const bossStill = (zoneId: string) => `${DRAGON_BASE}/stills/boss-${zoneId}.webp`;
