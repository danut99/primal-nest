import type { EvolutionStage, GameState } from './types';

export const EVOLUTION_STAGES: { id: EvolutionStage; name: string; minLevel: number; maxLevel: number }[] = [
  { id: 'pui', name: 'Pui', minLevel: 1, maxLevel: 3 },
  { id: 'juvenil', name: 'Juvenil', minLevel: 4, maxLevel: 6 },
  { id: 'adult', name: 'Adult', minLevel: 7, maxLevel: 10 },
];
export const stageForLevel = (level: number): EvolutionStage => (level >= 7 ? 'adult' : level >= 4 ? 'juvenil' : 'pui');
export function highestDiscoveredLevel(s: GameState, species: string): number {
  return Math.max(
    s.evolutionProgress?.[species] ?? (s.discovered.includes(species) ? 1 : 0),
    ...s.dinos.filter((d) => d.species === species).map((d) => d.level),
  );
}
export function recordEvolution(s: GameState, species: string, level: number) {
  s.evolutionProgress ??= {};
  s.evolutionProgress[species] = Math.max(highestDiscoveredLevel(s, species), level);
}
