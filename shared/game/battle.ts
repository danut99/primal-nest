// Lupta pe ture, deterministă: același seed și aceeași haită dau exact același jurnal.
// Interfața redă jurnalul ca animație; regulile nu depind de animație.

import { BACK_ROW_DAMAGE, MAX_BATTLE_ROUNDS, SPECIAL_COOLDOWN, SPECIES, WILD_STAT_MULT, ZONES, effectiveness, type Move, type Zone } from './catalog';
import { computeStats } from './creatures';
import { GameError } from './errors';
import { type Rng, createRng, pick, randInt } from './rng';
import type { Dino, DinoType, Temperament, Variant } from './types';

export interface Combatant {
  key: string; // p0, p1, e0…
  side: 'player' | 'enemy';
  dinoId?: string;
  speciesId: string;
  name: string;
  level: number;
  types: DinoType[];
  variant: Variant;
  atk: number;
  def: number;
  spd: number;
  hpMax: number;
  hp: number;
  cooldown: number;
  boss?: boolean;
  /** În rândul din spate: ferit cât timp cineva stă în față, dar lovește mai slab. */
  back?: boolean;
}

export type BattleEvent =
  | { t: 'attack'; actor: string; target: string; move: string; moveType: DinoType | null; special: boolean; damage: number; eff: number; crit: boolean; hp: number }
  | { t: 'faint'; target: string }
  | { t: 'end'; win: boolean };

export interface BattleResult {
  win: boolean;
  rounds: number;
  start: Combatant[];
  events: BattleEvent[];
}

export function fromDino(dino: Dino, index: number, relicLevel = 1, back = false): Combatant {
  const stats = computeStats(dino, relicLevel);
  const s = SPECIES[dino.speciesId];
  // Atașamentul contează și în luptă: până la +10% la toate statisticile.
  const bond = 1 + dino.bond / 1000;
  const hp = Math.round(stats.hp * bond);
  return {
    key: `p${index}`,
    side: 'player',
    dinoId: dino.id,
    speciesId: dino.speciesId,
    name: dino.nickname,
    level: dino.level,
    types: s.types,
    variant: dino.variant,
    atk: Math.round(stats.atk * bond),
    def: Math.round(stats.def * bond),
    spd: Math.round(stats.spd * bond),
    hpMax: hp,
    hp,
    cooldown: 1,
    ...(back ? { back: true } : {}),
  };
}

const TEMPERAMENT_LIST: Temperament[] = ['fioros', 'calm', 'agitat'];

export function wildCombatant(rng: Rng, speciesId: string, level: number, index: number, hpMult = 1, power = WILD_STAT_MULT): Combatant {
  const s = SPECIES[speciesId];
  const stats = computeStats({
    speciesId,
    level,
    genes: { hp: randInt(rng, 0, 15), atk: randInt(rng, 0, 15), def: randInt(rng, 0, 15), spd: randInt(rng, 0, 15) },
    temperament: pick(rng, TEMPERAMENT_LIST),
  });
  // Sălbaticii sunt neantrenați: mai slabi decât un dino crescut. Boșii nu.
  const wild = hpMult > 1 ? 1 : power;
  const hpMax = Math.round(stats.hp * hpMult * wild);
  return {
    key: `e${index}`,
    side: 'enemy',
    speciesId,
    name: `${s.name} umbrit`,
    level,
    types: s.types,
    variant: 'normal',
    atk: Math.round(stats.atk * wild),
    def: Math.round(stats.def * wild),
    spd: stats.spd,
    hpMax,
    hp: hpMax,
    cooldown: 2,
    boss: hpMult > 1,
  };
}

/**
 * Inamicii unei lupte. Niciodată mai mulți decât haita, iar nivelul urcă odată cu haita,
 * în limitele zonei: zona rămâne provocare, dar nu zid.
 */
