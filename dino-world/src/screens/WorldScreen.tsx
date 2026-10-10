// Lumea: insula pictată, cu clădirile pe parcelele ei. Tragi ca să muți camera, rotița/ciupitul fac zoom.
// Atingi o clădire ca s-o deschizi; în modul „plasare” atingi o parcelă liberă (marcată) ca să construiești.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BUILDINGS,
  WORLD_UNLOCK_COST,
  stageForLevel,
  EVOLUTION_STAGES,
  ELEMENTS,
  ELEMENT_IDS,
  habitatCapacity,
  SLOTS,
  canPlace,
  farmPlots,
  ITEMS,
  buildingUpgradeCost,
  buildingUpgradeFragments,
  dailyArena,
  dailyExpeditions,
  dinoUnavailable,
  expeditionTeamMatches,
  hasUpgradeParts,
  buildingPosition,
  buildingPositionError,
  positionError,
  FREE_BUILDING_SCALE,
  type BuildingPosition,
  goldCap,
  hatcherySlots,
  pendingGold,
  residents,
  speciesOf,
  type Building,
  type BuildingKind,
  type ElementId,
  type GameState,
} from '@shared/game';
import { BuildingArt, DINO_SPOTS, SPRITES, type BuildingVisual } from '../world/BuildingArt';
import { WorldLoader } from '../components/WorldLoader';
import { WorldPreview } from '../components/WorldPreview';
import { EggShape } from '../components/Eggs';
import { MAIN_ISLAND as ISLAND, HABITAT_ISLANDS, MAIN_ISLAND_POSITION as MAIN, SHADOW_PAD } from '../world/islands';
import { DetailContext, DetailImage } from '../world/DetailImage';
import { Need, formatNumber, formatTime, useThumbnail } from '../components/ui';
import { recipeFor } from '../dino-lab/recipes';
import { createHerd, type Herd, type HerdMember } from '../dino-lab/herd';

export type Placement = { kind: BuildingKind; element?: ElementId; moving?: string };

interface Props {
  state: GameState;
  now: number;
  placement: Placement | null;
  onPlace: (slot: string) => void;
  onPlacePosition: (position: BuildingPosition) => void;
  onCancelPlace: () => void;
  onOpen: (b: Building) => void;
  onDino: (id: string) => void;
  onCollect: (b: Building) => void;
  onUnlock: (element: ElementId) => void;
  /** Când se schimbă, camera arată toate insulele (folosit de „Primii pași”). */
  overview?: number;
  /** „Du-mă acolo”: camera merge la insulă (n crește la fiecare cerere). */
  focusOn?: { element: ElementId; n: number };
}

type Camera = { x: number; y: number; z: number };
/** Ecran tactil (telefon, tabletă): indicațiile vorbesc despre degete, nu despre rotița mouse-ului. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const MIN_Z = 0.08;
const MAX_Z = 2.5;
/** Cadrul scenei: imaginea plus loc pentru bulele de deasupra clădirilor. */
const VIEW = { x: -650, y: -380, width: 4400, height: 3200 };

