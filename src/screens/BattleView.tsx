import { ItemArt, RelicIcon } from '../components/AssetIcon';
// Redarea animată a unei lupte. Rezultatul e deja calculat de reguli; aici doar îl punem în scenă.
// Implicit: arena cu dragonii animați (Spine: mers, zbor, atac, ultimată, sărbătoare), al cărei ritm îl dă
// durata animațiilor. Cu grafică redusă sau fără WebGL: varianta 2D cu imagini statice. Ambele redau același jurnal.

import { useEffect, useMemo, useRef, useState } from 'react';
import { type BattleResult, type Combatant, type Haul, type ItemId, ITEMS, RELICS, TYPES, type Zone } from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { EggSprite } from '../components/EggSprite';
import { sceneBackground } from '../content/art';
import { Bar, Modal } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { bossStill } from '../content/dragons';
import type { Arena } from '../battle/Arena';
import { sound } from '../utils/sound';

interface Props {
  game: Game;
  zone: Zone;
  alpha?: boolean;
  result: BattleResult;
  haul: Haul;
  onClose: () => void;
  onAgain?: () => void;
}

const BASE_STEP = 1050;
const FAINT_STEP = 900;
const INTRO_MS = 2200;

interface DamagePop {
  id: number;
  x: number;
  y: number;
  text: string;
  cls: string;
}

