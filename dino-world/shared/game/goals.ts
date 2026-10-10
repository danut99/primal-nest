// Obiectivele (pașii următori, unul câte unul, cu o recompensă mică) și recompensele din Atlas pentru liniile
// de evoluție complete. Starea ține doar ce s-a revendicat; „gata” se calculează din joc.

import { RARITIES, SPECIES, speciesOf } from './catalog';
import { EVOLUTION_STAGES, highestDiscoveredLevel } from './evolution';
import { addMaterials } from './items';
import { GameError } from './state';
import type { GameEvent, GameState, Rarity, Reward } from './types';

export function applyReward(s: GameState, r: Reward) {
  s.gold += r.gold ?? 0;
  s.food += r.food ?? 0;
  s.gems += r.gems ?? 0;
  s.fragments = (s.fragments ?? 0) + (r.fragments ?? 0);
  if (r.materials) addMaterials(s, r.materials);
}

const stat = (s: GameState, key: keyof NonNullable<GameState['stats']>) => s.stats?.[key] ?? 0;

export interface Goal {
  id: string;
  icon: string;
  title: string;
  /** Unde se face, în două-trei cuvinte. */
  hint: string;
  done: (s: GameState) => boolean;
  reward: Reward;
  /** Face parte din „Primii pași” (primele obiective, ghidate pe hartă). */
  intro?: boolean;
}

const habitats = (s: GameState) => s.buildings.filter((b) => b.kind === 'habitat');
const level = (s: GameState, kind: string) =>
  Math.max(0, ...s.buildings.filter((b) => b.kind === kind).map((b) => b.level));

export const GOALS: Goal[] = [
  {
    id: 'world',
    icon: '🏝️',
    title: 'Deblochează o lume',
    hint: 'Atinge Caldera de jar',
    done: (s) => habitats(s).length >= 1,
    reward: { gold: 150 },
    intro: true,
  },
  {
    id: 'feed1',
    icon: '🍖',
    title: 'Hrănește puiul',
    hint: 'Lumea de foc → Hrănește',
    done: (s) => s.dinos.some((d) => d.level >= 2),
    reward: { food: 40 },
    intro: true,
  },
  {
    id: 'harvest',
    icon: '🌿',
    title: 'Strânge prima recoltă',
    hint: 'Ferma → plantează Ferigi',
    // salvările de dinainte de contor: cine a trecut de avanpost a recoltat sigur
    done: (s) => stat(s, 'harvested') >= 1 || !!s.goalsClaimed?.includes('outpost'),
    reward: { gold: 100 },
    intro: true,
  },
  {
    id: 'egg',
    icon: '🥚',
    title: 'Eclozează un ou',
    hint: 'Extinde → Ouă, apoi Incubatorul',
    done: (s) => stat(s, 'hatched') >= 1,
    reward: { gold: 200 },
    intro: true,
  },
  {
    id: 'feed',
    icon: '🍖',
    title: 'Un dinozaur la nivelul 3',
    hint: 'Lume → Hrănește',
    done: (s) => s.dinos.some((d) => d.level >= 3),
    reward: { food: 80 },
  },
  {
    id: 'outpost',
    icon: '🏕️',
    title: 'Construiește avanpostul',
    hint: 'Extinde → Clădiri',
    done: (s) => level(s, 'outpost') >= 1,
    reward: { gold: 250 },
  },
  {
    id: 'expedition',
    icon: '🧭',
    title: 'Termină o expediție',
    hint: 'Avanpostul',
    done: (s) => stat(s, 'expeditions') >= 1,
    reward: { gems: 2 },
  },
  {
    id: 'forge',
    icon: '⚒️',
    title: 'Construiește forja',
    hint: 'Extinde → Clădiri',
    done: (s) => level(s, 'forge') >= 1,
    reward: { materials: { bone: 4 } },
  },
  {
    id: 'craft',
    icon: '🪵',
    title: 'Făurește un obiect',
    hint: 'Forja → Rețete',
    done: (s) => stat(s, 'crafted') >= 1,
    reward: { gold: 300 },
  },
  {
    id: 'arena',
    icon: '🏟️',
    title: 'Construiește arena',
    hint: 'Extinde → Clădiri',
    done: (s) => level(s, 'arena') >= 1,
    reward: { gold: 200 },
  },
  {
    id: 'duel',
    icon: '⚔️',
    title: 'Câștigă un duel',
    hint: 'Arena',
    done: (s) => stat(s, 'duelsWon') >= 1,
    reward: { materials: { amber: 2 } },
  },
  {
    id: 'world3',
    icon: '⬆️',
    title: 'O lume la nivelul 3',
    hint: 'Lume plină + o Grindă din forjă',
    done: (s) => level(s, 'habitat') >= 3,
    reward: { gems: 5 },
  },
  {
    id: 'farm2',
    icon: '🌾',
    title: 'Ferma la nivelul 2',
    hint: 'Întâi o lume la Nv. 2',
    done: (s) => level(s, 'farm') >= 2,
    reward: { food: 200 },
  },
  {
    id: 'worlds3',
    icon: '🗺️',
    title: 'Trei lumi deblocate',
    hint: 'Extinde → Lumi',
    done: (s) => habitats(s).length >= 3,
    reward: { gold: 800 },
  },
  {
    id: 'gear',
    icon: '🪖',
    title: 'Echipează un dinozaur',
    hint: 'Fișa dinozaurului',
    done: (s) => s.dinos.some((d) => Object.values(d.gear ?? {}).some(Boolean)),
    reward: { materials: { crystal: 1 } },
  },
  {
    id: 'atlas',
    icon: '📖',
    title: 'O linie completă în Atlas',
    hint: 'Pui → juvenil → adult',
    done: (s) => SPECIES.some((sp) => atlasLineComplete(s, sp.id)),
    reward: { fragments: 10 },
  },
  {
    id: 'breed',
    icon: '💞',
    title: 'Un ou din bârlog',
    hint: 'Extinde → Bârlog · doi Nv. 4+',
    done: (s) => stat(s, 'bred') >= 1,
    reward: { gems: 3 },
  },
  {
    id: 'world4',
    icon: '⬆️',
    title: 'O lume la nivelul 4',
    hint: 'Lume plină + o Lentilă din forjă',
    done: (s) => level(s, 'habitat') >= 4,
    reward: { gems: 8 },
  },
  {
    id: 'forge2',
    icon: '⚒️',
    title: 'Forja la nivelul 2',
    hint: 'Rețete noi',
    done: (s) => level(s, 'forge') >= 2,
    reward: { materials: { crystal: 2, amber: 2 } },
  },
];

