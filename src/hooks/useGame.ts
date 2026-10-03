// Starea jocului în browser: salvare locală, ceas (cu „omite timpul” în dezvoltare) și comenzi.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Command,
  type CommandResult,
  type GameEvent,
  type GameState,
  GameError,
  loadState,
  runCommand,
} from '@shared/game';
import { sound } from '../utils/sound';

const SAVE_KEY = 'primal-nest-save-v1';
const OFFSET_KEY = 'primal-nest-dev-offset';

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

  return { state, dispatch, start, reset, now, skip, toasts, pushToasts };
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
