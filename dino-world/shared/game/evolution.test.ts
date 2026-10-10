import { expect, it } from 'vitest';
import { highestDiscoveredLevel, newGame, runCommand, stageForLevel } from './index';

it('uses the three growth stages at their exact level thresholds', () => {
  expect([1, 3, 4, 6, 7, 10].map(stageForLevel)).toEqual(['pui', 'pui', 'juvenil', 'juvenil', 'adult', 'adult']);
});
it('feeding records discovered evolution stages and preserves them after selling', () => {
  let s = newGame(1000, 1);
  s.food = 10000;
  const id = s.dinos[0].id;
  for (let i = 0; i < 6; i++) {
    const r = runCommand(s, { type: 'feed', dinoId: id }, 1000);
    expect(r.ok).toBe(true);
    s = r.state;
  }
  expect(highestDiscoveredLevel(s, 'ignisaur')).toBe(7);
  s.dinos.push({ ...s.dinos[0], id: 'other', species: 'pelagisaur', level: 1 });
  const sold = runCommand(s, { type: 'sellDino', dinoId: id }, 1000);
  expect(sold.ok).toBe(true);
  expect(highestDiscoveredLevel(sold.state, 'ignisaur')).toBe(7);
});
it('supports older saves without an evolution record and does not discover unowned species', () => {
  const s = newGame(1000, 1);
  delete s.evolutionProgress;
  s.dinos[0].level = 6;
  expect(highestDiscoveredLevel(s, 'ignisaur')).toBe(6);
  expect(highestDiscoveredLevel(s, 'terratitan')).toBe(0);
});
