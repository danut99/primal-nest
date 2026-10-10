// Starea jocului în React: salvată local, cu un ceas care bate o dată pe secundă pentru temporizatoare.
// În dev, `skip` mută ceasul înainte (ca să nu aștepți ouăle și recoltele).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensureMainBuildings,
  newGame,
  runCommand,
  speciesOf,
  ITEMS,
  MATERIALS,
  type MaterialId,
  type Command,
  type GameEvent,
  type GameState,
} from '@shared/game';
import { play, type Sfx } from '../audio/sfx';

const SAVE_KEY = 'dino-world-save-v3';
/** Ultima dată când jocul era deschis (pentru rezumatul de la revenire). */
const SEEN_KEY = 'dino-world-last-seen';
const OFFSET_KEY = 'dino-world-clock-offset';

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // fără salvare (mod privat): jocul merge în continuare
  }
};

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

function describe(e: GameEvent): string {
  if (e.type === 'arenaReward')
    return e.won
      ? `Victorie! +${e.gold} aur · +${e.medals} medalii`
      : 'Duel pierdut. Odihnește luptătorul și încearcă din nou.';
  if (e.type === 'adventureReward')
    return `Echipa s-a întors! ${[e.gold && `+${e.gold} aur`, e.food && `+${e.food} hrană`, e.gems && `+${e.gems} nestemate`, e.fragments && `+${e.fragments} fragmente`].filter(Boolean).join(' · ')}`;
  if (e.type === 'expeditionChest') return `Cufăr zilnic: +${e.fragments} fragmente · +${e.gems} nestemate`;
  switch (e.type) {
    case 'hatched':
      return `${speciesOf(e.species).name} a ieșit din ou!`;
    case 'bred':
      return `Ou nou de ${speciesOf(e.species).name} în incubator.`;
    case 'levelUp':
    case 'upgraded':
      return `Nivel ${e.level}!`;
    case 'collected':
      return `+${e.gold} aur`;
    case 'harvested':
      return `+${e.food} hrană`;
    case 'discovered':
      return `Specie nouă în Atlas: ${speciesOf(e.species).name}`;
    case 'materials':
      return `Materiale: ${Object.entries(e.materials)
        .map(([k, n]) => `${MATERIALS[k as MaterialId].icon} +${n}`)
        .join(' · ')}`;
    case 'crafted':
      return `${ITEMS[e.itemId]?.icon ?? '⚒️'} ${ITEMS[e.itemId]?.name ?? 'Obiect'} e gata!`;
    case 'reward':
      return `${e.icon} ${e.title}`;
  }
}

/** Un singur sunet pe comandă: cel al evenimentului cel mai important. */
function soundOf(cmd: Command, events: GameEvent[]): Sfx | null {
  if (cmd.type === 'unlockWorld') return 'unlock';
  const has = (t: GameEvent['type']) => events.some((e) => e.type === t);
  if (has('levelUp') || has('upgraded')) return 'level';
  if (has('hatched')) return 'hatch';
  if (events.some(isMajor)) return 'reward';
  if (has('harvested')) return 'harvest';
  if (has('collected')) return 'coin';
  return null;
}

/** O salvare citită dintr-un fișier: forma de bază trebuie să fie a unui joc, altfel null. */
export function parseSave(text: string): GameState | null {
  try {
    const s = JSON.parse(text) as Partial<GameState>;
    const ok =
      s &&
      s.version === 1 &&
      ['gold', 'food', 'gems', 'seed', 'counter'].every((k) => typeof s[k as keyof GameState] === 'number') &&
      Array.isArray(s.buildings) &&
      Array.isArray(s.dinos) &&
      Array.isArray(s.eggs) &&
      Array.isArray(s.discovered);
    return ok ? (s as GameState) : null;
  } catch {
    return null;
  }
}

/** Fereastra de recompensă: ce ai primit dintr-o singură acțiune (expediție, duel, forjă, obiectiv). */
export interface RewardPopup {
  icon: string;
  title: string;
  lines: { icon: string; value: string; label: string }[];
}

/** Nivel nou (clădire sau dinozaur): o animație scurtă, nu un mesaj. */
export interface Celebration {
  key: number;
  event: Extract<GameEvent, { type: 'levelUp' | 'upgraded' }>;
}
const isLevel = (e: GameEvent): e is Celebration['event'] => e.type === 'levelUp' || e.type === 'upgraded';

const MAJOR = new Set<GameEvent['type']>(['adventureReward', 'expeditionChest', 'crafted', 'reward', 'materials']);
const isMajor = (e: GameEvent) => MAJOR.has(e.type) || (e.type === 'arenaReward' && e.won);

