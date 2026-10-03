// Setări locale ale jucătorului. Efectele de sânge se pot opri, ca în Dinoblade.

const BLOOD_KEY = 'primal-nest-blood';

export function bloodEnabled(): boolean {
  try {
    return localStorage.getItem(BLOOD_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setBloodEnabled(on: boolean) {
  try {
    localStorage.setItem(BLOOD_KEY, on ? '1' : '0');
  } catch {
    // Stocare blocată: setarea rămâne doar pentru sesiunea curentă.
  }
}

const FX_KEY = 'primal-nest-low-fx';

/** Grafică redusă: implicit pornită pe dispozitivele cu puține nuclee. */
export function lowFxEnabled(): boolean {
  try {
    const saved = localStorage.getItem(FX_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    // ignorat: decidem după dispozitiv
  }
  return (navigator.hardwareConcurrency ?? 8) <= 4;
}

export function setLowFxEnabled(on: boolean) {
  try {
    localStorage.setItem(FX_KEY, on ? '1' : '0');
  } catch {
    // Stocare blocată: setarea rămâne doar pentru sesiunea curentă.
  }
}

export function applyLowFx(on: boolean) {
  document.documentElement.classList.toggle('low-fx', on);
}
