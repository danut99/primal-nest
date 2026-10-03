// „Ce fac acum?” — obiectivele lui Saurok, deduse din starea salvată.

import { PROPERTY_LEVELS, SPECIES } from './catalog';
import type { GameState } from './types';

export interface Objective {
  id: string;
  title: string;
  hint: string;
  screen: 'cuib' | 'haita' | 'activitati' | 'expeditii' | 'tabara' | 'atlas';
  done: (s: GameState) => boolean;
}

const stageOf = (s: GameState, stage: string) => s.dinos.some((d) => SPECIES[d.speciesId].stage === stage);

export const OBJECTIVES: Objective[] = [
  { id: 'hatch', title: 'Eclozează primul ou', hint: 'Când oul strălucește, atinge-l!', screen: 'cuib', done: (s) => s.dinos.length > 0 },
  { id: 'feed', title: 'Hrănește-ți puiul', hint: 'Deschide Haita și dă-i o ferigă. Dieta preferată dă dublu atașament.', screen: 'haita', done: (s) => s.dinos.some((d) => d.diets.length > 0) },
  { id: 'dig', title: 'Sapă în stratul de nisip', hint: 'Activități → Săpături. Sub nisip e un ou prins în chihlimbar.', screen: 'activitati', done: (s) => s.tutorialDone.includes('first-dig-egg') },
  { id: 'nest2', title: 'Pune oul găsit în cuib', hint: 'Alege lumina sub care crește: ea îi dă temperamentul.', screen: 'cuib', done: (s) => s.dinos.length >= 2 || s.eggs.some((e) => e.incubation && !e.tutorial) },
  { id: 'win', title: 'Câștigă prima luptă', hint: 'Expediții → Jungla Cețurilor → Luptă!', screen: 'expeditii', done: (s) => s.tutorialDone.includes('first-win') },
  { id: 'lut', title: `Construiește ${PROPERTY_LEVELS[1].name}`, hint: 'Ai nevoie de 15 lut și 100 scântei. Du oase la forja lui Saurok, în Tabără.', screen: 'tabara', done: (s) => s.property >= 1 },
  { id: 'cook', title: 'Gătește o Salată de ferigi', hint: 'Mâncarea gătită dă mult mai mult XP și atașament.', screen: 'activitati', done: (s) => s.tutorialDone.includes('first-cook') },
  { id: 'juvenil', title: 'Prima evoluție: Juvenil', hint: 'Nivel 10 și atașament 50, apoi Năpârlire (2 ore).', screen: 'haita', done: (s) => stageOf(s, 'juvenil') || stageOf(s, 'adult') },
  { id: 'adult', title: 'Crește un Adult', hint: 'Nivel 25, atașament 80 și un Cristal Stelar. Dieta decide ramura!', screen: 'haita', done: (s) => stageOf(s, 'adult') },
  { id: 'alfa', title: 'Învinge-l pe Alfa Umbrei', hint: 'Adu un Os de Alfa din Canion sau de pe Piscuri și urcă în crater.', screen: 'expeditii', done: (s) => s.atlas.vulcanraptor?.owned === true || s.tutorialDone.includes('alfa') },
];

export function currentObjective(state: GameState): Objective | null {
  return OBJECTIVES.find((o) => !o.done(state)) ?? null;
}
