// Ce se deschide când atingi o clădire: habitat, fermă, incubator, bârlog, forjă, arenă sau avanpost.
// Două coloane: în stânga clădirea (arta, cifrele, nivelul), în dreapta ce faci în ea. La habitat, dinozaurul
// ales stă mare pe piedestal, cu acțiunile lui; dedesubt, rândul de portrete din care îl alegi.

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  BREED_LEVEL,
  BUILDINGS,
  CROPS,
  ELEMENTS,
  FEED_COST,
  MAX_HABITAT_LEVEL,
  buildingUpgradeCost,
  buildingUpgradeFragments,
  upgradeLock,
  MAX_LEVEL,
  breedOdds,
  denRecipeFor,
  denRecipeHint,
  DEN_RECIPES,
  DEN_RARE_CHANCE,
  DEN_ADULT_BONUS,
  DEN_REST_MS,
  goldCap,
  habitatCapacity,
  habitatRate,
  hatcherySlots,
  homesFor,
  dinoIncome,
  GEAR_SLOTS,
  ITEMS,
  ITEM_LIST,
  MATERIALS,
  MATERIAL_IDS,
  buildingUpgradeParts,
  hasMaterials,
  itemCount,
  type GearSlot,
  type Item,
  type MaterialId,
  dinoPower,
  dinoUnavailable,
  onAdventure,
  isRecovering,
  pendingGold,
  residents,
  rushCost,
  sellPrice,
  speciesOf,
  stageForLevel,
  EVOLUTION_STAGES,
  FARM_PLOTS,
  farmPlots,
  type Building,
  type FarmPlot,
  type Dino,
  type ElementId,
} from '@shared/game';
import { AdventurePanel } from './AdventurePanel';
import type { Game } from '../hooks/useGame';
import { EggIcon, HabitatEggShop } from '../components/Eggs';
import { DinoThumb, Modal, Need, Progress, RarityBadge, formatNumber, formatTime } from '../components/ui';
import { HABITAT_ISLANDS } from '../world/islands';
import { useNav } from '../components/nav';
import { BuildingPreview } from '../world/BuildingArt';

interface Props {
  game: Game;
  building: Building;
  onClose: () => void;
  onMove?: () => void;
  onDino?: (id: string) => void;
}

const WORLD = import.meta.env.BASE_URL + 'world/';
const TINT: Partial<Record<Building['kind'], string>> = {
  farm: '#7fae45',
  hatchery: '#e0a83e',
  den: '#d0607f',
  arena: '#d0703e',
  outpost: '#3e9a7a',
  forge: '#e0703e',
};
const CROP_ICON: Record<string, string> = { ferigi: '🌿', cicade: '🦗', ginkgo: '🍃', carne: '🍖' };
const MAIN_TITLE: Partial<Record<Building['kind'], string>> = {
  habitat: 'Dinozauri',
  farm: 'Culturi',
  hatchery: 'Ouă',
  den: 'Împerechere',
  forge: 'Fierăria',
};

