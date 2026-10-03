// Imaginile 360° ale dinozaurilor (generate din art/turntables cu scripts/build-turntables.py).
// Fiecare linie folosește un corp; stadiul alege vârsta. Liniile fără imagini rămân pe desenele vechi.

import { SPECIES, type Stage } from '@shared/game';

const files = import.meta.glob('../assets/turntables/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) URLS[path.split('/').pop()!.replace(/\.webp$/, '')] = url;

/** Ce corp din art/turntables are fiecare linie. */
const BODY_OF_LINE: Record<string, string> = {
  sauropod: 'sauropod',
  raptor: 'theropod',
  ankylo: 'ankylosaur',
  ptero: 'pterosaur',
};

/** Câte cadre are banda 360° (la 45°, începând din față). */
export const TURNTABLE_FRAMES = 8;
/** Cadrul din banda 360° care corespunde pozei statice (3/4, spre dreapta). */
export const STILL_FRAME = 1;

export interface Turntable {
  still: string;
  strip: string;
  stage: Stage;
}

/** Imaginile pentru o specie, sau undefined dacă linia ei nu are încă imagini 360°. */
export function turntableFor(speciesId: string): Turntable | undefined {
  const s = SPECIES[speciesId];
  const body = s && BODY_OF_LINE[s.line];
  if (!body) return undefined;
  const still = URLS[`${body}-${s.stage}`];
  const strip = URLS[`${body}-${s.stage}-360`];
  return still && strip ? { still, strip, stage: s.stage } : undefined;
}
