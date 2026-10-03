// Artă locală opțională din src/local-art/ (exclus din git). Fișierele sunt găsite după nume;
// dacă lipsesc, jocul folosește desenele din cod. Vezi src/local-art/CITESTE.md.

import type { CSSProperties } from 'react';

const scenes = import.meta.glob('../local-art/scenes/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const dinos = import.meta.glob('../local-art/dinos/*.{png,webp,jpg}', {
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

const SCENES = byName(scenes);
const DINOS = byName(dinos);

/** URL-ul unei scene (ex. 'mlastina', 'poveste-1', 'fundal') sau undefined. */
export const sceneArt = (name: string): string | undefined => SCENES[name];

/** URL-ul imaginii unei specii sau undefined (atunci se folosește desenul SVG). */
export const dinoArt = (speciesId: string): string | undefined => DINOS[speciesId];

/** Încadrare pe scenă: capturile de test au personajul jocului în prim-plan, așa că mărim spre peisaj. */
const FOCUS: Record<string, { size: string; pos: string }> = {
  mlastina: { size: '175%', pos: '92% 42%' },
  jungla: { size: '190%', pos: '92% 38%' },
  vulcan: { size: '160%', pos: '30% 18%' },
};

/** Stil de fundal: imaginea sub un voal întunecat, ca textul să rămână lizibil. */
export function sceneBackground(name: string, veil = 0.55): CSSProperties | undefined {
  const url = SCENES[name];
  if (!url) return undefined;
  return {
    backgroundImage: `linear-gradient(rgba(5, 5, 10, ${veil}), rgba(5, 5, 10, ${Math.min(0.95, veil + 0.25)})), url(${url})`,
    // Cadrele late taie sus și jos, unde capturile de test au interfața jocului.
    backgroundSize: FOCUS[name]?.size ?? 'cover',
    backgroundPosition: FOCUS[name]?.pos ?? 'center 40%',
  };
}
