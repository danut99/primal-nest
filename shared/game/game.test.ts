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
  breedForecast,
  breedRarities,
  workReady,
  dayIndex,
  questProgress,
  ACHIEVEMENTS,
  achievementDone,
  workSpeed,
  WORK_JOBS,
  SPECIES,
} from './index';

const T0 = Date.UTC(2026, 9, 3, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

function play(state: GameState, cmd: Command, now: number) {
  return runCommand(state, cmd, now);
}

function hatchedGame(starter: 'mugurel' | 'scanteius' | 'pietroi' = 'scanteius') {
  let s = newGame('Ana', starter, 'cald', T0, 42);
  s = play(s, { type: 'placeEgg', eggId: s.eggs[0].id, temperature: 'cald' }, T0).state;
  const r = play(s, { type: 'hatch', eggId: s.eggs[0].id }, T0 + 2 * MIN);
  return { state: r.state, dinoId: r.hatchedId! };
}

const JUVENIL = { mugurel: 'ferigosaur', scanteius: 'jarraptor', pietroi: 'scutosaur' } as const;

/** Puii nu luptă: pentru lupte, starterul e deja Juvenil (nivel 10, ca după prima evoluție) și stă în haită. */
function juvenilGame(starter: 'mugurel' | 'scanteius' | 'pietroi' = 'scanteius', level = 10) {
  const { state, dinoId } = hatchedGame(starter);
  Object.assign(state.dinos[0], { speciesId: JUVENIL[starter], nickname: 'Juvi', level, xp: 30 * (level - 1) ** 2, bond: 50 });
  state.party = [dinoId];
  return { state, dinoId };
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
    const zone = findZone('jungla');
    const party = state.dinos.map((d, i) => fromDino(d, i));
    const a = simulateBattle(party, rollEnemies(createRng(5), zone, party, false), 9);
    const b = simulateBattle(party, rollEnemies(createRng(5), zone, party, false), 9);
    expect(a).toEqual(b);
    expect(a.events.at(-1)).toEqual({ t: 'end', win: a.win });
  });

  it('puii nu luptă: nu intră în haită și nu pot porni lupte', () => {
    const { state, dinoId } = hatchedGame();
    expect(state.party).toHaveLength(0);
    expect(() => play(state, { type: 'setParty', ids: [dinoId] }, T0)).toThrow(/Puii nu luptă/);
    state.party = [dinoId]; // salvare veche, cu puiul în haită
    expect(() => play(state, { type: 'battle', zoneId: 'jungla' }, T0)).toThrow(/Puii nu luptă/);
    expect(() => play(state, { type: 'expedition', zoneId: 'jungla' }, T0)).toThrow(/Puii nu luptă/);
  });

  it('în sălbăticie nu apar pui', () => {
    for (const zoneId of ['jungla', 'canion', 'piscuri', 'vulcan']) {
      for (const id of findZone(zoneId).enemies) expect(SPECIES[id].stage, `${zoneId}: ${id}`).not.toBe('pui');
    }
  });

  it('juvenilul proaspăt evoluat câștigă prima luptă din Junglă', () => {
    for (const starter of ['mugurel', 'scanteius', 'pietroi'] as const) {
      const { state } = juvenilGame(starter);
      const r = play(state, { type: 'battle', zoneId: 'jungla' }, T0 + 3 * MIN);
      expect(r.battle!.win).toBe(true);
      expect(r.state.dinos[0].xp).toBeGreaterThan(0);
    }
  });

  it('expediția se întoarce după 3 înfrângeri la rând', () => {
    const { state } = juvenilGame('scanteius', 1);
    state.alphas = ['jungla'];
    const s = play(state, { type: 'expedition', zoneId: 'canion' }, T0).state;
    const r = play(s, { type: 'claim' }, T0 + HOUR);
    expect(r.haul!.losses).toBe(3);
    expect(r.haul!.wins).toBe(0);
    expect(r.state.activity).toBeNull();
  });

  it('regiunile se deschid pe rând, iar Alfa final cere Os de Alfa', () => {
    const { state } = juvenilGame();
    expect(() => play(state, { type: 'expedition', zoneId: 'canion' }, T0)).toThrow(/Alfa Junglei/);
    state.alphas = ['jungla', 'canion', 'piscuri'];
    expect(() => play(state, { type: 'battle', zoneId: 'vulcan', alpha: true }, T0)).toThrow(/Os de Alfa/);
  });

  it('eliberarea lui Alfa deschide regiunea următoare și dă o relicvă', () => {
    let { state, dinoId } = juvenilGame('scanteius');
    state.dinos.push({ ...state.dinos[0], id: 'd2', speciesId: 'ferigosaur', nickname: 'Ferigosaur' });
    for (const d of state.dinos) Object.assign(d, { level: 14, xp: 30 * 169, bond: 60 });
    state.party = [dinoId, 'd2'];
    let won = false;
    for (let i = 0; i < 5 && !won; i++) {
      const r = play(state, { type: 'battle', zoneId: 'jungla', alpha: true }, T0 + i);
      state = r.state;
      won = r.battle!.win;
    }
    expect(won).toBe(true);
    expect(state.alphas).toContain('jungla');
    expect(state.relics).toContain('colti_licurici');
    expect(state.diamonds).toBeGreaterThanOrEqual(5 + 10);
    state = play(state, { type: 'equip', dinoId, relicId: 'colti_licurici' }, T0).state;
    expect(state.dinos[0].relic).toBe('colti_licurici');
    expect(() => play(state, { type: 'expedition', zoneId: 'canion' }, T0)).not.toThrow();
  });

  it('relicvele se întăresc la forjă până la nivelul 5', () => {
    let { state, dinoId } = hatchedGame('scanteius');
    state.relics = ['colti_licurici'];
    state.dinos[0].relic = 'colti_licurici';
    expect(() => play(state, { type: 'upgradeRelic', relicId: 'colti_licurici' }, T0)).toThrow(/scântei|materiale/);
    state.sparks = 10_000;
    state.inventory = { bazalt: 30, fosila: 2, cristal: 3 };
    const before = computeStats(state.dinos[0], 1).atk;
    for (let i = 0; i < 4; i++) state = play(state, { type: 'upgradeRelic', relicId: 'colti_licurici' }, T0).state;
    expect(state.relicLevels.colti_licurici).toBe(5);
    expect(state.sparks).toBe(10_000 - 1000);
    expect(state.inventory).toEqual({});
    expect(computeStats(state.dinos.find((d) => d.id === dinoId)!, 5).atk).toBeGreaterThan(before);
    expect(() => play(state, { type: 'upgradeRelic', relicId: 'colti_licurici' }, T0)).toThrow(/maxim/);
  });
});

