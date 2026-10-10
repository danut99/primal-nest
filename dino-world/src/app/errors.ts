// Erorile jocului: ultimele câteva se țin în browser, ca jucătorul să le poată trimite într-un raport
// („Trimite o problemă” din Setări sau ecranul „Ceva n-a mers”). Nimic nu pleacă singur din browser.

const LOG_KEY = 'dino-world:errors';
const SAVE_KEY = 'dino-world-save-v3';
const MAX = 15;

export interface LoggedError {
  at: string;
  message: string;
  stack?: string;
}

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as LoggedError[];
  } catch {
    return [];
  }
}

export function logError(error: unknown, extra?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const entry: LoggedError = {
    at: new Date().toISOString(),
    message: e.message,
    stack: [e.stack, extra].filter(Boolean).join('\n').split('\n').slice(0, 12).join('\n'),
  };
  try {
    const list = readErrors();
    // aceeași eroare repetată (ex. la fiecare cadru) ocupă un singur loc
    if (list.at(-1)?.message === entry.message) list.pop();
    localStorage.setItem(LOG_KEY, JSON.stringify([...list, entry].slice(-MAX)));
  } catch {
    // fără stocare: raportul va avea doar ce scrie jucătorul
  }
}

export const clearErrors = () => {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // vezi mai sus
  }
};

/** Erorile din afara React (evenimente, promisiuni, cod încărcat la cerere). */
export function watchErrors() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError(e.reason));
}

/** Salvarea din browser, ca text (null = nu există). Citită direct, merge și când interfața a căzut. */
export function savedGame(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function downloadSave(): boolean {
  const text = savedGame();
  if (!text) return false;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dino-world-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Raportul: ce a scris jucătorul, dispozitivul și ultimele erori. Fără salvarea întreagă (e mare). */
export function buildReport(note: string): string {
  let summary = 'fără salvare';
  try {
    const s = JSON.parse(savedGame() ?? 'null');
    if (s)
      summary = `${s.dinos?.length ?? 0} dinozauri · ${s.buildings?.filter((b: { kind: string }) => b.kind === 'habitat').length ?? 0} lumi · obiective ${s.goalsClaimed?.length ?? 0}`;
  } catch {
    summary = 'salvare ilizibilă';
  }
  const errors = readErrors();
  return [
    note.trim() || '(fără descriere)',
    '',
    '---',
    `Versiune: ${__APP_VERSION__}`,
    `Data: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Ecran: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    `Joc: ${summary}`,
    '',
    errors.length ? `Erori recente (${errors.length}):` : 'Erori recente: niciuna',
    ...errors.map((e) => `[${e.at}] ${e.message}\n${e.stack ?? ''}`),
  ].join('\n');
}

/**
 * Unde pleacă raportul: VITE_REPORT_EMAIL (se deschide aplicația de e-mail) sau VITE_REPORT_URL (un formular),
 * din .env. Fără ele, raportul doar se copiază, iar jucătorul îl trimite cum vrea.
 */
export const REPORT_EMAIL = import.meta.env.VITE_REPORT_EMAIL as string | undefined;
export const REPORT_URL = import.meta.env.VITE_REPORT_URL as string | undefined;

/** Trimite (sau copiază) raportul; întoarce ce s-a întâmplat, pentru mesajul afișat. */
export async function sendReport(note: string): Promise<'mail' | 'form' | 'copied' | 'failed'> {
  const text = buildReport(note);
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // fără clipboard: e-mailul sau formularul primesc textul oricum
  }
  if (REPORT_EMAIL) {
    // linkurile mailto lungi sunt tăiate de unele aplicații: corpul are cel mult ~1800 de caractere
    const body = encodeURIComponent(text.slice(0, 1800));
    window.location.href = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent('Dino World · problemă')}&body=${body}`;
    return 'mail';
  }
  if (REPORT_URL) {
    window.open(REPORT_URL, '_blank', 'noopener');
    return 'form';
  }
  return copied ? 'copied' : 'failed';
}
