import { ThemeText } from '../components/ThemeText';
import { EggIcon, ItemArt, RelicIcon } from '../components/AssetIcon';
// Expediții: regiuni păzite de câte un Alfa. Luptă directă (privită) sau expediție idle (și offline).

import { useState } from 'react';
import {
  QUEUE_MAX,
  type BattleResult,
  type GameEvent,
  type Haul,
  ITEMS,
  RELICS,
  SPECIES,
  ZONES,
  type Zone,
  partyDinos,
  zoneUnlocked,
} from '@shared/game';
import { BossLive } from '../components/DinoLive';
import { DinoSprite } from '../components/DinoSprite';
import { ZONE_BOSS, bossStill } from '../content/dragons';
import { sceneBackground } from '../content/art';
import { Panel } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatSeconds } from '../utils/format';
import { BattleView } from './BattleView';
import { FormationModal, FormationSummary } from './FormationPanel';

type Prep = { kind: 'arrange' } | { kind: 'battle' | 'idle'; zone: Zone; alpha?: boolean };

interface Fight {
  zone: Zone;
  alpha: boolean;
  result: BattleResult;
  haul: Haul;
  events: GameEvent[];
}

export function ExpeditionsScreen({ game }: { game: Game }) {
  const state = game.state!;
  const party = partyDinos(state);
  const [fight, setFight] = useState<Fight | null>(null);
  /** Fereastra de formație, deschisă înainte de luptă sau expediție. */
  const [prep, setPrep] = useState<Prep | null>(null);
  const onExpedition = state.activity?.kind === 'expedition' ? state.activity.zoneId : null;

  const start = (zone: Zone, alpha: boolean) => {
    const res = game.dispatch({ type: 'battle', zoneId: zone.id, alpha }, { quiet: true });
    // Mesajele (nivel nou, ouă, relicve) apar după animație, ca să nu strice surpriza.
    if (res?.battle && res.haul) setFight({ zone, alpha, result: res.battle, haul: res.haul, events: res.events });
  };

  return (
    <div className="screen">
      <FormationSummary game={game} onEdit={() => setPrep({ kind: 'arrange' })} />

      <div className="zone-list">
        {ZONES.map((zone, index) => {
          const unlocked = zoneUnlocked(state, zone);
          const here = onExpedition === zone.id;
          const a = zone.alpha;
          const beaten = state.alphas.includes(zone.id);
          const keys = a.key ? (state.inventory[a.key] ?? 0) : 0;
          const prev = zone.requires ? ZONES.find((z) => z.id === zone.requires)! : null;
          const boss = ZONE_BOSS[zone.id];
          return (
            <section key={zone.id} className={`zc biome-${zone.id}${here ? ' running' : ''}${unlocked ? '' : ' locked'}${beaten ? ' beaten' : ''}`}>
              {/* Bannerul: scena regiunii, numele și bossul ei. */}
              <header className="zc-banner" style={sceneBackground(zone.id, 0.15)}>
                <div className="zc-title">
                  <span className="zc-region">
                    <ThemeText>{zone.icon}</ThemeText> Regiunea <ThemeText>{index + 1}</ThemeText>
                  </span>
                  <h3><ThemeText>{zone.name}</ThemeText></h3>
                  <span className="zc-levels">
                    Nivel <ThemeText>{zone.levels[0]}</ThemeText>–<ThemeText>{zone.levels[1]}</ThemeText>
                  </span>
                  {here && <span className="zc-running"><ThemeText>{"🗺️ În expediție…"}</ThemeText></span>}
                </div>
                <div className="zc-boss">
                  <span className="zc-boss-glow" />
                  {unlocked ? (
                    <BossLive zoneId={zone.id} speciesId={a.speciesId} />
                  ) : (
                    <DinoSprite speciesId={a.speciesId} art={bossStill(zone.id)} size={190} flip silhouette />
                  )}
                  <div className="zc-boss-plate">
                    <span className="zc-boss-tag"><ThemeText>{!unlocked ? '🔒 ALFA' : beaten ? '★ ÎNVINS' : 'ALFA'}</ThemeText></span>
                    <b><ThemeText>{unlocked ? boss.name : '???'}</ThemeText></b>
                    <small>
                      <ThemeText>{a.title}</ThemeText> · nv. <ThemeText>{a.level}</ThemeText>
                    </small>
                  </div>
                </div>
                {!unlocked && (
                  <div className="zc-lock">
                    <span><ThemeText>{"🔒"}</ThemeText></span>
                    <p>
                      Drumul e păzit. Învinge-l pe <b><ThemeText>{prev?.alpha.title}</ThemeText></b> din <ThemeText>{prev?.name}</ThemeText>.
                    </p>
                  </div>
                )}
              </header>

              {unlocked && (
                <div className="zc-body">
                  <p className="zc-blurb"><ThemeText>{zone.blurb}</ThemeText></p>

                  <div className="zc-section">
                    <h4>Inamici</h4>
                    <div className="zc-enemies">
                      {zone.enemies.map((id) => {
                        const seen = !!state.atlas[id]?.seen;
                        return (
                          <figure key={id} className="zc-enemy" title={seen ? SPECIES[id].name : '???'}>
                            <span className="zc-enemy-frame">
                              <DinoSprite speciesId={id} size={64} flip shadowed={seen} silhouette={!seen} aura={false} />
                            </span>
                            <figcaption><ThemeText>{seen ? SPECIES[id].name : '???'}</ThemeText></figcaption>
                          </figure>
                        );
                      })}
                    </div>
                  </div>

                  <div className="zc-section">
                    <h4>Pradă</h4>
                    <div className="drops">
                      {zone.drops.map((d) => (
                        <span key={d.item} className="drop" title={ITEMS[d.item].name}>
                          <ItemArt item={d.item} /> <ThemeText>{ITEMS[d.item].name}</ThemeText> · <ThemeText>{Math.round(d.chance * 100)}</ThemeText>%
                        </span>
                      ))}
                      {zone.egg.chance > 0 && <span className="drop egg-drop"><EggIcon /> Ou · <ThemeText>{+(zone.egg.chance * 100).toFixed(1)}</ThemeText>%</span>}
                    </div>
                  </div>

                  <div className="zc-section zc-reward">
                    <h4>Premiul Alfa</h4>
                    <div className="drops">
                      <span className="drop zc-relic">
                        <RelicIcon relic={a.relic} /> <ThemeText>{RELICS[a.relic].name}</ThemeText>
                      </span>
                      <span className="drop"><EggIcon /> ou <ThemeText>{a.egg}</ThemeText></span>
                      <span className="drop"><ThemeText>{"✨ "}</ThemeText><ThemeText>{a.sparks}</ThemeText></span>
                    </div>
                  </div>

                  <footer className="zc-actions">
                    <div className="zc-actions-main">
                      <button
                        className="btn primary"
                        disabled={!!onExpedition}
                        onClick={() => setPrep({ kind: 'battle', zone })}
                        title={onExpedition ? 'Haita e în expediție' : ''}
                      ><ThemeText>{"\r\n                        ⚔️ Luptă acum\r\n                      "}</ThemeText></button>
                      {!here && (
                        <button className="btn" onClick={() => setPrep({ kind: 'idle', zone })} title={`O luptă la ${formatSeconds(zone.seconds)}, și offline`}><ThemeText>{"\r\n                          🕒 Expediție idle\r\n                        "}</ThemeText></button>
                      )}
                      {game.state!.activity && game.state!.activity.kind !== 'expedition' && game.state!.queue.length < QUEUE_MAX && (
                        <button
                          className="btn"
                          disabled={party.length === 0}
                          onClick={() => game.dispatch({ type: 'enqueue', item: { kind: 'expedition', zoneId: zone.id } })}
                          title="Pleacă în expediție după ce se termină activitatea curentă"
                        ><ThemeText>{"\r\n                          ＋ Coadă\r\n                        "}</ThemeText></button>
                      )}
                    </div>
                    <button
                      className="btn danger-glow"
                      disabled={!!onExpedition || (!!a.key && keys < 1)}
                      onClick={() => setPrep({ kind: 'battle', zone, alpha: true })}
                    >
                      <ThemeText>{a.key ? <ItemArt item={a.key} /> : '💀 '}</ThemeText>
                      <ThemeText>{beaten ? 'Luptă din nou cu Alfa' : 'Provoacă Alfa'}</ThemeText>
                      <ThemeText>{a.key ? ` (${keys})` : ''}</ThemeText>
                    </button>
                  </footer>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="hint">
        Expediția idle luptă singură (o luptă la 45–75 s, maximum 10 ore). După 3 înfrângeri la rând, haita se retrage.
        Haita se reface complet între lupte.
      </p>

      {prep && (
        <FormationModal
          game={game}
          title={prepTitle(prep)}
          startLabel={prep.kind === 'arrange' ? 'Gata' : prep.kind === 'idle' ? '🕒 Pornește expediția' : '⚔️ Începe lupta'}
          onClose={() => setPrep(null)}
          onStart={() => {
            setPrep(null);
            if (prep.kind === 'battle') start(prep.zone, !!prep.alpha);
            else if (prep.kind === 'idle') game.dispatch({ type: 'expedition', zoneId: prep.zone.id });
          }}
        />
      )}

      {fight && (
        <BattleView
          game={game}
          zone={fight.zone}
          alpha={fight.alpha}
          result={fight.result}
          haul={fight.haul}
          onClose={() => {
            game.pushToasts(fight.events);
            setFight(null);
          }}
          onAgain={() => {
            game.pushToasts(fight.events);
            setFight(null);
            setTimeout(() => start(fight.zone, fight.alpha), 50);
          }}
        />
      )}
    </div>
  );
}

function prepTitle(prep: Prep): string {
  if (prep.kind === 'arrange') return 'Formația de luptă';
  if (prep.alpha) return `Pregătește-te: ${prep.zone.alpha.title}`;
  return `${prep.zone.icon} ${prep.zone.name}`;
}
