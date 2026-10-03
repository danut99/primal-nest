// Laboratorul de dragoni: pornește de la un schelet Spine existent și îl transformă după o „rețetă” JSON.
// Rețeta schimbă culorile pe părți (recolorare reală a texturii), proporțiile, mișcarea (amplitudine, valuri,
// inerție, ritm, plutire), piesele vizibile și numele animațiilor. Se aplică live, fără reîncărcare.

import { DRAGON_BASE, loadCatalog, loadRuntime, openArchive, sourceKey, type DragonSource, type Files } from '../dragons/runtime';

// ---------- rețeta ----------

export interface ColorAdjust {
  /** Rotirea nuanței, în grade (-180…180). */
  hue?: number;
  /** Multiplicator de saturație (0…3). */
  saturation?: number;
  /** -1 (negru) … 0 … 1 (alb). */
  lightness?: number;
  /** Colorează în această culoare (#rrggbb), păstrând umbrele. */
  colorize?: string;
  /** Cât de mult se aplică `colorize` (0…1). */
  colorizeAmount?: number;
}

export interface PartSettings extends ColorAdjust {
  hidden?: boolean;
  /** Mărimea întregii părți (se aplică pe primul os din lanț). */
  scale?: number;
  /** Lungire (axa osului) și îngroșare. */
  length?: number;
  width?: number;
  /** Rotire fixă a părții (grade) și îndoire pe fiecare os din lanț. */
  rotate?: number;
  curl?: number;
  /** Amplificarea mișcării originale: 0 = înghețat, 1 = original, 2 = dublu. */
  amplify?: number;
  /** Val procedural: amplitudine (grade), viteză (Hz), defazaj pe fiecare os din lanț. */
  wave?: number;
  waveSpeed?: number;
  waveLag?: number;
  /** Întârziere elastică (0…0.95): părțile „vin după” restul corpului. */
  inertia?: number;
}

export interface PartGroup {
  id: string;
  label: string;
  /** Expresii regulate pe numele oaselor și pe numele sloturilor (piese desenate). */
  bones: string;
  slots: string;
}

export interface AnimationSettings {
  label?: string;
  speed?: number;
  hidden?: boolean;
}

export interface MotionSettings {
  speed?: number;
  /** Ritm neregulat în fiecare ciclu (0…0.9): accelerează și încetinește mișcarea. */
  warp?: number;
  /** Plutire sus-jos (unități Spine) și legănare (grade). */
  bob?: number;
  bobSpeed?: number;
  sway?: number;
  swaySpeed?: number;
  flip?: boolean;
  /** A doua animație suprapusă peste cea curentă (de ex. aripile din „fly” peste „walk”). */
  overlay?: string;
  overlayAlpha?: number;
  zoom?: number;
}

export interface DragonRecipe {
  id: string;
  name: string;
  description?: string;
  base: DragonSource;
  color?: ColorAdjust;
  parts?: Record<string, PartSettings>;
  /** Grupe suplimentare sau care le înlocuiesc pe cele implicite (același id). */
  groups?: PartGroup[];
  motion?: MotionSettings;
  animations?: Record<string, AnimationSettings>;
  /** Animații împrumutate de la alt schelet (potrivite os cu os, după nume), de ex. atacul adultului pentru juvenil. */
  borrow?: { from: DragonSource; animations: string[] };
}

