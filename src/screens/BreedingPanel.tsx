import { ControlIcon, ThemeText } from '../components/ThemeText';
// Bârlogul: împerecherea a doi dinozauri din aceeași linie. Oul moștenește genele lor.
// Părinții se trag (drag & drop) din haită pe cele două locuri ale altarului; pe telefon, o atingere îi pune.

import { type DragEvent, useState } from 'react';
import {
  BREED_MAX,
  BREED_SECONDS,
  BREED_SKILL_LEVEL,
  type Dino,
  RARITIES,
  SPECIES,
  STAT_NAMES,
  type StatKey,
  breedForecast,
  breedProblems,
  generation,
  geneStars,
  skillLevel,
  skillXp,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { EggSprite } from '../components/EggSprite';
import { EggIcon } from '../components/AssetIcon';
import { Bar, PageHeader, Panel, Stars } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration, formatSeconds } from '../utils/format';

type Slots = [string | null, string | null];

/** Raritatea cea mai probabilă a oului, pentru oul arătat pe altar. */
const likelyRarity = (a: Dino, b: Dino) => breedForecast(a, b).rarities.reduce((x, y) => (y.pct > x.pct ? y : x)).rarity;

const babyOf = (dino: Dino) => Object.values(SPECIES).find((s) => s.line === SPECIES[dino.speciesId].line && s.stage === 'pui')!.id;

export function BreedingPanel({ game }: { game: Game }) {
  const state = game.state!;
  const level = skillLevel(state, 'imblanzire');

  const head = (
    <PageHeader
      icon="💞"
      title="Bârlogul"
      subtitle={`Împerechează doi dragoni: după ${BREED_SECONDS / 3600} ore primești un ou care moștenește genele părinților. Fiecare dragon se poate împerechea de cel mult ${BREED_MAX} ori.`}
      stats={[
        { label: 'Îmblânzire', value: `Nv. ${level}` },
        { label: 'stare', value: level < BREED_SKILL_LEVEL ? '🔒' : state.breeding ? '⏳' : '✓', tone: level < BREED_SKILL_LEVEL ? undefined : 'ok' },
      ]}
    />
  );

  if (level < BREED_SKILL_LEVEL) {
    const xp = state.skills.imblanzire;
    return (
      <>
        <ThemeText>{head}</ThemeText>
        <Panel title="Cum funcționează" icon="📜" className="den">
          <ol className="den-steps">
            <li>
              <span><ThemeText>{"💞"}</ThemeText></span>
              <b>Alegi doi părinți</b>
              <small>Dragoni crescuți de tine, care nu luptă și nu muncesc în acel moment.</small>
            </li>
            <li>
              <span><ThemeText>{"⏳"}</ThemeText></span>
              <b>Așteaptă <ThemeText>{BREED_SECONDS / 3600}</ThemeText> ore</b>
              <small>Stau în bârlog; merge și cât ești plecat.</small>
            </li>
            <li>
              <span><EggIcon size={32} /></span>
              <b>Primești un ou</b>
              <small>Puiul moștenește genele părinților; părinți buni dau ouă mai rare.</small>
            </li>
          </ol>
          <div className="den-locked">
            <span className="den-lock-icon"><ThemeText>{"🔒"}</ThemeText></span>
            <h3>Se deschide la Îmblânzire nivel <ThemeText>{BREED_SKILL_LEVEL}</ThemeText></h3>
            <p className="muted">Îmblânzirea crește când câștigi lupte în Expediții.</p>
            <div className="den-lock-bar">
              <Bar value={xp} max={skillXp(BREED_SKILL_LEVEL)} color="#ff7aa8" label={`Îmblânzire ${level}/${BREED_SKILL_LEVEL}`} />
            </div>
          </div>
        </Panel>
      </>
    );
  }
  return (
    <>
      <ThemeText>{head}</ThemeText>
      {state.breeding ? <ActiveDen game={game} /> : <DenPicker game={game} />}
    </>
  );
}

// ---------- Împerecherea în curs ----------

