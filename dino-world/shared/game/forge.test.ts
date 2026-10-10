import { expect, it } from 'vitest';
import {
  EXPEDITION_MATERIALS,
  ITEMS,
  TOTEM_MS,
  arenaStats,
  dinoIncome,
  dinoPower,
  freeSlots,
  pendingGold,
  runCommand,
  type GameState,
} from './index';
import { fillHabitat, newGameWithServices } from './test-helpers';

const NOW = 1_000_000;
function ok(state: GameState, cmd: Parameters<typeof runCommand>[1], now = NOW) {
  const r = runCommand(state, cmd, now);
  expect(r.ok, r.ok ? '' : r.error).toBe(true);
  return r.state;
}
/** Joc cu forjă construită, aur și materiale din belșug. */
function withForge() {
  let s = newGameWithServices(NOW, 1);
  s.gold = 100_000;
  s.gems = 500;
  s.fragments = 500;
  s.materials = { bone: 100, amber: 100, crystal: 100, meteor: 100 };
  s = ok(s, { type: 'build', kind: 'forge', slot: freeSlots(s, 'forge')[0].id });
  return { s, forge: s.buildings.find((b) => b.kind === 'forge')!.id };
}
function make(s: GameState, forge: string, itemId: string) {
  s = ok(s, { type: 'craft', forgeId: forge, itemId });
  s = ok(s, { type: 'collectCraft', forgeId: forge }, NOW + ITEMS[itemId].seconds * 1000);
  return s;
}

it('crafts one item at a time from gold and materials', () => {
  let { s, forge } = withForge();
  const gold = s.gold;
  s = ok(s, { type: 'craft', forgeId: forge, itemId: 'bone-helm' });
  expect(s.gold).toBe(gold - ITEMS['bone-helm'].gold);
  expect(s.materials!.bone).toBe(100 - 6);
  expect(runCommand(s, { type: 'craft', forgeId: forge, itemId: 'fertilizer' }, NOW).ok).toBe(false);
  expect(runCommand(s, { type: 'collectCraft', forgeId: forge }, NOW).ok).toBe(false);
  s = ok(s, { type: 'collectCraft', forgeId: forge }, NOW + ITEMS['bone-helm'].seconds * 1000);
  expect(s.items!['bone-helm']).toBe(1);
});

it('locks recipes behind the forge level and missing materials', () => {
  const { s, forge } = withForge();
  expect(runCommand(s, { type: 'craft', forgeId: forge, itemId: 'amber-armor' }, NOW).ok).toBe(false);
  s.materials = {};
  expect(runCommand(s, { type: 'craft', forgeId: forge, itemId: 'bone-helm' }, NOW).ok).toBe(false);
});

it('gear adds power in the arena and gold in the habitat, and comes back when the dino is sold', () => {
  let { s, forge } = withForge();
  s = make(s, forge, 'bone-helm');
  const dino = s.dinos[0];
  const power = dinoPower(dino),
    attack = arenaStats(dino).attack;
  s = ok(s, { type: 'equip', dinoId: dino.id, itemId: 'bone-helm' });
  const geared = s.dinos[0];
  expect(dinoPower(geared)).toBe(power + 12);
  expect(arenaStats(geared).attack).toBe(attack + 12);
  expect(s.items!['bone-helm']).toBe(0);
  expect(dinoIncome({ ...geared, gear: { body: 'meteor-plate' } })).toBeGreaterThan(dinoIncome(dino));
  s = ok(s, { type: 'unequip', dinoId: dino.id, slot: 'head' });
  expect(s.items!['bone-helm']).toBe(1);
});

it('big upgrades need forged parts', () => {
  let { s, forge } = withForge();
  s = ok(s, { type: 'unlockWorld', element: 'fire' });
  const world = s.buildings.find((b) => b.kind === 'habitat')!.id;
  s = ok(fillHabitat(s, world), { type: 'upgrade', buildingId: world });
  fillHabitat(s, world);
  expect(runCommand(s, { type: 'upgrade', buildingId: world }, NOW).ok).toBe(false);
  s = make(s, forge, 'fossil-beam');
  s = ok(s, { type: 'upgrade', buildingId: world });
  expect(s.items!['fossil-beam']).toBe(0);
  expect(s.buildings.find((b) => b.id === world)!.level).toBe(3);
});

it('consumables: fertilizer, elixir, warm stone and the gold totem', () => {
  let { s, forge } = withForge();
  // fertilizator
  s = make(s, forge, 'fertilizer');
  const farm = s.buildings.find((b) => b.kind === 'farm')!.id;
  s = ok(s, { type: 'plant', farmId: farm, cropId: 'carne' });
  s = ok(s, { type: 'useItem', itemId: 'fertilizer', target: { farm, plot: 0 } });
  s = ok(s, { type: 'harvest', farmId: farm });
  // elixir
  s = make(s, forge, 'elixir');
  s.dinos[0].recoveryUntil = NOW + 60_000;
  s = ok(s, { type: 'useItem', itemId: 'elixir', target: { dino: s.dinos[0].id } });
  expect(s.dinos[0].recoveryUntil).toBe(NOW);
  // totem: aur dublu cât ține
  s = make(s, forge, 'fossil-beam');
  s = make(s, forge, 'fossil-beam');
  s = ok(s, { type: 'upgrade', buildingId: forge });
  s = ok(s, { type: 'unlockWorld', element: 'fire' });
  const world = s.buildings.find((b) => b.kind === 'habitat')!;
  s = make(s, forge, 'gold-totem');
  s = ok(s, { type: 'useItem', itemId: 'gold-totem', target: { habitat: world.id } });
  const boosted = s.buildings.find((b) => b.id === world.id)!;
  const normal = { ...boosted, boost: undefined };
  const later = NOW + TOTEM_MS / 4;
  expect(pendingGold(s, boosted, later)).toBe(2 * pendingGold(s, normal, later));
});

it('a returning expedition brings forge materials, more with a crystal charm', () => {
  const claim = (charm: boolean) => {
    const { s } = withForge();
    s.materials = {};
    const outpost = s.buildings.find((b) => b.kind === 'outpost')!;
    const slot = s.expeditionBoard!.slots[0];
    const dino = s.dinos[0];
    if (charm) dino.gear = { charm: 'crystal-charm' };
    slot.status = 'active';
    outpost.adventure = {
      missionId: slot.mission.id,
      dinoIds: [dino.id],
      readyAt: NOW,
      expedition: slot.mission,
      expeditionDay: s.expeditionBoard!.day,
      slotId: slot.id,
    };
    const after = ok(s, { type: 'claimAdventure', buildingId: outpost.id });
    return { got: after.materials!, tier: slot.mission.tier };
  };
  const plain = claim(false);
  expect(plain.got).toEqual(EXPEDITION_MATERIALS[plain.tier]);
  const total = (m: Record<string, number | undefined>) => Object.values(m).reduce((n: number, x) => n + (x ?? 0), 0);
  expect(total(claim(true).got)).toBeGreaterThan(total(plain.got));
});