/** Ordinea contează: o piesă aparține primei grupe care se potrivește. */
export const DEFAULT_GROUPS: PartGroup[] = [
  {
    id: 'efecte',
    label: 'Efecte',
    bones: 'fx|glow|particles|smoke|fire|rock|crack|splash|bean|spot|scratch',
    slots: 'fx|glow|guang|xing|baokai|shuai|particles|smoke|fire|rock|crack|Liquid|eff_',
  },
  { id: 'inotatoare', label: 'Înotătoare', bones: '(^|_)fin(_|$)', slots: '(^|_)fin(_|$)' },
  { id: 'coarne', label: 'Coarne', bones: 'horn', slots: 'horn|crown' },
  { id: 'aripi', label: 'Aripi', bones: 'wing|membrane', slots: 'wing|membrane' },
  { id: 'coada', label: 'Coadă', bones: 'tail', slots: 'tail' },
  {
    id: 'cap',
    label: 'Cap',
    bones: '^(head|jaw|eyebrow|pupil|eye_|hair|head_crest)|(^|_)ear',
    slots: 'face|jaw|tongue|tounge|eye|(^|_)ear|hair|cheek|nose|head_crest',
  },
  { id: 'gat', label: 'Gât', bones: 'neck', slots: 'neck|collar' },
  { id: 'brate', label: 'Brațe', bones: 'clavicle|arm|hand|finger|wrist|palm', slots: 'arm|shoulder|palm|finger|hand' },
  {
    id: 'picioare',
    label: 'Picioare',
    bones: 'leg|thigh|toe|foot|feet|ankle|knee',
    slots: 'leg|thigh|toe|foot|feet|knee',
  },
  {
    id: 'podoabe',
    label: 'Podoabe',
    bones: 'cloth|crest|ring|shield|sheild',
    slots: 'cloth|crest|ring|shield|sheld|belt|button',
  },
  { id: 'corp', label: 'Corp', bones: '^(pelvis|waist|hips|chest)', slots: '^body' },
];

export const DEFAULT_ANIMATION_LABELS: Record<string, string> = {
  breathe: 'Repaus',
  fly: 'Zbor',
  walk: 'Mers',
  attack: 'Atac',
  special1: 'Special',
  levelup: 'Evoluție',
};

export const groupsOf = (r: DragonRecipe) => [
  ...(r.groups ?? []),
  ...DEFAULT_GROUPS.filter((g) => !r.groups?.some((c) => c.id === g.id)),
];
export const animationLabel = (r: DragonRecipe, name: string) =>
  r.animations?.[name]?.label || DEFAULT_ANIMATION_LABELS[name] || name;

// ---------- rig: rețeta aplicată pe un schelet Spine (folosit de player și de arena de luptă) ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export interface Rig {
  /** Toate animațiile scheletului. */
  readonly all: string[];
  /** Animațiile vizibile după rețetă. */
  visible(): string[];
  readonly usedGroups: Set<string>;
  /** Aplică o rețetă nouă. Întoarce true dacă pista de animație trebuie repornită. */
  set(recipe: DragonRecipe): boolean;
  /** După ce pista 0 a primit o animație: viteza ei și animația suprapusă. */
  configure(name: string): void;
  /** Slotul e un efect (foc, strălucire) sau o parte ascunsă? */
  isEffect(slotIndex: number): boolean;
}

