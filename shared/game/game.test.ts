import { describe, expect, it } from 'vitest';
import {
  type Command,
  type GameState,
  GameError,
  adultTarget,
  computeStats,
  findZone,
  fromDino,
  loadState,
  newGame,
  rollEnemies,
  createRng,
  runCommand,
  simulateBattle,
  skillLevel,
} from './index';

const T0 = Date.UTC(2026, 9, 3, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

function play(state: GameState, cmd: Command, now: number) {
  return runCommand(state, cmd, now);
}

function hatchedGame(starter: 'mugurel' | 'scanteius' | 'stropel' = 'scanteius') {
  let s = newGame('Ana', starter, 'cald', T0, 42);
  s = play(s, { type: 'placeEgg', eggId: s.eggs[0].id, temperature: 'cald' }, T0).state;
  const r = play(s, { type: 'hatch', eggId: s.eggs[0].id }, T0 + 2 * MIN);
  return { state: r.state, dinoId: r.hatchedId! };
}

describe('cuib', () => {
  it('oul de start eclozează după 2 minute, nu mai devreme, exact o dată', () => {
    let s = newGame('Ana', 'mugurel', 'rece', T0, 1);
    const eggId = s.eggs[0].id;
    s = play(s, { type: 'placeEgg', eggId, temperature: 'rece' }, T0).state;
    expect(() => play(s, { type: 'hatch', eggId }, T0 + MIN)).toThrow(GameError);
    const r = play(s, { type: 'hatch', eggId }, T0 + 2 * MIN);
    expect(r.state.dinos).toHaveLength(1);
    expect(r.state.dinos[0].temperament).toBe('calm');
    expect(r.state.dinos[0].speciesId).toBe('mugurel');
    expect(r.state.atlas.mugurel.owned).toBe(true);
    expect(() => play(r.state, { type: 'hatch', eggId }, T0 + 3 * MIN)).toThrow(GameError);
  });

  it('o eroare nu modifică starea', () => {
    const s = newGame('Ana', 'mugurel', 'rece', T0, 1);
    const before = JSON.stringify(s);
    expect(() => play(s, { type: 'hatch', eggId: s.eggs[0].id }, T0)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('cuibul are locuri limitate', () => {
    let s = newGame('Ana', 'mugurel', 'rece', T0, 1);
    s.eggs.push({ ...s.eggs[0], id: 'x1', tutorial: false }, { ...s.eggs[0], id: 'x2', tutorial: false });
    s = play(s, { type: 'placeEgg', eggId: s.eggs[0].id, temperature: 'cald' }, T0).state;
    s = play(s, { type: 'placeEgg', eggId: 'x1', temperature: 'cald' }, T0).state;
    expect(() => play(s, { type: 'placeEgg', eggId: 'x2', temperature: 'cald' }, T0)).toThrow(/plin/);
  });

  it('rotirea scurtează timpul și are cooldown', () => {
    let s = newGame('Ana', 'mugurel', 'rece', T0, 1);
    s.eggs[0].tutorial = false; // 1 oră (neobișnuit)
    s = play(s, { type: 'placeEgg', eggId: s.eggs[0].id, temperature: 'cald' }, T0).state;
    const end = s.eggs[0].incubation!.endsAt;
    s = play(s, { type: 'turnEgg', eggId: s.eggs[0].id }, T0 + MIN).state;
    expect(s.eggs[0].incubation!.endsAt).toBe(end - 0.05 * HOUR);
    expect(() => play(s, { type: 'turnEgg', eggId: s.eggs[0].id }, T0 + 10 * MIN)).toThrow();
  });

  it('genele respectă minimul rarității', () => {
    const s = newGame('Ana', 'mugurel', 'rece', T0, 7);
    for (const g of Object.values(s.eggs[0].genes)) expect(g).toBeGreaterThanOrEqual(2);
  });
});

describe('creștere și evoluție', () => {
  it('hrănirea crește XP și atașamentul; dieta preferată dublează atașamentul', () => {
    const { state, dinoId } = hatchedGame('mugurel');
    const r = play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 3 * MIN);
    const dino = r.state.dinos[0];
    expect(dino.bond).toBe(14);
    expect(dino.xp).toBe(8);
    expect(r.state.inventory.ferigi).toBe(5);
  });

  it('un pui sătul refuză mâncarea, apoi îi trece', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state.inventory.ferigi = 20;
    for (let i = 0; i < 9; i++) state = play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 3 * MIN).state;
    expect(() => play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 3 * MIN)).toThrow(/sătul/);
    expect(() => play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 20 * MIN)).not.toThrow();
  });

  it('evoluția cere nivel și atașament, durează și schimbă specia', () => {
    let { state, dinoId } = hatchedGame('scanteius');
    expect(() => play(state, { type: 'evolve', dinoId }, T0)).toThrow(/Nivel 10/);
    Object.assign(state.dinos[0], { level: 10, xp: 30 * 81, bond: 50 });
    state = play(state, { type: 'evolve', dinoId }, T0).state;
    expect(state.party).not.toContain(dinoId);
    expect(() => play(state, { type: 'finishEvolve', dinoId }, T0 + HOUR)).toThrow();
    state = play(state, { type: 'finishEvolve', dinoId }, T0 + 2 * HOUR).state;
    expect(state.dinos[0].speciesId).toBe('jarraptor');
    expect(state.dinos[0].nickname).toBe('Jarraptor');
  });

  it('dieta dominantă alege ramura de adult', () => {
    const { state } = hatchedGame('scanteius');
    const dino = { ...state.dinos[0], speciesId: 'jarraptor' };
    expect(adultTarget({ ...dino, diets: ['insecte', 'insecte', 'carne'] })?.speciesId).toBe('fumaripter');
    expect(adultTarget({ ...dino, diets: ['carne'] })?.speciesId).toBe('vulcanraptor');
    // Plante: raptorul nu are ramură de colos → ramura implicită.
    expect(adultTarget({ ...dino, diets: ['plante'] })).toMatchObject({ speciesId: 'vulcanraptor', byDiet: false });
  });

  it('temperamentul modifică statisticile', () => {
    const base = { speciesId: 'jarraptor', level: 20, genes: { hp: 8, atk: 8, def: 8, spd: 8 } };
    const fioros = computeStats({ ...base, temperament: 'fioros' });
    const calm = computeStats({ ...base, temperament: 'calm' });
    expect(fioros.atk).toBeGreaterThan(calm.atk);
    expect(calm.def).toBeGreaterThan(fioros.def);
  });
});

