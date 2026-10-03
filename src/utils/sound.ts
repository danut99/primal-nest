// Efecte sonore sintetizate (fără fișiere audio). Se pot opri din bara de sus.

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('primal-nest-muted') === '1';
  } catch {
    return false;
  }
})();

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    // Fără audio disponibil.
  }
}

export const sound = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('primal-nest-muted', muted ? '1' : '0');
    } catch {
      // ignorat
    }
    return muted;
  },
  click: () => tone(660, 0, 0.06, 'triangle', 0.05),
  coin: () => {
    tone(988, 0, 0.08);
    tone(1319, 0.08, 0.16);
  },
  egg: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.14, 'triangle', 0.07)),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.16, 'square', 0.05)),
  hatch: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.22, 'triangle', 0.08)),
  crack: () => tone(180, 0, 0.08, 'sawtooth', 0.05),
  hit: () => tone(140, 0, 0.12, 'sawtooth', 0.06),
  bigHit: () => {
    tone(110, 0, 0.18, 'sawtooth', 0.08);
    tone(70, 0.05, 0.2, 'square', 0.05);
  },
  win: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.12, 0.2, 'square', 0.06)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.24, 'triangle', 0.06)),
  error: () => tone(200, 0, 0.12, 'square', 0.04),
};