export function rigSkeleton(skeleton: Any, state: Any, start: DragonRecipe, opts: { colors?: boolean } = {}): Rig {
  const bones: Any[] = skeleton.bones;
  const slots: Any[] = skeleton.slots;
  const all: string[] = skeleton.data.animations.map((a: { name: string }) => a.name);

  let recipe = start;
  let groupIds: string[] = [];
  let parts: (PartSettings | undefined)[] = [];
  let boneGroup = new Int16Array(bones.length);
  let slotGroup = new Int16Array(slots.length);
  const chainRoot = new Uint8Array(bones.length);
  const depth = new Uint8Array(bones.length);
  const prevRotation = new Float32Array(bones.length).fill(NaN);
  let clock = 0;
  let dt = 0;
  let usedGroups = new Set<string>();

  const compile = () => {
    const groups = groupsOf(recipe).map((g) => ({ id: g.id, bones: new RegExp(g.bones, 'i'), slots: new RegExp(g.slots, 'i') }));
    groupIds = groups.map((g) => g.id);
    parts = groups.map((g) => recipe.parts?.[g.id]);
    usedGroups = new Set();
    boneGroup = new Int16Array(bones.map((b) => groups.findIndex((g) => g.bones.test(b.data.name))));
    slotGroup = new Int16Array(slots.map((s) => groups.findIndex((g) => g.slots.test(s.data.name))));
    bones.forEach((b, i) => {
      const g = boneGroup[i];
      if (g >= 0) usedGroups.add(groups[g].id);
      const parent = b.parent ? b.parent.data.index : -1;
      chainRoot[i] = g >= 0 && (parent < 0 || boneGroup[parent] !== g) ? 1 : 0;
      depth[i] = g < 0 || chainRoot[i] ? 0 : Math.min(255, depth[parent] + 1);
    });
    slotGroup.forEach((g) => g >= 0 && usedGroups.add(groups[g].id));
  };

  // Mișcarea: după ce animația originală a fost aplicată, modificăm poza locală a oaselor.
  const TAU = Math.PI * 2;
  const deform = () => {
    for (let i = 0; i < bones.length; i++) {
      const p = parts[boneGroup[i]];
      if (!p) continue;
      const b = bones[i];
      const d = b.data;
      const amp = p.amplify ?? 1;
      if (amp !== 1) {
        b.rotation = d.rotation + (b.rotation - d.rotation) * amp;
        b.x = d.x + (b.x - d.x) * amp;
        b.y = d.y + (b.y - d.y) * amp;
      }
      if (chainRoot[i]) {
        const s = p.scale ?? 1;
        b.scaleX *= s * (p.length ?? 1);
        b.scaleY *= s * (p.width ?? 1);
        b.rotation += p.rotate ?? 0;
      }
      b.rotation += p.curl ?? 0;
      if (p.wave) b.rotation += p.wave * Math.sin(TAU * (p.waveSpeed ?? 1) * clock - depth[i] * (p.waveLag ?? 0.6));
      if (p.inertia) {
        const prev = prevRotation[i];
        if (!Number.isNaN(prev) && dt > 0) b.rotation = prev + (b.rotation - prev) * (1 - Math.pow(Math.min(0.97, p.inertia), dt * 60));
        prevRotation[i] = b.rotation;
      }
    }
    const m = recipe.motion ?? {};
    const root = skeleton.getRootBone();
    if (m.bob) root.y += m.bob * Math.sin(TAU * (m.bobSpeed ?? 0.5) * clock);
    if (m.sway) root.rotation += m.sway * Math.sin(TAU * (m.swaySpeed ?? 0.3) * clock);
    for (let i = 0; i < slots.length; i++) if (parts[slotGroup[i]]?.hidden) slots[i].attachment = null;
  };

  const update = state.update.bind(state);
  state.update = (delta: number) => {
    const warp = recipe.motion?.warp ?? 0;
    const cur = state.getCurrent(0);
    const k = warp && cur ? 1 + warp * Math.sin((TAU * cur.trackTime) / (cur.animation.duration || 1)) : 1;
    dt = delta;
    clock += delta;
    return update(delta * k);
  };
  const apply = state.apply.bind(state);
  state.apply = (s: Any) => {
    s.setToSetupPose();
    const result = apply(s);
    deform();
    return result;
  };

  // Culorile: o singură trecere prin pixeli; fiecare pixel ia ajustarea globală + a părții lui.
  const pageRegions = new Map<Any, { slot: number; x0: number; y0: number; x1: number; y1: number }[]>();
  const originals = new Map<Any, ImageData>();
  if (opts.colors !== false) {
    for (const skin of skeleton.data.skins) {
      for (const entry of skin.getAttachments()) {
        const region = entry.attachment?.region;
        const page = region?.page;
        if (!page?.texture) continue;
        const list = pageRegions.get(page.texture) ?? [];
        list.push({
          slot: entry.slotIndex,
          x0: Math.floor(Math.min(region.u, region.u2) * page.width),
          x1: Math.ceil(Math.max(region.u, region.u2) * page.width),
          y0: Math.floor(Math.min(region.v, region.v2) * page.height),
          y1: Math.ceil(Math.max(region.v, region.v2) * page.height),
        });
        pageRegions.set(page.texture, list);
      }
    }
  }
  let colorKey = '';
  let frame = 0;
  const recolor = () => {
    const key = JSON.stringify([recipe.color, groupsOf(recipe).map((g) => [g.slots, colorOf(recipe.parts?.[g.id])])]);
    if (key === colorKey) return;
    colorKey = key;
    const global = recipe.color;
    const globalOn = hasColor(global);
    for (const [texture, regions] of pageRegions) {
      let src = originals.get(texture);
      if (!src) {
        if (!globalOn && !parts.some(hasColor)) continue;
        const img = texture.getImage();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        src = ctx.getImageData(0, 0, c.width, c.height);
        originals.set(texture, src);
      }
      const { width, height } = src;
      const owner = new Int16Array(width * height).fill(-1);
      for (const r of regions) {
        const g = slotGroup[r.slot];
        if (g < 0 || !hasColor(parts[g])) continue;
        for (let y = Math.max(0, r.y0); y < Math.min(height, r.y1); y++) owner.fill(g, y * width + Math.max(0, r.x0), y * width + Math.min(width, r.x1));
      }
      const out = new ImageData(new Uint8ClampedArray(src.data), width, height);
      const d = out.data;
      const rgb = [0, 0, 0];
      for (let p = 0, o = 0; p < owner.length; p++, o += 4) {
        if (d[o + 3] === 0) continue;
        const part = owner[p] >= 0 ? parts[owner[p]] : undefined;
        if (!globalOn && !part) continue;
        rgb[0] = d[o] / 255;
        rgb[1] = d[o + 1] / 255;
        rgb[2] = d[o + 2] / 255;
        if (globalOn) adjust(rgb, global!);
        if (part) adjust(rgb, part);
        d[o] = rgb[0] * 255;
        d[o + 1] = rgb[1] * 255;
        d[o + 2] = rgb[2] * 255;
      }
      texture._image = out;
      texture.update(false);
    }
  };

  const trackKey = (r: DragonRecipe) => JSON.stringify([r.motion?.overlay, r.motion?.overlayAlpha, r.animations, r.motion?.flip]);
  let lastTrack = '';
  const set = (r: DragonRecipe) => {
    recipe = r;
    compile();
    skeleton.scaleX = Math.abs(skeleton.scaleX) * (r.motion?.flip ? -1 : 1);
    if (pageRegions.size) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recolor);
    }
    const key = trackKey(r);
    const changed = key !== lastTrack;
    lastTrack = key;
    return changed;
  };
  set(start);
  if (pageRegions.size) {
    cancelAnimationFrame(frame);
    recolor();
  }

  return {
    all,
    visible: () => all.filter((a) => !recipe.animations?.[a]?.hidden),
    get usedGroups() {
      return usedGroups;
    },
    set,
    configure(name) {
      const entry = state.getCurrent(0);
      if (entry) entry.timeScale = recipe.animations?.[name]?.speed ?? 1;
      const overlay = recipe.motion?.overlay;
      state.clearTrack(1);
      if (overlay && all.includes(overlay) && overlay !== name) state.setAnimation(1, overlay, true).alpha = recipe.motion?.overlayAlpha ?? 0.5;
      prevRotation.fill(NaN);
    },
    isEffect: (i) => groupIds[slotGroup[i]] === 'efecte' || !!parts[slotGroup[i]]?.hidden,
  };
}

