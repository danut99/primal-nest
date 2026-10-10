// Simularea echilibrului: un jucător-robot intră la fiecare 30 de minute, de la 8:00 la 24:00, și face ce ar face
// un jucător atent (strânge, plantează, hrănește, deblochează, forjă, expediții, arenă, niveluri). Notăm când
// atinge fiecare etapă. Testul pică dacă progresia se blochează sau etapele importante vin mult prea târziu.
// Tabelul complet: `npx vitest run shared/game/economy.test.ts --silent=false --disableConsoleIntercept`.

import { expect, it } from 'vitest';
import {
  CROPS,
  ELEMENT_IDS,
  FEED_COST,
  HABITAT_EGG_PRICE,
  ITEMS,
  MAX_LEVEL,
  WORLD_UNLOCK_COST,
  buildingUpgradeCost,
  buildingUpgradeParts,
  dailyArena,
  dailyExpeditions,
  dinoPower,
  dinoUnavailable,
  farmPlots,
  BUILDINGS,
  FREE_BUILDING_SCALE,
  buildLock,
  positionError,
  hatcherySlots,
  homesFor,
  habitatCapacity,
  residents,
  matchesRequirement,
  runCommand,
  newGame,
  type Command,
  type Dino,
  type ExpeditionMission,
  type GameState,
} from './index';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 0, 5, 6); // 8:00 în România
const DAYS = 7;

function findTeam(dinos: Dino[], mission: ExpeditionMission): string[] | undefined {
  const match = (i: number, ids: string[]): string[] | undefined => {
    if (i === mission.requirements.length) return ids;
    for (const d of dinos)
      if (!ids.includes(d.id) && matchesRequirement(d, mission.requirements[i])) {
        const found = match(i + 1, [...ids, d.id]);
        if (found) return found;
      }
  };
  return match(0, []);
}

/** Cum joacă: la câte minute intră și câte ore pe zi e treaz (de la 8:00). */
type Profile = { name: string; every: number; awake: number };
const ACTIVE: Profile = { name: 'activ (la 30 min, 16 h/zi)', every: 30, awake: 16 };
const CASUAL: Profile = { name: 'ocazional (la 4 h, 16 h/zi)', every: 240, awake: 16 };

/** Un loc liber pe insula principală, cât mai aproape de mijloc. */
function freeSpot(s: GameState) {
  for (let r = 0; r < 700; r += 30)
    for (let a = 0; a < 360; a += 30) {
      const p = { x: 768 + r * Math.cos((a * Math.PI) / 180), y: 470 + 0.5 * r * Math.sin((a * Math.PI) / 180) };
      if (!positionError(s, p, FREE_BUILDING_SCALE)) return p;
    }
  return null;
}