export function BattleView({ game, zone, alpha, result, haul, onClose, onAgain }: Props) {
  const [intro, setIntro] = useState(!!alpha);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [impacted, setImpacted] = useState(false);
  const byKey = useMemo(() => Object.fromEntries(result.start.map((c) => [c.key, c])), [result]);
  const [use3d, setUse3d] = useState(webglAvailable);
  const [ready, setReady] = useState(!use3d);
  const [pops, setPops] = useState<DamagePop[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<Arena | null>(null);
  const finished = step >= result.events.length;
  // Viteza se schimbă din mers: arena accelerează tot, iar pasul curent nu se reia.
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const stepMs = (ev: (typeof result.events)[number]) => (ev.t === 'faint' ? FAINT_STEP : BASE_STEP) / speedRef.current;

  // Arena: se încarcă o dată, se eliberează la închidere. Dacă nu poate porni, lupta se vede în varianta 2D.
  useEffect(() => {
    if (!use3d || !stage.current) return;
    const el = stage.current;
    let alive = true;
    let s: Arena | null = null;
    import('../battle/Arena')
      .then(({ Arena }) => {
        if (!alive) return;
        s = new Arena(el, zone.id);
        scene.current = s;
        return s.load(result.start);
      })
      .then(() => alive && setReady(true))
      .catch((e) => {
        console.warn('Arena nu a pornit, lupta se vede în 2D.', e);
        if (!alive) return;
        setUse3d(false);
        setReady(true);
      });
    return () => {
      alive = false;
      s?.dispose();
      scene.current = null;
    };
  }, [use3d, zone.id, result]);

  useEffect(() => {
    if (!intro || !ready) return;
    sound.bigHit();
    const id = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(id);
  }, [intro, ready]);

  useEffect(() => {
    if (intro || finished || !ready) return;
    const ev = result.events[step];
    // Arena spune cât durează animația pasului și când lovește; varianta 2D are pași ficși.
    const plan = scene.current?.play(ev);
    const rate = speedRef.current;
    const ms = plan ? (plan.duration * 1000) / rate : stepMs(ev);
    const impactMs = plan ? (plan.impact * 1000) / rate : ms * 0.1;
    setImpacted(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (ev.t === 'attack') {
      // Lovitura se aude și se vede exact când animația atacului ajunge la țintă.
      timers.push(
        setTimeout(() => {
          (ev.crit || ev.eff > 1 ? sound.bigHit : sound.hit)();
          setImpacted(true);
          const pos = scene.current?.screenPos(ev.target);
          if (pos) {
            const cls = `${ev.crit ? ' crit' : ''}${ev.eff > 1 ? ' super' : ''}`;
            // Sub cartonașele de viață din colțuri, ca cifra să nu se ascundă după ele.
            const cards = Math.max(...(['player', 'enemy'] as const).map((sd) => result.start.filter((c) => c.side === sd).length));
            const y = Math.max(pos.y, cards * 64 + 40);
            const pop = { id: Date.now() + Math.random(), x: pos.x, y, text: `−${ev.damage}`, cls };
            setPops((p) => [...p.slice(-4), pop]);
          }
        }, impactMs),
      );
    }
    if (ev.t === 'end') (ev.win ? sound.win : sound.lose)();
    timers.push(setTimeout(() => setStep((s) => s + 1), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, step, finished, result, ready]);

  useEffect(() => scene.current?.setSpeed(speed), [speed, ready]);

  // Starea curentă (HP, KO) reconstruită din evenimentele deja jucate.
  const hp: Record<string, number> = {};
  const fainted = new Set<string>();
  for (const c of result.start) hp[c.key] = c.hp;
  for (let i = 0; i < Math.min(step, result.events.length); i++) {
    const ev = result.events[i];
    if (ev.t === 'attack') hp[ev.target] = ev.hp;
    if (ev.t === 'faint') fainted.add(ev.target);
  }
  const current = result.events[Math.min(step, result.events.length - 1)];
  const lastAttack = current.t === 'attack' && !finished ? current : null;
  if (lastAttack && impacted) hp[lastAttack.target] = lastAttack.hp;
  const heavy = !!lastAttack && impacted && (lastAttack.crit || lastAttack.eff > 1);
  const enemyAlpha = result.start.find((c) => c.side === 'enemy' && c.boss);

  const message = (() => {
    if (!ready) return 'Se pregătește arena…';
    if (step === 0 && !lastAttack) return alpha ? `${enemyAlpha?.name} îți iese în cale!` : `Prădători corupți în ${zone.name}!`;
    if (current.t === 'attack') {
      const a = byKey[current.actor];
      let txt = `${a.name} folosește ${current.move}!`;
      if (impacted) {
        if (current.eff > 1) txt += ' Lovitură devastatoare!';
        else if (current.eff < 1) txt += ' Abia l-a zgâriat…';
        if (current.crit) txt += ' CRITIC!';
      }
      return txt;
    }
    if (current.t === 'faint') {
      const c = byKey[current.target];
      return c.side === 'enemy' ? `${c.name} se prăbușește. Umbra se risipește din el.` : `${c.name} e la pământ!`;
    }
    return current.win ? 'VICTORIE' : 'Haita ta a fost zdrobită…';
  })();

  const side = (s: 'player' | 'enemy') => result.start.filter((c) => c.side === s);

  const card = (c: Combatant) => {
    const ratio = hp[c.key] / c.hpMax;
    return (
      <div key={c.key} className={`fighter-card ${c.side}${fainted.has(c.key) ? ' out' : ''}${c.boss ? ' is-alpha' : ''}`}>
        <div className="row between">
          <b>
            {c.side === 'player' && <span title={c.back ? 'Rândul din spate' : 'Rândul din față'}>{c.back ? '🏹 ' : '🛡️ '}</span>}
            {c.name}
          </b>
          <small>Nv. {c.level}</small>
        </div>
        <Bar value={hp[c.key]} max={c.hpMax} thin color={ratio > 0.5 ? '#5cd65a' : ratio > 0.2 ? '#f2c84b' : '#ef4b3f'} />
        <small className="muted">
          {hp[c.key]}/{c.hpMax}
        </small>
      </div>
    );
  };

  // Varianta 2D (grafică redusă): sprite-uri cu lovituri și tăieturi CSS.
  const renderFighter2d = (c: Combatant) => {
    const acting = lastAttack?.actor === c.key;
    const hit = lastAttack?.target === c.key;
    const dino = c.dinoId ? game.state!.dinos.find((d) => d.id === c.dinoId) : undefined;
    return (
      <div key={c.key} className={`fighter ${c.side}${c.back ? ' back-row' : ''}${fainted.has(c.key) ? ' fainted' : ''}${c.boss ? ' is-alpha' : ''}`}>
        {card(c)}
        <div className={`fighter-sprite${acting ? (c.side === 'player' ? ' lunge-right' : ' lunge-left') : ''}${hit ? ' hit' : ''}`} key={hit || acting ? step : 'idle'}>
          <DinoSprite
            speciesId={c.speciesId}
            art={c.boss ? bossStill(zone.id) : undefined}
            albino={c.variant === 'albino'}
            size={c.boss ? 170 : 108}
            flip={c.side === 'enemy'}
            shadowed={c.side === 'enemy' && !fainted.has(c.key)}
            relic={dino?.relic ?? (c.boss ? zone.alpha.relic : undefined)}
          />
          {hit && lastAttack && (
            <>
              <span
                className={`slash${lastAttack.special ? ' special' : ''}`}
                style={{ ['--slash' as string]: lastAttack.moveType ? TYPES[lastAttack.moveType].color : '#ffffff' }}
              />
              <span className={`dmg${lastAttack.crit ? ' crit' : ''}${lastAttack.eff > 1 ? ' super' : ''}`}>−{lastAttack.damage}</span>
            </>
          )}
          {fainted.has(c.key) && c.side === 'enemy' && <span className="umbra-dissolve" />}
        </div>
      </div>
    );
  };

  return (
    <Modal wide className="battle-modal" onClose={finished ? onClose : undefined}>
      <div
        className={`arena biome-${zone.id}${use3d ? ' arena-3d' : ''}${heavy && !use3d ? ' shake' : ''}`}
        key={heavy && !use3d ? `s${step}` : 'arena'}
        style={sceneBackground(zone.id, use3d ? 0.1 : 0.2)}
      >
        <div className="biome-mist" />
        {use3d ? (
          <>
            <div className="arena3d-stage" ref={stage} />
            <div className="arena-cards player">{side('player').map(card)}</div>
            <div className="arena-cards enemy">{side('enemy').map(card)}</div>
            {pops.map((p) => (
              <span key={p.id} className={`dmg3d${p.cls}`} style={{ left: p.x, top: p.y }} onAnimationEnd={() => setPops((all) => all.filter((x) => x.id !== p.id))}>
                {p.text}
              </span>
            ))}
            {!ready && <div className="arena-loading">Se pregătește arena…</div>}
          </>
        ) : (
          <>
            <div className="embers" />
            <div className="arena-side player">{side('player').map(renderFighter2d)}</div>
            <div className="vs">VS</div>
            <div className="arena-side enemy">{side('enemy').map(renderFighter2d)}</div>
          </>
        )}
        {intro && enemyAlpha && ready && (
          <div className="alpha-intro">
            <span className="intro-slash" />
            <small>{zone.name}</small>
            <h2>{zone.alpha.title}</h2>
            <p>Învinge-l, sau vei fi devorat.</p>
          </div>
        )}
        {finished && <div className={`result-banner ${result.win ? 'win' : 'lose'}`}>{result.win ? 'VICTORIE' : 'ÎNFRÂNGERE'}</div>}
      </div>
      <div className="battle-log" aria-live="polite">
        {intro && ready ? '…' : message}
      </div>
      {!finished ? (
        <div className="row center gap-s">
          {[1, 2, 4].map((s) => (
            <button key={s} className={`btn small${speed === s ? ' primary' : ''}`} onClick={() => setSpeed(s)}>
              {s === 1 ? '▶' : s === 2 ? '⏩' : '⏭'} ×{s}
            </button>
          ))}
          <button
            className="btn small ghost"
            onClick={() => {
              setIntro(false);
              setStep(result.events.length);
            }}
          >
            Doar rezultatul
          </button>
        </div>
      ) : (
        <div className={`battle-result pop-in ${result.win ? 'win' : 'lose'}`}>
          {result.win ? (
            <HaulList haul={haul} game={game} />
          ) : (
            <p className="muted">Haita s-a retras rănită și se reface în tabără. Devino mai puternic și întoarce-te.</p>
          )}
          <div className="row center gap-s">
            {onAgain && (
              <button
                className="btn primary"
                onClick={onAgain}
                disabled={!!alpha && !!zone.alpha.key && (game.state!.inventory[zone.alpha.key] ?? 0) < 1}
              >
                ⚔️ Încă o luptă
              </button>
            )}
            <button className="btn" onClick={onClose}>
              Gata
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function HaulList({ haul, game }: { haul: Haul; game: Game }) {
  const items = Object.entries(haul.items) as [ItemId, number][];
  const eggs = haul.eggs.map((id) => game.state!.eggs.find((e) => e.id === id)).filter((e) => !!e);
  if (!items.length && !eggs.length && !haul.sparks && !haul.diamonds && !haul.relic) return <p className="muted">Nimic de data asta.</p>;
  return (
    <div className="haul">
      {haul.relic && (
        <span className="haul-item relic-haul" style={{ ['--relic' as string]: RELICS[haul.relic].color }}>
          <RelicIcon relic={haul.relic} /> {RELICS[haul.relic].name}!
        </span>
      )}
      {haul.sparks > 0 && <span className="haul-item">✨ +{haul.sparks}</span>}
      {haul.diamonds > 0 && <span className="haul-item">💎 +{haul.diamonds}</span>}
      {items.map(([id, n]) => (
        <span key={id} className="haul-item" title={ITEMS[id].name}>
          <ItemArt item={id} /> +{n}
        </span>
      ))}
      {eggs.map((egg) => (
        <span key={egg.id} className="haul-item egg-haul">
          <EggSprite egg={egg} size={30} /> Ou nou!
        </span>
      ))}
    </div>
  );
}

/** WebGL disponibil? Dacă nu, lupta folosește varianta 2D. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
