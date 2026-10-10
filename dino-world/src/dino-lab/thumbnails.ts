// Miniaturi statice (PNG) pentru liste și hartă: un singur player WebGL, pe rând, cu rezultatul ținut în memorie.
// Pe ecran pot fi zeci de dinozauri, dar browserul permite doar ~16 contexte WebGL deodată.

import { createDino, type DinoRecipe } from './engine';
import previews from './previews.json';
import previewBounds from './preview-bounds.json';
import { thumbnailRecipeKey } from './thumbnail-key';

/** Standard species artwork is baked at 512px, so the world never needs WebGL for it. */
export function readyThumbnail(recipe: DinoRecipe, size = 256): string | undefined {
  if (size > 512) return;
  const path = (previews as Record<string, string>)[thumbnailRecipeKey(recipe)];
  return path ? import.meta.env.BASE_URL + path : undefined;
}

export function thumbnailBounds(recipe: DinoRecipe) {
  const path = (previews as Record<string, string>)[thumbnailRecipeKey(recipe)];
  return (
    previewBounds as Record<
      string,
      { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }
    >
  )[path];
}

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

export function thumbnail(recipe: DinoRecipe, size = 256): Promise<string> {
  const ready = readyThumbnail(recipe, size);
  if (ready) return Promise.resolve(ready);
  const key = JSON.stringify(recipe) + size;
  let url = cache.get(key);
  if (!url) {
    url = queue.then(() => render(recipe, size));
    queue = url.catch(() => undefined);
    cache.set(key, url);
    url.catch(() => cache.delete(key));
  }
  return url;
}

async function render(recipe: DinoRecipe, size: number): Promise<string> {
  const host = document.createElement('div');
  host.className = 'dino-view';
  host.style.cssText = `position:fixed;left:-${size * 2}px;top:0;width:${size}px;height:${size}px;pointer-events:none`;
  document.body.append(host);
  const abort = new AbortController();
  try {
    const dino = await createDino(host, recipe, { still: true, pad: 4 }, abort.signal);
    // Un cadru ca să se aplice recolorarea texturii și mărimea canvasului.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const blob = await dino.snapshot();
    dino.dispose();
    if (!blob) throw new Error('Miniatura nu s-a putut desena.');
    return URL.createObjectURL(blob);
  } finally {
    abort.abort();
    host.remove();
  }
}