// ---------- player (o singură scenă, cu runtime-ul SpinePlayer) ----------

export interface LabController {
  /** Numele interne ale animațiilor (fără cele ascunse în rețetă). */
  readonly animations: string[];
  /** Animațiile vizibile care chiar diferă între ele (fără copii identice, de ex. „levelup” = „breathe”). */
  readonly distinct: string[];
  /** Toate animațiile scheletului, inclusiv cele ascunse. */
  readonly allAnimations: string[];
  /** Ce grupe au piese în acest schelet (pentru editor). */
  readonly usedGroups: Set<string>;
  setAnimation(name: string): void;
  /** Joacă o animație o dată, apoi revine la repaus. */
  playOnce(name: string): void;
  setPaused(value: boolean): void;
  setRecipe(recipe: DragonRecipe): void;
  /** Reîncadrează camera după schimbări mari de proporții. */
  reframe(): void;
  snapshot(): Promise<Blob | null>;
  dispose(): void;
}

export interface LabOptions {
  animation?: string;
  paused?: boolean;
  background?: string;
  /**
   * Camera fixă pe corpul dragonului: `true` cuprinde toate animațiile vizibile, o listă doar pe acelea
   * (de ex. ['attack'] pentru un boss care atacă în buclă). Dragonul se vede mereu întreg.
   */
  fixedViewport?: boolean | string[];
  /**
   * Camera urmărește corpul dragonului: aproape în repaus (dragonul e mare), iar când joacă o animație mai largă
   * (atac, ultimată) se depărtează lin cât s-o cuprindă întreagă, apoi revine.
   */
  follow?: boolean;
  /** Marginile din jurul dragonului, în procente din cadru (de ex. loc pentru titlu sus și butoane jos). */
  pad?: { top: number; bottom: number; left: number; right: number };
}