function simulate(profile: Profile) {
  let s: GameState = newGame(START, 42);
  let now = START;
  const reached: Record<string, number> = {};
  const mark = (name: string, ok: boolean) => {
    if (ok && reached[name] === undefined) reached[name] = (now - START) / HOUR;
  };
  const errors: Record<string, Record<string, number>> = {};
  const run = (cmd: Command) => {
    const r = runCommand(s, cmd, now);
    if (r.ok) s = r.state;
    else (errors[cmd.type] ??= {})[r.error] = (errors[cmd.type]?.[r.error] ?? 0) + 1;
    return r.ok;
  };
  const upgradeNeeds = (): Record<string, number> => {
    const need: Record<string, number> = {};
    for (const b of s.buildings)
      if (buildingUpgradeCost(b) !== undefined)
        for (const [id, n] of Object.entries(buildingUpgradeParts(b))) need[id] = Math.max(need[id] ?? 0, n);
    return need;
  };

  const step = profile.every / 60;
  for (let t = 0; t < (DAYS * 24) / step; t++) {
    now = START + t * step * HOUR;
    const hour = (t * step) % 24; // ore de la 8:00
    if (hour >= profile.awake) continue; // noaptea jucătorul doarme
    const lastSession = hour + step >= profile.awake;

    run({ type: 'collectAll' });
    // ferma: plantează doar cât îi trebuie hrană (hrănirea următoare a tuturor + intrările în expediții și arenă)
    // (doar pentru următoarea hrănire, nu pentru toți deodată: altfel tot aurul s-ar duce pe semințe)
    const foodNeed = 150 + Math.max(0, ...s.dinos.map((d) => FEED_COST[d.level] ?? 0));
    for (const farm of s.buildings.filter((b) => b.kind === 'farm')) {
      run({ type: 'harvest', farmId: farm.id });
      for (let i = 0; i < farmPlots(farm).length && s.food < foodNeed; i++) {
        const order = lastSession ? ['carne', 'ginkgo', 'cicade', 'ferigi'] : ['ginkgo', 'cicade', 'ferigi'];
        for (const id of order)
          if (
            s.gold >= CROPS.find((c) => c.id === id)!.cost + 100 &&
            run({ type: 'plant', farmId: farm.id, cropId: id })
          )
            break;
      }
    }
    // lumi, ouă, eclozare
    for (const element of ELEMENT_IDS)
      if (s.gold >= WORLD_UNLOCK_COST[element] + 100) run({ type: 'unlockWorld', element });
    for (const egg of s.eggs.filter((e) => e.hatchAt <= now)) {
      const home = homesFor(s, egg.species)[0];
      if (home) run({ type: 'hatch', eggId: egg.id, habitatId: home.id });
    }
    // ouă doar pentru lumile cu loc liber (socotind și ouăle care așteaptă)
    for (const world of s.buildings.filter((b) => b.kind === 'habitat')) {
      const waiting = s.eggs.filter((e) => e.element === world.element).length;
      if (
        s.eggs.length < hatcherySlots(s) &&
        residents(s, world.id).length + waiting < habitatCapacity(world) &&
        s.gold >= HABITAT_EGG_PRICE[world.element!] + 300
      )
        run({ type: 'buyHabitatEgg', element: world.element! });
    }
    // hrană: întâi cei mai mici
    for (const d of [...s.dinos].sort((a, b) => a.level - b.level))
      if (d.level < MAX_LEVEL && s.food >= FEED_COST[d.level] + 60) run({ type: 'feed', dinoId: d.id });
    // clădirile noi, când se deblochează: avanpostul, forja, arena (așezate liber pe insulă)
    for (const kind of ['outpost', 'forge', 'arena'] as const)
      if (!s.buildings.some((b) => b.kind === kind) && !buildLock(s, kind) && s.gold >= BUILDINGS[kind].cost[0] + 100) {
        const spot = freeSpot(s);
        if (spot) run({ type: 'buildAt', kind, position: spot });
      }
    const forge = s.buildings.find((b) => b.kind === 'forge');
    if (forge) {
      run({ type: 'collectCraft', forgeId: forge.id });
      const need = upgradeNeeds();
      const want =
        Object.keys(need).find((id) => (s.items?.[id] ?? 0) < need[id] && ITEMS[id].level <= forge.level) ??
        'bone-helm';
      if (!s.buildings.find((b) => b.id === forge.id)!.craft) run({ type: 'craft', forgeId: forge.id, itemId: want });
      mark('prima piesă făurită', (s.items?.['fossil-beam'] ?? 0) > 0 || reached['lume Nv. 3'] !== undefined);
    }
    // expediții
    const outpost = s.buildings.find((b) => b.kind === 'outpost');
    if (outpost) run({ type: 'claimAdventure', buildingId: outpost.id });
    if (outpost && !s.buildings.find((b) => b.id === outpost.id)!.adventure) {
      const board = dailyExpeditions(s, now);
      for (const slot of board.slots.filter((x) => x.status === 'available')) {
        const team = findTeam(
          s.dinos.filter((d) => !dinoUnavailable(s, d, now)),
          slot.mission,
        );
        if (
          team &&
          run({
            type: 'startAdventure',
            buildingId: outpost.id,
            missionId: slot.mission.id,
            dinoIds: team,
            day: board.day,
          })
        ) {
          mark('prima expediție', true);
          break;
        }
      }
    }
    // arena: cel mai puternic luptător liber, adversarul cel mai ușor nebătut
    const arena = s.buildings.find((b) => b.kind === 'arena');
    if (arena) {
      run({ type: 'skipDuelAnimation', buildingId: arena.id });
      run({ type: 'claimAdventure', buildingId: arena.id });
    }
    if (arena && !s.buildings.find((b) => b.id === arena.id)!.adventure) {
      const board = dailyArena(s, now);
      const fighter = s.dinos.filter((d) => !dinoUnavailable(s, d, now)).sort((a, b) => dinoPower(b) - dinoPower(a))[0];
      const challenge = board.challenges.find((c) => !c.claimed);
      if (fighter && challenge)
        run({ type: 'startDuel', buildingId: arena.id, challengeId: challenge.id, dinoId: fighter.id, day: board.day });
    }
    // niveluri: întâi lumile, apoi restul
    for (const b of [...s.buildings].sort((a, b) => Number(b.kind === 'habitat') - Number(a.kind === 'habitat'))) {
      const cost = buildingUpgradeCost(b);
      if (cost !== undefined && s.gold >= cost + 100) run({ type: 'upgrade', buildingId: b.id });
    }

    const habitats = s.buildings.filter((b) => b.kind === 'habitat');
    const top = Math.max(0, ...habitats.map((b) => b.level));
    mark('prima lume', habitats.length >= 1);
    mark('a doua lume', habitats.length >= 2);
    mark('a treia lume', habitats.length >= 3);
    mark('forja construită', !!forge);
    mark(
      'avanpost construit',
      s.buildings.some((b) => b.kind === 'outpost'),
    );
    mark(
      'arenă construită',
      s.buildings.some((b) => b.kind === 'arena'),
    );
    mark('lume Nv. 2', top >= 2);
    mark('lume Nv. 3', top >= 3);
    mark('lume Nv. 4', top >= 4);
    mark(
      'fermă Nv. 3',
      s.buildings.some((b) => b.kind === 'farm' && b.level >= 3),
    );
    mark(
      'dinozaur Nv. 5',
      s.dinos.some((d) => d.level >= 5),
    );
    mark('5 dinozauri', s.dinos.length >= 5);
  }
  return { reached, s, errors };
}