describe('activități', () => {
  it('prima săpătură garantează un ou; producția e deterministă', () => {
    const { state } = hatchedGame();
    const s = play(state, { type: 'gather', actionId: 'nisip' }, T0).state;
    const a = play(s, { type: 'claim' }, T0 + 10 * 10_000);
    const b = play(s, { type: 'claim' }, T0 + 10 * 10_000);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.haul!.eggs.length).toBeGreaterThanOrEqual(1);
    const total = Object.values(a.haul!.items).reduce((x, y) => x + y!, 0);
    expect(total).toBe(10);
  });

  it('gathering-ul offline e plafonat la 8 ore', () => {
    const { state } = hatchedGame();
    const s = play(state, { type: 'gather', actionId: 'ferigi' }, T0).state;
    const r = play(s, { type: 'claim' }, T0 + 24 * HOUR);
    expect(r.haul!.items.ferigi).toBe((8 * 3600) / 6);
  });

  it('bucătăria consumă la start și restituie porțiile negătite la oprire', () => {
    let { state } = hatchedGame();
    state.property = 1;
    state.inventory.ferigi = 30;
    state = play(state, { type: 'cook', recipeId: 'salata', count: 10 }, T0).state;
    expect(state.inventory.ferigi ?? 0).toBe(0);
    const r = play(state, { type: 'stop' }, T0 + 3 * 8000);
    expect(r.state.inventory.salata).toBe(3);
    expect(r.state.inventory.ferigi).toBe(21);
    expect(r.state.activity).toBeNull();
  });

  it('bucătăria e blocată până la Cuibul de lut', () => {
    const { state } = hatchedGame();
    expect(() => play(state, { type: 'cook', recipeId: 'salata', count: 1 }, T0)).toThrow(/Cuib de lut/);
  });
});

