// Plasa de siguranță: o eroare în interfață nu mai lasă ecranul alb. Jucătorul vede „Ceva n-a mers”, își poate
// descărca salvarea (citită direct din browser), poate trimite raportul și reîncarcă jocul.

import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { REPORT_EMAIL, REPORT_URL, downloadSave, logError, savedGame, sendReport } from './errors';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info.componentStack ?? undefined);
  }
  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}

function CrashScreen() {
  const hasSave = !!savedGame();
  return (
    <div className="crash">
      <section className="crash-card" role="alertdialog" aria-label="Ceva n-a mers">
        <span className="crash-icon" aria-hidden="true">
          🦕
        </span>
        <h1>Ceva n-a mers</h1>
        <p>
          Jocul a întâlnit o eroare. {hasSave ? 'Progresul tău e salvat în acest browser' : 'Nu am găsit o salvare'}
          {hasSave && '; reîncarcă și continui de unde ai rămas'}.
        </p>
        <div className="crash-buttons">
          <button className="button" onClick={() => window.location.reload()} autoFocus>
            ↻ Reîncarcă
          </button>
          {hasSave && (
            <button className="button ghost" onClick={downloadSave}>
              ⬇ Descarcă salvarea
            </button>
          )}
        </div>
        <ReportForm compact />
      </section>
    </div>
  );
}

/** „Trimite o problemă”: o descriere scurtă, plus detaliile tehnice adăugate automat. */
export function ReportForm({ compact }: { compact?: boolean }) {
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const messages = {
    mail: 'S-a deschis aplicația de e-mail cu raportul. Apasă Trimite acolo.',
    form: 'S-a deschis formularul. Raportul e copiat: lipește-l acolo.',
    copied: 'Raportul e copiat. Trimite-l dezvoltatorului (mesaj sau e-mail).',
    failed: 'Nu am putut copia raportul. Fă o captură de ecran și descrie ce s-a întâmplat.',
  };
  return (
    <div className={`report ${compact ? 'compact' : ''}`}>
      {!compact && (
        <p className="settings-note">
          Spune pe scurt ce făceai și ce nu a mers. Adăugăm automat versiunea jocului, browserul și ultimele erori (fără
          salvarea întreagă și fără date personale).
        </p>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          compact ? 'Ce făceai când a apărut eroarea? (opțional)' : 'Ex.: Am apăsat Eclozează și nu s-a întâmplat nimic'
        }
        rows={compact ? 2 : 3}
      />
      <button className="button small" onClick={() => void sendReport(note).then((r) => setResult(messages[r]))}>
        {REPORT_EMAIL ? '✉️ Trimite raportul' : REPORT_URL ? '📝 Deschide formularul' : '📋 Copiază raportul'}
      </button>
      {result && <small className="report-result">{result}</small>}
    </div>
  );
}