describe('echilibrare', () => {
  it('prima sesiune de lupte: juvenilul crește în 2 ore de expediție în Junglă', () => {
    for (const starter of ['mugurel', 'scanteius', 'pietroi'] as const) {
      let { state } = juvenilGame(starter);
      state = play(state, { type: 'battle', zoneId: 'jungla' }, T0 + 3 * MIN).state;
      state = play(state, { type: 'expedition', zoneId: 'jungla' }, T0 + 4 * MIN).state;
      const r = play(state, { type: 'claim' }, T0 + 4 * MIN + 2 * HOUR);
      expect(r.state.activity, starter).not.toBeNull();
      expect(r.haul!.wins / (r.haul!.wins + r.haul!.losses), starter).toBeGreaterThan(0.7);
      expect(r.state.dinos[0].level, starter).toBeGreaterThan(10);
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
    // Linia de plesiozaur a fost scoasă: salvările vechi o primesc pe cea de Junglă, același stadiu.
    const { state: old } = hatchedGame();
    old.dinos.push({ ...old.dinos[0], id: 'w', speciesId: 'valusaur' });
    old.eggs.push({ ...old.dinos[0], id: 'e', speciesId: 'stropel', rarity: 'comun', variant: 'normal', genes: old.dinos[0].genes } as never);
    old.atlas.stropel = { seen: true, owned: true };
    const migrated = loadState(JSON.parse(JSON.stringify(old)))!;
    expect(migrated.dinos.find((d) => d.id === 'w')!.speciesId).toBe('ferigosaur');
    expect(migrated.eggs.find((e) => e.id === 'e')!.speciesId).toBe('mugurel');
    expect(migrated.atlas.stropel).toBeUndefined();
    expect(migrated.atlas.mugurel?.owned).toBe(true);
    // Harta veche: Mlaștina → Jungla, Jungla → Canionul.
    const oldMap = JSON.parse(JSON.stringify(old));
    delete oldMap.zonesVersion;
    oldMap.alphas = ['mlastina', 'jungla'];
    oldMap.activity = { kind: 'expedition', zoneId: 'jungla', startedAt: T0, seed: 1, index: 0 };
    const moved = loadState(oldMap)!;
    expect(moved.alphas).toEqual(['jungla', 'canion']);
    expect(moved.activity).toMatchObject({ zoneId: 'canion' });
    const { state } = hatchedGame();
    expect(loadState(JSON.parse(JSON.stringify(state)))).not.toBeNull();
  });
});

describe('haita la muncă', () => {
  it('dinozaurul lucrează în paralel cu activitatea, iese din haită și aduce materiale', () => {
    let { state, dinoId } = juvenilGame('scanteius');
    state = play(state, { type: 'gather', actionId: 'ferigi' }, T0).state;
    state = play(state, { type: 'assignWork', dinoId, jobId: 'vanator' }, T0).state;
    expect(state.party).not.toContain(dinoId);
    expect(state.activity?.kind).toBe('gather');
    expect(() => play(state, { type: 'collectWork' }, T0 + 1000)).toThrow(/nimic/);
    const r = play(state, { type: 'collectWork' }, T0 + HOUR);
    const meat = (r.state.inventory.carne ?? 0) + (r.state.inventory.os ?? 0);
    expect(meat).toBe(workReady(state, state.workers[0], T0 + HOUR));
    expect(meat).toBeGreaterThanOrEqual(60); // tip Foc la Vânător: +50% (90 s → ~60 s)
    expect(r.state.dinos[0].xp).toBeGreaterThan(state.dinos[0].xp);
    expect(() => play(r.state, { type: 'setParty', ids: [dinoId] }, T0 + HOUR)).toThrow(/muncă/);
  });

  it('tipul potrivit lucrează mai repede; posturile sunt limitate de Tabără', () => {
    let { state, dinoId } = hatchedGame('scanteius');
    const dino = state.dinos[0];
    const [culegator, , vanator] = WORK_JOBS;
    expect(workSpeed(dino, vanator)).toBeGreaterThan(workSpeed(dino, culegator));
    state.dinos.push({ ...dino, id: 'd2', nickname: 'Doi' });
    state = play(state, { type: 'assignWork', dinoId, jobId: 'culegator' }, T0).state;
    expect(() => play(state, { type: 'assignWork', dinoId: 'd2', jobId: 'sapator' }, T0)).toThrow(/post/);
    state.property = 1;
    state = play(state, { type: 'assignWork', dinoId: 'd2', jobId: 'sapator' }, T0).state;
    expect(state.workers).toHaveLength(2);
  });

  it('plafonul offline e de 8 ore, iar chemarea acasă strânge tot', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state = play(state, { type: 'assignWork', dinoId, jobId: 'culegator' }, T0).state;
    expect(workReady(state, state.workers[0], T0 + 48 * HOUR)).toBe(workReady(state, state.workers[0], T0 + 8 * HOUR));
    const r = play(state, { type: 'unassignWork', dinoId }, T0 + 2 * HOUR);
    expect(r.state.workers).toHaveLength(0);
    expect((r.state.inventory.ferigi ?? 0) + (r.state.inventory.fructe ?? 0) + (r.state.inventory.insecte ?? 0)).toBeGreaterThan(6);
  });
});

