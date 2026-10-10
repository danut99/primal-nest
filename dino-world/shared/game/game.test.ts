import { describe, expect, it } from 'vitest';
import {
  BREED_LEVEL,
  ELEMENT_IDS,
  SPECIES,
  freeSlots,
  residents,
  breedOdds,
  canPlace,
  newGame as freshGame,
  pendingGold,
  runCommand,
  speciesOf,
  type Command,
  type GameState,
  ensureMainBuildings,
  DEN_RECIPES,
  DEN_RARE_CHANCE,
  DEN_ADULT_BONUS,
} from './index';
import { newGameWithServices } from './test-helpers';

const T0 = 1_000_000;
const newGame = (now: number, seed: number) => {
  const r = runCommand(freshGame(now, seed), { type: 'unlockWorld', element: 'fire' }, now);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const ok = (s: GameState, cmd: Command, now = T0) => {
  const r = runCommand(s, cmd, now);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('lumea', () => {
  it('începe cu un habitat de foc și un Ignisaur', () => {
    const s = newGame(T0, 1);
    expect(s.dinos).toHaveLength(1);
    expect(s.buildings.find((b) => b.id === s.dinos[0].habitatId)?.element).toBe('fire');
  });

  it('construiește doar pe locuri libere și potrivite', () => {
    const s = newGame(T0, 1);
    expect(canPlace(s, 'habitat', 'world0')).toBe(false);
    expect(canPlace(s, 'habitat', 'p1')).toBe(true);
    expect(canPlace(s, 'habitat', 'hatchery')).toBe(false);
    expect(canPlace(s, 'habitat', 'nicaieri')).toBe(false);
  });

  it('mută o clădire pe alt loc liber', () => {
    const s = newGame(T0, 1);
    const home = s.buildings.find((b) => b.kind === 'habitat')!;
    const r = ok(s, { type: 'move', buildingId: home.id, slot: 'p2' });
    expect(r.state.buildings.find((b) => b.id === home.id)?.slot).toBe('p2');
    expect(runCommand(s, { type: 'move', buildingId: home.id, slot: 'p4' }, T0).ok).toBe(false);
  });

  it('o eroare lasă starea neschimbată', () => {
    const s = newGame(T0, 1);
    const r = runCommand(s, { type: 'build', kind: 'habitat', slot: 'p0', element: 'water' }, T0);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
});

describe('aur', () => {
  it('habitatul produce aur în timp, până la plafon', () => {
    const s = newGame(T0, 1);
    const home = s.buildings.find((b) => b.kind === 'habitat')!;
    expect(pendingGold(s, home, T0 + 10 * 60_000)).toBe(60);
    expect(pendingGold(s, home, T0 + 10 * 3600_000)).toBe(300);
    const r = ok(s, { type: 'collect', buildingId: home.id }, T0 + 10 * 60_000);
    expect(r.state.gold).toBe(s.gold + 60);
  });

  it('hrănirea păstrează aurul strâns la vechiul ritm', () => {
    let s = newGame(T0, 1);
    s.food = 1000;
    const home = s.buildings.find((b) => b.kind === 'habitat')!;
    s = ok(s, { type: 'feed', dinoId: s.dinos[0].id }, T0 + 10 * 60_000).state;
    expect(s.dinos[0].level).toBe(2);
    expect(
      pendingGold(
        s,
        s.buildings.find((b) => b.id === home.id)!,
        T0 + 10 * 60_000,
      ),
    ).toBe(60);
  });
});

describe('ouă și împerechere', () => {
  it('un ou cumpărat eclozează doar într-un habitat potrivit', () => {
    let s = newGame(T0, 1);
    s.gold = 10_000;
    s = ok(s, { type: 'buyEgg', species: 'pelagisaur' }).state;
    const fire = s.buildings.find((b) => b.kind === 'habitat')!;
    expect(runCommand(s, { type: 'hatch', eggId: s.eggs[0].id, habitatId: fire.id }, T0 + 60_000).ok).toBe(false);
    s = ok(s, { type: 'unlockWorld', element: 'water' }).state;
    const water = s.buildings.find((b) => b.element === 'water')!;
    expect(runCommand(s, { type: 'hatch', eggId: s.eggs[0].id, habitatId: water.id }, T0).ok).toBe(false);
    const r = ok(s, { type: 'hatch', eggId: s.eggs[0].id, habitatId: water.id }, T0 + 60_000);
    expect(r.state.dinos.at(-1)?.species).toBe('pelagisaur');
    expect(r.events.some((e) => e.type === 'discovered')).toBe(true);
  });

  it('perechea rețetei poate da specia rară; doi adulți au șanse mai mari', () => {
    const odds = breedOdds(speciesOf('ignisaur'), speciesOf('ferrankyl'));
    expect(odds.map((o) => o.species.id).sort()).toEqual(['ferrankyl', 'ignisaur', 'pyroceratops']);
    expect(odds.find((o) => o.species.id === 'pyroceratops')!.pct).toBe(DEN_RARE_CHANCE);
    expect(odds.reduce((sum, o) => sum + o.pct, 0)).toBeCloseTo(100);
    const adults = breedOdds(speciesOf('ignisaur'), speciesOf('ferrankyl'), true);
    expect(adults.find((o) => o.species.id === 'pyroceratops')!.pct).toBe(DEN_RARE_CHANCE + DEN_ADULT_BONUS);
  });

  it('o pereche fără rețetă dă doar speciile părinților', () => {
    const odds = breedOdds(speciesOf('ignisaur'), speciesOf('pelagisaur'));
    expect(odds.map((o) => o.species.id).sort()).toEqual(['ignisaur', 'pelagisaur']);
  });

  it('fiecare specie se obține: din ou sau dintr-o rețetă cu părinți din ouă', () => {
    for (const s of SPECIES) {
      if (s.shopPrice) continue;
      const [a, b] = DEN_RECIPES[s.id];
      expect(speciesOf(a).shopPrice && speciesOf(b).shopPrice).toBeTruthy();
      expect(breedOdds(speciesOf(a), speciesOf(b)).some((o) => o.species.id === s.id)).toBe(true);
    }
  });

  it('împerecherea e deterministă și lasă un ou în incubator', () => {
    let s = newGameWithServices(T0, 7);
    s.dinos.push({ id: 'x', species: 'ignisaur', level: BREED_LEVEL, habitatId: s.dinos[0].habitatId });
    s.dinos[0].level = BREED_LEVEL;
    const a = ok(s, { type: 'breed', a: s.dinos[0].id, b: 'x' }).state;
    const b = ok(s, { type: 'breed', a: s.dinos[0].id, b: 'x' }).state;
    expect(a.breeding).toEqual(b.breeding);
    s = ok(a, { type: 'finishBreed' }, a.breeding!.readyAt).state;
    expect(s.eggs).toHaveLength(1);
    expect(s.breeding).toBeNull();
  });
});

describe('habitat worlds', () => {
  it('supports every habitat type without consuming the expedition farm plots', () => {
    let s = newGame(T0, 1);
    s.gold = 10000;
    for (const element of ELEMENT_IDS.filter((element) => element !== 'fire')) {
      s = ok(s, { type: 'unlockWorld', element }).state;
    }
    expect(s.buildings.filter((b) => b.kind === 'habitat')).toHaveLength(6);
    // arena, avanpostul și bârlogul nu mai sunt construite la început, deci locurile lor sunt libere
    expect(freeSlots(s, 'farm')).toHaveLength(6);
    const fire = s.buildings.find((b) => b.kind === 'habitat' && b.element === 'fire')!;
    const water = s.buildings.find((b) => b.kind === 'habitat' && b.element === 'water')!;
    expect(residents(s, fire.id)).toHaveLength(1);
    expect(residents(s, water.id)).toHaveLength(0);
    expect(
      ok(s, { type: 'build', kind: 'farm', slot: freeSlots(s, 'farm')[0].id }).state.buildings.filter(
        (b) => b.kind === 'farm',
      ),
    ).toHaveLength(2);
  });
});

it('o salvare veche cu specii scoase le mută pe specia de pe același element', () => {
  const s = newGame(T0, 1);
  s.dinos[0].species = 'magmadon';
  s.eggs.push({ id: 'old-egg', species: 'hidrodon', hatchAt: T0 });
  s.discovered = ['ignisaur', 'magmadon', 'astravor'];
  s.evolutionProgress = { astravor: 5 };
  ensureMainBuildings(s, T0);
  expect(s.dinos[0].species).toBe('ignisaur');
  expect(s.eggs.at(-1)!.species).toBe('pelagisaur');
  expect(s.discovered.sort()).toEqual(['ferrankyl', 'ignisaur']);
  expect(s.evolutionProgress).toMatchObject({ ferrankyl: 5 });
  expect(s.evolutionProgress!.astravor).toBeUndefined();
});
