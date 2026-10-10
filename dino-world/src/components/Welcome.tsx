// Rezumatul la revenire: după o pauză (la deschiderea jocului sau la întoarcerea în tab), ce s-a terminat cât ai
// lipsit, cu acces direct la fiecare și „Strânge tot” pentru aur și recolte.

import { useEffect, useRef, useState } from 'react';
import { farmPlots, pendingGold, type GameState } from '@shared/game';
import { formatNumber, formatTime } from './ui';
import { useNav, type NavTarget } from './nav';

/** De la cât timp de absență apare rezumatul. */
const AWAY_MS = 5 * 60_000;

type Row = { icon: string; text: string; go?: NavTarget };

function rows(s: GameState, now: number): { list: Row[]; gold: number; crops: number } {
  const list: Row[] = [];
  const gold = s.buildings.filter((b) => b.kind === 'habitat').reduce((n, b) => n + pendingGold(s, b, now), 0);
  const crops = s.buildings
    .filter((b) => b.kind === 'farm')
    .reduce((n, b) => n + farmPlots(b).filter((p) => p && p.readyAt <= now).length, 0);
  if (gold > 0) list.push({ icon: '🪙', text: `${formatNumber(gold)} aur strâns în lumi` });
  if (crops)
    list.push({
      icon: '🌾',
      text: crops === 1 ? 'O cultură e gata' : `${crops} culturi sunt gata`,
      go: { to: 'building', kind: 'farm', spot: 'harvest' },
    });
  const eggs = s.eggs.filter((e) => e.hatchAt <= now).length;
  if (eggs)
    list.push({
      icon: '🐣',
      text: eggs === 1 ? 'Un ou poate ecloza' : `${eggs} ouă pot ecloza`,
      go: { to: 'building', kind: 'hatchery', spot: 'hatch' },
    });
  for (const b of s.buildings) {
    if (b.adventure && b.adventure.readyAt <= now && (b.kind === 'outpost' || b.kind === 'arena'))
      list.push({
        icon: b.kind === 'outpost' ? '🧭' : '🏟️',
        text: b.kind === 'outpost' ? 'Expediția s-a încheiat' : 'Duelul s-a încheiat',
        go: { to: 'building', kind: b.kind, id: b.id },
      });
    if (b.kind === 'forge' && b.craft && b.craft.readyAt <= now)
      list.push({ icon: '⚒️', text: 'Forja a terminat un obiect', go: { to: 'building', kind: 'forge', id: b.id } });
  }
  if (s.breeding && s.breeding.readyAt <= now)
    list.push({ icon: '💞', text: 'Un ou nou te așteaptă în Bârlog', go: { to: 'building', kind: 'den' } });
  return { list, gold, crops };
}

export function Welcome({
  state,
  now,
  lastSeen,
  onCollectAll,
}: {
  state: GameState;
  now: number;
  lastSeen: number;
  onCollectAll: () => void;
}) {
  const nav = useNav();
  const hasWorld = state.buildings.some((b) => b.kind === 'habitat');
  // cât ai lipsit: la pornire din salvare, apoi la fiecare întoarcere în tab după o pauză
  const [away, setAway] = useState(() => (lastSeen && now - lastSeen >= AWAY_MS ? now - lastSeen : 0));
  const hiddenAt = useRef(0);
  useEffect(() => {
    const change = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current >= AWAY_MS) setAway(Date.now() - hiddenAt.current);
    };
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);

  if (!away || !hasWorld) return null;
  const { list, gold, crops } = rows(state, now);
  if (!list.length) return null;
  const close = () => setAway(0);
  return (
    <div className="reward-backdrop" onClick={close}>
      <section
        className="reward-card welcome-card"
        role="dialog"
        aria-label="Bine ai revenit"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="reward-burst" aria-hidden="true">
          🦖
        </span>
        <h2>Bine ai revenit!</h2>
        <p className="welcome-away">Ai lipsit {formatTime(away)}. Între timp:</p>
        <ul className="welcome-list">
          {list.map((r) => (
            <li key={r.text}>
              <b aria-hidden="true">{r.icon}</b>
              <span>{r.text}</span>
              {r.go && (
                <button
                  className="button small ghost"
                  onClick={() => {
                    close();
                    nav(r.go!);
                  }}
                >
                  Du-mă →
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="welcome-buttons">
          <button className="button ghost" onClick={close}>
            Mai târziu
          </button>
          {(gold > 0 || crops > 0) && (
            <button
              className="button"
              autoFocus
              onClick={() => {
                onCollectAll();
                close();
              }}
            >
              Strânge tot
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
