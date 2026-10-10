// Aspectul fiecărei specii: scheletul animat din studio (rig-lab/tempest-studio, adus cu scripts/import-studio.py),
// rețeta salvată (recipes.json) sau, dacă nu există niciuna, cea generată pe scheletul de T-Rex.

import { HABITAT_SPECIES, SPECIES_BY_ID, type EvolutionStage, type Species } from '@shared/game';
import type { DinoRecipe } from './engine';
import { generateDino } from './generator';
import saved from './recipes.json';

export const SAVED_RECIPES = saved as unknown as Record<string, DinoRecipe>;

export function generatedRecipe(species: Species, seed?: number): DinoRecipe {
  return generateDino({ ...species, seed });
}

/** Speciile cu schelet propriu, pictat și animat în studio: câte unul pe vârstă (`<specie>-<vârstă>`). */
const STUDIO_SPECIES = new Set(HABITAT_SPECIES.map((s) => s.id));
/** Arta fiecărei vârste umple tot cadrul; puiul și juvenilul se micșorează aici. */
const STUDIO_ZOOM: Record<EvolutionStage, number> = { pui: 0.62, juvenil: 0.8, adult: 1 };

export function recipeFor(speciesId: string, stage: EvolutionStage = 'adult'): DinoRecipe {
  const species = SPECIES_BY_ID.get(speciesId);
  if (!species) throw new Error(`Specie necunoscută: ${speciesId}`);
  if (STUDIO_SPECIES.has(speciesId))
    return {
      id: `${speciesId}-${stage}`,
      name: species.name,
      base: { rig: `${speciesId}-${stage}` },
      motion: { zoom: STUDIO_ZOOM[stage] },
    };
  // Painted stages have their own anatomy and skeleton, rather than scaled adult parts.
  const stageRecipe = SAVED_RECIPES[`${speciesId}-${stage}`];
  if (stageRecipe) return stageRecipe;
  const recipe = SAVED_RECIPES[speciesId] ?? generatedRecipe(species);
  if (stage === 'adult') return recipe;
  const young = structuredClone(recipe);
  young.id = `${speciesId}-${stage}`;
  young.parts ??= {};
  young.parts.cap = { ...young.parts.cap, scale: (young.parts.cap?.scale ?? 1) * (stage === 'pui' ? 1.3 : 1.12) };
  young.parts.coada = {
    ...young.parts.coada,
    length: (young.parts.coada?.length ?? 1) * (stage === 'pui' ? 0.75 : 0.9),
  };
  young.motion = { ...young.motion, zoom: (young.motion?.zoom ?? 1) * (stage === 'pui' ? 0.78 : 0.9) };
  return young;
}
