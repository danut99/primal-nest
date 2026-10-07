import { ThemeText } from '../components/ThemeText';
import { DietArt, ItemArt, RelicIcon } from '../components/AssetIcon';
// Haita: toți dinozaurii, haita de luptă, hrănire, statistici și evoluție.

import { useMemo, useRef, useState } from 'react';
import {
  type Diet,
  type Dino,
  type ItemId,
  BREED_MAX,
  BRANCH_INFO,
  DIET_INFO,
  ITEMS,
  MAX_RELIC_LEVEL,
  RELICS,
  RUNAWAY_HOURS,
  RELIC_UPGRADES,
  SPECIES,
  STAT_NAMES,
  TEMPERAMENTS,
  adultTarget,
  canEvolve,
  computeStats,
  RARITIES,
  TROUGH_CAPACITY,
  TROUGH_HOURS,
  releaseReward,
  troughTotal,
  hoursSinceMeal,
  returnCost,
  runawayIn,
  findJob,
  hasItems,
  relicBonus,
  relicLevel,
  currentFullness,
  evolutionRequirement,
  evolutionTarget,
  geneStars,
  levelXp,
  partySize,
  type Stats,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { DinoLive } from '../components/DinoLive';
import { Bar, Hearts, PageHeader, Panel, Stars, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatDuration } from '../utils/format';
import { sound } from '../utils/sound';
import { LabDragon } from '../dragon-lab/LabDragon';
import type { LabController } from '../dragon-lab/engine';
import { speciesRecipe } from '../content/dragons';

/** Numele animațiilor pe scenă, cu iconițe. */
const ANIM_LABELS: Record<string, string> = {
  breathe: '😌 Repaus',
  fly: '🪽 Zbor',
  walk: '🐾 Mers',
  attack: '⚔️ Atac',
  special1: '✨ Ultimată',
  levelup: '🌟 Bucurie',
};
const ANIM_ORDER = ['breathe', 'walk', 'fly', 'attack', 'special1', 'levelup'];
import { sceneBackground } from '../content/art';

/** Fundalul scenei: regiunea care se potrivește tipului dragonului. */
const SCENE_OF_TYPE: Record<string, string> = { jungla: 'jungla', apa: 'jungla', foc: 'vulcan', piatra: 'canion', aer: 'piscuri' };

export function PackScreen({ game, selected, onSelect }: { game: Game; selected: string | null; onSelect: (id: string | null) => void }) {
  const state = game.state!;
  const now = game.now();
  const dino = state.dinos.find((d) => d.id === selected) ?? state.dinos[0];
  const [sort, setSort] = useState<Sort>('level');
  const [filter, setFilter] = useState<Filter>('all');

  if (state.dinos.length === 0) {
    return (
      <div className="screen">
        <Panel title="Haita" icon="🦖">
          <p className="empty-state">
            <ThemeText>{state.wild.length ? 'Toată haita a fugit în sălbăticie. Adu-i înapoi mai jos.' : 'Încă n-ai niciun dinozaur. Primul ou din cuib e aproape gata! 🥚'}</ThemeText>
          </p>
        </Panel>
        <WildPanel game={game} />
      </div>
    );
  }

  const size = partySize(state);
  const shown = sortDinos(
    state.dinos.filter((d) => matchesFilter(d, filter, state, now)),
    sort,
    now,
  );
  const togglePartyMember = (id: string) => {
    const inParty = state.party.includes(id);
    game.dispatch({ type: 'setParty', ids: inParty ? state.party.filter((x) => x !== id) : [...state.party, id] });
  };

  const hungry = state.dinos.filter((d) => runawayIn(d, now) !== null).length;
  const evolveReady = state.dinos.filter((d) => d.molt && now >= d.molt.endsAt).length;

  // Dragonul anterior / următor din lista afișată (săgețile de pe scenă).
  const order = shown.some((d) => d.id === dino.id) ? shown : state.dinos;
  const at = order.findIndex((d) => d.id === dino.id);
  const step = (dir: number) => order.length > 1 && onSelect(order[(at + dir + order.length) % order.length].id);

  return (
    <div className="screen pack-v3">
      <DinoDetail
        key={dino.id}
        game={game}
        dino={dino}
        inParty={state.party.includes(dino.id)}
        onToggleParty={() => togglePartyMember(dino.id)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        position={`${at + 1}/${order.length}`}
      />

      {/* Banda cu toți dragonii */}
      <section className="roster">
        <div className="roster-head">
          <h3><ThemeText>{"\r\n            🐉 Dragonii tăi "}</ThemeText><span className="muted">· <ThemeText>{state.party.length}</ThemeText>/<ThemeText>{size}</ThemeText> în luptă</span>
            {hungry > 0 && <span className="roster-warn"><ThemeText>{"😟 "}</ThemeText><ThemeText>{hungry}</ThemeText> flămânzi</span>}
            {evolveReady > 0 && <span className="roster-gold"><ThemeText>{"✨ "}</ThemeText><ThemeText>{evolveReady}</ThemeText> gata de evoluție</span>}
          </h3>
          <div className="roster-tools">
            <div className="pack-filters">
              {FILTERS.map(([id, label]) => (
                <button key={id} className={`chip-btn${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
                  <ThemeText>{label}</ThemeText>
                </button>
              ))}
            </div>
            <select className="pack-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortează">
              <option value="level">Nivel</option>
              <option value="stars">Gene </option>
              <option value="rarity">Raritate</option>
              <option value="bond">Atașament</option>
              <option value="hunger">Cei mai flămânzi</option>
              <option value="name">Nume</option>
            </select>
            <button className="btn small primary" onClick={() => game.dispatch({ type: 'feedAll' })} title="Fiecare primește mâncarea lui preferată din rucsac"><ThemeText>{"\r\n              🍖 Hrănește toată haita\r\n            "}</ThemeText></button>
          </div>
        </div>
        {shown.length === 0 && <p className="muted small">Niciun dragon aici.</p>}
        <div className="roster-band">
          {shown.map((d) => {
            const ds = SPECIES[d.speciesId];
            const inParty = state.party.includes(d.id);
            const ready = d.molt && now >= d.molt.endsAt;
            const full = currentFullness(d, now);
            return (
              <button
                key={d.id}
                className={`roster-card type-${ds.types[0]}${d.id === dino.id ? ' selected' : ''}${d.variant === 'albino' ? ' albino' : ''}`}
                onClick={() => onSelect(d.id)}
                title={`${d.nickname} · ${ds.name}`}
              >
                <span className="roster-pins">
                  {inParty && <span title="În haita de luptă"><ThemeText>{"⚔️"}</ThemeText></span>}
                  {state.workers.some((w) => w.dinoId === d.id) && <span title="La muncă"><ThemeText>{findJob(state.workers.find((w) => w.dinoId === d.id)!.jobId).icon}</ThemeText></span>}
                  {d.molt && <span><ThemeText>{ready ? '✨' : '🌀'}</ThemeText></span>}
                  {runawayIn(d, now) !== null && <span title="Flămând!"><ThemeText>{"😟"}</ThemeText></span>}
                </span>
                <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} size={84} className={d.molt ? 'molting' : ''} />
                <b><ThemeText>{d.nickname}</ThemeText></b>
                <small>Nv. <ThemeText>{d.level}</ThemeText></small>
                <span className="roster-belly" title={`Burtică ${Math.round(full)}%`}>
                  <i style={{ width: `${full}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="pack-extras">
        <TroughPanel game={game} />
        <WildPanel game={game} />
      </div>
    </div>
  );
}

function DinoDetail({
  game,
  dino,
  inParty,
  onToggleParty,
  onPrev,
  onNext,
  position,
}: {
  game: Game;
  dino: Dino;
  inParty: boolean;
  onToggleParty: () => void;
  onPrev: () => void;
  onNext: () => void;
  position: string;
}) {
  const state = game.state!;
  const now = game.now();
  const s = SPECIES[dino.speciesId];
  const stats = computeStats(dino, relicLevel(state, dino.relic));
  const work = state.workers.find((w) => w.dinoId === dino.id);
  const [releasing, setReleasing] = useState(false);
  const job = work ? findJob(work.jobId) : undefined;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(dino.nickname);
  // Evoluția se joacă pe scenă: încărcare (dragonul strălucește și tremură) → fulger → forma nouă își face ultimata.
  const [evo, setEvo] = useState<{ phase: 'charge' | 'flash' | 'reveal'; from: string; to?: string } | null>(null);
  const evoRef = useRef(evo);
  evoRef.current = evo;
  const stageRef = useRef<HTMLElement>(null);
  const [fed, setFed] = useState(0);
  const fullness = currentFullness(dino, now);
  const foods = (Object.keys(ITEMS) as ItemId[]).filter((id) => ITEMS[id].food && (state.inventory[id] ?? 0) > 0);
  const xpFrom = levelXp(dino.level);
  const xpTo = levelXp(dino.level + 1);
  const t = TEMPERAMENTS[dino.temperament];

  // Dragonul de pe scenă: canvasul acoperă toată scena, iar animația se alege din butoanele de jos.
  const recipe = useMemo(() => speciesRecipe(dino.speciesId, dino.variant === 'albino'), [dino.speciesId, dino.variant]);
  const stageDragon = useRef<LabController | null>(null);
  const [anims, setAnims] = useState<string[]>([]);
  const [anim, setAnim] = useState('breathe');

  const feed = (itemId: ItemId) => {
    if (game.dispatch({ type: 'feed', dinoId: dino.id, itemId })) {
      setFed((n) => n + 1);
      stageDragon.current?.playOnce(stageDragon.current.animations.includes('levelup') ? 'levelup' : anim);
    }
  };

  const finishMolt = () => {
    if (evoRef.current) return;
    const from = dino.speciesId;
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAnim('breathe');
    setEvo({ phase: 'charge', from });
    // Bătăi de inimă tot mai dese cât se încarcă.
    [0, 600, 1050, 1400, 1650, 1850, 2000].forEach((ms) => window.setTimeout(() => sound.click(), ms));
    window.setTimeout(() => {
      const res = game.dispatch({ type: 'finishEvolve', dinoId: dino.id }, { quiet: true });
      if (!res) return setEvo(null);
      setEvo({ phase: 'flash', from, to: res.state.dinos.find((d) => d.id === dino.id)!.speciesId });
      window.setTimeout(() => setEvo((e) => (e ? { ...e, phase: 'reveal' } : e)), 450);
    }, 2200);
  };

  const [pane, setPane] = useState<'hrana' | 'statistici' | 'relicve' | 'evolutie'>('hrana');
  // Mâncarea recomandată: preferata lui, dacă o ai; altfel cea care dă cel mai mult XP.
  const bestFood = [...foods].sort((x, y) => {
    const fx = ITEMS[x].food!;
    const fy = ITEMS[y].food!;
    return Number(fy.diet === s.diet) - Number(fx.diet === s.diet) || fy.xp - fx.xp;
  })[0];
  const evoReady = !!dino.molt && now >= dino.molt.endsAt;
  // Cât din năpârlire s-a scurs (pentru butonul de pe scenă).
  const moltPct = dino.molt ? Math.min(100, Math.floor(((now - dino.molt.startedAt) / (dino.molt.endsAt - dino.molt.startedAt)) * 100)) : 0;
  // Poate începe năpârlirea acum (nivel, atașament și obiectul cerut sunt îndeplinite).
  const canStart = !dino.molt && !!evolutionRequirement(dino) && canEvolve(state, dino).ok;
  const req = evolutionRequirement(dino);
  const relicCount = state.relics.length;

  return (
    <>
      <section
        ref={stageRef}
        className={`pack-stage type-${s.types[0]}${evo ? ` evo-${evo.phase}` : ''}`}
        style={sceneBackground(SCENE_OF_TYPE[s.types[0]], 0.12)}
      >
        {evo && (
          <div className="evo-fx" aria-hidden="true">
            <span className="evo-rays" />
            <span className="evo-flash" />
            {evo.phase === 'reveal' && Array.from({ length: 24 }, (_, i) => <i key={i} className="evo-spark" style={{ ['--i' as string]: i }} />)}
          </div>
        )}
        {evo?.phase === 'reveal' && evo.to && (
          <button className="evo-banner" onClick={() => setEvo(null)} title="Închide">
            <small>Evoluție!</small>
            <b>
              <ThemeText>{SPECIES[evo.from].name}</ThemeText> a evoluat în <ThemeText>{SPECIES[evo.to].name}</ThemeText>!
            </b>
            <span><ThemeText>{SPECIES[evo.to].blurb}</ThemeText></span>
            <em>apasă ca să continui</em>
          </button>
        )}
        <div className={`ps-canvas${dino.molt ? ' molting' : ''}`}>
          <LabDragon
            recipe={recipe}
            animation={anim}
            fixedViewport
            pad={{ top: 18, bottom: 26, left: 6, right: 6 }}
            onReady={(d) => {
              stageDragon.current = d;
              // Forma nouă apare cu ultimata ei (sau cu bucuria, dacă n-are).
              if (evoRef.current?.phase === 'reveal' || evoRef.current?.phase === 'flash') {
                sound.levelUp();
                d.playOnce(d.distinct.includes('special1') ? 'special1' : d.distinct[0]);
              }
              // Doar animațiile care există și chiar diferă (unele exporturi au copii identice).
              setAnims(ANIM_ORDER.filter((a) => d.distinct.includes(a)).concat(d.distinct.filter((a) => !ANIM_ORDER.includes(a))));
              if (!d.animations.includes(anim)) setAnim(d.animations[0]);
            }}
          />
        </div>
        <header className="ps-top">
          <button className="ps-arrow" onClick={onPrev} aria-label="Dragonul anterior"><ThemeText>{"\r\n            ◀\r\n          "}</ThemeText></button>
          <div className="ps-title">
            {renaming ? (
              <form
                className="name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (game.dispatch({ type: 'rename', dinoId: dino.id, nickname: name }, { quiet: true })) setRenaming(false);
                }}
              >
                <input autoFocus value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label="Nume nou" />
                <button className="btn small primary">OK</button>
              </form>
            ) : (
              <h2>
                <ThemeText>{dino.nickname}</ThemeText>
                <button className="ps-rename" onClick={() => setRenaming(true)} aria-label="Redenumește" title="Redenumește"><ThemeText>{"\r\n                  ✏️\r\n                "}</ThemeText></button>
              </h2>
            )}
            <div className="ps-chips">
              <span className="ps-level">Nv. <ThemeText>{dino.level}</ThemeText></span>
              {s.types.map((ty) => (
                <TypeBadge key={ty} type={ty} small />
              ))}
              <span className="chip"><ThemeText>{s.stage === 'pui' ? 'Pui' : s.stage === 'juvenil' ? 'Juvenil' : `Adult · ${BRANCH_INFO[s.branch!].name}`}</ThemeText></span>
              {dino.nickname !== s.name && <span className="chip"><ThemeText>{s.name}</ThemeText></span>}
              {dino.variant === 'albino' && <span className="chip albino-chip"><ThemeText>{"🤍 Albino"}</ThemeText></span>}
              {dino.rarity && <span className={`rarity-tag r-${dino.rarity}`}><ThemeText>{RARITIES[dino.rarity].name}</ThemeText></span>}
            </div>
          </div>
          <span className="ps-pos"><ThemeText>{position}</ThemeText></span>
          <button className="ps-arrow" onClick={onNext} aria-label="Dragonul următor"><ThemeText>{"\r\n            ▶\r\n          "}</ThemeText></button>
        </header>

        <div className="ps-body">
          <aside className="ps-glass">
            <h4>Starea lui</h4>
            <div className="ps-meter">
              <div>
                <span><ThemeText>{"⭐ Nivel "}</ThemeText><ThemeText>{dino.level}</ThemeText></span>
                <small>
                  <ThemeText>{dino.xp - xpFrom}</ThemeText>/<ThemeText>{xpTo - xpFrom}</ThemeText> XP
                </small>
              </div>
              <Bar value={dino.xp - xpFrom} max={xpTo - xpFrom} thin color="#5bb4f0" />
            </div>
            <div className="ps-meter">
              <div>
                <span><ThemeText>{"💗 Atașament"}</ThemeText></span>
                <small><ThemeText>{dino.bond}</ThemeText>/100</small>
              </div>
              <Bar value={dino.bond} max={100} thin color="#ff7a9a" />
            </div>
            <div className={`ps-meter${runawayIn(dino, now) !== null ? ' warn' : ''}`}>
              <div>
                <span><ThemeText>{"🍖 Burtică"}</ThemeText></span>
                <small><ThemeText>{fullness >= 100 ? 'Sătul!' : `${Math.round(fullness)}%`}</ThemeText></small>
              </div>
              <Bar value={fullness} max={100} thin color="#f5b942" />
            </div>
            {runawayIn(dino, now) !== null ? (
              <p className="ps-alert"><ThemeText>{"😟 Fuge în "}</ThemeText><ThemeText>{Math.ceil(runawayIn(dino, now)!)}</ThemeText> h dacă nu-l hrănești!</p>
            ) : (
              <small className="muted">Ultima masă: <ThemeText>{formatAgo(hoursSinceMeal(dino, now))}</ThemeText></small>
            )}
          </aside>

          <div className="ps-dragon">
            <span className="ps-spot" />
            {fed > 0 && (
              <span key={`h${fed}`} className="float-heart"><ThemeText>{"\r\n                ❤️\r\n              "}</ThemeText></span>
            )}
          </div>

          <aside className="ps-glass">
            <h4>Puterea lui</h4>
            <div className="ps-stats">
              {(Object.keys(stats) as (keyof Stats)[]).map((k) => (
                <div key={k} className={`ps-stat${k === t.up ? ' up' : k === t.down ? ' down' : ''}`}>
                  <span><ThemeText>{STAT_NAMES[k]}</ThemeText></span>
                  <b><ThemeText>{stats[k]}</ThemeText></b>
                </div>
              ))}
            </div>
            <div className="ps-row">
              <span className="muted small">Gene</span> <Stars n={geneStars(dino.genes)} />
            </div>
            <small className="muted"><ThemeText>{"\r\n              🧠 "}</ThemeText><ThemeText>{t.name}</ThemeText>: <ThemeText>{t.text}</ThemeText>
            </small>
            {/* Slotul de echipament: relicva purtată (sau un loc gol, dacă ai relicve libere). */}
            {dino.relic && RELICS[dino.relic] ? (
              <button className="ps-relic" style={{ ['--relic' as string]: RELICS[dino.relic].color }} onClick={() => setPane('relicve')} title={RELICS[dino.relic].blurb}>
                <span className="ps-relic-art">
                  <RelicIcon relic={dino.relic} size={40} />
                </span>
                <span className="ps-relic-text">
                  <small>Relicvă · nv. <ThemeText>{relicLevel(state, dino.relic)}</ThemeText></small>
                  <b><ThemeText>{RELICS[dino.relic].name}</ThemeText></b>
                  <em>
                    <ThemeText>{(Object.keys(RELICS[dino.relic].bonus) as (keyof Stats)[])
                      .map((k) => `+${Math.round(relicBonus(RELICS[dino.relic!], k, relicLevel(state, dino.relic!)) * 100)}% ${STAT_NAMES[k]}`)
                      .join(' · ')}</ThemeText>
                  </em>
                </span>
              </button>
            ) : (
              state.relics.length > 0 && (
                <button className="ps-relic empty" onClick={() => setPane('relicve')}>
                  <span className="ps-relic-art"><ThemeText>{"＋"}</ThemeText></span>
                  <span className="ps-relic-text">
                    <small>Relicvă</small>
                    <b>Echipează una</b>
                  </span>
                </button>
              )
            )}
          </aside>
        </div>

        {anims.length > 1 && (
          <div className="ps-anims" role="group" aria-label="Alege animația">
            <span className="ps-anims-label"><ThemeText>{"🎬 Vezi animația"}</ThemeText></span>
            {anims.map((a) => (
              <button key={a} className={a === anim ? 'on' : ''} onClick={() => (a === anim ? stageDragon.current?.setAnimation(a) : setAnim(a))}>
                <ThemeText>{ANIM_LABELS[a] ?? a}</ThemeText>
              </button>
            ))}
          </div>
        )}
        <footer className="ps-actions">
          {bestFood ? (
            <button className="ps-btn feed" onClick={() => feed(bestFood)} disabled={fullness >= 100 || !!dino.molt}>
              <span><ItemArt item={bestFood} /></span>
              <b>Hrănește</b>
              <small>
                <ThemeText>{ITEMS[bestFood].name}</ThemeText>
                <ThemeText>{ITEMS[bestFood].food!.diet === s.diet ? ' ❤️' : ''}</ThemeText> · ×<ThemeText>{state.inventory[bestFood]}</ThemeText>
              </small>
            </button>
          ) : (
            <button className="ps-btn" disabled>
              <span><ThemeText>{"🍽️"}</ThemeText></span>
              <b>N-ai mâncare</b>
              <small>culege sau adu din expediții</small>
            </button>
          )}
          {job ? (
            <button className="ps-btn" disabled>
              <span><ThemeText>{job.icon}</ThemeText></span>
              <b>La muncă</b>
              <small><ThemeText>{job.name}</ThemeText></small>
            </button>
          ) : s.stage === 'pui' ? (
            <button className="ps-btn" disabled>
              <span><ThemeText>{"🍼"}</ThemeText></span>
              <b>Prea mic</b>
              <small>luptă după prima evoluție</small>
            </button>
          ) : (
            <button className={`ps-btn fight${inParty ? ' on' : ''}`} onClick={onToggleParty} disabled={!!dino.molt}>
              <span><ThemeText>{"⚔️"}</ThemeText></span>
              <b><ThemeText>{inParty ? 'În haită' : 'La luptă'}</ThemeText></b>
              <small><ThemeText>{inParty ? 'apasă ca să-l scoți' : 'pune-l în haită'}</ThemeText></small>
            </button>
          )}
          {evoReady ? (
            <button className="ps-btn evo ready" onClick={finishMolt}>
              <span><ThemeText>{"✨"}</ThemeText></span>
              <b>Evoluează!</b>
              <small>vezi forma nouă</small>
            </button>
          ) : (
            <button
              className={`ps-btn evo${canStart ? ' ready' : ''}${dino.molt ? ' molting' : ''}`}
              style={dino.molt ? { ['--molt' as string]: `${moltPct}%` } : undefined}
              onClick={() => {
                setPane('evolutie');
                document.querySelector('.dino-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              disabled={!req}
            >
              <span className={dino.molt ? 'ps-molt-icon' : ''}><ThemeText>{dino.molt ? '🌀' : '🧬'}</ThemeText></span>
              <b><ThemeText>{dino.molt ? `Năpârlește · ${moltPct}%` : canStart ? 'Poate evolua!' : 'Evoluție'}</ThemeText></b>
              <small>
                <ThemeText>{dino.molt
                  ? `gata în ${formatDuration(dino.molt.endsAt - now)}`
                  : req
                    ? canStart
                      ? 'începe năpârlirea'
                      : `la nivelul ${req.level}`
                    : 'formă finală'}</ThemeText>
              </small>
            </button>
          )}
        </footer>
      </section>

      <Panel className="dino-detail">
      <div className="dd-tabs" role="tablist">
        {(
          [
            ['hrana', '🍖 Hrănire'],
            ['statistici', '📊 Statistici'],
            ['relicve', `💠 Relicve${relicCount ? ` (${relicCount})` : ''}`],
            ['evolutie', '🧬 Evoluție'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={pane === id} className={`dd-tab${pane === id ? ' active' : ''}`} onClick={() => setPane(id)}>
            <ThemeText>{label}</ThemeText>
            {id === 'evolutie' && evoReady && <span className="badge">!</span>}
          </button>
        ))}
      </div>

      <div className="dd-pane">
        {pane === 'hrana' && (
          <div className="dd-grid">
            <section className="detail-card">
              <h3>Ce îi dai</h3>
              <p className="muted small">
                Îi place: <DietArt diet={s.diet} /> <b><ThemeText>{DIET_INFO[s.diet].name}</ThemeText></b>: dublu atașament. Hrănește-l măcar o dată la <ThemeText>{RUNAWAY_HOURS / 24}</ThemeText> zile, altfel fuge în
                sălbăticie.
              </p>
              {foods.length === 0 ? (
                <p className="empty-state small">N-ai mâncare. Culege ferigi sau adu carne din expediții.</p>
              ) : (
                <div className="food-row">
                  {foods.map((id) => {
                    const food = ITEMS[id].food!;
                    const loves = food.diet === s.diet;
                    return (
                      <button key={id} className={`food-btn${loves ? ' loves' : ''}`} onClick={() => feed(id)} disabled={fullness >= 100 || !!dino.molt} title={`${ITEMS[id].name}: +${food.xp} XP`}>
                        <span className="food-icon"><ItemArt item={id} size={32} /></span>
                        <small>×<ThemeText>{state.inventory[id]}</ThemeText></small>
                        {loves && <span className="love-tag"><ThemeText>{"❤️"}</ThemeText></span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="detail-card">
              <h3>Dieta decide ramura</h3>
              <DietMeter dino={dino} />
            </section>
          </div>
        )}

        {pane === 'statistici' && (
          <div className="dd-grid">
            <section className="detail-card">
              <h3>Puterea lui</h3>
              <StatsTable stats={stats} genes={dino.genes} up={t.up} down={t.down} />
              <div className="row gap-s">
                <span className="muted small">Gene:</span> <Stars n={geneStars(dino.genes)} />
              </div>
            </section>
            <section className="detail-card">
              <h3>În luptă</h3>
              <ul className="dd-facts">
                <li>
                  <span><ThemeText>{"⚔️ Atac de bază"}</ThemeText></span>
                  <b><ThemeText>{s.basic.name}</ThemeText></b>
                </li>
                <li>
                  <span><ThemeText>{"✨ Ultimată"}</ThemeText></span>
                  <b>
                    <ThemeText>{s.special.name}</ThemeText> {s.special.type && <TypeBadge type={s.special.type} small />}
                  </b>
                </li>
                <li>
                  <span><ThemeText>{"🧠 Temperament"}</ThemeText></span>
                  <b>
                    <ThemeText>{t.name}</ThemeText> <small className="muted">(<ThemeText>{t.text}</ThemeText>)</small>
                  </b>
                </li>
                <li>
                  <span><ThemeText>{"💞 Generația"}</ThemeText></span>
                  <b>
                    <ThemeText>{dino.lineage?.generation ?? 1}</ThemeText> <small className="muted">· împerecheri <ThemeText>{dino.breeds ?? 0}</ThemeText>/<ThemeText>{BREED_MAX}</ThemeText></small>
                  </b>
                </li>
                {dino.lineage && (
                  <li>
                    <span><ThemeText>{"👪 Părinți"}</ThemeText></span>
                    <b>
                      <ThemeText>{dino.lineage.parents[0]}</ThemeText> × <ThemeText>{dino.lineage.parents[1]}</ThemeText>
                    </b>
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}

        {pane === 'relicve' && <RelicBox game={game} dino={dino} />}
        {pane === 'evolutie' && <EvolutionBox game={game} dino={dino} onFinish={finishMolt} />}
      </div>

      <div className="release-row">
        {releasing ? (
          <>
            <span className="small">
              Sigur îl eliberezi pe <b><ThemeText>{dino.nickname}</ThemeText></b>? Primești <b>+<ThemeText>{releaseReward(dino)}</ThemeText><ThemeText>{" ✨"}</ThemeText></b>, dar nu se mai întoarce.
            </span>
            <button className="btn small danger" onClick={() => game.dispatch({ type: 'release', dinoId: dino.id }) && setReleasing(false)}>
              Da, eliberează-l
            </button>
            <button className="btn small ghost" onClick={() => setReleasing(false)}>
              Nu
            </button>
          </>
        ) : (
          <button className="btn tiny ghost" onClick={() => setReleasing(true)} title="Îl lași liber în junglă, în schimbul unor scântei"><ThemeText>{"\r\n            🌿 Eliberează (+"}</ThemeText><ThemeText>{releaseReward(dino)}</ThemeText><ThemeText>{" ✨)\r\n          "}</ThemeText></button>
        )}
      </div>
      </Panel>
    </>
  );
}

function StatsTable({ stats, genes, up, down }: { stats: Stats; genes: Stats; up: keyof Stats; down: keyof Stats }) {
  const max = 220;
  return (
    <div className="stats-table">
      {(Object.keys(stats) as (keyof Stats)[]).map((k) => (
        <div key={k} className="stat-row">
          <span className={k === up ? 'stat-up' : k === down ? 'stat-down' : ''}>
            <ThemeText>{STAT_NAMES[k]}</ThemeText>
            <ThemeText>{k === up ? ' ▲' : k === down ? ' ▼' : ''}</ThemeText>
          </span>
          <Bar value={stats[k]} max={max} thin color={k === 'hp' ? '#6cc36a' : k === 'atk' ? '#ef7b4f' : k === 'def' ? '#7d9fd6' : '#f2c84b'} />
          <b><ThemeText>{stats[k]}</ThemeText></b>
          <small className="gene" title="Genă (0–15)">
            <ThemeText>{genes[k] >= 13 ? '★' : genes[k] >= 8 ? '☆' : '·'}</ThemeText>
          </small>
        </div>
      ))}
    </div>
  );
}

function DietMeter({ dino }: { dino: Dino }) {
  const s = SPECIES[dino.speciesId];
  const counts: Record<Diet, number> = { plante: 0, carne: 0, insecte: 0 };
  for (const d of dino.diets) counts[d]++;
  const total = dino.diets.length || 1;
  const target = s.stage === 'juvenil' ? adultTarget(dino) : null;
  return (
    <div className="diet-meter">
      <small className="muted">Ultimele <ThemeText>{dino.diets.length}</ThemeText>/20 mese</small>
      <div className="diet-bar">
        {(Object.keys(counts) as Diet[]).map((d) =>
          counts[d] ? (
            <span key={d} className={`diet-seg d-${d}`} style={{ flex: counts[d] / total }} title={`${DIET_INFO[d].name}: ${counts[d]}`}>
              <DietArt diet={d} />
            </span>
          ) : null,
        )}
        {dino.diets.length === 0 && <span className="diet-seg empty">—</span>}
      </div>
      {s.stage === 'juvenil' && s.branches && (
        <div className="branch-preview">
          {(Object.keys(s.branches) as (keyof typeof BRANCH_INFO)[]).map((b) => (
            <div key={b} className={`branch${target?.speciesId === s.branches![b] ? ' active' : ''}`}>
              <DinoSprite speciesId={s.branches![b]!} size={56} silhouette={target?.speciesId !== s.branches![b]} />
              <small>
                <DietArt diet={BRANCH_INFO[b].diet} /> <ThemeText>{BRANCH_INFO[b].name}</ThemeText>
              </small>
            </div>
          ))}
          <small className="muted">Dieta dominantă decide în ce evoluează!</small>
        </div>
      )}
    </div>
  );
}

function EvolutionBox({ game, dino, onFinish }: { game: Game; dino: Dino; onFinish: () => void }) {
  const state = game.state!;
  const now = game.now();
  const req = evolutionRequirement(dino);
  if (!req) return <p className="evo-box done"><ThemeText>{"🏆 Formă finală. Felicitări, Paznicule!"}</ThemeText></p>;

  if (dino.molt) {
    const left = dino.molt.endsAt - now;
    const total = dino.molt.endsAt - dino.molt.startedAt;
    return (
      <div className="evo-box molting-box">
        <h3><ThemeText>{"🌀 Năpârlește…"}</ThemeText></h3>
        {left > 0 ? (
          <Bar value={total - left} max={total} color="#b48cf2" label={formatDuration(left)} />
        ) : (
          <button className="btn primary glow" onClick={onFinish}><ThemeText>{"\r\n            ✨ Vezi evoluția!\r\n          "}</ThemeText></button>
        )}
      </div>
    );
  }

  const target = evolutionTarget(dino)!;
  const check = canEvolve(state, dino);
  return (
    <div className="evo-box">
      <div className="evo-preview">
        <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={64} />
        <span className="arrow">➜</span>
        <DinoSprite speciesId={target} size={64} silhouette={!state.atlas[target]?.owned} />
      </div>
      <div className="evo-reqs">
        <h3>Evoluție: <ThemeText>{SPECIES[dino.speciesId].stage === 'pui' ? 'Juvenil' : 'Adult'}</ThemeText></h3>
        <ul>
          <li className={dino.level >= req.level ? 'ok' : ''}>Nivel <ThemeText>{req.level}</ThemeText></li>
          <li className={dino.bond >= req.bond ? 'ok' : ''}>Atașament <ThemeText>{req.bond}</ThemeText></li>
          {req.item && <li className={(state.inventory[req.item] ?? 0) > 0 ? 'ok' : ''}>1 <ThemeText>{ITEMS[req.item].name}</ThemeText></li>}
          <li className="muted">Năpârlire: <ThemeText>{formatDuration(req.seconds * 1000)}</ThemeText></li>
        </ul>
        <button className="btn primary" disabled={!check.ok} onClick={() => game.dispatch({ type: 'evolve', dinoId: dino.id })}><ThemeText>{"\r\n          🌀 Începe năpârlirea\r\n        "}</ThemeText></button>
      </div>
    </div>
  );
}

function RelicBox({ game, dino }: { game: Game; dino: Dino }) {
  const state = game.state!;
  return (
    <div className="relic-box">
      <h3>Relicve</h3>
      <div className="relic-grid">
        {Object.keys(RELICS).map((id) => {
          const r = RELICS[id];
          if (!state.relics.includes(id)) {
            return (
              <div key={id} className="relic-card locked" title="Învinge un Alfa ca s-o câștigi.">
                <span className="relic-icon"><ThemeText>{"❔"}</ThemeText></span>
                <b>Necunoscută</b>
                <small className="muted">Învinge un Alfa</small>
              </div>
            );
          }
          const worn = dino.relic === id;
          const owner = state.dinos.find((d) => d.relic === id && d.id !== dino.id);
          const level = relicLevel(state, id);
          const next = level < MAX_RELIC_LEVEL ? RELIC_UPGRADES[level] : undefined;
          const affordable = !!next && state.sparks >= next.sparks && hasItems(state, next.cost);
          const bonus = (Object.keys(r.bonus) as (keyof Stats)[])
            .map((k) => `+${Math.round(relicBonus(r, k, level) * 100)}% ${STAT_NAMES[k]}`)
            .join(', ');
          return (
            <div key={id} className={`relic-card${worn ? ' worn' : ''}`} style={{ ['--relic' as string]: r.color }} title={r.blurb}>
              <span className="relic-icon"><RelicIcon relic={id} size={48} /></span>
              <b><ThemeText>{r.name}</ThemeText></b>
              <span className="relic-pips" aria-label={`Nivel ${level} din ${MAX_RELIC_LEVEL}`}>
                {Array.from({ length: MAX_RELIC_LEVEL }, (_, i) => (
                  <i key={i} className={i < level ? 'on' : ''} />
                ))}
              </span>
              <small><ThemeText>{bonus}</ThemeText></small>
              <small className="muted"><ThemeText>{worn ? 'Purtată' : owner ? `O poartă ${owner.nickname}` : 'Liberă'}</ThemeText></small>
              <div className="relic-actions">
                <button className={`btn small${worn ? '' : ' primary'}`} onClick={() => game.dispatch({ type: 'equip', dinoId: dino.id, relicId: worn ? null : id })}>
                  <ThemeText>{worn ? 'Scoate' : 'Echipează'}</ThemeText>
                </button>
                {next ? (
                  <button className="btn small" disabled={!affordable} onClick={() => game.dispatch({ type: 'upgradeRelic', relicId: id })}><ThemeText>{"\r\n                    ⬆️ Întărește\r\n                  "}</ThemeText></button>
                ) : (
                  <span className="chip">MAX</span>
                )}
              </div>
              {next && (
                <small className={`relic-cost${affordable ? '' : ' muted'}`}><ThemeText>{"\r\n                  ✨ "}</ThemeText><ThemeText>{next.sparks}</ThemeText>
                  {Object.entries(next.cost).map(([item, qty]) => (
                    <span key={item} className={(state.inventory[item as ItemId] ?? 0) >= qty! ? '' : 'missing'}>
                      <ThemeText>{' '}</ThemeText>
                      · <ItemArt item={item as ItemId} /> <ThemeText>{state.inventory[item as ItemId] ?? 0}</ThemeText>/<ThemeText>{qty}</ThemeText>
                    </span>
                  ))}
                </small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WildPanel({ game }: { game: Game }) {
  const state = game.state!;
  const now = game.now();
  if (state.wild.length === 0) return null;
  return (
    <Panel title="În sălbăticie" icon="🌲" className="wild-panel" right={<span className="diamonds"><ThemeText>{"💎 "}</ThemeText><ThemeText>{state.diamonds}</ThemeText></span>}>
      <p className="muted small">Au fugit pentru că n-au primit de mâncare <ThemeText>{RUNAWAY_HOURS / 24}</ThemeText> zile. Se întorc cu tot ce știau, dar flămânzi și mai puțin atașați.</p>
      <div className="wild-list">
        {state.wild.map(({ dino, leftAt }) => {
          const cost = returnCost(dino);
          const days = Math.max(0, Math.floor((now - leftAt) / (24 * 3600 * 1000)));
          return (
            <div key={dino.id} className="wild-card">
              <DinoSprite speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={56} silhouette />
              <div className="grow">
                <b><ThemeText>{dino.nickname}</ThemeText></b>
                <small className="muted">
                  Nv. <ThemeText>{dino.level}</ThemeText> · <ThemeText>{SPECIES[dino.speciesId].name}</ThemeText> · <ThemeText>{days === 0 ? 'a fugit azi' : `de ${days} ${days === 1 ? 'zi' : 'zile'}`}</ThemeText>
                </small>
              </div>
              <button className="btn small primary" disabled={state.diamonds < cost} onClick={() => game.dispatch({ type: 'bringBack', dinoId: dino.id })}><ThemeText>{"\r\n                Adu-l înapoi · 💎 "}</ThemeText><ThemeText>{cost}</ThemeText>
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatAgo(hours: number): string {
  if (hours < 1) return 'acum câteva minute';
  if (hours < 24) return `acum ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return `acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

type Sort = 'level' | 'stars' | 'rarity' | 'bond' | 'hunger' | 'name';
type Filter = 'all' | 'party' | 'hungry' | 'adults' | 'free';

const FILTERS: [Filter, string][] = [
  ['all', 'Toți'],
  ['party', '⚔️ În luptă'],
  ['hungry', '😟 Flămânzi'],
  ['adults', 'Juvenili și adulți'],
  ['free', 'Liberi'],
];

const RARITY_RANK = Object.keys(RARITIES);

function matchesFilter(d: Dino, filter: Filter, state: NonNullable<Game['state']>, now: number): boolean {
  if (filter === 'party') return state.party.includes(d.id);
  if (filter === 'hungry') return hoursSinceMeal(d, now) >= TROUGH_HOURS;
  if (filter === 'adults') return SPECIES[d.speciesId].stage !== 'pui';
  if (filter === 'free') return !d.molt && !state.workers.some((w) => w.dinoId === d.id) && state.breeding?.a !== d.id && state.breeding?.b !== d.id;
  return true;
}

function sortDinos(list: Dino[], sort: Sort, now: number): Dino[] {
  const by: Record<Sort, (a: Dino, b: Dino) => number> = {
    level: (a, b) => b.level - a.level,
    stars: (a, b) => geneStars(b.genes) - geneStars(a.genes) || b.level - a.level,
    rarity: (a, b) => RARITY_RANK.indexOf(b.rarity ?? 'comun') - RARITY_RANK.indexOf(a.rarity ?? 'comun'),
    bond: (a, b) => b.bond - a.bond,
    hunger: (a, b) => hoursSinceMeal(b, now) - hoursSinceMeal(a, now),
    name: (a, b) => a.nickname.localeCompare(b.nickname, 'ro'),
  };
  return [...list].sort(by[sort]);
}

function TroughPanel({ game }: { game: Game }) {
  const state = game.state!;
  const total = troughTotal(state);
  const foods = (Object.keys(ITEMS) as ItemId[]).filter((id) => ITEMS[id].food && (state.inventory[id] ?? 0) > 0);
  const stored = (Object.keys(state.trough) as ItemId[]).filter((id) => (state.trough[id] ?? 0) > 0);
  return (
    <Panel title="Troaca" icon="🥣" className="trough-panel" right={<span className="muted small"><ThemeText>{total}</ThemeText>/<ThemeText>{TROUGH_CAPACITY}</ThemeText></span>}>
      <p className="muted small">
        Cine n-a mâncat de <ThemeText>{TROUGH_HOURS}</ThemeText> h mănâncă singur de aici, chiar și cât lipsești. Fiecare își alege mâncarea preferată.
      </p>
      <Bar value={total} max={TROUGH_CAPACITY} color="#f5b942" thin />
      {stored.length > 0 && (
        <div className="trough-row">
          {stored.map((id) => (
            <button key={id} className="trough-item" onClick={() => game.dispatch({ type: 'troughWithdraw', itemId: id })} title="Scoate înapoi în rucsac">
              <ItemArt item={id} /> ×<ThemeText>{state.trough[id]}</ThemeText>
            </button>
          ))}
        </div>
      )}
      {foods.length === 0 ? (
        <p className="muted small">N-ai mâncare în rucsac de pus în troacă.</p>
      ) : (
        <div className="trough-add">
          <span className="muted small">Pune din rucsac:</span>
          {foods.map((id) => (
            <button
              key={id}
              className="btn tiny"
              disabled={total >= TROUGH_CAPACITY}
              onClick={() => game.dispatch({ type: 'troughDeposit', itemId: id, qty: state.inventory[id] ?? 0 })}
              title={`Pune toate (${state.inventory[id]})`}
            >
              <ItemArt item={id} /> +<ThemeText>{state.inventory[id]}</ThemeText>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