export function WorldScreen({
  state,
  now,
  placement,
  onPlace,
  onPlacePosition,
  onCancelPlace,
  onOpen,
  onDino,
  onCollect,
  onUnlock,
  overview,
  focusOn,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const scene = useRef<SVGSVGElement>(null);
  const mainSurface = useRef<SVGGElement>(null);
  const [preview, setPreview] = useState<BuildingPosition | null>(null);
  /** Așezare liberă (oriunde pe insula principală): la mutare și la orice clădire nouă care nu e habitat. */
  const freeMode = !!placement && (!!placement.moving || placement.kind !== 'habitat');
  const freePointer = useRef<number | null>(null);
  const freeDragged = useRef(false);
  const islandPoint = (clientX: number, clientY: number) => {
    const matrix = mainSurface.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  useAmbientTicker(scene);
  // Mărimea ecranului, ținută la redimensionare (nu se citește din layout la fiecare cadru al camerei).
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const observer = new ResizeObserver(([e]) => setScreen({ w: e.contentRect.width, h: e.contentRect.height }));
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, z: 0.5 });
  const cameraRef = useRef(cam);
  const cameraFrame = useRef<number | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  /** Unde a dus camera ultima apropiere de o insulă (pentru clicul în doi pași). */
  const focusTarget = useRef<{ id: string; z: number } | null>(null);
  useLayoutEffect(() => {
    cameraRef.current = cam;
    herd.current?.render();
  }, [cam]);

  // Dinozaurii din habitate, animați (repaus, plimbări, atacuri) într-un canvas comun peste hartă.
  const herdHost = useRef<HTMLDivElement>(null);
  const herd = useRef<Herd | null>(null);
  const [liveDinos, setLiveDinos] = useState<Set<string>>(() => new Set());
  // loading: se încarcă (pe insule apar ouă care pulsează); ready: animați; off: fără WebGL, miniaturi statice
  const [herdStatus, setHerdStatus] = useState<'loading' | 'ready' | 'off'>('loading');
  const herdReady = herdStatus === 'ready';
  // Contextul WebGL costă ~1 s la creare (blochează prima afișare): turma pornește doar când are dinozauri de
  // desenat pe hartă, și abia după primul cadru al hărții.
  const needHerd = state.dinos.some((d) => state.buildings.some((b) => b.id === d.habitatId && b.kind === 'habitat'));
  useEffect(() => {
    if (!needHerd) return;
    let alive = true;
    let created: Herd | null = null;
    const start = requestAnimationFrame(() =>
      setTimeout(() => {
        if (!alive) return;
        createHerd(herdHost.current!, {
          camera: () => ({ ...cameraRef.current, originX: VIEW.x, originY: VIEW.y }),
          onLive: (ids) => alive && setLiveDinos(ids),
        })
          .then((h) => {
            if (!alive) return h.dispose();
            created = herd.current = h;
            setHerdStatus('ready');
          })
          .catch(() => alive && setHerdStatus('off'));
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(start);
      created?.dispose();
      herd.current = null;
      setHerdStatus('loading');
    };
  }, [needHerd]);
  const stopCamera = useCallback(() => {
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
  }, []);

  useEffect(() => {
    if (placement) focus('main');
    const moving = state.buildings.find((b) => b.id === placement?.moving);
    setPreview(moving ? buildingPosition(moving) : freeMode ? firstFreeSpot(state) : null);
    // doar când începe o așezare nouă
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement?.kind, placement?.moving]);
  useEffect(() => stopCamera, [stopCamera]);
  useEffect(() => {
    if (!freeMode) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelPlace();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [freeMode, onCancelPlace]);
  const travelTo = (target: Camera, smooth = true, onArrive?: () => void) => {
    stopCamera();
    if (!smooth || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cameraRef.current = target;
      setCam(target);
      if (onArrive)
        cameraFrame.current = requestAnimationFrame(() => {
          cameraFrame.current = null;
          onArrive();
        });
      return;
    }
    const from = cameraRef.current;
    const started = performance.now();
    const frame = (time: number) => {
      const progress = Math.min(1, (time - started) / 750);
      const eased = progress * progress * (3 - 2 * progress);
      const next = {
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        z: from.z + (target.z - from.z) * eased,
      };
      cameraRef.current = next;
      setCam(next);
      cameraFrame.current =
        progress < 1
          ? requestAnimationFrame(frame)
          : onArrive
            ? requestAnimationFrame(() => {
                cameraFrame.current = null;
                onArrive();
              })
            : null;
    };
    cameraFrame.current = requestAnimationFrame(frame);
  };
  const worlds = ELEMENT_IDS.map((element) => ({
    element,
    buildings: state.buildings.filter((b) => b.kind === 'habitat' && b.element === element),
    ...HABITAT_ISLANDS[element],
    islandId: element,
  }));
  const sceneHeight = Math.max(VIEW.height, ...worlds.map((w) => w.y + 850));
  const herdKey = JSON.stringify(
    worlds.map((w) =>
      w.buildings.flatMap((b) => residents(state, b.id).map((d) => [d.id, d.species, stageForLevel(d.level)])),
    ),
  );
  useEffect(() => {
    if (!herd.current) return;
    const members: HerdMember[] = [];
    for (const w of worlds) {
      const dinos = w.buildings.flatMap((b) => residents(state, b.id));
      const capacity = w.buildings.reduce((n, b) => n + habitatCapacity(b), 0);
      dinos.forEach((d, i) => {
        const spot = habitatSpot(i, capacity, w.element);
        const area = HABITAT_ISLANDS[w.element].layout?.area ?? { x0: 200, y0: 270, x1: 920, y1: 540 };
        members.push({
          id: d.id,
          recipe: recipeFor(d.species, stageForLevel(d.level)),
          island: w.element,
          home: { x: w.x + spot.x, y: w.y + spot.y },
          area: { x0: w.x + area.x0, y0: w.y + area.y0, x1: w.x + area.x1, y1: w.y + area.y1 },
          size: mapDinoSize(d.level),
          facing: i % 2 ? -1 : 1,
        });
      });
    }
    herd.current.setMembers(members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [herdKey, herdReady]);

  // Ecranul de încărcare: fonturile, imaginile de la pornire (decodate) și dinozaurii animați.
  const [images, setImages] = useState({ done: 0, total: 1 });
  useEffect(() => {
    // doar ce e în centrul ecranului la pornire: insula principală (varianta mică) și clădirile ei; celelalte
    // insule apar când s-au descărcat, fără să țină harta ascunsă
    const urls = [
      ISLAND.lite ?? ISLAND.image,
      ...new Set(state.buildings.map((b) => SPRITES[b.kind]?.href).filter((u): u is string => !!u)),
    ];
    const total = urls.length + 1;
    let done = 0;
    const tick = () => setImages({ done: ++done, total });
    setImages({ done, total });
    for (const url of urls) {
      const img = new Image();
      img.src = url;
      img
        .decode()
        .catch(() => undefined)
        .finally(tick);
    }
    document.fonts.ready.finally(tick);
    // doar la pornire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const memberIds = (JSON.parse(herdKey) as [string][][]).flat().map(([id]) => id);
  const dinosLive = herdStatus === 'off' ? memberIds.length : memberIds.filter((id) => liveDinos.has(id)).length;
  const loaded = images.done >= images.total && (herdStatus === 'off' || dinosLive >= memberIds.length);
  const focusedWorld = worlds.find((w) => w.islandId === focusedId || w.element === focusedId);
  const focus = (
    element?: ElementId | 'main',
    world?: { x: number; y: number; islandId: string },
    smooth = true,
    onArrive?: () => void,
  ) => {
    const r = viewport.current!.getBoundingClientRect();
    if (!element) {
      const z = Math.max(MIN_Z, Math.min(r.width / (VIEW.width * 1.08), (r.height - 150) / (sceneHeight * 1.08)));
      setFocusedId(null);
      travelTo({ z, x: (r.width - VIEW.width * z) / 2, y: (r.height - sceneHeight * z) / 2 }, smooth);
    } else {
      const island = world ?? (element === 'main' ? MAIN : HABITAT_ISLANDS[element]);
      setFocusedId(element === 'main' ? 'main' : (world?.islandId ?? element));
      const target = element === 'main' ? 'main' : (world?.islandId ?? element);
      const z = Math.min(
        1,
        Math.max(0.2, Math.min(r.width / (element === 'main' ? 1500 : 1250), (r.height - 220) / 950)),
      );
      focusTarget.current = { id: target, z };
      travelTo(
        {
          z,
          x: r.width / 2 - (island.x + (element === 'main' ? (ISLAND.width * MAIN.scale) / 2 : 550) - VIEW.x) * z,
          y: r.height / 2 - (island.y + (element === 'main' ? 480 * MAIN.scale : 440) - VIEW.y) * z,
        },
        smooth,
        onArrive,
      );
    }
  };

  useEffect(() => {
    if (overview) focus();
    // doar când se cere din nou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);
  useEffect(() => {
    if (focusOn) focus(focusOn.element);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOn?.n]);

  // Încadrarea inițială: insula întreagă în ecran.
  useLayoutEffect(() => {
    const r = viewport.current!.getBoundingClientRect();
    if (r.width < 640 || !state.buildings.some((b) => b.kind === 'habitat')) {
      focus('main', undefined, false);
      return;
    }
    const z = Math.max(MIN_Z, Math.min(0.65, r.width / 3300, (r.height - 160) / 2150));
    setCam({ z, x: r.width / 2 - (1450 - VIEW.x) * z, y: r.height / 2 - (1330 - VIEW.y) * z });
  }, []);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      stopCamera();
      setCam((c) => {
        const z = Math.max(MIN_Z, Math.min(MAX_Z, c.z * factor));
        const k = z / c.z;
        return { z, x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k };
      });
    },
    [stopCamera],
  );

  // Rotița: zoom în jurul cursorului (listener ne-pasiv ca să oprim derularea paginii).
  useEffect(() => {
    const el = viewport.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  // Tragere (un deget/mouse) și ciupire (două degete). Un click după tragere nu deschide nimic.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    stopCamera();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
    if (freeMode && (e.target as Element).closest('.world-svg')) {
      freePointer.current = e.pointerId;
      freeDragged.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (freeMode && (freePointer.current !== null || (e.target as Element).closest('.world-svg'))) {
      const point = islandPoint(e.clientX, e.clientY);
      if (point) setPreview(point);
    }
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const list = [...pointers.current.entries()];
    if (freeMode && list.length === 1) {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6)
        freeDragged.current = true;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (list.length === 2) {
      const other = list.find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const r = viewport.current!.getBoundingClientRect();
      if (before > 0) zoomAt(after / before, (e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top);
      dragged.current = true;
    } else {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6)
        dragged.current = true;
      if (dragged.current) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setCam((c) => ({ ...c, x: c.x + e.clientX - prev.x, y: c.y + e.clientY - prev.y }));
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (freePointer.current !== e.pointerId) return;
    freePointer.current = null;
    if (freeMode && freeDragged.current && !dragged.current) {
      const point = islandPoint(e.clientX, e.clientY);
      if (point) onPlacePosition(point);
      dragged.current = true;
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.stopPropagation();
      e.preventDefault();
      dragged.current = false;
      return;
    }
    if (freeMode && ((e.target as Element).closest('.world-svg') || e.target === viewport.current)) {
      e.stopPropagation();
      const point = islandPoint(e.clientX, e.clientY);
      if (point) {
        setPreview(point);
        onPlacePosition(point);
      }
      return;
    }
    // dinozaurii se plimbă: îi găsim după unde sunt acum, nu după locul de acasă
    if (placement || !herd.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const id = herd.current.hit(e.clientX - r.left, e.clientY - r.top);
    if (id) {
      e.stopPropagation();
      e.preventDefault();
      onDino(id);
    }
  };

  // Imaginile mari (4K insule, HD clădiri) se cer doar pentru ce e pe ecran și doar când varianta ușoară ar fi
  // mărită: `px` = lățimea variantei ușoare, `w` = lățimea desenată în scenă.
  const dpr = window.devicePixelRatio || 1;
  const near = (x: number, y: number, w: number, h: number, px: number) => {
    if ((w / px) * cam.z * dpr <= 1.15) return false;
    const sx = (x - VIEW.x) * cam.z + cam.x;
    const sy = (y - VIEW.y) * cam.z + cam.y;
    return sx < screen.w && sy < screen.h && sx + w * cam.z > 0 && sy + h * cam.z > 0;
  };
  const mainW = ISLAND.width * MAIN.scale;
  const mainH = ISLAND.height * MAIN.scale;
  const mainNear = near(MAIN.x, MAIN.y, mainW, mainH, 1728);
  // clădirile: ~280 unități × scara insulei, desenate din 768 px
  const buildingsNear = near(MAIN.x, MAIN.y, mainW, mainH, (768 / (280 * MAIN.scale)) * mainW);

  // Clădirile, de la cele din spate (sus pe imagine) la cele din față.
  const ordered = useMemo(
    () =>
      state.buildings.filter((b) => b.kind !== 'habitat').sort((a, b) => buildingPosition(a).y - buildingPosition(b).y),
    [state.buildings],
  );
  const free = placement && !freeMode ? SLOTS.filter((s) => canPlace(state, placement.kind, s.id)) : [];
  const movingBuilding = state.buildings.find((b) => b.id === placement?.moving);
  const previewScale = movingBuilding ? buildingPosition(movingBuilding).scale : FREE_BUILDING_SCALE;
  const previewError = !preview
    ? null
    : movingBuilding
      ? buildingPositionError(state, movingBuilding.id, preview)
      : freeMode
        ? positionError(state, preview, FREE_BUILDING_SCALE)
        : null;

  return (
    <div
      ref={viewport}
      className={`world-viewport ${placement ? 'placing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        freePointer.current = null;
        dragged.current = true;
      }}
      onClickCapture={onClickCapture}
    >
      <Sky />
      <svg
        ref={scene}
        className="world-svg"
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${sceneHeight}`}
        width={VIEW.width}
        height={sceneHeight}
        style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}
      >
        <g transform={`translate(${MAIN.x},${MAIN.y}) scale(${MAIN.scale})`}>
          <g>
            <g
              className="main-island"
              ref={mainSurface}
              role="button"
              tabIndex={0}
              aria-label="Insula principală: apropie camera"
              onClick={() => !placement && focus('main')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!placement) focus('main');
                }
              }}
            >
              <IslandShadow href={ISLAND.shadow} width={ISLAND.width} height={ISLAND.height} />
              <DetailImage
                href={ISLAND.image}
                lite={ISLAND.lite}
                hd={ISLAND.hd}
                detail={mainNear}
                width={ISLAND.width}
                height={ISLAND.height}
                className="island-image"
              />
              <DetailContext.Provider value={buildingsNear}>
                <g onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  {ordered.map((b) => (
                    <BuildingNode
                      key={b.id}
                      b={b}
                      state={state}
                      now={now}
                      moving={placement?.moving === b.id}
                      onOpen={() => !placement && onOpen(b)}
                      onDino={(id) => {
                        if (!placement) onDino(id);
                      }}
                    />
                  ))}
                  {placement &&
                    free.map((s) => (
                      <SlotMarker key={s.id} slot={s.id} placement={placement} onPick={() => onPlace(s.id)} />
                    ))}
                  {freeMode && placement && preview && (
                    <g
                      className={`free-building-preview ${previewError ? 'invalid' : 'valid'}`}
                      pointerEvents="none"
                      transform={`translate(${preview.x},${preview.y}) scale(${previewScale})`}
                    >
                      <ellipse className="free-building-ground" cx={0} cy={0} rx={100} ry={50} />
                      <BuildingArtMemo
                        visual={movingBuilding ? visualOf(movingBuilding, state, now) : visualOfPlacement(placement)}
                      />
                      <text className="free-building-status" textAnchor="middle" y={80}>
                        {previewError ? 'Loc indisponibil' : 'Plasează aici'}
                      </text>
                    </g>
                  )}
                  {!placement &&
                    ordered.map((b) => (
                      <Bubble
                        key={b.id}
                        b={b}
                        state={state}
                        now={now}
                        onCollect={() => onCollect(b)}
                        onOpen={() => onOpen(b)}
                      />
                    ))}
                </g>
              </DetailContext.Provider>
              <g transform="translate(768,915)">
                <rect
                  x={-320}
                  y={-34}
                  width={640}
                  height={70}
                  rx={24}
                  fill="#233729"
                  stroke="#d6b970"
                  strokeWidth={3}
                />
                <text className="island-title" textAnchor="middle" y={10}>
                  Insula expediției
                </text>
              </g>
            </g>
          </g>
        </g>
        {worlds.map((w) => (
          <HabitatIsland
            key={w.islandId}
            {...w}
            detail={near(w.x, w.y, 1100, 734, 1728)}
            live={herdStatus === 'off' ? null : liveDinos}
            state={state}
            now={now}
            onDino={onDino}
            onOpen={() => {
              if (placement) return;
              // în doi pași: primul clic apropie camera (să vezi dinozaurii), al doilea, pe insula deja apropiată,
              // deschide gestionarea; tot acolo duce și butonul „Gestionează lumea”
              const t = focusTarget.current;
              const close = t?.id === w.islandId && cameraRef.current.z >= t.z * 0.85;
              if (close && w.buildings.length) onOpen(w.buildings[0]);
              else focus(w.element, w, true);
            }}
            onCollect={() => w.buildings.forEach(onCollect)}
          />
        ))}
      </svg>
      <div ref={herdHost} className="world-herd-host" />
      <WorldLoader done={images.done + dinosLive} total={images.total + memberIds.length} ready={loaded} />

      {placement && (
        <div className="placement-bar">
          <span>
            {freeMode
              ? 'Trage clădirea sau atinge un loc pe insulă: '
              : free.length
                ? 'Alege o parcelă pentru '
                : 'Nu mai sunt parcele libere pentru '}
            <strong>
              {placement.moving
                ? BUILDINGS[placement.kind].name.toLowerCase()
                : placement.element
                  ? `habitat de ${ELEMENTS[placement.element].name.toLowerCase()}`
                  : BUILDINGS[placement.kind].name.toLowerCase()}
            </strong>
          </span>
          {freeMode && preview && (
            <button className="button small" disabled={!!previewError} onClick={() => onPlacePosition(preview)}>
              {movingBuilding ? 'Plasează aici' : 'Construiește aici'}
            </button>
          )}
          <button className="button small ghost" onClick={onCancelPlace}>
            Anulează
          </button>
        </div>
      )}
      {focusedId === 'main' && !placement && (
        <aside className="focused-habitat main-island-actions">
          <button
            className="focus-close"
            aria-label="Închide detaliile insulei principale"
            onClick={() => setFocusedId(null)}
          >
            ×
          </button>
          <strong>Insula expediției</strong>
          <span>Clădiri · Arenă · Expediții</span>
          {ordered.map((b) => (
            <button key={b.id} className="button small" onClick={() => onOpen(b)}>
              {BUILDINGS[b.kind].name}
            </button>
          ))}
        </aside>
      )}
      {focusedWorld && !placement && (
        <aside className="focused-habitat">
          <button className="focus-close" aria-label="Închide detaliile insulei" onClick={() => setFocusedId(null)}>
            ×
          </button>
          <strong>
            {ELEMENTS[focusedWorld.element].icon} {HABITAT_ISLANDS[focusedWorld.element].name}
          </strong>
          <span>
            {focusedWorld.buildings.length
              ? `${focusedWorld.buildings.reduce((n, b) => n + residents(state, b.id).length, 0)}/${focusedWorld.buildings.reduce((n, b) => n + habitatCapacity(b), 0)} locuitori`
              : 'Lume blocată · cumpără deblocarea în aur'}
          </span>
          {focusedWorld.buildings.map((b, i) => (
            <button key={b.id} className="button small" onClick={() => onOpen(b)}>
              {focusedWorld.buildings.length > 1 ? `Zonă ${i + 1} · ` : ''}Nivel {b.level} · Gestionează lumea
            </button>
          ))}
          {!focusedWorld.buildings.length && (
            <button
              className="button small"
              data-tour={`unlock-${focusedWorld.element}`}
              disabled={state.gold < WORLD_UNLOCK_COST[focusedWorld.element]}
              onClick={() => onUnlock(focusedWorld.element)}
            >
              🔓 Deblochează lumea · 🪙 {formatNumber(WORLD_UNLOCK_COST[focusedWorld.element])}
            </button>
          )}
          {!focusedWorld.buildings.length && <WorldPreview state={state} element={focusedWorld.element} />}
          {!focusedWorld.buildings.length && state.gold < WORLD_UNLOCK_COST[focusedWorld.element] && (
            <Need
              what={`Îți lipsesc 🪙 ${formatNumber(WORLD_UNLOCK_COST[focusedWorld.element] - state.gold)}`}
              how="Aurul vine din lumile tale: Strânge din panoul lumii"
            />
          )}
        </aside>
      )}
      <p className="world-hint">
        {TOUCH
          ? 'Trage cu degetul · Ciupește pentru zoom · Atinge o insulă'
          : 'Trage pentru a explora · Scroll pentru zoom · Atinge o insulă pentru a te apropia'}
      </p>
      <div className="zoom-buttons">
        <button className="round-button" onClick={() => zoomCenter(1.25)} aria-label="Apropie">
          +
        </button>
        <button className="round-button" onClick={() => zoomCenter(0.8)} aria-label="Depărtează">
          −
        </button>
      </div>
    </div>
  );

  function zoomCenter(f: number) {
    const r = viewport.current!.getBoundingClientRect();
    zoomAt(f, r.width / 2, r.height / 2);
  }
}

const slotTransform = (slot: string) => {
  const s = ISLAND.slots[slot];
  return `translate(${s.x},${s.y}) scale(${s.scale})`;
};
const buildingTransform = (building: Building) => {
  const p = buildingPosition(building);
  return `translate(${p.x},${p.y}) scale(${p.scale})`;
};

/** Primul loc bun pentru o clădire nouă: cel mai aproape de mijlocul insulei. */
function firstFreeSpot(state: GameState): BuildingPosition | null {
  const spots: BuildingPosition[] = [];
  for (let y = 260; y <= 700; y += 30) for (let x = 120; x <= 1420; x += 40) spots.push({ x, y });
  spots.sort((a, b) => Math.hypot(a.x - 768, (a.y - 470) * 2) - Math.hypot(b.x - 768, (b.y - 470) * 2));
  return spots.find((p) => !positionError(state, p, FREE_BUILDING_SCALE)) ?? null;
}

function visualOfPlacement(p: Placement): BuildingVisual {
  if (p.kind === 'arena' || p.kind === 'outpost') return { kind: p.kind, busy: false };
  if (p.kind === 'habitat') return { kind: 'habitat', element: p.element ?? 'fire' };
  if (p.kind === 'farm') return { kind: 'farm', stage: 'empty' };
  if (p.kind === 'hatchery') return { kind: 'hatchery', eggs: 0, ready: false };
  if (p.kind === 'forge') return { kind: 'forge', busy: false };
  return { kind: 'den', busy: false };
}

function visualOf(b: Building, state: GameState, now: number): BuildingVisual {
  switch (b.kind) {
    case 'arena':
    case 'outpost':
      return { kind: b.kind, busy: !!b.adventure };
    case 'habitat':
      return { kind: 'habitat', element: b.element! };
    case 'farm': {
      const plots = farmPlots(b).filter((x) => !!x);
      return {
        kind: 'farm',
        stage: !plots.length ? 'empty' : plots.some((x) => x.readyAt <= now) ? 'ready' : 'growing',
      };
    }
    case 'hatchery':
      return { kind: 'hatchery', eggs: state.eggs.length, ready: state.eggs.some((e) => e.hatchAt <= now) };
    case 'den':
      return { kind: 'den', busy: !!state.breeding };
    case 'forge':
      return { kind: 'forge', busy: !!b.craft };
  }
}

// ---------- parcelă liberă în modul plasare ----------

function SlotMarker({ slot, placement, onPick }: { slot: string; placement: Placement; onPick: () => void }) {
  return (
    <g
      className="slot-marker"
      data-slot={slot}
      role="button"
      tabIndex={0}
      aria-label="Alege acest loc"
      transform={slotTransform(slot)}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <g className="slot-preview">
        <BuildingArt visual={visualOfPlacement(placement)} />
      </g>
      <polygon className="slot-ring" points="0,-58 100,-8 0,42 -100,-8" />
      <g className="slot-plus">
        <circle cx={0} cy={-10} r={20} />
        <path d="M-9,-10 h18 M0,-19 v18" />
      </g>
    </g>
  );
}

// ---------- o clădire pe insulă ----------

function BuildingNode({
  b,
  state,
  now,
  moving,
  onOpen,
  onDino,
}: {
  b: Building;
  state: GameState;
  now: number;
  moving: boolean;
  onOpen: () => void;
  onDino: (id: string) => void;
}) {
  const visual = visualOf(b, state, now);
  // puiul care așteaptă o lume nu stă pe hartă lângă incubator: se vede în panoul incubatorului
  const dinos = b.kind === 'habitat' ? residents(state, b.id) : [];
  return (
    <g
      className={`bld ${moving ? 'moving' : ''}`}
      data-building-id={b.id}
      transform={buildingTransform(b)}
      onClick={onOpen}
    >
      <BuildingArtMemo visual={visual} />
      {dinos.map((d, i) => (
        <DinoSprite
          key={d.id}
          dinoId={d.id}
          onOpen={() => onDino(d.id)}
          species={d.species}
          level={d.level}
          x={DINO_SPOTS[i].x}
          y={DINO_SPOTS[i].y - 16}
          flip={i % 2 === 1}
          delay={i * 0.4}
        />
      ))}
      {b.kind === 'hatchery' && <HatcheryEggs state={state} now={now} />}
    </g>
  );
}

/** Ouăle din incubator, în cuibul clădirii; cele gata de eclozare tremură. */
function HatcheryEggs({ state, now }: { state: GameState; now: number }) {
  const n = state.eggs.length;
  return (
    <g className="hatchery-eggs" pointerEvents="none">
      {state.eggs.map((egg, i) => (
        <g key={egg.id} transform={`translate(${(i - (n - 1) / 2) * 26},${-4 + (i % 2) * 6})`}>
          <EggShape
            element={egg.element ?? speciesOf(egg.species).elements[0]}
            size={34}
            shaking={egg.hatchAt <= now}
          />
        </g>
      ))}
    </g>
  );
}

const BuildingArtMemo = memo(BuildingArt, (a, b) => JSON.stringify(a.visual) === JSON.stringify(b.visual));

/** Lungimea unui dinozaur adult pe hartă. Puiul și juvenilul sunt mai mici prin rețetă (src/dino-lab/recipes.ts). */
const MAP_DINO_SIZE = 240;
/** În fiecare vârstă mai crește puțin cu nivelul: +5% pe nivel peste primul nivel al vârstei. */
function mapDinoSize(level: number) {
  const stage = EVOLUTION_STAGES.find((s) => s.id === stageForLevel(level))!;
  return MAP_DINO_SIZE * (1 + 0.05 * (level - stage.minLevel));
}

const DinoSprite = memo(function DinoSprite({
  species,
  level = 10,
  dinoId,
  onOpen,
  x,
  y,
  flip,
  delay,
  animated = false,
  live = false,
}: {
  species: string;
  level?: number;
  dinoId?: string;
  onOpen?: () => void;
  x: number;
  y: number;
  flip: boolean;
  delay: number;
  /** Îl desenează turma (animat): aici rămâne doar ținta pentru clic și tastatură. */
  animated?: boolean;
  /** Turma l-a încărcat și îl desenează. */
  live?: boolean;
}) {
  const stage = stageForLevel(level);
  const url = useThumbnail(
    useMemo(() => recipeFor(species, stage), [species, stage]),
    512,
    !animated,
  );
  // miniatura statică (fără WebGL) are aceeași mărime ca dinozaurul animat
  const size = 112 * (mapDinoSize(level) / MAP_DINO_SIZE);
  return (
    <g
      className={onOpen ? 'world-dino' : undefined}
      data-dino-id={dinoId}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Deschide scena: ${species}` : undefined}
      transform={`translate(${x},${y})`}
      onClick={
        onOpen
          ? (e) => {
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onOpen();
              }
            }
          : undefined
      }
    >
      {animated && <rect x={-50} y={-70} width={100} height={80} fill="transparent" />}
      {!animated && url && (
        <g className="dino-idle" style={{ animationDelay: `${delay}s` }}>
          <DetailImage
            href={url}
            x={-size / 2}
            y={-size + 14}
            width={size}
            height={size}
            transform={flip ? 'scale(-1,1)' : undefined}
          />
        </g>
      )}
    </g>
  );
});

// ---------- bule (aur, ouă gata, recoltă) ----------

/** Când clădirea nu are nimic de strâns: un semn că ai ceva de făcut acolo (expediție, duel, nivel nou). */
function hintOf(b: Building, state: GameState, now: number): { icon: string; text: string } | null {
  const free = state.dinos.filter((d) => !dinoUnavailable(state, d, now));
  if (b.kind === 'outpost' && !b.adventure) {
    const board = dailyExpeditions(state, now);
    if (
      board.slots.some(
        (s) =>
          s.status === 'available' &&
          state.food >= s.mission.cost &&
          expeditionTeamMatches(free, s.mission.requirements),
      )
    )
      return { icon: '🧭', text: '!' };
  }
  if (b.kind === 'arena' && !b.adventure && free.length) {
    if (dailyArena(state, now).challenges.some((c) => !c.claimed && state.food >= c.cost))
      return { icon: '⚔️', text: '!' };
  }
  const cost = buildingUpgradeCost(b);
  if (
    cost !== undefined &&
    state.gold >= cost &&
    (state.fragments ?? 0) >= buildingUpgradeFragments(b) &&
    hasUpgradeParts(state, b)
  )
    return { icon: '⬆', text: `Nv. ${b.level + 1}` };
  return null;
}

function Bubble({
  b,
  state,
  now,
  onCollect,
  onOpen,
}: {
  b: Building;
  state: GameState;
  now: number;
  onCollect: () => void;
  onOpen: () => void;
}) {
  const pos = buildingPosition(b);
  let content: { icon: string; text: string; full?: boolean; hint?: boolean; action: () => void } | null = null;
  if (b.kind === 'habitat') {
    const gold = pendingGold(state, b, now);
    if (gold >= 1) content = { icon: '🪙', text: formatNumber(gold), full: gold >= goldCap(b), action: onCollect };
  } else if (b.kind === 'farm' && farmPlots(b).some((x) => x)) {
    const plots = farmPlots(b).filter((x) => !!x);
    const ready = plots.filter((x) => x.readyAt <= now).length;
    content = ready
      ? { icon: '🍖', text: plots.length > 1 ? `${ready}/${plots.length}` : 'Gata', full: true, action: onOpen }
      : { icon: '🌱', text: formatTime(Math.min(...plots.map((x) => x.readyAt)) - now), action: onOpen };
  } else if (b.kind === 'hatchery') {
    const ready = state.eggs.filter((e) => e.hatchAt <= now).length;
    if (ready) content = { icon: '🐣', text: `${ready}`, full: true, action: onOpen };
    else if (state.eggs.length)
      content = { icon: '🥚', text: `${state.eggs.length}/${hatcherySlots(state)}`, action: onOpen };
  } else if (b.kind === 'den' && state.breeding) {
    const left = state.breeding.readyAt - now;
    content =
      left <= 0
        ? { icon: '🥚', text: 'Gata', full: true, action: onOpen }
        : { icon: '💞', text: formatTime(left), action: onOpen };
  } else if (b.kind === 'forge' && b.craft) {
    const left = b.craft.readyAt - now;
    content =
      left <= 0
        ? { icon: ITEMS[b.craft.itemId]?.icon ?? '⚒️', text: 'Gata', full: true, action: onOpen }
        : { icon: '⚒️', text: formatTime(left), action: onOpen };
  } else if (b.adventure) {
    const left = b.adventure.readyAt - now;
    content = {
      icon: b.kind === 'arena' ? '⚔' : '🧭',
      text: left <= 0 ? (b.adventure.duel && !b.adventure.duel.won ? 'Duel încheiat' : 'Recompensă') : formatTime(left),
      full: left <= 0,
      action: onOpen,
    };
  }
  if (!content) {
    const hint = hintOf(b, state, now);
    if (hint) content = { ...hint, hint: true, action: onOpen };
  }
  if (!content) return null;
  const c = content;
  const w = 26 + c.text.length * 9;
  const lift = 220 * pos.scale;
  return (
    <g
      className={`bubble ${c.full ? 'full' : ''} ${c.hint ? 'hint' : ''}`}
      transform={`translate(${pos.x},${pos.y - lift})`}
      onClick={(e) => {
        e.stopPropagation();
        c.action();
      }}
    >
      <g className="bubble-bob">
        <path
          d={`M${-w / 2},-14 h${w} a14,14 0 0 1 0,28 h${-w / 2 + 8} l-8,9 l-8,-9 h${-w / 2 + 8} a14,14 0 0 1 0,-28 Z`}
          fill={c.full ? '#ffd54f' : c.hint ? '#c8f5e6' : '#ffffff'}
          stroke="#5d4037"
          strokeWidth={2}
        />
        <text x={0} y={5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#3e2723">
          {c.icon} {c.text}
        </text>
      </g>
    </g>
  );
}

/**
 * Animațiile decorului din scenă (râuri, fum, dinozauri care respiră) sunt lente și fine, dar
 * orice schimbare din SVG îl redesenează întreg. Le avansăm toate deodată, de AMBIENT_FPS ori pe secundă, în loc de
 * la fiecare cadru: aceleași keyframe-uri CSS, de ~6 ori mai puțină muncă. Animațiile interfeței nu sunt atinse.
 */
const AMBIENT_FPS = 12;
function useAmbientTicker(scene: React.RefObject<SVGSVGElement | null>) {
  useEffect(() => {
    const root = scene.current;
    if (!root || !root.getAnimations) return;
    const starts = new WeakMap<Animation, number>();
    const tick = () => {
      const now = Number(document.timeline.currentTime ?? performance.now());
      for (const a of root.getAnimations({ subtree: true })) {
        let start = starts.get(a);
        if (start === undefined) {
          start = now - Number(a.currentTime ?? 0);
          starts.set(a, start);
          a.pause();
        }
        a.currentTime = now - start;
      }
    };
    tick();
    const id = setInterval(tick, 1000 / AMBIENT_FPS);
    return () => clearInterval(id);
  }, [scene]);
}

function Sky() {
  return (
    <div
      className="sky"
      aria-hidden
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}world/prehistoric-background.webp)` }}
    />
  );
}

function ChainLinks({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const count = Math.max(3, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 29));
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <g className="world-chain-links" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        return (
          <ellipse
            key={i}
            cx={0}
            cy={0}
            rx={22}
            ry={i % 2 ? 6 : 11}
            transform={`translate(${x1 + (x2 - x1) * t},${y1 + (y2 - y1) * t}) rotate(${angle})`}
          />
        );
      })}
    </g>
  );
}

function WorldLock({ element }: { element: ElementId }) {
  return (
    <g className="world-lock" aria-hidden="true">
      <ChainLinks x1={170} y1={200} x2={940} y2={510} />
      <ChainLinks x1={170} y1={510} x2={940} y2={200} />
      <g transform="translate(550,345)">
        <path d="M-42,-8 V-55 A42,42 0 0 1 42,-55 V-8" fill="none" stroke="#283441" strokeWidth={24} />
        <path d="M-42,-8 V-55 A42,42 0 0 1 42,-55 V-8" fill="none" stroke="#b7c8ca" strokeWidth={12} />
        <rect x={-77} y={-15} width={154} height={116} rx={18} fill="#e7b64b" stroke="#79541f" strokeWidth={8} />
        <rect x={-62} y={0} width={124} height={85} rx={10} fill="#ffd46c" stroke="#ffeb9c" strokeWidth={3} />
        <circle cy={32} r={16} fill="#674921" />
        <path d="M-7,39 L-12,66 H12 L7,39" fill="#674921" />
        <rect x={-110} y={120} width={220} height={47} rx={20} fill="#243b37" stroke="#d4b475" strokeWidth={3} />
        <text y={152} textAnchor="middle" fill="#ffdd83" fontSize={25} fontWeight={800}>
          🪙 {formatNumber(WORLD_UNLOCK_COST[element])}
        </text>
      </g>
    </g>
  );
}

/** Umbra insulei, deja estompată (înlocuiește un drop-shadow care s-ar recalcula la fiecare cadru al plutirii). */
function IslandShadow({ href, width, height }: { href: string; width: number; height: number }) {
  return (
    <DetailImage
      href={href}
      x={-SHADOW_PAD}
      y={-SHADOW_PAD}
      width={width + 2 * SHADOW_PAD}
      height={height + 2 * SHADOW_PAD}
      preserveAspectRatio="none"
      className="island-shadow"
      aria-hidden="true"
    />
  );
}

function habitatSpot(index: number, capacity: number, element: ElementId) {
  const spots = HABITAT_ISLANDS[element].layout?.spots;
  if (spots) return spots[index % spots.length];
  if (capacity <= 2) return { x: 350 + index * 390, y: 400 };
  if (capacity <= 4) return { x: 350 + (index % 2) * 390, y: 320 + Math.floor(index / 2) * 160 };
  if (index < 3) return { x: 330 + index * 220, y: 280 };
  if (index < 7) return { x: 220 + (index - 3) * 220, y: 400 };
  return { x: 330 + ((index - 7) % 3) * 220, y: 520 + Math.floor((index - 7) / 3) * 110 };
}

function HabitatIsland({
  element,
  buildings,
  x,
  y,
  state,
  now,
  onOpen,
  onDino,
  onCollect,
  detail,
  live,
}: {
  element: ElementId;
  buildings: Building[];
  x: number;
  y: number;
  detail: boolean;
  /** Dinozaurii animați deja de turmă (canvasul de peste hartă); null = fără turmă, miniaturi statice. */
  live: Set<string> | null;
  state: GameState;
  now: number;
  onOpen: () => void;
  onDino: (id: string) => void;
  onCollect: () => void;
}) {
  const island = HABITAT_ISLANDS[element];
  const dinos = buildings.flatMap((b) => residents(state, b.id));
  const building = buildings[0];
  const capacity = buildings.reduce((n, b) => n + habitatCapacity(b), 0);
  const gold = buildings.reduce((n, b) => n + pendingGold(state, b, now), 0);
  const activate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <g transform={`translate(${x},${y})`}>
      <g>
        <g
          className={`habitat-island ${building ? '' : 'undiscovered'}`}
          data-tour={`island-${element}`}
          onClick={onOpen}
          onKeyDown={activate}
          role="button"
          tabIndex={0}
          aria-label={`${island.name}: apropie camera`}
        >
          <IslandShadow href={island.shadow} width={1100} height={734} />
          {building ? (
            <DetailImage
              href={island.image}
              hd={island.hd}
              detail={detail}
              width={1100}
              height={734}
              className="island-image"
            />
          ) : (
            <DetailImage href={island.locked} width={1100} height={734} className="island-image" />
          )}
          {dinos.map((d, i) => (
            <g
              key={d.id}
              transform={`translate(${habitatSpot(i, capacity, element).x},${habitatSpot(i, capacity, element).y}) scale(1.55)`}
            >
              <DinoSprite
                species={d.species}
                level={d.level}
                dinoId={d.id}
                onOpen={() => onDino(d.id)}
                x={0}
                y={0}
                flip={i % 2 === 1}
                delay={i * 0.4}
                animated={!!live}
                live={!!live?.has(d.id)}
              />
            </g>
          ))}
          {!building && <WorldLock element={element} />}
          <g transform="translate(550,680)">
            <rect x={-290} y={-35} width={580} height={92} rx={22} fill="#233729" stroke="#d6b970" strokeWidth={3} />
            <text className="island-title" textAnchor="middle" y={0}>
              {ELEMENTS[element].icon} {island.name}
            </text>
            <text textAnchor="middle" y={33} fill="#e9e7c9" fontSize={22}>
              {building
                ? `${dinos.length}/${capacity} locuitori · ${buildings.length > 1 ? `${buildings.length} habitate` : `Nivel ${building.level}`} · Apropie →`
                : `🔒 Lume blocată · ${formatNumber(WORLD_UNLOCK_COST[element])} aur`}
            </text>
          </g>
        </g>
        {gold > 0 && (
          <g
            className="island-gold"
            role="button"
            tabIndex={0}
            aria-label={`Strânge ${gold} aur`}
            transform="translate(800,110)"
            onClick={onCollect}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCollect();
              }
            }}
          >
            <rect x={-95} y={-28} width={190} height={56} rx={28} fill="#ffda71" stroke="#845727" strokeWidth={3} />
            <text y={9} textAnchor="middle" fontSize={25} fontWeight={800} fill="#4a3216">
              🪙 {formatNumber(gold)}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}
