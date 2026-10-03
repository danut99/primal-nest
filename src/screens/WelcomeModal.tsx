// „Cât ai lipsit”: la întoarcere, tot ce te așteaptă, cu scurtături spre ecranul potrivit.

import { type GameEvent, eggsInNest, readyCount, runawayIn, workReady } from '@shared/game';
import type { Screen } from '../app/App';
import { Modal, Saurok } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration } from '../utils/format';
import { claimableCount } from './MissionsModal';

interface Line {
  icon: string;
  text: string;
  screen?: Screen;
  warn?: boolean;
}

export function WelcomeModal({ game, away, events, onGo, onMissions, onClose }: {
  game: Game;
  away: number;
  events: GameEvent[];
  onGo: (s: Screen) => void;
  onMissions: () => void;
  onClose: () => void;
}) {
  const state = game.state!;
  const now = game.now();
  const lines: Line[] = [];

  // Ce s-a întâmplat singur cât ai lipsit (troaca, fugarii).
  for (const e of events) {
    // Mesajele de joc încep deja cu o iconiță (🥣 …); n-o dublăm.
    const icon = e.kind === 'warning' ? '💔' : e.text.startsWith('🥣') ? '🥣' : '🌙';
    lines.push({ icon, text: e.text.replace(/^🥣\s*/, ''), screen: 'haita', warn: e.kind === 'warning' });
  }

  const eggs = eggsInNest(state).filter((e) => e.incubation!.endsAt <= now).length;
  if (eggs) lines.push({ icon: '🐣', text: `${eggs} ${eggs === 1 ? 'ou e gata' : 'ouă sunt gata'} să eclozeze.`, screen: 'cuib' });
  if (state.activity) {
    const n = readyCount(state.activity, now);
    if (n > 0) lines.push({ icon: '⛏️', text: `Activitatea ta are ${n} ${state.activity.kind === 'expedition' ? 'lupte' : 'bucăți'} de revendicat.`, screen: 'activitati' });
  }
  const work = state.workers.reduce((sum, w) => sum + workReady(state, w, now), 0);
  if (work) lines.push({ icon: '🦖', text: `Haita a strâns ${work} bucăți la muncă.`, screen: 'activitati' });
  if (state.breeding && state.breeding.endsAt <= now) lines.push({ icon: '💞', text: 'Oul din Bârlog e gata!', screen: 'barlog' });
  const molts = state.dinos.filter((d) => d.molt && d.molt.endsAt <= now).length;
  if (molts) lines.push({ icon: '✨', text: `${molts} ${molts === 1 ? 'năpârlire s-a terminat' : 'năpârliri s-au terminat'}.`, screen: 'haita' });
  const hungry = state.dinos.filter((d) => runawayIn(d, now) !== null).length;
  if (hungry) lines.push({ icon: '😟', text: `${hungry} ${hungry === 1 ? 'dinozaur e flămând' : 'dinozauri sunt flămânzi'}. Hrănește-i înainte să fugă!`, screen: 'haita', warn: true });
  const rewards = claimableCount(state);

  return (
    <Modal onClose={onClose} className="welcome-modal">
      <div className="speech">
        <Saurok size={60} />
        <div>
          <h2>Bine ai revenit, {state.playerName}!</h2>
          <p className="muted">Ai lipsit {formatDuration(away)}. Iată ce te așteaptă:</p>
        </div>
      </div>
      {lines.length === 0 && rewards === 0 ? (
        <p className="empty-state">Liniște în tabără. Totul merge cum trebuie. 🌿</p>
      ) : (
        <div className="welcome-list">
          {lines.map((l, i) => (
            <button key={i} className={`welcome-line${l.warn ? ' warn' : ''}`} onClick={() => l.screen && onGo(l.screen)}>
              <span>{l.icon}</span>
              <span className="grow">{l.text}</span>
              {l.screen && <span className="muted">→</span>}
            </button>
          ))}
          {rewards > 0 && (
            <button className="welcome-line" onClick={onMissions}>
              <span>📜</span>
              <span className="grow">
                {rewards} {rewards === 1 ? 'răsplată te așteaptă' : 'răsplăți te așteaptă'} la Misiuni.
              </span>
              <span className="muted">→</span>
            </button>
          )}
        </div>
      )}
      <button className="btn primary" onClick={onClose}>
        Hai la joc
      </button>
    </Modal>
  );
}
