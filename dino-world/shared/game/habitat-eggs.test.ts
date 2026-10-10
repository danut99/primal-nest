import { expect, it } from 'vitest';
import { EGG_SPECIES, ELEMENT_IDS, habitatEggOdds, newGame, runCommand, unlockWorld } from '.';

it('oul fiecărei lumi dă mereu specia ei de bază (rarele vin din Bârlog)', () => {
  for (const element of ELEMENT_IDS) {
    const odds = habitatEggOdds(element);
    expect(odds).toHaveLength(1);
    expect(odds[0].species.id).toBe(EGG_SPECIES[element]);
    expect(odds[0].species.elements).toEqual([element]);
    expect(odds[0].pct).toBe(100);
  }
});

it('oul de habitat cere lumea deblocată, costă aur și ajunge în incubator cu elementul lui', () => {
  const now = 0;
  let s = newGame(now, 3);
  s.gold = 10_000;
  expect(runCommand(s, { type: 'buyHabitatEgg', element: 'fire' }, now).ok).toBe(false);
  unlockWorld(s, 'fire', now);
  const gold = s.gold,
    eggs = s.eggs.length;
  const r = runCommand(s, { type: 'buyHabitatEgg', element: 'fire' }, now);
  expect(r.ok).toBe(true);
  s = r.state;
  expect(s.eggs.length).toBe(eggs + 1);
  const egg = s.eggs.at(-1)!;
  expect(egg.element).toBe('fire');
  expect(habitatEggOdds('fire').map((o) => o.species.id)).toContain(egg.species);
  expect(s.gold).toBeLessThan(gold);
});