describe('coada de acțiuni', () => {
  it('o activitate cu număr fix se termină și pornește următoarea exact atunci, chiar offline', () => {
    let { state } = hatchedGame('mugurel');
    state.property = 1;
    state = play(state, { type: 'gather', actionId: 'ferigi', count: 10 }, T0).state; // 10 × 6 s = 1 min
    state = play(state, { type: 'enqueue', item: { kind: 'cook', recipeId: 'salata', count: 3 } }, T0).state;
    state = play(state, { type: 'enqueue', item: { kind: 'gather', actionId: 'ferigi', count: 5 } }, T0).state;
    expect(() => play(state, { type: 'enqueue', item: { kind: 'gather', actionId: 'ferigi', count: 5 } }, T0)).toThrow(/maximum/);
    // După 10 min: 10 ferigi + 6 de la start, 9 gătite în 3 salate (24 s), apoi încă 5 ferigi.
    const r = play(state, { type: 'claim' }, T0 + 10 * MIN);
    expect(r.state.inventory.salata).toBe(3);
    expect(r.state.inventory.ferigi).toBe(6 + 10 - 9 + 5);
    expect(r.state.queue).toHaveLength(0);
    expect(r.state.activity).toBeNull();
  });

  it('oprirea trece la următoarea din coadă; pornirea directă nu golește coada', () => {
    let { state } = hatchedGame('mugurel');
    state = play(state, { type: 'gather', actionId: 'ferigi' }, T0).state;
    state = play(state, { type: 'enqueue', item: { kind: 'gather', actionId: 'nisip', count: 3 } }, T0).state;
    state = play(state, { type: 'gather', actionId: 'ferigi' }, T0 + MIN).state;
    expect(state.queue).toHaveLength(1);
    state = play(state, { type: 'stop' }, T0 + 2 * MIN).state;
    expect(state.activity).toMatchObject({ kind: 'gather', actionId: 'nisip', limit: 3 });
    expect(state.queue).toHaveLength(0);
  });
});