/** Strânge evenimentele mari ale unei comenzi într-o singură fereastră. */
function popupOf(events: GameEvent[]): RewardPopup | null {
  const major = events.filter(isMajor);
  if (!major.length) return null;
  const lines: RewardPopup['lines'] = [];
  const add = (icon: string, n: number | undefined, label: string) => n && lines.push({ icon, value: `+${n}`, label });
  let icon = '🎁',
    title = 'Recompensă';
  for (const e of major) {
    if (e.type === 'adventureReward') {
      [icon, title] = ['🧭', 'Echipa s-a întors!'];
      add('🪙', e.gold, 'aur');
      add('🍖', e.food, 'hrană');
      add('💎', e.gems, 'nestemate');
      add('✦', e.fragments, 'fragmente');
    } else if (e.type === 'arenaReward') {
      [icon, title] = ['🏆', 'Victorie în arenă!'];
      add('🪙', e.gold, 'aur');
      add('🏅', e.medals, 'medalii');
    } else if (e.type === 'expeditionChest') {
      add('✦', e.fragments, 'fragmente · cufărul zilei');
      add('💎', e.gems, 'nestemate · cufărul zilei');
    } else if (e.type === 'crafted') {
      const item = ITEMS[e.itemId];
      [icon, title] = [item?.icon ?? '⚒️', 'Făurit!'];
      lines.push({ icon: item?.icon ?? '⚒️', value: '+1', label: item?.name ?? 'obiect' });
    } else if (e.type === 'reward') {
      [icon, title] = [e.icon, e.title];
      add('🪙', e.reward.gold, 'aur');
      add('🍖', e.reward.food, 'hrană');
      add('💎', e.reward.gems, 'nestemate');
      add('✦', e.reward.fragments, 'fragmente');
      for (const [k, n] of Object.entries(e.reward.materials ?? {}))
        add(MATERIALS[k as MaterialId].icon, n, MATERIALS[k as MaterialId].name.toLowerCase());
    } else if (e.type === 'materials') {
      for (const [k, n] of Object.entries(e.materials))
        add(MATERIALS[k as MaterialId].icon, n, MATERIALS[k as MaterialId].name.toLowerCase());
    }
  }
  return { icon, title, lines };
}

export function useGame() {
  const [offset, setOffset] = useState(() => read(OFFSET_KEY, 0));
  const clock = useCallback(() => Date.now() + offset, [offset]);
  const [now, setNow] = useState(clock);
  const [state, setState] = useState<GameState>(() =>
    ensureMainBuildings(read<GameState | null>(SAVE_KEY, null) ?? newGame(clock()), clock()),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [popup, setPopup] = useState<RewardPopup | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const nextToast = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setNow(clock());
    const timer = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(timer);
  }, [clock]);
  useEffect(() => write(SAVE_KEY, state), [state]);
  // cât timp jocul e deschis, „ultima vizită” e acum; la revenire, App citește valoarea veche înainte
  const [lastSeen] = useState(() => read<number>(SEEN_KEY, 0));
  useEffect(() => write(SEEN_KEY, now), [now]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++nextToast.current;
    setToasts((list) => [...list.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2600);
  }, []);

  /** Rulează o comandă; întoarce true dacă a reușit. Mesajele apar ca notificări. */
  const run = useCallback(
    (cmd: Command): boolean => {
      const result = runCommand(stateRef.current, cmd, clock());
      if (!result.ok) {
        toast(result.error, 'error');
        play('error');
        return false;
      }
      stateRef.current = result.state;
      setState(result.state);
      const sound = soundOf(cmd, result.events);
      if (sound) play(sound);
      const big = popupOf(result.events);
      if (big) setPopup(big);
      const level = result.events.filter(isLevel).at(-1);
      if (level) setCelebration({ key: ++nextToast.current, event: level });
      result.events.filter((e) => !isLevel(e) && (!big || !isMajor(e))).forEach((e) => toast(describe(e)));
      return true;
    },
    [clock, toast],
  );
  const reset = useCallback(() => {
    setOffset(0);
    write(OFFSET_KEY, 0);
    setState(newGame(Date.now()));
  }, []);
  /** Înlocuiește jocul cu o salvare importată (deja verificată cu parseSave). */
  const replace = useCallback(
    (next: GameState) => {
      const loaded = ensureMainBuildings(next, clock());
      stateRef.current = loaded;
      setState(loaded);
    },
    [clock],
  );
  const skip = useCallback((ms: number) => {
    setOffset((o: number) => {
      write(OFFSET_KEY, o + ms);
      return o + ms;
    });
  }, []);

  const closePopup = useCallback(() => setPopup(null), []);
  const endCelebration = useCallback(() => setCelebration(null), []);
  return {
    state,
    now,
    lastSeen,
    run,
    toasts,
    toast,
    reset,
    replace,
    skip,
    popup,
    closePopup,
    celebration,
    endCelebration,
  };
}

export type Game = ReturnType<typeof useGame>;