describe('lupte', () => {
  it('lupta e deterministă pentru același seed', () => {
    const { state } = hatchedGame();
    const zone = findZone('mlastina');
    const party = state.dinos.map(fromDino);
    const a = simulateBattle(party, rollEnemies(createRng(5), zone, party, false), 9);
    const b = simulateBattle(party, rollEnemies(createRng(5), zone, party, false), 9);
    expect(a).toEqual(b);
    expect(a.events.at(-1)).toEqual({ t: 'end', win: a.win });
  });

  it('puiul de nivel 1 câștigă prima luptă din Mlaștină', () => {
    for (const starter of ['mugurel', 'scanteius', 'stropel'] as const) {
      const { state } = hatchedGame(starter);
      const r = play(state, { type: 'battle', zoneId: 'mlastina' }, T0 + 3 * MIN);
      expect(r.battle!.win).toBe(true);
      expect(r.state.dinos[0].xp).toBeGreaterThan(0);
    }
  });

  it('expediția se întoarce după 3 înfrângeri la rând', () => {
    const { state } = hatchedGame();
    state.alphas = ['mlastina'];
    const s = play(state, { type: 'expedition', zoneId: 'jungla' }, T0).state;
    const r = play(s, { type: 'claim' }, T0 + HOUR);
    expect(r.haul!.losses).toBe(3);
    expect(r.haul!.wins).toBe(0);
    expect(r.state.activity).toBeNull();
  });

  it('regiunile se deschid pe rând, iar Alfa final cere Os de Alfa', () => {
    const { state } = hatchedGame();
    expect(() => play(state, { type: 'expedition', zoneId: 'jungla' }, T0)).toThrow(/Alfa Mlaștinii/);
    state.alphas = ['mlastina', 'jungla'];
    expect(() => play(state, { type: 'battle', zoneId: 'vulcan', alpha: true }, T0)).toThrow(/Os de Alfa/);
  });

  it('eliberarea lui Alfa deschide regiunea următoare și dă o relicvă', () => {
    let { state, dinoId } = hatchedGame('scanteius');
    state.dinos.push({ ...state.dinos[0], id: 'd2', speciesId: 'mugurel', nickname: 'Mugurel' });
    for (const d of state.dinos) Object.assign(d, { level: 14, xp: 30 * 169, bond: 60 });
    state.party = [dinoId, 'd2'];
    let won = false;
    for (let i = 0; i < 5 && !won; i++) {
      const r = play(state, { type: 'battle', zoneId: 'mlastina', alpha: true }, T0 + i);
      state = r.state;
      won = r.battle!.win;
    }
    expect(won).toBe(true);
    expect(state.alphas).toContain('mlastina');
    expect(state.relics).toContain('colti_licurici');
    state = play(state, { type: 'equip', dinoId, relicId: 'colti_licurici' }, T0).state;
    expect(state.dinos[0].relic).toBe('colti_licurici');
    expect(() => play(state, { type: 'expedition', zoneId: 'jungla' }, T0)).not.toThrow();
  });
});

describe('echilibrare', () => {
  it('prima sesiune: puiul ajunge la nivelul 10 în 2 ore de expediție în Mlaștină', () => {
    for (const starter of ['mugurel', 'scanteius', 'stropel'] as const) {
      let { state } = hatchedGame(starter);
      state = play(state, { type: 'battle', zoneId: 'mlastina' }, T0 + 3 * MIN).state;
      state = play(state, { type: 'expedition', zoneId: 'mlastina' }, T0 + 4 * MIN).state;
      const r = play(state, { type: 'claim' }, T0 + 4 * MIN + 2 * HOUR);
      expect(r.state.activity, starter).not.toBeNull();
      expect(r.haul!.wins / (r.haul!.wins + r.haul!.losses), starter).toBeGreaterThan(0.7);
      expect(r.state.dinos[0].level, starter).toBeGreaterThanOrEqual(10);
      expect(skillLevel(r.state, 'imblanzire')).toBeGreaterThanOrEqual(3);
    }
  });

  it('se poate construi Cuibul de lut din săpături și vânzări în prima oră', () => {
    let { state } = hatchedGame();
    state = play(state, { type: 'gather', actionId: 'nisip' }, T0).state;
    state = play(state, { type: 'stop' }, T0 + 30 * MIN).state;
    const os = state.inventory.os ?? 0;
    if (os) state = play(state, { type: 'sell', itemId: 'os', qty: os }, T0 + 30 * MIN).state;
    state = play(state, { type: 'upgrade' }, T0 + 30 * MIN).state;
    expect(state.property).toBe(1);
  });
});

describe('salvare', () => {
  it('respinge salvări stricate și le acceptă pe cele valide', () => {
    expect(loadState(null)).toBeNull();
    expect(loadState({ version: 2 })).toBeNull();
    const { state } = hatchedGame();
    expect(loadState(JSON.parse(JSON.stringify(state)))).not.toBeNull();
  });
});