/** Primul obiectiv nerevendicat (cel afișat pe hartă); undefined = le-ai terminat pe toate. */
export const currentGoal = (s: GameState) => GOALS.find((g) => !s.goalsClaimed?.includes(g.id));

export function claimGoal(s: GameState, id: string, events: GameEvent[]) {
  const goal = GOALS.find((g) => g.id === id);
  if (!goal) throw new GameError('Obiectiv necunoscut.');
  if (s.goalsClaimed?.includes(id)) throw new GameError('Recompensa a fost deja luată.');
  if (!goal.done(s)) throw new GameError('Obiectivul nu e încă îndeplinit.');
  applyReward(s, goal.reward);
  (s.goalsClaimed ??= []).push(id);
  events.push({ type: 'reward', title: goal.title, icon: goal.icon, reward: goal.reward });
}

// ---------- Atlas ----------

/** Nestematele pentru o linie completă (pui, juvenil și adult descoperite), pe raritate. */
export const ATLAS_REWARD: Record<Rarity, number> = { common: 2, rare: 3, epic: 5, legendary: 8 };

export const atlasLineComplete = (s: GameState, species: string) =>
  highestDiscoveredLevel(s, species) >= EVOLUTION_STAGES[EVOLUTION_STAGES.length - 1].minLevel;

export function claimAtlas(s: GameState, species: string, events: GameEvent[]) {
  const sp = speciesOf(species);
  if (s.atlasClaimed?.includes(species)) throw new GameError('Recompensa a fost deja luată.');
  if (!atlasLineComplete(s, species)) throw new GameError('Descoperă toate cele trei forme.');
  const reward = { gems: ATLAS_REWARD[sp.rarity] };
  applyReward(s, reward);
  (s.atlasClaimed ??= []).push(species);
  events.push({ type: 'reward', title: `Linia ${sp.name} · ${RARITIES[sp.rarity].name}`, icon: '📖', reward });
}