/** Fișierele unui schelet: modelele generate sunt statice, arhivele se despachetează în browser. */
export async function baseFiles(base: DragonSource, signal: AbortSignal): Promise<Files> {
  if ('archive' in base) return openArchive(base.archive, signal);
  const dir = `${DRAGON_BASE}/models/${base.model}/${base.stage}/`;
  return { skel: dir + 'skeleton.skel', atlas: dir + 'atlas.atlas', urls: {} };
}

// ---------- animații împrumutate ----------

const dataCache = new Map<string, Promise<Any>>();

/** Doar datele unui schelet (oase, animații), fără texturi: sursa animațiilor împrumutate. */
export function loadSkeletonData(spine: Any, base: DragonSource): Promise<Any> {
  const key = sourceKey(base);
  let data = dataCache.get(key);
  if (!data) {
    data = (async () => {
      const files = await baseFiles(base, new AbortController().signal);
      try {
        const [atlasText, skel] = await Promise.all([
          fetch(files.urls[files.atlas] ?? files.atlas).then((r) => r.text()),
          fetch(files.urls[files.skel] ?? files.skel).then((r) => r.arrayBuffer()),
        ]);
        const atlas = new spine.TextureAtlas(atlasText, () => new spine.FakeTexture(new Image()));
        return new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(skel));
      } finally {
        Object.values(files.urls).forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    dataCache.set(key, data);
    data.catch(() => dataCache.delete(key));
  }
  return data;
}

/**
 * Copiază animațiile `names` din `source` în `target`. Oasele și sloturile se potrivesc după nume; mutările se scalează
 * cu raportul dintre mărimile scheletelor. Schimbările de piese (attachment, deform, ordine) nu se copiază.
 */
export function borrowAnimations(spine: Any, target: Any, source: Any, names: string[]) {
  const boneMap: number[] = source.bones.map((b: Any) => target.findBone(b.name)?.index ?? -1);
  const slotMap: number[] = source.slots.map((s: Any) => target.findSlot(s.name)?.index ?? -1);
  const size = (d: Any) => d.bones.reduce((sum: number, b: Any) => sum + (b.length || 0), 0);
  const ratio = size(source) > 0 && size(target) > 0 ? size(target) / size(source) : 1;
  const clone = (t: Any, patch: object) => Object.assign(Object.create(Object.getPrototypeOf(t)), t, patch);
  for (const name of names) {
    const anim = source.findAnimation(name);
    if (!anim) continue;
    const timelines = anim.timelines.flatMap((t: Any) => {
      if (t instanceof spine.RotateTimeline || t instanceof spine.TranslateTimeline) {
        const bone = boneMap[t.boneIndex];
        if (bone < 0) return [];
        if (t.constructor !== spine.TranslateTimeline) return [clone(t, { boneIndex: bone })];
        const frames = Float32Array.from(t.frames);
        for (let i = 0; i < frames.length; i += 3) {
          frames[i + 1] *= ratio;
          frames[i + 2] *= ratio;
        }
        return [clone(t, { boneIndex: bone, frames })];
      }
      if (t instanceof spine.ColorTimeline || t instanceof spine.TwoColorTimeline) {
        const slot = slotMap[t.slotIndex];
        return slot < 0 ? [] : [clone(t, { slotIndex: slot })];
      }
      return [];
    });
    target.animations = target.animations.filter((a: Any) => a.name !== name);
    target.animations.push(new spine.Animation(name, timelines, anim.duration));
  }
}

// ---------- economie: dragonii care nu se văd nu se randează ----------

const live = new Set<() => void>();
let focusRoots: Element[] = [];

/**
 * Un modal deschis: dragonii din afara lui se opresc (nu se mai randează) până se închide.
 * Întoarce funcția care îi repornește. Folosit de Modal.
 */
export function focusDragons(root: Element): () => void {
  focusRoots.push(root);
  live.forEach((update) => update());
  return () => {
    focusRoots = focusRoots.filter((r) => r !== root);
    live.forEach((update) => update());
  };
}

export async function createLabDragon(host: HTMLElement, initial: DragonRecipe, opts: LabOptions, signal: AbortSignal): Promise<LabController> {
  const [, spine] = await Promise.all([loadCatalog(), loadRuntime()]);
  const borrowed = initial.borrow ? await loadSkeletonData(spine, initial.borrow.from) : null;
  const files = await baseFiles(initial.base, signal);
  const revoke = () => Object.values(files.urls).forEach((u) => URL.revokeObjectURL(u));
  if (signal.aborted) {
    revoke();
    throw signal.reason;
  }

  const element = document.createElement('div');
  element.className = 'dragon-spine-host';
  host.append(element);

  return new Promise((resolve, reject) => {
    let disposed = false;
    let raw: Any;
    const stops: (() => void)[] = [];
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', onAbort);
      stops.forEach((stop) => stop());
      raw?.dispose?.();
      raw?.context?.gl?.getExtension('WEBGL_lose_context')?.loseContext();
      element.remove();
      revoke();
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });

    raw = new spine.SpinePlayer(element, {
      skelUrl: files.skel,
      atlasUrl: files.atlas,
      rawDataURIs: files.urls,
      premultipliedAlpha: false,
      showControls: false,
      alpha: true,
      backgroundColor: opts.background ?? '#00000000',
      viewport: { padLeft: '10%', padRight: '10%', padTop: '10%', padBottom: '10%', transitionTime: 0.25 },
      success: () => {
        if (disposed) return;
        try {
          resolve(control());
        } catch (e) {
          cleanup();
          reject(e);
        }
      },
      error: (_: unknown, message: string) => {
        cleanup();
        reject(new Error(String(message)));
      },
    });

    /**
     * SpinePlayer face la fiecare cadru două lucruri scumpe pentru pagină: actualizează slider-ul de timeline (ascuns)
     * și citește mărimea canvasului, ceea ce forțează recalcularea layout-ului. Le tăiem pe amândouă, apoi oprim
     * randarea cât timp dragonul nu se vede (derulat în afara ecranului sau acoperit de un modal).
     */
    function economize() {
      if (raw.timelineSlider) raw.timelineSlider.setValue = () => {};
      let dirty = true;
      const sizes = new ResizeObserver(() => (dirty = true));
      sizes.observe(element);
      const resize = raw.sceneRenderer.resize.bind(raw.sceneRenderer);
      raw.sceneRenderer.resize = (mode: Any) => {
        if (mode !== spine.webgl.ResizeMode.Expand) {
          dirty = true;
          return resize(mode);
        }
        if (dirty) {
          dirty = false;
          resize(mode);
        }
      };

      // Bucla de randare: știm dacă mai rulează, ca s-o pornim o singură dată la loc.
      let looping = true;
      const draw = raw.drawFrame.bind(raw);
      raw.drawFrame = (next = true) => {
        if (next) looping = !raw.stopRequestAnimationFrame;
        return draw(next);
      };
      let onScreen = true;
      const update = () => {
        const top = focusRoots[focusRoots.length - 1];
        const run = onScreen && (!top || top.contains(element));
        if (!run) {
          raw.stopRequestAnimationFrame = true;
          return;
        }
        raw.stopRequestAnimationFrame = false;
        if (!looping) {
          looping = true;
          raw.time?.update?.(); // fără salt în animație după pauză
          requestAnimationFrame(() => raw.drawFrame());
        }
      };
      const seen = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        update();
      });
      seen.observe(element);
      live.add(update);
      update();
      stops.push(() => {
        sizes.disconnect();
        seen.disconnect();
        live.delete(update);
      });
    }

    function control(): LabController {
      economize();
      const state = raw.animationState;
      if (borrowed) borrowAnimations(spine, raw.skeleton.data, borrowed, initial.borrow!.animations);
      const rig = rigSkeleton(raw.skeleton, state, initial);
      // Amprenta fiecărei animații: poza oaselor și piesele vizibile în câteva momente. Copiile identice se ascund.
      const fingerprint = (name: string) => {
        const data = raw.skeleton.data;
        const anim = data.findAnimation(name);
        const sk = new spine.Skeleton(data);
        if (!data.defaultSkin && data.skins.length) sk.setSkin(data.skins[0]);
        const parts: string[] = [String(Math.round(anim.duration * 10))];
        for (let i = 0; i < 6; i++) {
          const t = (anim.duration * i) / 6;
          sk.setToSetupPose();
          anim.apply(sk, t, t, false, null, 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
          sk.updateWorldTransform();
          for (const b of sk.bones) parts.push(`${Math.round(b.worldX)},${Math.round(b.worldY)}`);
          for (const sl of sk.slots) parts.push(sl.attachment?.name ?? '-');
        }
        return parts.join('|');
      };
      const distinctOf = () => {
        const seen = new Set<string>();
        return rig.visible().filter((name) => {
          try {
            const key = fingerprint(name);
            if (seen.has(key)) return false;
            seen.add(key);
          } catch {
            // dacă amprenta nu se poate calcula, animația rămâne
          }
          return true;
        });
      };
      let distinct: string[] | null = null;
      let recipe = initial;
      let current = '';
      const idle = () => {
        const names = rig.visible();
        return names.includes('breathe') ? 'breathe' : (names[0] ?? rig.all[0]);
      };
      const redraw = () => {
        if (!raw.paused) return;
        state.apply(raw.skeleton);
        raw.drawFrame(false);
      };
      const viewport = () => {
        const f = Math.max(0.2, Math.min(3, recipe.motion?.zoom ?? 1));
        const pad = 10 + (1 / f - 1) * 50 + '%';
        const p = opts.pad;
        Object.assign(
          raw.config.viewport,
          p ? { padLeft: p.left + '%', padRight: p.right + '%', padTop: p.top + '%', padBottom: p.bottom + '%' } : { padLeft: pad, padRight: pad, padTop: pad, padBottom: pad },
        );
      };
      // Conturul corpului (fără efecte) în fiecare animație, calculat o dată: camera se așază după el.
      // Efectele (raze, străluciri) nu mută camera; au loc în jur, pe canvasul mai mare decât caseta.
      type Box = { x: number; y: number; width: number; height: number };
      const boxes = new Map<string, Box>();
      const measure = () => {
        boxes.clear();
        const skeleton = raw.skeleton;
        const o = new spine.Vector2();
        const size = new spine.Vector2();
        for (const name of rig.visible()) {
          const anim = skeleton.data.findAnimation(name);
          let x0 = Infinity;
          let y0 = Infinity;
          let x1 = -Infinity;
          let y1 = -Infinity;
          state.clearTracks();
          skeleton.setToSetupPose();
          state.setAnimation(0, name, true);
          const steps = 30;
          for (let i = 0; i <= steps; i++) {
            state.update(i ? anim.duration / steps : 0);
            state.apply(skeleton);
            skeleton.slots.forEach((s: Any, k: number) => rig.isEffect(k) && (s.attachment = null));
            skeleton.updateWorldTransform();
            skeleton.getBounds(o, size);
            if (!Number.isFinite(o.x) || !Number.isFinite(size.x)) continue;
            x0 = Math.min(x0, o.x);
            y0 = Math.min(y0, o.y);
            x1 = Math.max(x1, o.x + size.x);
            y1 = Math.max(y1, o.y + size.y);
          }
          if (Number.isFinite(x0)) boxes.set(name, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        }
      };
      const union = (names: string[]): Box | null => {
        const list = names.map((n) => boxes.get(n)).filter((b): b is Box => !!b);
        if (!list.length) return null;
        const x0 = Math.min(...list.map((b) => b.x));
        const y0 = Math.min(...list.map((b) => b.y));
        const x1 = Math.max(...list.map((b) => b.x + b.width));
        const y1 = Math.max(...list.map((b) => b.y + b.height));
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      };
      const play = (name: string, loop = true) => {
        current = name;
        if (opts.follow) {
          const box = boxes.get(name);
          if (box) Object.assign(raw.config.viewport, box);
        }
        raw.setAnimation(name, loop);
        rig.configure(name);
        if (!loop) {
          // Cu camera care urmărește, revenirea la repaus trebuie să mute și camera înapoi.
          if (opts.follow) state.getCurrent(0).listener = { complete: () => current === name && play(idle()) };
          else state.addAnimation(0, idle(), true, 0);
        }
        redraw();
      };
      const frame = () => {
        if (!opts.fixedViewport && !opts.follow) return play(current);
        measure();
        if (opts.fixedViewport) {
          const box = union(Array.isArray(opts.fixedViewport) ? opts.fixedViewport : rig.visible());
          if (box) Object.assign(raw.config.viewport, box);
        }
        raw.previousViewport = null;
        play(current);
        raw.previousViewport = null;
      };

      viewport();
      raw.speed = recipe.motion?.speed ?? 1;
      current = rig.visible().includes(opts.animation ?? '') ? opts.animation! : idle();
      frame();
      if (opts.paused) raw.pause();

      return {
        get animations() {
          return rig.visible();
        },
        get distinct() {
          return (distinct ??= distinctOf());
        },
        allAnimations: rig.all,
        get usedGroups() {
          return rig.usedGroups;
        },
        setAnimation: (name) => rig.all.includes(name) && play(name),
        playOnce: (name) => rig.all.includes(name) && play(name, false),
        setPaused(value) {
          if (value) raw.pause();
          else raw.play();
        },
        setRecipe(r) {
          const zoom = recipe.motion?.zoom;
          recipe = r;
          raw.speed = r.motion?.speed ?? 1;
          viewport();
          const changed = rig.set(r);
          if (zoom !== r.motion?.zoom) frame();
          else if (changed) play(rig.visible().includes(current) ? current : idle());
          else redraw();
        },
        reframe: frame,
        snapshot() {
          raw.drawFrame(false);
          return new Promise((r) => raw.canvas.toBlob(r, 'image/png'));
        },
        dispose: cleanup,
      };
    }
  });
}

