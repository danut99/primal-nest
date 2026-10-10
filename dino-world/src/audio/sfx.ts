// Sunete scurte, sintetizate pe loc (Web Audio): fără fișiere de descărcat. Se aud doar după o atingere a
// jucătorului (regula browserelor) și se pot opri din Setări.

export type Sfx = 'coin' | 'harvest' | 'level' | 'hatch' | 'reward' | 'error' | 'unlock';

const KEY = 'dino-world:sound';
let ctx: AudioContext | null = null;
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();

export const soundOn = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // fără stocare: setarea ține până la reîncărcare
  }
  if (on) play('coin');
}

/** O notă: frecvență (sau alunecare de la..la), început și durată în secunde. */
type Note = { f: number; to?: number; at: number; len: number; type?: OscillatorType; vol?: number };

const C5 = 523.25,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5;
const SOUNDS: Record<Sfx, Note[]> = {
  coin: [
    { f: 988, at: 0, len: 0.07, type: 'square', vol: 0.05 },
    { f: 1319, at: 0.06, len: 0.16, type: 'square', vol: 0.05 },
  ],
  harvest: [
    { f: 330, to: 520, at: 0, len: 0.12, type: 'triangle' },
    { f: 440, to: 700, at: 0.09, len: 0.14, type: 'triangle' },
  ],
  level: [
    { f: C5, at: 0, len: 0.12 },
    { f: E5, at: 0.1, len: 0.12 },
    { f: G5, at: 0.2, len: 0.12 },
    { f: C6, at: 0.3, len: 0.3 },
  ],
  hatch: [
    { f: 1200, at: 0, len: 0.03, type: 'square', vol: 0.04 },
    { f: 900, at: 0.08, len: 0.03, type: 'square', vol: 0.04 },
    { f: 600, to: 1100, at: 0.18, len: 0.22, type: 'sine', vol: 0.12 },
  ],
  reward: [
    { f: G5, at: 0, len: 0.1 },
    { f: C6, at: 0.09, len: 0.1 },
    { f: E5 * 2, at: 0.18, len: 0.28 },
  ],
  error: [{ f: 220, to: 160, at: 0, len: 0.18, type: 'sawtooth', vol: 0.04 }],
  unlock: [
    { f: 196, to: 392, at: 0, len: 0.35, type: 'triangle' },
    { f: G5, at: 0.3, len: 0.12 },
    { f: C6, at: 0.4, len: 0.35 },
  ],
};

export function play(name: Sfx) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const n of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.f, t0 + n.at);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.len);
      const vol = n.vol ?? 0.09;
      gain.gain.setValueAtTime(0.0001, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + n.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.len + 0.02);
    }
  } catch {
    // fără Web Audio: jocul merge în tăcere
  }
}
