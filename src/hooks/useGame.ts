// Starea jocului în browser: salvare locală, ceas (cu „omite timpul” în dezvoltare) și comenzi.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Command,
  type CommandResult,
  type GameEvent,
  type GameState,
  GameError,
  dinosToRunAway,
  troughDue,
  loadState,
  runCommand,
} from '@shared/game';
import { sound } from '../utils/sound';

const SAVE_KEY = 'primal-nest-save-v1';
const OFFSET_KEY = 'primal-nest-dev-offset';
const LAST_SEEN_KEY = 'primal-nest-last-seen';
/** După atâta timp plecat, la întoarcere apare „Bine ai revenit”. */
const WELCOME_AFTER_MS = 15 * 60 * 1000;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Spațiu plin sau stocare blocată: jocul merge mai departe, fără salvare.
  }
}

export interface Toast extends GameEvent {
  id: number;
  error?: boolean;
}

export function useGame() {
  const [state, setState] = useState<GameState | null>(() => loadState(readJson(SAVE_KEY)));
  const [offset, setOffset] = useState<number>(() => (import.meta.env.DEV ? Number(readJson(OFFSET_KEY)) || 0 : 0));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const now = useCallback(() => Date.now() + offset, [offset]);
  const nowRef = useRef(now);
  nowRef.current = now;
  const [welcome, setWelcome] = useState<{ away: number; events: GameEvent[] } | null>(null);

  useEffect(() => {
    if (state) write(SAVE_KEY, state);
  }, [state]);

  const pushToasts = useCallback((events: (GameEvent & { error?: boolean })[]) => {
    if (!events.length) return;
    const added = events.map((e) => ({ ...e, id: ++toastId.current }));
    setToasts((t) => [...t, ...added].slice(-5));
    for (const t of added) setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), t.error ? 4500 : 3800);
  }, []);

  /** Rulează o comandă. La eroare de joc arată mesajul și întoarce null. */
  const dispatch = useCallback(
    (cmd: Command, opts: { quiet?: boolean } = {}): CommandResult | null => {
      const current = stateRef.current;
      if (!current) return null;
      try {
        const result = runCommand(current, cmd, now());
        stateRef.current = result.state;
        setState(result.state);
        if (!opts.quiet) pushToasts(result.events);
        const kinds = new Set(result.events.map((e) => e.kind));
        if (kinds.has('levelup')) sound.levelUp();
        else if (kinds.has('egg')) sound.egg();
        else if (kinds.has('reward')) sound.coin();
        return result;
      } catch (err) {
        if (err instanceof GameError) {
          sound.error();
          pushToasts([{ kind: 'warning', text: err.message, error: true }]);
          return null;
        }
        throw err;
      }
    },
    [now, pushToasts],
  );

  // „Bine ai revenit”: la pornire, dacă ai lipsit, aplicăm ce s-a întâmplat (troacă, fugari) și arătăm rezumatul.
  useEffect(() => {
    const last = Number(readJson(LAST_SEEN_KEY)) || 0;
    const away = nowRef.current() - last;
    if (stateRef.current && last && away > WELCOME_AFTER_MS) {
      const res = dispatch({ type: 'tick' }, { quiet: true });
      setWelcome({ away, events: res?.events.filter((e) => e.kind !== 'levelup') ?? [] });
    }
    const mark = () => write(LAST_SEEN_KEY, nowRef.current());
    mark();
    const id = setInterval(mark, 30_000);
    window.addEventListener('beforeunload', mark);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', mark);
    };
    // Doar la pornire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troaca și fuga se întâmplă și dacă nu apeși nimic: verificăm la pornire și o dată pe minut.
  useEffect(() => {
    const check = () => {
      const s = stateRef.current;
      if (s && (dinosToRunAway(s, now()).length || troughDue(s, now()))) dispatch({ type: 'tick' });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [dispatch, now]);

  const start = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(OFFSET_KEY);
    } catch {
      // ignorat
    }
    setOffset(0);
    setState(null);
  }, []);

  const skip = useCallback((ms: number) => {
    setOffset((o) => {
      const next = o + ms;
      write(OFFSET_KEY, next);
      return next;
    });
  }, []);

  const dismissWelcome = useCallback(() => setWelcome(null), []);

  return { state, dispatch, start, reset, now, skip, toasts, pushToasts, welcome, dismissWelcome };
}

export type Game = ReturnType<typeof useGame>;

/** Re-randează la fiecare secundă, pentru timere. */
export function useTick(ms = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
