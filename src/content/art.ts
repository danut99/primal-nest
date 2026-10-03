// Fundalurile: regiunile de expediție vin din src/assets/scenes (generate din art/scenes cu
// `npm run scenes`); restul (ex. 'fundal', 'poveste-1') sunt scene locale opționale din
// src/local-art/scenes, exclus din git. Dacă lipsesc, ecranele rămân pe fundalul din cod.
// Dinozaurii sunt dragonii animați din public/dragons (vezi content/dragons.ts).

import type { CSSProperties } from 'react';

const game = import.meta.glob('../assets/scenes/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const local = import.meta.glob('../local-art/scenes/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function byName(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
    out[name] = url;
  }
  return out;
}

/** Imaginile jocului au întâietate față de cele locale de test. */
const SCENES = { ...byName(local), ...byName(game) };

/** URL-ul unei scene (ex. 'jungla', 'poveste-1', 'fundal') sau undefined. */
export const sceneArt = (name: string): string | undefined => SCENES[name];

/**
 * Stil de fundal: imaginea sub un voal întunecat, ca textul să rămână lizibil.
 * Regiunile au solul liber în treimea de jos, așa că încadrarea coboară puțin spre el.
 */
export function sceneBackground(name: string, veil = 0.55): CSSProperties | undefined {
  const url = SCENES[name];
  if (!url) return undefined;
  return {
    backgroundImage: `linear-gradient(rgba(5, 5, 10, ${veil}), rgba(5, 5, 10, ${Math.min(0.95, veil + 0.25)})), url(${url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 55%',
  };
}
