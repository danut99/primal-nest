// Expediții: regiuni păzite de câte un Alfa. Luptă directă (privită) sau expediție idle (și offline).

import { useState } from 'react';
import {
  type BattleResult,
  type GameEvent,
  type Haul,
  ITEMS,
  RELICS,
  SPECIES,
  ZONES,
  type Zone,
  partyDinos,
  partySize,
  zoneUnlocked,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { sceneBackground } from '../content/art';
import { Panel } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { formatSeconds } from '../utils/format';
import { BattleView } from './BattleView';
import { SkillHeader } from './ActivitiesScreen';

interface Fight {
  zone: Zone;
  alpha: boolean;
  result: BattleResult;
  haul: Haul;
  events: GameEvent[];
}

export function ExpeditionsScreen({ game, goPack }: { game: Game; goPack: () => void }) {
  const state = game.state!;
  const party = partyDinos(state);
  const [fight, setFight] = useState<Fight | null>(null);
  const onExpedition = state.activity?.kind === 'expedition' ? state.activity.zoneId : null;

  const start = (zone: Zone, alpha: boolean) => {
    const res = game.dispatch({ type: 'battle', zoneId: zone.id, alpha }, { quiet: true });
    // Mesajele (nivel nou, ouă, relicve) apar după animație, ca să nu strice surpriza.
    if (res?.battle && res.haul) setFight({ zone, alpha, result: res.battle, haul: res.haul, events: res.events });
  };

  return (
    <div className="screen">
      <Panel title="Haita de luptă" icon="⚔️" right={<button className="btn small" onClick={goPack}>Schimbă</button>}>
        <SkillHeader game={game} skill="imblanzire" />
        {party.length === 0 ? (
          <p className="empty-state">Haita e goală. Alege dinozauri din ecranul Haită.</p>
        ) : (
          <div className="party-row">
            {party.map((d) => (
              <div key={d.id} className="party-member">
                <DinoSprite speciesId={d.speciesId} albino={d.variant === 'albino'} relic={d.relic} size={84} className="bob" />
                <b>{d.nickname}</b>
                <small>Nv. {d.level}</small>
              </div>
            ))}
            {Array.from({ length: partySize(state) - party.length }, (_, i) => (
              <div key={i} className="party-member empty">
                <span>+</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="zone-list">
        {ZONES.map((zone) => {
          const unlocked = zoneUnlocked(state, zone);
          const here = onExpedition === zone.id;
          const a = zone.alpha;
          const beaten = state.alphas.includes(zone.id);
          const keys = a.key ? (state.inventory[a.key] ?? 0) : 0;
          const prev = zone.requires ? ZONES.find((z) => z.id === zone.requires)! : null;
          return (
            <section
              key={zone.id}
              className={`zone-card biome-${zone.id}${here ? ' running' : ''}${unlocked ? '' : ' locked'}`}
              style={sceneBackground(zone.id, 0.4)}
            >
              <div className="biome-mist" />
              <div className="zone-body">
                <div className="zone-head">
                  <span className="zone-icon">{zone.icon}</span>
                  <div>
                    <h3>{zone.name}</h3>
                    <small>
                      Nivel {zone.levels[0]}–{zone.levels[1]} · Alfa nv. {a.level}
                    </small>
                  </div>
                </div>
                {unlocked ? (
                  <>
                    <p className="zone-blurb">{zone.blurb}</p>
                    <div className="zone-enemies">
                      {zone.enemies.map((id) => (
                        <DinoSprite
                          key={id}
                          speciesId={id}
                          size={54}
                          flip
                          shadowed={!!state.atlas[id]?.seen}
                          silhouette={!state.atlas[id]?.seen}
                          title={state.atlas[id]?.seen ? SPECIES[id].name : '???'}
                        />
                      ))}
                    </div>
                    <div className="drops">
                      {zone.drops.map((d) => (
                        <span key={d.item} className="drop" title={ITEMS[d.item].name}>
                          {ITEMS[d.item].icon} {Math.round(d.chance * 100)}%
                        </span>
                      ))}
                      {zone.egg.chance > 0 && <span className="drop egg-drop">🥚 {+(zone.egg.chance * 100).toFixed(1)}%</span>}
                    </div>
                    <div className="zone-actions">
                      <button
                        className="btn primary"
                        disabled={party.length === 0 || !!onExpedition}
                        onClick={() => start(zone, false)}
                        title={onExpedition ? 'Haita e în expediție' : ''}
                      >
                        ⚔️ Luptă acum
                      </button>
                      {here ? (
                        <span className="running-tag">🗺️ În expediție…</span>
                      ) : (
                        <button
                          className="btn"
                          disabled={party.length === 0}
                          onClick={() => game.dispatch({ type: 'expedition', zoneId: zone.id })}
                          title={`O luptă la ${formatSeconds(zone.seconds)}, și offline`}
                        >
                          🕒 Expediție idle
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="zone-locked">
                    🔒 Drumul e păzit. Învinge-l pe <b>{prev?.alpha.title}</b> din {prev?.name}.
                  </p>
                )}
              </div>

              <div className={`alpha-panel${beaten ? ' beaten' : ''}`}>
                <div className="alpha-art">
                  <span className="alpha-glow" />
                  <DinoSprite
                    speciesId={a.speciesId}
                    size={150}
                    flip
                    shadowed={!beaten && unlocked}
                    silhouette={!unlocked}
                    relic={unlocked && !beaten ? a.relic : undefined}
                  />
                </div>
                <div className="alpha-info">
                  <span className="alpha-tag">{beaten ? 'ÎNVINS' : 'ALFA'}</span>
                  <b>{unlocked ? `${SPECIES[a.speciesId].name}, ${a.title}` : '???'}</b>
                  <small>
                    Pradă: {RELICS[a.relic].icon} {RELICS[a.relic].name} · 🥚 ou {a.egg} · ✨ {a.sparks}
                  </small>
                  <button
                    className="btn danger-glow"
                    disabled={!unlocked || party.length === 0 || !!onExpedition || (!!a.key && keys < 1)}
                    onClick={() => start(zone, true)}
                  >
                    {a.key ? `${ITEMS[a.key].icon} ` : '💀 '}
                    {beaten ? 'Luptă din nou' : 'Provoacă-l'}
                    {a.key ? ` (${keys})` : ''}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <p className="hint">
        Expediția idle luptă singură (o luptă la 45–75 s, maximum 10 ore). După 3 înfrângeri la rând, haita se retrage.
        Haita se reface complet între lupte.
      </p>

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