function ActiveDen({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  const br = state.breeding!;
  const pa = state.dinos.find((d) => d.id === br.a)!;
  const pb = state.dinos.find((d) => d.id === br.b)!;
  const left = br.endsAt - now;
  const pct = Math.min(1, (now - br.startedAt) / (br.endsAt - br.startedAt));
  const done = left <= 0;
  const likely = likelyRarity(pa, pb);

  return (
    <Panel title="Bârlogul" icon="💞" className="den">
      <div className={`den-altar active${done ? ' done' : ''}`}>
        <div className="den-slot filled">
          <ParentCard dino={pa} />
        </div>
        <div className="den-center">
          <div className="den-ring" style={{ ['--p' as string]: `${pct * 360}deg` }}>
            <EggSprite egg={{ rarity: likely, speciesId: babyOf(pa) }} size={64 + Math.round(pct * 24)} className={done ? 'wobble-fast' : 'breathe'} />
          </div>
          <b className="den-timer"><ThemeText>{done ? 'Oul e gata!' : formatDuration(left)}</ThemeText></b>
          <small className="muted"><ThemeText>{done ? 'Ia-l și pune-l în cuib' : `${Math.floor(pct * 100)}% · cuibăresc oul`}</ThemeText></small>
        </div>
        <div className="den-slot filled">
          <ParentCard dino={pb} />
        </div>
      </div>
      <div className="den-cta">
        {done ? (
          <button className="btn primary big glow" onClick={() => game.dispatch({ type: 'finishBreed' })}>
            <EggIcon /> Ia oul
          </button>
        ) : (
          <button className="btn small ghost" onClick={() => game.dispatch({ type: 'cancelBreed' })}>
            Anulează împerecherea
          </button>
        )}
      </div>
    </Panel>
  );
}

// ---------- Alegerea părinților ----------

function DenPicker({ game }: { game: Game }) {
  const state = game.state!;
  const [slots, setSlots] = useState<Slots>([null, null]);
  const [over, setOver] = useState<number | null>(null);
  const find = (id: string | null) => (id ? (state.dinos.find((d) => d.id === id) ?? null) : null);
  const first = find(slots[0]);
  const second = find(slots[1]);
  const partner = first ?? second;

  /** De ce nu poate intra acest dinozaur în Bârlog acum (null = poate). */
  const blocker = (d: Dino): string | null => {
    if (SPECIES[d.speciesId].stage === 'pui') return 'Pui · crește-l întâi';
    if ((d.breeds ?? 0) >= BREED_MAX) return `${BREED_MAX}/${BREED_MAX} împerecheri`;
    if (d.molt) return 'Năpârlește';
    if (state.workers.some((w) => w.dinoId === d.id)) return 'La muncă';
    if (state.activity?.kind === 'expedition' && state.party.includes(d.id)) return 'În expediție';
    const other = slots[0] === d.id ? second : slots[1] === d.id ? first : partner;
    if (other && other.id !== d.id && SPECIES[other.speciesId].line !== SPECIES[d.speciesId].line) return 'Altă linie';
    return null;
  };

  const place = (id: string, index?: number) => {
    const d = find(id);
    if (!d || blocker(d)) return;
    const next: Slots = [slots[0] === id ? null : slots[0], slots[1] === id ? null : slots[1]];
    const at = index ?? (next[0] === null ? 0 : next[1] === null ? 1 : 1);
    next[at] = id;
    // Dacă perechea nu mai e din aceeași linie, celălalt loc se golește.
    const o = find(next[1 - at]);
    if (o && SPECIES[o.speciesId].line !== SPECIES[d.speciesId].line) next[1 - at] = null;
    setSlots(next);
  };
  const clear = (index: number) => setSlots(index === 0 ? [null, slots[1]] : [slots[0], null]);

  const onDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    setOver(null);
    place(e.dataTransfer.getData('text/plain'), index);
  };

  const roster = [...state.dinos].sort((x, y) => {
    const bx = blocker(x) ? 1 : 0;
    const by = blocker(y) ? 1 : 0;
    return bx - by || geneStars(y.genes) - geneStars(x.genes);
  });
  const problems = first && second ? breedProblems(state, first, second) : [];
  const ready = !!first && !!second && problems.length === 0;

  return (
    <Panel title="Bârlogul" icon="💞" className="den" right={<span className="muted small"><ThemeText>{"⏳ "}</ThemeText><ThemeText>{formatSeconds(BREED_SECONDS)}</ThemeText></span>}>
      <p className="den-intro">
        Trage doi dinozauri din aceeași linie pe altar. <b><ThemeText>{"Părinți cu gene mai bune → pui mai puternic și ou mai rar."}</ThemeText></b>
      </p>

      <div className="den-altar">
        {[0, 1].map((i) => {
          const d = i === 0 ? first : second;
          return (
            <div
              key={i}
              className={`den-slot${d ? ' filled' : ''}${over === i ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => onDrop(e, i)}
            >
              {d ? (
                <>
                  <button className="den-slot-x" onClick={() => clear(i)} aria-label="Scoate din Bârlog"><ThemeText>{"\r\n                    ✕\r\n                  "}</ThemeText></button>
                  <ParentCard dino={d} />
                </>
              ) : (
                <div className="den-slot-empty">
                  <span className="den-slot-plus"><ControlIcon glyph="+" /></span>
                  <b><ThemeText>{i === 0 ? 'Primul părinte' : 'Perechea'}</ThemeText></b>
                  <small>Trage aici un dinozaur<ThemeText>{partner && i === 1 ? ` din linia lui ${SPECIES[partner.speciesId].name}` : ''}</ThemeText></small>
                </div>
              )}
            </div>
          );
        })}
        <div className={`den-center${first && second ? ' paired' : ''}`}>
          {first && second ? (
            <>
              <EggSprite egg={{ rarity: likelyRarity(first, second), speciesId: babyOf(first) }} size={70} className="breathe" />
              <small className="muted">puiul: <ThemeText>{SPECIES[babyOf(first)].name}</ThemeText></small>
            </>
          ) : (
            <span className="den-heart"><ThemeText>{"💞"}</ThemeText></span>
          )}
        </div>
      </div>

      {first && second && <Forecast a={first} b={second} />}
      {problems.length > 0 && <p className="lock-text den-problems">Nu se poate: <ThemeText>{problems.join(', ')}</ThemeText>.</p>}
      <div className="den-cta">
        <button
          className={`btn primary big${ready ? ' glow' : ''}`}
          disabled={!ready}
          onClick={() => first && second && game.dispatch({ type: 'breed', a: first.id, b: second.id }) && setSlots([null, null])}
        ><ThemeText>{"\r\n          💞 Trimite în Bârlog\r\n        "}</ThemeText></button>
      </div>

      <h3 className="den-roster-title">
        Haita ta <small className="muted">· trage pe altar sau atinge</small>
      </h3>
      <div className="den-roster">
        {roster.map((d) => {
          const why = blocker(d);
          const chosen = slots.includes(d.id);
          const match = !why && partner && !chosen;
          return (
            <button
              key={d.id}
              className={`den-dino${why ? ' blocked' : ''}${chosen ? ' chosen' : ''}${match ? ' match' : ''}`}
              draggable={!why}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', d.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => (chosen ? clear(slots.indexOf(d.id)) : place(d.id))}
              disabled={!!why && !chosen}
              title={why ?? 'Trage pe altar sau atinge'}
            >
              <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={56} />
              <b><ThemeText>{d.nickname}</ThemeText></b>
              <small className="muted">
                <ThemeText>{SPECIES[d.speciesId].name}</ThemeText> · Gen. <ThemeText>{generation(d)}</ThemeText>
              </small>
              <Stars n={geneStars(d.genes)} />
              {why ? <span className="den-why"><ThemeText>{why}</ThemeText></span> : <span className="den-uses"><ThemeText>{"💞 "}</ThemeText><ThemeText>{d.breeds ?? 0}</ThemeText>/<ThemeText>{BREED_MAX}</ThemeText></span>}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function ParentCard({ dino }: { dino: Dino }) {
  return (
    <div className="den-parent">
      <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={104} className="breathe" />
      <b><ThemeText>{dino.nickname}</ThemeText></b>
      <small className="muted">
        <ThemeText>{SPECIES[dino.speciesId].name}</ThemeText> · Gen. <ThemeText>{generation(dino)}</ThemeText>
      </small>
      <Stars n={geneStars(dino.genes)} />
    </div>
  );
}

function Forecast({ a, b }: { a: Dino; b: Dino }) {
  const f = breedForecast(a, b);
  return (
    <div className="forecast">
      <div className="forecast-head">
        <h3>Ce poate ieși</h3>
        <span className="forecast-stars">
          Puiul: <Stars n={f.stars[0]} />
          {f.stars[1] !== f.stars[0] && (
            <>
              <ThemeText>{' '}</ThemeText>
              până la <Stars n={f.stars[1]} />
            </>
          )}
        </span>
      </div>
      <div className="forecast-genes">
        {(Object.keys(f.genes) as StatKey[]).map((k) => {
          const [lo, hi] = f.genes[k];
          return (
            <div key={k} className="forecast-gene">
              <span><ThemeText>{STAT_NAMES[k]}</ThemeText></span>
              <div className="gene-track" title={`${lo}–${hi} din 15`}>
                <i style={{ left: `${(lo / 15) * 100}%`, width: `${Math.max(4, ((hi - lo) / 15) * 100)}%` }} />
              </div>
              <small>
                <ThemeText>{lo}</ThemeText>–<ThemeText>{hi}</ThemeText>
              </small>
            </div>
          );
        })}
      </div>
      <div className="forecast-rar">
        <span className="muted small">Oul:</span>
        {f.rarities.map((r) => (
          <span key={r.rarity} className={`rarity-tag r-${r.rarity}`}>
            <ThemeText>{RARITIES[r.rarity].name}</ThemeText> <ThemeText>{r.pct}</ThemeText>%
          </span>
        ))}
      </div>
    </div>
  );
}
