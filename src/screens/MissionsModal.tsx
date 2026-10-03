// Misiunile zilnice (cu cufărul zilei și seria) și realizările, într-o fereastră deschisă din bara de sus.

import { useState } from 'react';
import {
  ACHIEVEMENTS,
  type GameState,
  achievementDone,
  achievementValue,
  dayIndex,
  findQuest,
  questProgress,
  streakBonus,
} from '@shared/game';
import { Bar, Modal } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration } from '../utils/format';

/** Câte răsplăți așteaptă să fie luate (pentru bulina din bara de sus). */
export function claimableCount(state: GameState): number {
  const d = state.daily;
  const quests = d ? d.quests.filter((id) => !d.claimed.includes(id) && questProgress(state, id) >= findQuest(id).goal).length : 0;
  const bonus = d && !d.bonusClaimed && d.claimed.length === d.quests.length ? 1 : 0;
  const ach = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && achievementDone(state, a)).length;
  return quests + bonus + ach;
}

export function MissionsModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<'daily' | 'ach'>('daily');
  const state = game.state!;
  const now = game.now();
  const daily = state.daily;
  const resetIn = (dayIndex(now) + 1) * 24 * 3600 * 1000 - now;
  const streakAlive = state.streak.lastDay >= dayIndex(now) - 1;
  const nextStreak = state.streak.lastDay === dayIndex(now) - 1 ? state.streak.count + 1 : state.streak.lastDay === dayIndex(now) ? state.streak.count : 1;
  const allDone = !!daily && daily.claimed.length === daily.quests.length;

  return (
    <Modal onClose={onClose} className="missions-modal">
      <h2>📜 Misiuni</h2>
      <div className="tabs small-tabs">
        <button className={`tab${tab === 'daily' ? ' active' : ''}`} onClick={() => setTab('daily')}>
          Zilnice
        </button>
        <button className={`tab${tab === 'ach' ? ' active' : ''}`} onClick={() => setTab('ach')}>
          Realizări {state.achievements.length}/{ACHIEVEMENTS.length}
        </button>
      </div>

      {tab === 'daily' ? (
        <>
          <div className="streak-row">
            <span className="streak-fire">🔥</span>
            <div className="grow">
              <b>Serie: {streakAlive ? state.streak.count : 0} {state.streak.count === 1 ? 'zi' : 'zile'}</b>
              <small className="muted">Termină toate misiunile zilnic: cufărul crește până la ziua 7.</small>
            </div>
            <small className="muted">Misiuni noi în {formatDuration(resetIn)}</small>
          </div>
          {!daily ? (
            <p className="empty-state">Misiunile apar la prima acțiune de azi.</p>
          ) : (
            <div className="quest-list">
              {daily.quests.map((id) => {
                const q = findQuest(id);
                const p = questProgress(state, id);
                const claimed = daily.claimed.includes(id);
                return (
                  <div key={id} className={`quest${claimed ? ' claimed' : p >= q.goal ? ' ready' : ''}`}>
                    <span className="quest-icon">{q.icon}</span>
                    <div className="grow">
                      <b>{q.title}</b>
                      <Bar value={p} max={q.goal} color="#7bc66b" thin label={`${p}/${q.goal}`} />
                    </div>
                    {claimed ? (
                      <span className="quest-done">✓</span>
                    ) : (
                      <button className="btn small primary" disabled={p < q.goal} onClick={() => game.dispatch({ type: 'claimQuest', questId: id })}>
                        +{q.sparks} ✨ · +{q.diamonds} 💎
                      </button>
                    )}
                  </div>
                );
              })}
              <div className={`daily-chest${allDone && !daily.bonusClaimed ? ' ready' : ''}`}>
                <span className="chest-icon">{daily.bonusClaimed ? '📭' : '🎁'}</span>
                <div className="grow">
                  <b>Cufărul zilei</b>
                  <small className="muted">
                    {daily.bonusClaimed ? 'Luat azi. Revino mâine pentru serie!' : `Toate cele ${daily.quests.length} misiuni → +${streakBonus(nextStreak)} 💎 (ziua ${nextStreak})`}
                  </small>
                </div>
                {!daily.bonusClaimed && (
                  <button className="btn small primary" disabled={!allDone} onClick={() => game.dispatch({ type: 'claimDailyBonus' })}>
                    Deschide
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = state.achievements.includes(a.id);
            const done = achievementDone(state, a);
            const value = Math.min(a.goal, achievementValue(state, a));
            return (
              <div key={a.id} className={`ach${got ? ' got' : done ? ' ready' : ''}`}>
                <span className="ach-icon">{a.icon}</span>
                <b>{a.title}</b>
                <small className="muted">{a.text}</small>
                {got ? (
                  <span className="quest-done">✓ +{a.diamonds} 💎</span>
                ) : done ? (
                  <button className="btn tiny primary" onClick={() => game.dispatch({ type: 'claimAchievement', achievementId: a.id })}>
                    Ia +{a.diamonds} 💎
                  </button>
                ) : (
                  <Bar value={value} max={a.goal} color="#c79bff" thin label={`${value}/${a.goal}`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