function report(profile: Profile) {
  const { reached, s } = simulate(profile);
  const rows = Object.entries(reached)
    .sort((a, b) => a[1] - b[1])
    .map(([name, h]) => `  ${name.padEnd(22)} ${(h / 24).toFixed(1).padStart(4)} zile  (${h.toFixed(1)} h)`);
  console.log(
    [`Etape · jucător ${profile.name}:`, ...rows].join('\n'),
    `\n  La final: 🪙 ${s.gold} · 🍖 ${s.food} · ✦ ${s.fragments} · materiale ${JSON.stringify(s.materials)} · ${s.dinos.length} dinozauri\n`,
  );
  return reached;
}

it('an active player progresses steadily through the first week', () => {
  const reached = report(ACTIVE);
  // nu se blochează: etapele de bază vin în prima zi, cele cu forja în primele zile
  expect(reached['prima lume']).toBeLessThan(2);
  expect(reached['prima expediție']).toBeLessThan(24);
  expect(reached['forja construită']).toBeLessThan(48);
  expect(reached['lume Nv. 3']).toBeLessThan(3 * 24);
}, 30_000);

it('a casual player still reaches the forge and a level 2 world within the week', () => {
  const reached = report(CASUAL);
  expect(reached['forja construită']).toBeLessThan(5 * 24);
  // creșterea e lentă intenționat: hrănirea și lumile pline cer timp
  expect(reached['lume Nv. 2']).toBeLessThan(DAYS * 24);
}, 30_000);