export function rollEnemies(rng: Rng, zone: Zone, party: Combatant[], firstBattles: boolean, alpha = false): Combatant[] {
  if (alpha) {
    const a = wildCombatant(rng, zone.alpha.speciesId, zone.alpha.level, 0, zone.alpha.hpMult);
    return [{ ...a, name: `${SPECIES[zone.alpha.speciesId].name}, ${zone.alpha.title}` }];
  }
  // Prima luptă e blândă: un singur pui sălbatic, slăbit, la nivelul minim al zonei.
  const count = firstBattles ? 1 : Math.min(party.length, randInt(rng, zone.count[0], zone.count[1]));
  const top = Math.max(1, ...party.map((c) => c.level));
  const maxLevel = Math.max(zone.levels[0], Math.min(zone.levels[1], top + 1));
  return Array.from({ length: Math.max(1, count) }, (_, i) =>
    firstBattles
      ? wildCombatant(rng, pick(rng, zone.enemies), zone.levels[0], i, 1, 0.5)
      : wildCombatant(rng, pick(rng, zone.enemies), randInt(rng, zone.levels[0], maxLevel), i),
  );
}

function moveOf(c: Combatant, special: boolean): Move {
  const s = SPECIES[c.speciesId];
  return special ? s.special : s.basic;
}

function damage(rng: Rng, attacker: Combatant, defender: Combatant, move: Move) {
  const eff = effectiveness(move.type, defender.types);
  const stab = move.type && attacker.types.includes(move.type) ? 1.2 : 1;
  const crit = rng() < 1 / 16;
  const base = (((2 * attacker.level) / 5 + 2) * move.power * (attacker.atk / defender.def)) / 50 + 2;
  const roll = 0.85 + rng() * 0.15;
  const row = attacker.back ? BACK_ROW_DAMAGE : 1;
  return { damage: Math.max(1, Math.floor(base * eff * stab * row * (crit ? 1.5 : 1) * roll)), eff, crit };
}

/** Ținta: cea cu cel mai bun avantaj de tip, apoi cea mai slăbită. */
function chooseTarget(foes: Combatant[], move: Move): Combatant {
  // Cei din spate sunt feriți cât timp mai stă cineva în față.
  const front = foes.filter((f) => !f.back);
  return (front.length ? front : foes).reduce((best, f) => {
    const eb = effectiveness(move.type, best.types);
    const ef = effectiveness(move.type, f.types);
    if (ef !== eb) return ef > eb ? f : best;
    return f.hp < best.hp ? f : best;
  });
}

export function simulateBattle(players: Combatant[], enemies: Combatant[], seed: number): BattleResult {
  if (players.length === 0) throw new GameError('VALIDATION', 'Haita e goală. Alege cel puțin un dinozaur.');
  const rng = createRng(seed);
  const all = [...players, ...enemies].map((c) => ({ ...c }));
  const start = all.map((c) => ({ ...c }));
  const events: BattleEvent[] = [];
  const alive = (side: Combatant['side']) => all.filter((c) => c.side === side && c.hp > 0);

  let rounds = 0;
  while (rounds < MAX_BATTLE_ROUNDS && alive('player').length && alive('enemy').length) {
    rounds++;
    const order = all.filter((c) => c.hp > 0).sort((a, b) => b.spd - a.spd || (a.side === 'player' ? -1 : 1));
    for (const actor of order) {
      if (actor.hp <= 0) continue;
      const foes = alive(actor.side === 'player' ? 'enemy' : 'player');
      if (!foes.length) break;
      const special = actor.cooldown <= 0;
      const move = moveOf(actor, special);
      actor.cooldown = special ? SPECIAL_COOLDOWN : actor.cooldown - 1;
      const target = chooseTarget(foes, move);
      const hit = damage(rng, actor, target, move);
      target.hp = Math.max(0, target.hp - hit.damage);
      events.push({ t: 'attack', actor: actor.key, target: target.key, move: move.name, moveType: move.type, special, ...hit, hp: target.hp });
      if (target.hp === 0) events.push({ t: 'faint', target: target.key });
    }
  }
  const win = alive('enemy').length === 0 && alive('player').length > 0;
  events.push({ t: 'end', win });
  return { win, rounds, start, events };
}

export function findZone(zoneId: string): Zone {
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) throw new GameError('NOT_FOUND', 'Zonă necunoscută.');
  return zone;
}