describe('împerechere', () => {
  function pair() {
    const { state, dinoId } = hatchedGame('scanteius');
    const a = state.dinos[0];
    Object.assign(a, { speciesId: 'jarraptor', nickname: 'Jar', genes: { hp: 15, atk: 15, def: 15, spd: 15 } });
    state.dinos.push({ ...a, id: 'd2', nickname: 'Scrum', genes: { hp: 0, atk: 0, def: 0, spd: 0 }, lineage: { parents: ['X', 'Y'], generation: 2 } });
    state.skills.imblanzire = 50 * 16; // nivel 5
    return { state, a: dinoId, b: 'd2' };
  }

  it('lasă un ou din linia părinților, cu gene moștenite și generația următoare', () => {
    let { state, a, b } = pair();
    state.party = [a];
    state = play(state, { type: 'breed', a, b }, T0).state;
    expect(state.party).toHaveLength(0);
    expect(() => play(state, { type: 'setParty', ids: [a] }, T0)).toThrow(/Bârlog/);
    expect(() => play(state, { type: 'finishBreed' }, T0 + HOUR)).toThrow(/gata/);
    const r = play(state, { type: 'finishBreed' }, T0 + 6 * HOUR);
    const egg = r.state.eggs.at(-1)!;
    expect(egg.speciesId).toBe('scanteius');
    expect(egg.lineage).toEqual({ parents: ['Jar', 'Scrum'], generation: 3 });
    expect(egg.rarity).not.toBe('comun');
    for (const g of Object.values(egg.genes)) expect(g).toBeGreaterThanOrEqual(0);
    expect(r.state.dinos.every((d) => d.breeds === 1)).toBe(true);
    expect(r.state.breeding).toBeNull();
  });

  it('raritatea oului vine din genele părinților; previziunea arată intervalul', () => {
    const top = { genes: { hp: 15, atk: 15, def: 15, spd: 15 } };
    const weak = { genes: { hp: 2, atk: 2, def: 2, spd: 2 } };
    expect(breedRarities(top, top).map((r) => r.value)).toEqual(['epic', 'legendar']);
    expect(breedRarities(weak, weak).map((r) => r.value)).toEqual(['neobisnuit', 'rar']);
    const f = breedForecast(top, weak);
    expect(f.genes.atk).toEqual([0, 15]);
    expect(f.stars).toEqual([0, 3]);
    expect(f.rarities.reduce((sum, r) => sum + r.pct, 0)).toBe(100);
    expect(breedForecast(top, top).stars).toEqual([3, 3]);
  });

  it('cere aceeași linie, fără pui și Îmblânzire nivel 5', () => {
    const { state, a, b } = pair();
    state.dinos[1].speciesId = 'ferigosaur';
    expect(() => play(state, { type: 'breed', a, b }, T0)).toThrow(/aceeași linie/);
    state.dinos[1].speciesId = 'scanteius';
    expect(() => play(state, { type: 'breed', a, b }, T0)).toThrow(/pui/);
    state.dinos[1].speciesId = 'jarraptor';
    state.skills.imblanzire = 0;
    expect(() => play(state, { type: 'breed', a, b }, T0)).toThrow(/Îmblânzire/);
  });
});

