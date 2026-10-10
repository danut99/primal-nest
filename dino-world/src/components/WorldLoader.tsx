// Ecranul de încărcare al lumii: la prima vizită (sau după o versiune nouă) acoperă tot până când insulele,
// clădirile și dinozaurii animați sunt gata, apoi dispare lin. Când fișierele sunt deja în cache (F5), nu apare
// deloc: lumea se vede direct, iar dinozaurii intră cu fade. Decizia o ia scriptul din index.html (clasa `warm`).

/** Versiunea aplicației = scriptul principal (în producție are hash în nume). */
function appVersion() {
  const scripts = document.querySelectorAll('script[type="module"][src]');
  return scripts.length ? (scripts[scripts.length - 1].getAttribute('src') ?? '').split('?')[0] : null;
}
const warm = typeof document !== 'undefined' && document.documentElement.classList.contains('warm');

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Dacă ceva se blochează (rețea, WebGL), lumea se deschide oricum după atât. */
const GIVE_UP_MS = 10_000;

export function WorldLoader({ done, total, ready }: { done: number; total: number; ready: boolean }) {
  const [gaveUp, setGaveUp] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading');
  useEffect(() => {
    // ecranul identic din index.html (vizibil înainte de JS) nu mai e necesar
    document.getElementById('boot-loader')?.remove();
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready && !gaveUp) return;
    // a doua oară fișierele vin din cache: fără ecran de încărcare
    const version = appVersion();
    try {
      if (version) localStorage.setItem('dino-world-warm', version);
    } catch {
      // fără localStorage: ecranul apare la fiecare încărcare
    }
  }, [ready, gaveUp]);
  useEffect(() => {
    if (phase !== 'loading' || !(ready || gaveUp)) return;
    // un cadru în plus, ca dinozaurii să fie deja desenați sub ecran când începe să dispară
    const t = requestAnimationFrame(() => setPhase('leaving'));
    return () => cancelAnimationFrame(t);
  }, [ready, gaveUp, phase]);
  useEffect(() => {
    if (phase !== 'leaving') return;
    // fără tranziții (reduce motion) nu vine `transitionend`
    const t = setTimeout(() => setPhase('gone'), 300);
    return () => clearTimeout(t);
  }, [phase]);
  if (warm || phase === 'gone') return null;
  const pct = Math.round((100 * Math.min(done, total)) / Math.max(1, total));
  return createPortal(
    <div
      className={`world-loader ${phase === 'leaving' ? 'leaving' : ''}`}
      role="status"
      aria-live="polite"
      onTransitionEnd={(e) => e.target === e.currentTarget && phase === 'leaving' && setPhase('gone')}
    >
      <div className="world-loader-card">
        <h1 className="world-loader-title">Dino World</h1>
        <p className="world-loader-text">Se încarcă lumea…</p>
        <div className="world-loader-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="world-loader-pct">{pct}%</p>
      </div>
    </div>,
    document.body,
  );
}
