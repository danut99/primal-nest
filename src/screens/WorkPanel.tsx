import { ControlIcon, ThemeText } from '../components/ThemeText';
import { ItemArt } from '../components/AssetIcon';
// Haita la muncă: posturile din Tabără, unde dinozaurii lucrează în paralel cu activitatea ta.

import { useState } from 'react';
import {
  type Dino,
  ITEMS,
  PROPERTY_LEVELS,
  SPECIES,
  TYPES,
  WORK_CAP_SECONDS,
  WORK_JOBS,
  type WorkJob,
  findJob,
  jobAffinity,
  workReady,
  workSeconds,
  workSlots,
  workSpeed,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { Modal, Panel } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatSeconds } from '../utils/format';

const MAX_POSTS = Math.max(...PROPERTY_LEVELS.map((l) => l.workSlots));

export function WorkPanel({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  const slots = workSlots(state);
  const [picking, setPicking] = useState(false);
  const ready = state.workers.reduce((sum, w) => sum + workReady(state, w, now), 0);

  return (
    <Panel
      title="Haita la muncă"
      icon="🦖"
      className="work-panel"
      right={
        <button className="btn small primary" disabled={ready === 0} onClick={() => game.dispatch({ type: 'collectWork' })}><ThemeText>{"\r\n          🧺 Strânge"}</ThemeText><ThemeText>{ready > 0 ? ` (${ready})` : ''}</ThemeText>
        </button>
      }
    >
      <p className="muted small">
        Dinozaurii lucrează în paralel cu tine, chiar și offline (maximum 8 ore). Tipul potrivit lucrează cu +50% mai repede.
      </p>
      <div className="work-grid">
        {Array.from({ length: MAX_POSTS }, (_, i) => {
          const worker = state.workers[i];
          if (worker) {
            const dino = state.dinos.find((d) => d.id === worker.dinoId)!;
            const job = findJob(worker.jobId);
            const dur = workSeconds(dino, job) * 1000;
            const n = workReady(state, worker, now);
            const elapsed = Math.max(0, now - worker.startedAt);
            const pct = elapsed >= WORK_CAP_SECONDS * 1000 ? 100 : ((elapsed % dur) / dur) * 100;
            return (
              <div key={worker.dinoId} className="work-post busy">
                <div className="work-job">
                  <span><ThemeText>{job.icon}</ThemeText></span> <ThemeText>{job.name}</ThemeText>
                </div>
                <div className="work-dino">
                  <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={72} className="bob" />
                  {n > 0 && <span className="work-ready"><ThemeText>{n}</ThemeText></span>}
                </div>
                <b><ThemeText>{dino.nickname}</ThemeText></b>
                <small className="muted">
                  Nv. <ThemeText>{dino.level}</ThemeText> · ×<ThemeText>{workSpeed(dino, job).toFixed(2)}</ThemeText> {jobAffinity(dino, job) && <span className="work-fit">tip potrivit</span>}
                </small>
                <div className="work-progress">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <small className="muted">o bucată la <ThemeText>{formatSeconds(Math.round(dur / 1000))}</ThemeText></small>
                <button className="btn tiny" onClick={() => game.dispatch({ type: 'unassignWork', dinoId: dino.id })}><ThemeText>{"\r\n                  🏠 Cheamă acasă\r\n                "}</ThemeText></button>
              </div>
            );
          }
          if (i < slots) {
            return (
              <button key={`free${i}`} className="work-post free" onClick={() => setPicking(true)}>
                <span className="work-plus"><ControlIcon glyph="+" /></span>
                <b>Post liber</b>
                <small className="muted">Trimite un dinozaur la muncă</small>
              </button>
            );
          }
          const unlock = PROPERTY_LEVELS.find((l) => l.workSlots > i)!;
          return (
            <div key={`lock${i}`} className="work-post locked">
              <span className="work-plus"><ThemeText>{"🔒"}</ThemeText></span>
              <small className="muted">Se deblochează cu <ThemeText>{unlock.name}</ThemeText></small>
            </div>
          );
        })}
      </div>
      {picking && <AssignModal game={game} onClose={() => setPicking(false)} />}
    </Panel>
  );
}

function AssignModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const state = game.state!;
  const [job, setJob] = useState<WorkJob>(WORK_JOBS[0]);
  const free = state.dinos
    .filter((d) => !d.molt && !state.workers.some((w) => w.dinoId === d.id))
    .sort((a, b) => workSpeed(b, job) - workSpeed(a, job));
  const busyInExpedition = (d: Dino) => state.activity?.kind === 'expedition' && state.party.includes(d.id);

  return (
    <Modal onClose={onClose} className="assign-modal">
      <h2>Trimite la muncă</h2>
      <div className="job-tabs">
        {WORK_JOBS.map((j) => (
          <button key={j.id} className={`job-tab${j.id === job.id ? ' active' : ''}`} onClick={() => setJob(j)}>
            <span className="job-icon"><ThemeText>{j.icon}</ThemeText></span>
            <b><ThemeText>{j.name}</ThemeText></b>
            <small>
              {j.types.map((t) => (
                <span key={t} title={TYPES[t].name}>
                  <ThemeText>{TYPES[t].icon}</ThemeText>
                </span>
              ))}
            </small>
          </button>
        ))}
      </div>
      <p className="muted small">
        <ThemeText>{job.blurb}</ThemeText> Aduce:<ThemeText>{' '}</ThemeText>
        {job.drops.map((d) => (
          <span key={d.value} title={ITEMS[d.value].name}>
            <ItemArt item={d.value} />
          </span>
        ))}
      </p>
      {free.length === 0 ? (
        <p className="empty-state">Toți dinozaurii sunt ocupați.</p>
      ) : (
        <div className="assign-list">
          {free.map((d) => {
            const fit = jobAffinity(d, job);
            const blocked = busyInExpedition(d);
            return (
              <button
                key={d.id}
                className={`assign-dino${fit ? ' fit' : ''}`}
                disabled={blocked}
                onClick={() => {
                  if (game.dispatch({ type: 'assignWork', dinoId: d.id, jobId: job.id })) onClose();
                }}
              >
                <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={48} />
                <span className="grow">
                  <b><ThemeText>{d.nickname}</ThemeText></b>
                  <small className="muted">
                    <ThemeText>{SPECIES[d.speciesId].name}</ThemeText> · Nv. <ThemeText>{d.level}</ThemeText>
                    <ThemeText>{state.party.includes(d.id) && ' · iese din haită'}</ThemeText>
                    <ThemeText>{blocked && ' · în expediție'}</ThemeText>
                  </small>
                </span>
                <span className="assign-speed">
                  ×<ThemeText>{workSpeed(d, job).toFixed(2)}</ThemeText>
                  <small><ThemeText>{formatSeconds(Math.round(workSeconds(d, job)))}</ThemeText>/buc</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