describe('rucsacul de ouă', () => {
  it('vinde sau aruncă mai multe ouă odată, dar nu oul de start sau unul din cuib', () => {
    let { state } = hatchedGame('mugurel');
    const base = { speciesId: 'mugurel', genes: { hp: 1, atk: 1, def: 1, spd: 1 }, variant: 'normal' as const };
    state.eggs.push({ ...base, id: 'x1', rarity: 'comun' }, { ...base, id: 'x2', rarity: 'comun' }, { ...base, id: 'x3', rarity: 'rar', candled: true });
    const sparks = state.sparks;
    state = play(state, { type: 'sellEggs', eggIds: ['x1', 'x3'] }, T0).state;
    expect(state.sparks).toBeGreaterThan(sparks);
    expect(state.eggs.map((e) => e.id)).toEqual(['x2']);
    const before = state.sparks;
    state = play(state, { type: 'discardEggs', eggIds: ['x2'] }, T0).state;
    expect(state.eggs).toHaveLength(0);
    expect(state.sparks).toBe(before);
    state.eggs.push({ ...base, id: 't', rarity: 'comun', tutorial: true });
    expect(() => play(state, { type: 'discardEggs', eggIds: ['t'] }, T0)).toThrow(/start/);
  });
});

describe('foamea și sălbăticia', () => {
  it('un dino nehrănit 3 zile fuge; cu diamante se întoarce flămând și mai puțin atașat', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state.party = [dinoId];
    state.dinos[0].bond = 50;
    expect(play(state, { type: 'tick' }, T0 + 71 * HOUR).state.dinos).toHaveLength(1);
    const r = play(state, { type: 'tick' }, T0 + 73 * HOUR);
    expect(r.state.dinos).toHaveLength(0);
    expect(r.state.party).toHaveLength(0);
    expect(r.state.wild[0].dino.id).toBe(dinoId);
    expect(r.events.some((e) => e.text.includes('sălbăticie'))).toBe(true);
    state = r.state;
    state.diamonds = 2;
    expect(() => play(state, { type: 'bringBack', dinoId }, T0 + 74 * HOUR)).toThrow(/💎/);
    state.diamonds = 5;
    state = play(state, { type: 'bringBack', dinoId }, T0 + 74 * HOUR).state;
    expect(state.diamonds).toBe(2);
    expect(state.wild).toHaveLength(0);
    expect(state.dinos[0].bond).toBe(30);
    // Ceasul foamei pornește din nou de la întoarcere.
    expect(play(state, { type: 'tick' }, T0 + 74 * HOUR + 71 * HOUR).state.dinos).toHaveLength(1);
  });

  it('hrănirea resetează ceasul', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state = play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 60 * HOUR).state;
    expect(play(state, { type: 'tick' }, T0 + 120 * HOUR).state.dinos).toHaveLength(1);
  });
});

