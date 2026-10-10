import { expect, it } from 'vitest';
import { SPECIES, EVOLUTION_STAGES } from '@shared/game';
import { recipeFor } from './recipes';
import { readyThumbnail } from './thumbnails';

it('provides distinct saved artwork for every species and evolution stage', () => {
  const paths = SPECIES.flatMap((species) =>
    EVOLUTION_STAGES.map((stage) => readyThumbnail(recipeFor(species.id, stage.id), 512)),
  );
  expect(paths.every((path) => path?.includes('dinosaurs/previews/'))).toBe(true);
  expect(new Set(paths).size).toBe(SPECIES.length * EVOLUTION_STAGES.length);
});

it('renders edited recipes instead of reusing stale species artwork', () => {
  const recipe = structuredClone(recipeFor(SPECIES[0].id));
  recipe.color = { ...recipe.color, hue: (recipe.color?.hue ?? 0) + 10 };
  expect(readyThumbnail(recipe)).toBeUndefined();
});

it('uses saved artwork for small previews and preserves higher-resolution rendering', () => {
  const recipe = recipeFor(SPECIES[0].id);
  expect(readyThumbnail(recipe, 256)).toBe(readyThumbnail(recipe, 512));
  expect(readyThumbnail(recipe, 1024)).toBeUndefined();
});
