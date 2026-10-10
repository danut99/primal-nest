// „Du-mă acolo”: un loc din joc (o clădire, o insulă, un tab din Extinde, un articol din Wikipedia) și,
// opțional, elementul de evidențiat acolo (`[data-tour=spot]`). Obiectivele, rezumatul la revenire și mesajele
// „Îți lipsesc…” folosesc aceeași navigare, din App.

import { createContext, useContext } from 'react';
import type { BuildingKind, ElementId } from '@shared/game';

export type ShopTab = 'worlds' | 'eggs' | 'buildings';
export type NavTarget = { spot?: string } & (
  | { to: 'building'; kind: BuildingKind; id?: string }
  | { to: 'island'; element: ElementId }
  | { to: 'shop'; tab: ShopTab }
  | { to: 'wiki'; article: string }
  | { to: 'atlas' }
);

const NavContext = createContext<(t: NavTarget) => void>(() => undefined);
export const NavProvider = NavContext.Provider;
export const useNav = () => useContext(NavContext);

let pending = 0;
/**
 * Evidențiază `[data-tour=spot]` câteva secunde. Elementul poate apărea abia după ce se deschide panoul sau
 * ajunge camera: se caută la fiecare cadru, cel mult 4 s.
 */
export function spotlight(spot: string) {
  const ticket = ++pending;
  const started = performance.now();
  const find = () => {
    if (ticket !== pending) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${spot}"]`);
    if (!el || !el.getClientRects().length) {
      if (performance.now() - started < 4000) requestAnimationFrame(find);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('spotlight');
    void el.offsetWidth;
    el.classList.add('spotlight');
    setTimeout(() => el.classList.remove('spotlight'), 3600);
  };
  requestAnimationFrame(find);
}
