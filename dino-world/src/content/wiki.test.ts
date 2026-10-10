import { describe, it, expect } from 'vitest';
import { searchWiki } from './wiki';
describe('căutarea din Wikipedia', () => {
  it('găsește aceleași explicații cu diacritice, fără diacritice și cu majuscule', () => {
    const ids = (q: string) => searchWiki(q).map((a) => a.id);
    expect(ids('împerechere').length).toBeGreaterThan(0);
    expect(ids('IMPERECHERE')).toEqual(ids('împerechere'));
    expect(ids('forja')[0]).toBe('building-forge');
  });
  it('caută și în pași și în tabele, nu numai în titluri', () => {
    expect(searchWiki('ignisaur ferrankyl').map((a) => a.id)).toContain('breeding');
    expect(searchWiki('piatra incubator').map((a) => a.id)).toContain('item-warm-stone');
  });
  it('respectă categoria și tratează o căutare fără rezultate', () => {
    expect(searchWiki('foc', 'worlds').map((a) => a.id)).toEqual(['world-fire']);
    expect(searchWiki('nimic-de-acest-fel')).toEqual([]);
    expect(searchWiki('   ', 'help').length).toBeGreaterThan(0);
  });
});