export function BuildingPanel({ game, building, onClose, onMove, onDino }: Props) {
  // Clădirea din starea curentă (după comenzi se schimbă obiectul).
  const b = game.state.buildings.find((x) => x.id === building.id);
  if (!b) return null;
  const spec = BUILDINGS[b.kind];

  // arena și avanpostul: conținutul are nevoie de toată lățimea, deci clădirea stă într-o bară sus
  if (b.kind === 'arena' || b.kind === 'outpost')
    return (
      <Modal
        title={`${spec.name} · nivel ${b.level}`}
        onClose={onClose}
        bare
        corner={<Corner kind={b.kind} onMove={onMove} />}
        className={`bp-modal bp-adventure ${onMove ? 'with-move' : ''} ${b.kind === 'outpost' ? 'expedition-modal' : 'duel-modal'}`}
      >
        <div className="bp-adv" style={{ '--tint': TINT[b.kind] } as CSSProperties}>
          <header className="bp-bar">
            <img className="bp-bar-art" src={`${WORLD}${b.kind}-building.webp`} alt="" draggable={false} />
            <div className="bp-bar-title">
              <h2>{spec.name}</h2>
              <span className="bp-chip gold">Nv. {b.level}</span>
            </div>
            <div className="bp-bar-actions">
              <UpgradeButton game={game} b={b} compact />
            </div>
          </header>
          <div className="bp-adv-body">
            <AdventurePanel game={game} building={b} />
          </div>
        </div>
      </Modal>
    );

  const island = b.kind === 'habitat' ? HABITAT_ISLANDS[b.element!] : undefined;
  const title = island ? island.name : spec.name;
  const tint = island ? ELEMENTS[b.element!].color : (TINT[b.kind] ?? '#c9a86a');
  return (
    <Modal
      title={`${title} · nivel ${b.level}`}
      onClose={onClose}
      bare
      corner={<Corner kind={b.kind} element={b.element} onMove={onMove} />}
      className={`bp-modal ${onMove ? 'with-move' : ''}`}
    >
      <div className="bp" style={{ '--tint': tint } as CSSProperties}>
        <aside className="bp-side">
          <div className={`bp-art ${island ? 'island' : ''}`}>
            {b.kind === 'forge' ? (
              <BuildingPreview kind="forge" />
            ) : (
              <img src={island ? island.image : `${WORLD}${b.kind}-building.webp`} alt="" draggable={false} />
            )}
          </div>
          <div className="bp-title">
            <h2>{title}</h2>
            <div className="bp-chips">
              {island && (
                <span className="bp-chip">
                  {ELEMENTS[b.element!].icon} {ELEMENTS[b.element!].name}
                </span>
              )}
              <span className="bp-chip gold">Nv. {b.level}</span>
            </div>
          </div>
          <div className="bp-stats">
            <SideStats game={game} b={b} />
          </div>
          <SideActions game={game} b={b} />
        </aside>
        <section className="bp-main">
          {/* titlul stă fix, pe rândul butoanelor din colț; doar conținutul de sub el derulează */}
          <header className="bp-main-head">
            <h3 className="bp-main-title">{MAIN_TITLE[b.kind]}</h3>
          </header>
          <div className="bp-main-body">
            {b.kind === 'habitat' && <HabitatMain game={game} b={b} onDino={onDino} />}
            {b.kind === 'farm' && <FarmMain game={game} b={b} />}
            {b.kind === 'hatchery' && <HatcheryMain game={game} onDino={onDino} />}
            {b.kind === 'den' && <DenMain game={game} />}
            {b.kind === 'forge' && <ForgeMain game={game} b={b} />}
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Colțul panoului: articolul clădirii din Wikipedia și, unde se poate, mutarea. */
function Corner({ kind, element, onMove }: { kind: Building['kind']; element?: ElementId; onMove?: () => void }) {
  const nav = useNav();
  return (
    <>
      <button
        className="corner-button"
        title="Cum funcționează · Wikipedia"
        aria-label="Cum funcționează"
        onClick={() => nav({ to: 'wiki', article: element ? `world-${element}` : `building-${kind}` })}
      >
        📚
      </button>
      {onMove && (
        <button className="corner-button" onClick={onMove}>
          ✥ Mută
        </button>
      )}
    </>
  );
}

// ---------- coloana din stânga ----------

function Meter({
  icon,
  value,
  label,
  children,
}: {
  icon: string;
  value: ReactNode;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="bp-meter">
      <span className="bp-meter-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="bp-meter-copy">
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
      {children}
    </div>
  );
}

function SideStats({ game, b }: { game: Game; b: Building }) {
  const { state, now, run } = game;
  if (b.kind === 'habitat') {
    const gold = pendingGold(state, b, now);
    const cap = goldCap(b);
    const list = residents(state, b.id);
    const seats = habitatCapacity(b);
    return (
      <>
        <div className="bp-gold">
          <div className="bp-gold-top">
            <span className="bp-coin" aria-hidden="true">
              🪙
            </span>
            <strong>{formatNumber(gold)}</strong>
            <small>/ {formatNumber(cap)}</small>
          </div>
          <Progress value={gold / cap} />
          <button
            className="button bp-collect"
            disabled={gold < 1}
            onClick={() => run({ type: 'collect', buildingId: b.id })}
          >
            Strânge
          </button>
        </div>
        <Meter
          icon="⏱"
          value={habitatRate(state, b.id) * (b.boost && b.boost.until > now ? 2 : 1)}
          label={b.boost && b.boost.until > now ? `aur / min · 🗿 ×2 ${formatTime(b.boost.until - now)}` : 'aur / min'}
        >
          {itemCount(state, 'gold-totem') > 0 && (
            <button
              className="bp-use"
              title="Totem de aur: aur dublu o oră"
              onClick={() => run({ type: 'useItem', itemId: 'gold-totem', target: { habitat: b.id } })}
            >
              🗿 {itemCount(state, 'gold-totem')}
            </button>
          )}
        </Meter>
        <Meter
          icon="🦖"
          value={`${list.length}/${seats}`}
          label={b.level < MAX_HABITAT_LEVEL ? 'locuri' : 'locuri · maxim'}
        >
          <span className="bp-seats" aria-hidden="true">
            {Array.from({ length: seats }, (_, i) => (
              <i key={i} className={i < list.length ? 'on' : ''} />
            ))}
          </span>
        </Meter>
      </>
    );
  }
  if (b.kind === 'farm') {
    const plots = farmPlots(b);
    const busy = plots.filter((p) => p).length;
    return (
      <>
        <Meter icon="🍖" value={formatNumber(state.food)} label="hrană" />
        <Meter icon="🌱" value={`${busy}/${plots.length}`} label="straturi ocupate">
          <span className="bp-seats" aria-hidden="true">
            {plots.map((p, i) => (
              <i key={i} className={p ? 'on' : ''} />
            ))}
          </span>
        </Meter>
      </>
    );
  }
  if (b.kind === 'hatchery') {
    const slots = hatcherySlots(state);
    return (
      <Meter icon="🥚" value={`${state.eggs.length}/${slots}`} label="ouă în incubator">
        <span className="bp-seats" aria-hidden="true">
          {Array.from({ length: slots }, (_, i) => (
            <i key={i} className={i < state.eggs.length ? 'on' : ''} />
          ))}
        </span>
      </Meter>
    );
  }
  if (b.kind === 'forge')
    return (
      <div className="bp-materials">
        {MATERIAL_IDS.map((k) => (
          <span key={k} title={MATERIALS[k].name}>
            <b aria-hidden="true">{MATERIALS[k].icon}</b>
            <strong>{state.materials?.[k] ?? 0}</strong>
            <small>{MATERIALS[k].name}</small>
          </span>
        ))}
      </div>
    );
  // bârlog
  const ready = state.dinos.filter((d) => d.level >= BREED_LEVEL && !dinoUnavailable(state, d, now)).length;
  return (
    <>
      <Meter icon="🦖" value={ready} label={`pregătiți · nv. ${BREED_LEVEL}+`} />
      <Meter icon="🥚" value={state.breeding ? formatTime(state.breeding.readyAt - now) : '—'} label="ou în lucru" />
    </>
  );
}

function SideActions({ game, b }: { game: Game; b: Building }) {
  if (buildingUpgradeCost(b) === undefined) return null;
  return (
    <div className="bp-side-actions">
      <UpgradeButton game={game} b={b} />
    </div>
  );
}

/** Butonul de nivel: aur, plus fragmente (ultimul nivel) și piese din forjă (nivelurile mari). */
function UpgradeButton({ game, b, compact }: { game: Game; b: Building; compact?: boolean }) {
  const { state, run } = game;
  const next = buildingUpgradeCost(b);
  if (next === undefined) return null;
  const shards = buildingUpgradeFragments(b);
  const parts = Object.entries(buildingUpgradeParts(b));
  const missing = (state.fragments ?? 0) < shards || parts.some(([id, n]) => itemCount(state, id) < n);
  const lock = upgradeLock(state, b);
  return (
    <div className={`bp-upgrade-wrap ${compact ? 'compact' : ''}`}>
      <button
        className={`button bp-upgrade ${compact ? 'compact' : ''}`}
        data-tour="upgrade"
        disabled={state.gold < next || missing || !!lock}
        onClick={() => run({ type: 'upgrade', buildingId: b.id })}
      >
        <span className="bp-upgrade-arrow" aria-hidden="true">
          ⬆
        </span>
        {compact ? (
          <strong>Nv. {b.level + 1}</strong>
        ) : (
          <span className="bp-upgrade-copy">
            <strong>Nivel {b.level + 1}</strong>
            {b.kind === 'habitat' && <small>{habitatCapacity({ ...b, level: b.level + 1 })} locuri</small>}
            {b.kind === 'farm' && <small>{FARM_PLOTS[b.level]} straturi</small>}
            {b.kind === 'forge' && <small>rețete noi</small>}
          </span>
        )}
        <span className="bp-upgrade-costs">
          {lock && (
            <span className="bp-upgrade-cost lock short" title="Încă blocat">
              🔒 {lock}
            </span>
          )}
          <span className={`bp-upgrade-cost ${state.gold < next ? 'short' : ''}`} title="Aur">
            🪙 {formatNumber(next)}
          </span>
          {shards > 0 && (
            <span
              className={`bp-upgrade-cost shards ${(state.fragments ?? 0) < shards ? 'short' : ''}`}
              title="Fragmente ancestrale din expediții"
            >
              ✦ {Math.min(state.fragments ?? 0, shards)}/{shards}
            </span>
          )}
          {parts.map(([id, n]) => (
            <span
              key={id}
              className={`bp-upgrade-cost part ${itemCount(state, id) < n ? 'short' : ''}`}
              title={`${ITEMS[id].name} · din forjă`}
            >
              {ITEMS[id].icon} {Math.min(itemCount(state, id), n)}/{n}
            </span>
          ))}
        </span>
      </button>
      <UpgradeInfo state={state} b={b} cost={next} shards={shards} parts={parts} lock={lock} />
    </div>
  );
}

/** ⓘ lângă butonul de nivel: fiecare cerință cu numele întreg, unde o obții și dacă o ai deja. */
function UpgradeInfo({
  state,
  b,
  cost,
  shards,
  parts,
  lock,
}: {
  state: Game['state'];
  b: Building;
  cost: number;
  shards: number;
  parts: [string, number][];
  lock: string | null;
}) {
  const [open, setOpen] = useState(false);
  const forge = state.buildings.find((x) => x.kind === 'forge');
  const rows: { icon: string; what: string; how: string; ok: boolean }[] = [];
  if (b.kind === 'habitat') {
    const seats = habitatCapacity(b);
    rows.push({
      icon: '🦖',
      what: `Lumea plină: ${seats} dinozauri`,
      how: 'Ouă din Extinde → Ouă, eclozate în Incubator',
      ok: !lock,
    });
  }
  if (b.kind === 'farm')
    rows.push({
      icon: '🏝️',
      what: `O lume la Nv. ${b.level + 1}`,
      how: 'Ferma nu poate trece de cea mai mare lume',
      ok: !lock,
    });
  rows.push({
    icon: '🪙',
    what: `${formatNumber(cost)} aur`,
    how: 'Din lumi: dinozaurii strâng aur (butonul Strânge)',
    ok: state.gold >= cost,
  });
  if (shards > 0)
    rows.push({
      icon: '✦',
      what: `${shards} fragmente ancestrale`,
      how: 'Din expediții (Avanpost) și cufărul zilei',
      ok: (state.fragments ?? 0) >= shards,
    });
  for (const [id, n] of parts)
    rows.push({
      icon: ITEMS[id].icon,
      what: `${n}× ${ITEMS[id].name} (ai ${itemCount(state, id)})`,
      how: !forge
        ? 'Se face în Forjă: construiește-o din Extinde → Clădiri'
        : forge.level < ITEMS[id].level
          ? `Se face în Forjă → Rețete, de la forja Nv. ${ITEMS[id].level}`
          : 'Se face în Forjă → Rețete',
      ok: itemCount(state, id) >= n,
    });
  return (
    <>
      <button
        type="button"
        className={`bp-info ${open ? 'on' : ''}`}
        aria-expanded={open}
        aria-label="Ce îți trebuie pentru nivelul următor"
        onClick={() => setOpen(!open)}
      >
        i
      </button>
      {open && (
        <ul className="bp-needs">
          {rows.map((r) => (
            <li key={r.what} className={r.ok ? 'ok' : 'missing'}>
              <b aria-hidden="true">{r.icon}</b>
              <span>
                <strong>{r.what}</strong>
                <small>{r.how}</small>
              </span>
              <i aria-label={r.ok ? 'ai' : 'lipsește'}>{r.ok ? '✓' : '✕'}</i>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---------- habitat: piedestal + portrete ----------

function HabitatMain({ game, b, onDino }: { game: Game; b: Building; onDino?: (id: string) => void }) {
  const list = residents(game.state, b.id);
  const seats = habitatCapacity(b);
  return <Roster game={game} dinos={list} seats={seats} element={b.element!} onDino={onDino} />;
}

function Roster({
  game,
  dinos,
  seats,
  element,
  onDino,
  badge,
}: {
  game: Game;
  dinos: Dino[];
  seats: number;
  element: ElementId;
  onDino?: (id: string) => void;
  badge?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = dinos.find((d) => d.id === picked) ?? dinos[0];
  return (
    <div className="bp-roster-wrap">
      {current ? (
        <DinoFocus game={game} dino={current} badge={badge} onOpen={onDino ? () => onDino(current.id) : undefined} />
      ) : (
        <div className="bp-focus empty" style={{ '--el': ELEMENTS[element].color } as CSSProperties}>
          <EggIcon element={element} size={110} />
          <strong>Niciun dinozaur încă</strong>
          <span className="bp-chip">🥚 Eclozează un ou {ELEMENTS[element].icon}</span>
        </div>
      )}
      <div className="bp-roster" role="listbox" aria-label="Dinozauri">
        {dinos.map((d) => {
          const s = speciesOf(d.species);
          return (
            <button
              key={d.id}
              role="option"
              aria-selected={d.id === current?.id}
              className={`bp-portrait r-${s.rarity} ${d.id === current?.id ? 'on' : ''}`}
              style={{ '--el': ELEMENTS[s.elements[0]].color } as CSSProperties}
              onClick={() => setPicked(d.id)}
              title={d.nickname ?? s.name}
            >
              <DinoThumb species={d.species} stage={stageForLevel(d.level)} tight className="bp-portrait-art" />
              <span className="bp-portrait-level">{d.level}</span>
            </button>
          );
        })}
        {Array.from({ length: Math.max(0, seats - dinos.length) }, (_, i) => (
          <span key={i} className="bp-portrait empty" title="Loc liber">
            <EggIcon element={element} size={34} />
          </span>
        ))}
      </div>
    </div>
  );
}

function DinoFocus({ game, dino, onOpen, badge }: { game: Game; dino: Dino; onOpen?: () => void; badge?: string }) {
  const { state, now, run } = game;
  const away = onAdventure(state, dino.id, now);
  const s = speciesOf(dino.species);
  const stage = stageForLevel(dino.level);
  const homes = homesFor(state, dino.species, dino.id).filter((h) => h.id !== dino.habitatId);
  const cost = FEED_COST[dino.level];
  const nursery = state.buildings.find((b) => b.id === dino.habitatId)?.kind === 'hatchery';
  const stageName = EVOLUTION_STAGES.find((x) => x.id === stage)!.name;
  const status =
    badge ??
    (away ? '🧭 În misiune' : isRecovering(dino, now) ? `⏳ ${formatTime(dino.recoveryUntil! - now)}` : undefined);
  return (
    <div className={`bp-focus r-${s.rarity}`} style={{ '--el': ELEMENTS[s.elements[0]].color } as CSSProperties}>
      <button
        type="button"
        className="bp-stage"
        disabled={!onOpen}
        onClick={onOpen}
        aria-label={onOpen ? `Deschide scena: ${dino.nickname ?? s.name}` : undefined}
      >
        <span className="bp-ground">
          <DinoThumb key={dino.id} species={dino.species} stage={stage} tight className="bp-stage-art" />
          <span className="bp-shadow" aria-hidden="true" />
        </span>
        {status && <span className="bp-status">{status}</span>}
        {onOpen && <span className="bp-stage-hint">↗ Scenă</span>}
      </button>
      <div className="bp-focus-info">
        <div className="bp-focus-head">
          <RarityBadge rarity={s.rarity} />
          <h4>{dino.nickname ?? s.name}</h4>
          <span className="bp-focus-sub">
            {s.elements.map((e) => (
              <span
                key={e}
                className="bp-el"
                style={{ '--el': ELEMENTS[e].color } as CSSProperties}
                title={ELEMENTS[e].name}
              >
                {ELEMENTS[e].icon}
              </span>
            ))}
            <span>{stageName}</span>
          </span>
        </div>
        <div className="bp-level">
          <span>
            Nivel <strong>{dino.level}</strong>
            <small> / {MAX_LEVEL}</small>
          </span>
          <Progress value={dino.level / MAX_LEVEL} />
        </div>
        <div className="bp-focus-stats">
          <span>
            <small>Putere</small>⚔ {dinoPower(dino)}
          </span>
          <span>
            <small>Aur</small>🪙 {nursery ? '—' : `${dinoIncome(dino)}/min`}
          </span>
        </div>
        <GearRow game={game} dino={dino} disabled={away} />
        {isRecovering(dino, now) && itemCount(state, 'elixir') > 0 && (
          <button
            className="bp-ghost bp-elixir"
            onClick={() => run({ type: 'useItem', itemId: 'elixir', target: { dino: dino.id } })}
          >
            🍵 Elixir · trezește-l acum ({itemCount(state, 'elixir')})
          </button>
        )}
        {dino.level < MAX_LEVEL ? (
          <button
            className="button bp-feed"
            data-tour="feed"
            disabled={away || state.food < cost}
            onClick={() => run({ type: 'feed', dinoId: dino.id })}
          >
            <span>Hrănește</span>
            <span className="bp-feed-cost">🍖 {formatNumber(cost)}</span>
          </button>
        ) : (
          <span className="bp-max">✦ Nivel maxim</span>
        )}
        {dino.level < MAX_LEVEL &&
          (away ? (
            <Need what="E plecat în expediție sau în arenă" how="Îl poți hrăni după ce se întoarce" />
          ) : state.food < cost ? (
            <Need
              what={`Îți lipsesc 🍖 ${formatNumber(cost - state.food)}`}
              how="Plantează la Fermă și strânge recolta"
              go={{ to: 'building', kind: 'farm', spot: 'crop-ferigi' }}
            />
          ) : null)}
        <div className="bp-focus-more">
          {homes.length > 0 && (
            <select
              className="bp-select"
              aria-label={`Mută ${dino.nickname ?? s.name} în alt habitat`}
              value=""
              disabled={away}
              onChange={(e) => run({ type: 'moveDino', dinoId: dino.id, habitatId: e.target.value })}
            >
              <option value="">↔ Mută în…</option>
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {ELEMENTS[h.element!].icon} {ELEMENTS[h.element!].name} ({residents(state, h.id).length}/
                  {habitatCapacity(h)})
                </option>
              ))}
            </select>
          )}
          <button className="bp-ghost" disabled={away} onClick={() => run({ type: 'sellDino', dinoId: dino.id })}>
            Vinde · 🪙 {sellPrice(dino)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Echipamentul dinozaurului: un loc pe cap, corp, talisman; alegi din ce ai făurit. */
function GearRow({ game, dino, disabled }: { game: Game; dino: Dino; disabled: boolean }) {
  const { state, run } = game;
  return (
    <div className="bp-gear" data-tour="gear">
      {(Object.keys(GEAR_SLOTS) as GearSlot[]).map((slot) => {
        const worn = dino.gear?.[slot];
        const owned = ITEM_LIST.filter((i) => i.slot === slot && itemCount(state, i.id) > 0);
        const item = worn ? ITEMS[worn] : undefined;
        return (
          <label
            key={slot}
            className={`bp-gear-slot ${item ? 'on' : ''}`}
            title={item ? `${item.name} · ${item.effect}` : GEAR_SLOTS[slot].name}
          >
            <span className="bp-gear-icon" aria-hidden="true">
              {item?.icon ?? GEAR_SLOTS[slot].icon}
            </span>
            <small>{item ? item.effect : GEAR_SLOTS[slot].name}</small>
            <select
              aria-label={`Echipament: ${GEAR_SLOTS[slot].name}`}
              value={worn ?? ''}
              disabled={disabled || (!worn && !owned.length)}
              onChange={(e) =>
                e.target.value
                  ? run({ type: 'equip', dinoId: dino.id, itemId: e.target.value })
                  : run({ type: 'unequip', dinoId: dino.id, slot })
              }
            >
              <option value="">{worn ? '— Scoate' : '—'}</option>
              {worn && <option value={worn}>{ITEMS[worn].name}</option>}
              {owned
                .filter((i) => i.id !== worn)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({itemCount(state, i.id)})
                  </option>
                ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

// ---------- forjă ----------

const ITEM_GROUPS: [Item['kind'], string][] = [
  ['gear', 'Echipament'],
  ['consumable', 'Consumabile'],
  ['part', 'Piese pentru clădiri'],
];

function ForgeMain({ game, b }: { game: Game; b: Building }) {
  const { state, now, run } = game;
  const [tab, setTab] = useState<'recipes' | 'bag'>('recipes');
  const job = b.craft;
  const owned = ITEM_LIST.filter((i) => itemCount(state, i.id) > 0);
  const have = (k: string) => state.materials?.[k as MaterialId] ?? 0;
  return (
    <div className="bp-stack">
      {job && (
        <div className={`bp-craft ${job.readyAt <= now ? 'ready' : ''}`}>
          <span className="bp-craft-icon" aria-hidden="true">
            {ITEMS[job.itemId].icon}
          </span>
          <div className="bp-craft-copy">
            <strong>{ITEMS[job.itemId].name}</strong>
            {job.readyAt > now ? (
              <Progress value={1 - (job.readyAt - now) / (ITEMS[job.itemId].seconds * 1000)} />
            ) : (
              <small>Gata de ridicat</small>
            )}
          </div>
          {job.readyAt > now ? (
            <>
              <span className="bp-chip">⏱ {formatTime(job.readyAt - now)}</span>
              <button className="button small gem" onClick={() => run({ type: 'rush', target: { forge: b.id } })}>
                💎 {rushCost(job.readyAt - now)}
              </button>
            </>
          ) : (
            <button className="button" onClick={() => run({ type: 'collectCraft', forgeId: b.id })}>
              Ia obiectul
            </button>
          )}
        </div>
      )}
      <nav className="arena-tabs bp-tabs" aria-label="Forja">
        <button className={tab === 'recipes' ? 'on' : ''} onClick={() => setTab('recipes')}>
          ⚒️ Rețete
        </button>
        <button className={tab === 'bag' ? 'on' : ''} onClick={() => setTab('bag')}>
          🎒 Inventar{owned.length > 0 && ` · ${owned.reduce((n, i) => n + itemCount(state, i.id), 0)}`}
        </button>
      </nav>
      {tab === 'recipes' ? (
        ITEM_GROUPS.map(([kind, label]) => (
          <section key={kind} className="bp-stack">
            <h3 className="bp-main-title">{label}</h3>
            <div className="bp-recipes">
              {ITEM_LIST.filter((i) => i.kind === kind).map((item) => {
                const locked = item.level > b.level;
                const can = !locked && !job && hasMaterials(state, item.materials) && state.gold >= item.gold;
                return (
                  <article key={item.id} className={`bp-recipe ${kind} ${locked ? 'locked' : ''}`}>
                    <span className="bp-recipe-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <strong>{item.name}</strong>
                    <span className="bp-recipe-effect">{item.effect}</span>
                    <span className="bp-recipe-costs">
                      {Object.entries(item.materials).map(([k, n]) => (
                        <span
                          key={k}
                          className={have(k) < (n ?? 0) ? 'short' : ''}
                          title={MATERIALS[k as MaterialId].name}
                        >
                          {MATERIALS[k as MaterialId].icon} {n}
                        </span>
                      ))}
                      <span>⏱ {formatTime(item.seconds * 1000)}</span>
                    </span>
                    {locked ? (
                      <span className="bp-chip">🔒 Forja Nv. {item.level}</span>
                    ) : (
                      <button
                        className="button small bp-recipe-make"
                        disabled={!can}
                        onClick={() => run({ type: 'craft', forgeId: b.id, itemId: item.id })}
                      >
                        <span>Făurește</span>
                        <span className="arena-cost">🪙 {formatNumber(item.gold)}</span>
                      </button>
                    )}
                    {!locked && !can && (
                      <small className="bp-recipe-need">
                        {job
                          ? 'Forja lucrează la alt obiect'
                          : !hasMaterials(state, item.materials)
                            ? 'Lipsesc materiale (roșu) · din expediții și arenă'
                            : `Îți lipsesc 🪙 ${formatNumber(item.gold - state.gold)}`}
                      </small>
                    )}
                    {itemCount(state, item.id) > 0 && (
                      <span className="bp-recipe-owned">×{itemCount(state, item.id)}</span>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : owned.length ? (
        <div className="bp-recipes">
          {owned.map((item) => (
            <article key={item.id} className={`bp-recipe ${item.kind}`}>
              <span className="bp-recipe-icon" aria-hidden="true">
                {item.icon}
              </span>
              <strong>{item.name}</strong>
              <span className="bp-recipe-effect">{item.effect}</span>
              <span className="bp-recipe-owned">×{itemCount(state, item.id)}</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="bp-focus empty">
          <span className="bp-empty-icon">🎒</span>
          <strong>Inventarul e gol</strong>
          <span className="bp-chip">⚒️ Făurește din rețete</span>
        </div>
      )}
    </div>
  );
}

// ---------- fermă ----------

function FarmMain({ game, b }: { game: Game; b: Building }) {
  const { state, now, run } = game;
  const plots = farmPlots(b);
  const max = FARM_PLOTS[FARM_PLOTS.length - 1];
  const [picked, setPicked] = useState<number | null>(null);
  const firstFree = plots.findIndex((p) => !p);
  const target = picked !== null && picked < plots.length && !plots[picked] ? picked : firstFree;
  const ready = plots.filter((p): p is FarmPlot => !!p && p.readyAt <= now);
  const readyFood = ready.reduce((n, p) => n + CROPS.find((c) => c.id === p.id)!.food, 0);
  const growing = plots.filter((p): p is FarmPlot => !!p && p.readyAt > now);
  const growingFood = growing.reduce((n, p) => n + CROPS.find((c) => c.id === p.id)!.food, 0);
  const nextReady = Math.min(...growing.map((p) => p.readyAt));
  return (
    <div className="bp-stack">
      <div className="bp-plots">
        {Array.from({ length: max }, (_, i) => {
          if (i >= plots.length)
            return (
              <div
                key={i}
                className="bp-plot locked"
                title={`Se deblochează la nivelul ${FARM_PLOTS.indexOf(i + 1) + 1}`}
              >
                <span className="bp-plot-soil" aria-hidden="true">
                  🔒
                </span>
                <span className="bp-chip">⬆ Nv. {FARM_PLOTS.indexOf(i + 1) + 1}</span>
              </div>
            );
          const p = plots[i];
          if (!p)
            return (
              <button
                key={i}
                className={`bp-plot empty ${i === target ? 'on' : ''}`}
                onClick={() => setPicked(i)}
                aria-pressed={i === target}
              >
                <span className="bp-plot-soil" aria-hidden="true">
                  +
                </span>
                <span className="bp-chip">Liber</span>
              </button>
            );
          const crop = CROPS.find((c) => c.id === p.id)!;
          const left = p.readyAt - now;
          const done = Math.max(0, Math.min(1, 1 - left / (crop.seconds * 1000)));
          return (
            <div key={i} className={`bp-plot ${left > 0 ? 'growing' : 'ready'}`}>
              <div
                className={`bp-ring ${left > 0 ? '' : 'ready'}`}
                data-tour={left > 0 ? 'crop-wait' : undefined}
                style={{ '--p': `${done * 360}deg` } as CSSProperties}
              >
                <span aria-hidden="true">{CROP_ICON[crop.id] ?? '🌱'}</span>
              </div>
              <strong className="bp-plot-name">{crop.name}</strong>
              {left > 0 ? (
                <>
                  <span className="bp-chip">⏱ {formatTime(left)}</span>
                  <button
                    className="button small gem"
                    onClick={() => run({ type: 'rush', target: { farm: b.id, plot: i } })}
                  >
                    💎 {rushCost(left)}
                  </button>
                  {itemCount(state, 'fertilizer') > 0 && (
                    <button
                      className="bp-use"
                      title="Fertilizator: gata pe loc"
                      onClick={() => run({ type: 'useItem', itemId: 'fertilizer', target: { farm: b.id, plot: i } })}
                    >
                      🧪 {itemCount(state, 'fertilizer')}
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="button"
                  data-tour="harvest"
                  onClick={() => run({ type: 'harvest', farmId: b.id, plot: i })}
                >
                  🍖 +{crop.food}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {ready.length > 1 && (
        <button className="button bp-big bp-harvest-all" onClick={() => run({ type: 'harvest', farmId: b.id })}>
          Recoltează tot · 🍖 {readyFood}
        </button>
      )}
      {target < 0 && !ready.length && (
        <div className="bp-farm-summary">
          <span className="bp-farm-summary-icon" aria-hidden="true">
            🌾
          </span>
          <div>
            <strong>Toate straturile cresc</strong>
            <small>Revino când sunt gata</small>
          </div>
          <span className="bp-chip">🍖 +{growingFood}</span>
          <span className="bp-chip">⏱ {formatTime(nextReady - now)}</span>
        </div>
      )}
      {plots.length < max && <p className="bp-farm-more">⬆ Nivelul {plots.length + 1} deblochează încă un strat</p>}
      {target >= 0 && (
        <>
          <h3 className="bp-main-title">Plantează · stratul {target + 1}</h3>
          <div className="bp-crops">
            {CROPS.map((c) => (
              <button
                key={c.id}
                className="bp-crop"
                data-tour={`crop-${c.id}`}
                disabled={state.gold < c.cost}
                onClick={() => run({ type: 'plant', farmId: b.id, cropId: c.id, plot: target }) && setPicked(null)}
              >
                <span className="bp-crop-icon" aria-hidden="true">
                  {CROP_ICON[c.id] ?? '🌱'}
                </span>
                <strong>{c.name}</strong>
                <span className="bp-crop-meta">
                  <span>🍖 {c.food}</span>
                  <span>⏱ {formatTime(c.seconds * 1000)}</span>
                </span>
                <span className={`bp-price ${state.gold < c.cost ? 'short' : ''}`}>🪙 {c.cost}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- incubator ----------

function HatcheryMain({ game, onDino }: { game: Game; onDino?: (id: string) => void }) {
  const { state, now, run } = game;
  const [choosing, setChoosing] = useState<string | null>(null);
  const nursery = state.dinos.filter((d) => state.buildings.find((b) => b.id === d.habitatId)?.kind === 'hatchery');
  return (
    <div className="bp-stack">
      {nursery.length > 0 && (
        <Roster
          game={game}
          dinos={nursery}
          seats={nursery.length}
          element={speciesOf(nursery[0].species).elements[0]}
          onDino={onDino}
          badge="🏠 Caută o lume"
        />
      )}
      <div className="bp-eggs">
        {state.eggs.map((egg) => {
          const s = speciesOf(egg.species);
          const left = egg.hatchAt - now;
          const homes = homesFor(state, egg.species);
          return (
            <div
              key={egg.id}
              className={`bp-egg ${left <= 0 ? 'ready' : ''}`}
              style={{ '--el': ELEMENTS[s.elements[0]].color } as CSSProperties}
            >
              <span className="bp-egg-art">
                <EggIcon element={egg.element ?? s.elements[0]} size={80} shaking={left <= 0} />
              </span>
              <strong>
                {egg.element
                  ? `${ELEMENTS[egg.element].icon} ${ELEMENTS[egg.element].name}`
                  : state.discovered.includes(s.id)
                    ? s.name
                    : '???'}
              </strong>
              {left > 0 ? (
                <>
                  <span className="bp-chip" data-tour="egg-wait">
                    ⏱ {formatTime(left)}
                  </span>
                  <button className="button small gem" onClick={() => run({ type: 'rush', target: { egg: egg.id } })}>
                    💎 {rushCost(left)}
                  </button>
                  {itemCount(state, 'warm-stone') > 0 && (
                    <button
                      className="bp-use"
                      title="Piatră caldă: eclozează pe loc"
                      onClick={() => run({ type: 'useItem', itemId: 'warm-stone', target: { egg: egg.id } })}
                    >
                      ♨️ {itemCount(state, 'warm-stone')}
                    </button>
                  )}
                </>
              ) : choosing === egg.id ? (
                homes.length ? (
                  <span className="bp-row">
                    {homes.map((h) => (
                      <button
                        key={h.id}
                        className="button small"
                        data-tour="hatch-home"
                        onClick={() => run({ type: 'hatch', eggId: egg.id, habitatId: h.id }) && setChoosing(null)}
                      >
                        {ELEMENTS[h.element!].icon} {residents(state, h.id).length}/{habitatCapacity(h)}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="bp-chip warn">🔒 {s.elements.map((e) => ELEMENTS[e].icon).join(' ')}</span>
                )
              ) : (
                <button className="button small" data-tour="hatch" onClick={() => setChoosing(egg.id)}>
                  🐣 Eclozează
                </button>
              )}
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, hatcherySlots(state) - state.eggs.length) }, (_, i) => (
          <div key={i} className="bp-egg empty" aria-label="Loc gol">
            <span className="bp-egg-ghost" aria-hidden="true" />
          </div>
        ))}
      </div>
      <h3 className="bp-main-title">Cumpără ouă</h3>
      <HabitatEggShop state={state} onBuy={(element) => run({ type: 'buyHabitatEgg', element })} />
    </div>
  );
}

// ---------- bârlog ----------

function DenMain({ game }: { game: Game }) {
  const { state, now, run } = game;
  const adults = state.dinos.filter((d) => d.level >= BREED_LEVEL && !dinoUnavailable(state, d, now));
  const [a, setA] = useState(adults[0]?.id ?? '');
  const [b, setB] = useState(adults[1]?.id ?? '');
  const br = state.breeding;

  if (br) {
    const left = br.readyAt - now;
    const total = speciesOf(br.species).breedSeconds * 1000;
    const pa = state.dinos.find((d) => d.id === br.a);
    const pb = state.dinos.find((d) => d.id === br.b);
    return (
      <div className="bp-stack center">
        <div className="bp-pair">
          <span className="bp-parent">{pa && <DinoThumb species={pa.species} />}</span>
          <span className="bp-heart beating">💞</span>
          <span className="bp-parent">{pb && <DinoThumb species={pb.species} />}</span>
        </div>
        <div className="bp-wide-progress">
          <Progress value={1 - left / total} />
        </div>
        {left > 0 ? (
          <div className="bp-row">
            <span className="bp-chip">⏱ {formatTime(left)}</span>
            <button className="button gem" onClick={() => run({ type: 'rush', target: 'breeding' })}>
              💎 {rushCost(left)}
            </button>
            <button className="bp-ghost" onClick={() => run({ type: 'cancelBreed' })}>
              Oprește
            </button>
          </div>
        ) : (
          <button className="button bp-big" onClick={() => run({ type: 'finishBreed' })}>
            🥚 Ia oul
          </button>
        )}
      </div>
    );
  }

  if (adults.length < 2)
    return (
      <div className="bp-stack center">
        <div className="bp-pair">
          <span className="bp-parent empty">?</span>
          <span className="bp-heart">💞</span>
          <span className="bp-parent empty">?</span>
        </div>
        <div className="bp-row">
          <span className="bp-chip">🦖 × 2</span>
          <span className="bp-chip">Nv. {BREED_LEVEL}+</span>
          <span className="bp-chip">liberi</span>
        </div>
        <Need
          what={`Ai nevoie de doi dinozauri de nivel ${BREED_LEVEL}+, liberi`}
          how="Hrănește-i din lumea lor; cei plecați sau care se odihnesc nu pot fi părinți"
        />
        <DenRecipes state={state} />
      </div>
    );

  const da = adults.find((d) => d.id === a);
  const db = adults.find((d) => d.id === b);
  const pair = da && db && da.id !== db.id;
  const rare = pair ? denRecipeFor(da.species, db.species) : undefined;
  // o rețetă nedescoperită nu se trădează: arătăm doar părinții și semnul întrebării
  const known = !!rare && state.discovered.includes(rare);
  const adults7 = !!pair && da.level >= 7 && db.level >= 7;
  const odds = pair
    ? breedOdds(speciesOf(da.species), speciesOf(db.species), adults7).filter((o) => known || o.species.id !== rare)
    : [];
  const label = (d: Dino) => `${d.nickname ?? speciesOf(d.species).name} · nv. ${d.level}`;
  return (
    <div className="bp-stack center">
      <div className="bp-pair">
        <ParentPicker value={a} onChange={setA} dinos={adults} label={label} />
        <span className="bp-heart beating">💞</span>
        <ParentPicker value={b} onChange={setB} dinos={adults} label={label} />
      </div>
      {odds.length > 0 && (
        <div className="bp-odds">
          {odds.map((o) => {
            const known = state.discovered.includes(o.species.id);
            return (
              <div key={o.species.id} className={`bp-odd r-${o.species.rarity}`} title={known ? o.species.name : '???'}>
                <DinoThumb species={o.species.id} hidden={!known} />
                <strong>{rare && !known ? '?' : `${o.pct.toFixed(o.pct < 10 ? 1 : 0)}%`}</strong>
              </div>
            );
          })}
          {!known && (
            <div className="bp-odd mystery" title="Doar perechea potrivită dă o specie rară">
              <span className="bp-odd-mystery">❓</span>
              <strong>rar?</strong>
            </div>
          )}
        </div>
      )}
      {known && (
        <p className="bp-den-match">
          ✨ Pereche specială: {speciesOf(rare!).name} ·{' '}
          {adults7 ? 'doi adulți, șanse mai mari' : `doi adulți (Nv. 7+) ar avea +${DEN_ADULT_BONUS}%`}
        </p>
      )}
      <button className="button bp-big" disabled={!odds.length} onClick={() => run({ type: 'breed', a, b })}>
        💞 Împerechează
      </button>
      {!odds.length && <Need what="Alege doi părinți diferiți" />}
      <DenRecipes state={state} />
    </div>
  );
}

/**
 * Cartea Bârlogului: fiecare specie rară cu rețeta ei. Descoperită = perechea exactă; altfel doar elementele
 * părinților (indiciu), ca să încerci perechi.
 */
function DenRecipes({ state }: { state: Game['state'] }) {
  return (
    <section className="bp-den-book">
      <h3 className="bp-main-title">📖 Rețete rare</h3>
      <p className="bp-den-rules">
        Oul din magazin dă doar specia de bază a lumii. Rarele vin de aici: perechea potrivită are {DEN_RARE_CHANCE}%
        șanse (+{DEN_ADULT_BONUS}% dacă ambii sunt adulți). După ou, părinții se odihnesc{' '}
        {Math.round(DEN_REST_MS / 3600000)} ore.
      </p>
      <div className="bp-den-recipes">
        {Object.keys(DEN_RECIPES).map((rare) => {
          const found = state.discovered.includes(rare);
          const [x, y] = DEN_RECIPES[rare];
          return (
            <article key={rare} className={`bp-den-recipe ${found ? 'found' : ''}`}>
              <DinoThumb species={rare} hidden={!found} className="small" lazy />
              <span>
                <strong>{found ? speciesOf(rare).name : '???'}</strong>
                <small>
                  {found
                    ? `${speciesOf(x).name} + ${speciesOf(y).name}`
                    : `${denRecipeHint(rare)
                        .map((e) => ELEMENTS[e].icon)
                        .join(' + ')} · găsește perechea`}
                </small>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ParentPicker({
  value,
  onChange,
  dinos,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  dinos: Dino[];
  label: (d: Dino) => string;
}) {
  const d = dinos.find((x) => x.id === value);
  return (
    <label className="bp-parent-pick">
      <span className="bp-parent">{d && <DinoThumb species={d.species} />}</span>
      <select className="bp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {dinos.map((x) => (
          <option key={x.id} value={x.id}>
            {label(x)}
          </option>
        ))}
      </select>
    </label>
  );
}