describe('grija pentru haită', () => {
  it('hrănește toată haita cu mâncarea preferată', () => {
    let { state } = hatchedGame('scanteius');
    state.dinos.push({ ...state.dinos[0], id: 'd2', nickname: 'Doi', speciesId: 'mugurel' });
    state.inventory = { carne: 1, ferigi: 1, insecte: 5 };
    state = play(state, { type: 'feedAll' }, T0 + HOUR).state;
    expect(state.inventory.carne).toBeUndefined(); // Scânteiuș mănâncă carne
    expect(state.inventory.ferigi).toBeUndefined(); // Mugurel mănâncă ferigi
    expect(state.inventory.insecte).toBe(5);
    expect(state.stats.feeds).toBe(2);
  });

  it('troaca îi hrănește singuri, și offline, așa că nu mai fug', () => {
    let { state } = hatchedGame('mugurel');
    state = play(state, { type: 'troughDeposit', itemId: 'ferigi', qty: 6 }, T0).state;
    expect(state.inventory.ferigi).toBeUndefined();
    // 5 zile: o masă la 12 h → nu ajunge niciodată la 72 h fără mâncare.
    const r = play(state, { type: 'tick' }, T0 + 5 * 24 * HOUR);
    expect(r.state.dinos).toHaveLength(1);
    expect(r.state.trough.ferigi).toBeUndefined(); // 6 mese în 5 zile
    expect(r.events.some((e) => e.text.includes('troacă'))).toBe(true);
    // Fără mâncare, după încă 72 h fuge.
    expect(play(r.state, { type: 'tick' }, T0 + 5 * 24 * HOUR + 80 * HOUR).state.dinos).toHaveLength(0);
  });

  it('eliberarea dă scântei, dar nu și pentru cei ocupați', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state.dinos.push({ ...state.dinos[0], id: 'd2', nickname: 'Doi' });
    state = play(state, { type: 'assignWork', dinoId: 'd2', jobId: 'culegator' }, T0).state;
    expect(() => play(state, { type: 'release', dinoId: 'd2' }, T0)).toThrow(/muncă/);
    const sparks = state.sparks;
    state = play(state, { type: 'release', dinoId }, T0).state;
    expect(state.dinos.map((d) => d.id)).toEqual(['d2']);
    expect(state.sparks).toBeGreaterThan(sparks);
  });
});

describe('misiuni și realizări', () => {
  it('3 misiuni pe zi, progres din contoare, cufăr cu serie', () => {
    let { state, dinoId } = hatchedGame('mugurel');
    state = play(state, { type: 'tick' }, T0).state;
    expect(state.daily!.quests).toHaveLength(3);
    // Facem ce cere fiecare misiune, artificial, din contoare.
    for (const id of state.daily!.quests) {
      const q = { feed5: 'feeds', gather40: 'gathers', win5: 'wins', win20: 'wins', hatch1: 'hatches', cook10: 'cooks', work20: 'work' }[id] as keyof typeof state.stats;
      state.stats[q] += 50;
      expect(questProgress(state, id)).toBeGreaterThan(0);
      state = play(state, { type: 'claimQuest', questId: id }, T0).state;
    }
    const gems = state.diamonds;
    state = play(state, { type: 'claimDailyBonus' }, T0).state;
    expect(state.streak.count).toBe(1);
    expect(state.diamonds).toBe(gems + 3);
    // Ziua următoare: misiuni noi; seria crește doar dacă iei din nou cufărul.
    state = play(state, { type: 'feed', dinoId, itemId: 'ferigi' }, T0 + 24 * HOUR).state;
    expect(state.daily!.day).toBe(dayIndex(T0) + 1);
    expect(state.daily!.claimed).toHaveLength(0);
    expect(() => play(state, { type: 'claimDailyBonus' }, T0 + 24 * HOUR)).toThrow(/Termină/);
  });

  it('realizările se iau o singură dată', () => {
    let { state } = hatchedGame('mugurel');
    expect(achievementDone(state, ACHIEVEMENTS.find((a) => a.id === 'hatch1')!)).toBe(true);
    state = play(state, { type: 'claimAchievement', achievementId: 'hatch1' }, T0).state;
    expect(() => play(state, { type: 'claimAchievement', achievementId: 'hatch1' }, T0)).toThrow(/deja/);
    expect(() => play(state, { type: 'claimAchievement', achievementId: 'gen5' }, T0)).toThrow(/Încă/);
  });

  it('rândul din spate nu e lovit cât timp cineva stă în față', () => {
    const { state } = hatchedGame('scanteius');
    const a = fromDino(state.dinos[0], 0, 1, false);
    const b = fromDino({ ...state.dinos[0], id: 'd2' }, 1, 1, true);
    const zone = findZone('jungla');
    const enemies = rollEnemies(createRng(3), zone, [a, b], false);
    const r = simulateBattle([a, b], enemies, 9);
    const hitsOnBack = r.events.filter((e) => e.t === 'attack' && e.target === b.key);
    const frontDown = r.events.findIndex((e) => e.t === 'faint' && e.target === a.key);
    for (const h of hitsOnBack) {
      expect(frontDown).toBeGreaterThanOrEqual(0);
      expect(r.events.indexOf(h)).toBeGreaterThan(frontDown);
    }
  });
});