// ---------- culoare ----------

const colorOf = (p?: ColorAdjust) => p && [p.hue, p.saturation, p.lightness, p.colorize, p.colorizeAmount];
const hasColor = (p?: ColorAdjust): boolean =>
  !!p && (!!p.hue || (p.saturation ?? 1) !== 1 || !!p.lightness || (!!p.colorize && (p.colorizeAmount ?? 1) > 0));

function adjust(rgb: number[], a: ColorAdjust) {
  let [h, s, l] = toHsl(rgb[0], rgb[1], rgb[2]);
  if (a.hue) h = (((h + a.hue / 360) % 1) + 1) % 1;
  if (a.saturation !== undefined) s = Math.min(1, s * a.saturation);
  if (a.lightness) l = a.lightness > 0 ? l + (1 - l) * a.lightness : l * (1 + a.lightness);
  if (a.colorize && (a.colorizeAmount ?? 1) > 0) {
    const t = parseHex(a.colorize);
    const [th, ts] = toHsl(t[0], t[1], t[2]);
    const [r, g, b] = fromHsl(th, ts, l);
    const [r0, g0, b0] = fromHsl(h, s, l);
    const k = a.colorizeAmount ?? 1;
    rgb[0] = r0 + (r - r0) * k;
    rgb[1] = g0 + (g - g0) * k;
    rgb[2] = b0 + (b - b0) * k;
    return;
  }
  [rgb[0], rgb[1], rgb[2]] = fromHsl(h, s, l);
}

const hexCache = new Map<string, number[]>();
function parseHex(hex: string) {
  let c = hexCache.get(hex);
  if (!c) {
    const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    hexCache.set(hex, c);
  }
  return c;
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
}

function hue(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
