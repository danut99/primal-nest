// Motorul laboratorului: pornește de la un schelet de dinozaur (Spine JSON) și îl transformă după o „rețetă”.
// Rețeta schimbă culorile pe părți (recolorare reală a texturii), proporțiile, mișcarea (amplitudine, valuri,
// inerție, ritm, legănare), piesele vizibile și numele animațiilor. Se aplică live, fără reîncărcare.

import { DINO_BASE, loadRig, loadRuntime, type Bounds } from './runtime';

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
  /** Săltare sus-jos (unități Spine) și legănare (grade). */
  bob?: number;
  bobSpeed?: number;
  sway?: number;
  swaySpeed?: number;
  flip?: boolean;
  /** Mărimea în cadru (1 = normal). */
  zoom?: number;
}

export interface DinoRecipe {
  id: string;
  name: string;
  description?: string;
  /** Scheletul de pornire (id din public/dinosaurs/manifest.json). */
  base: { rig: string };
  color?: ColorAdjust;
  parts?: Record<string, PartSettings>;
  /** Grupe suplimentare sau care le înlocuiesc pe cele implicite (același id). */
  groups?: PartGroup[];
  motion?: MotionSettings;
  animations?: Record<string, AnimationSettings>;
}

/**
 * Părțile unui dinozaur, după numele oaselor și ale sloturilor. Ordinea contează: o piesă aparține primei grupe
 * care se potrivește. Acoperă scheletul de T-Rex și numele obișnuite pentru scheletele viitoare
 * (guler de triceratops, plăci de stegozaur, gât de sauropod, aripi de pterozaur).
 */
export const DEFAULT_GROUPS: PartGroup[] = [
  { id: 'efecte', label: 'Efecte', bones: '^fx|glow|spark', slots: '^fx|glow|spark' },
  {
    id: 'podoabe',
    label: 'Creastă și plăci',
    bones: 'crest|plate|spike|frill|sail|horn',
    slots: 'crest|plate|spike|frill|sail|horn',
  },
  { id: 'cap', label: 'Cap', bones: 'head|jaw|skull|beak', slots: 'head|jaw|skull|beak|eye' },
  { id: 'gat', label: 'Gât', bones: 'neck', slots: 'neck' },
  { id: 'coada', label: 'Coadă', bones: 'tail|club', slots: 'tail|club' },
  { id: 'aripi', label: 'Aripi', bones: 'wing|membrane', slots: 'wing|membrane' },
  { id: 'brate', label: 'Brațe', bones: 'arm|hand|claw|finger', slots: 'arm|hand|claw|finger' },
  {
    id: 'picioare',
    label: 'Picioare',
    bones: 'thigh|shin|calf|foot|leg|toe|knee',
    slots: 'thigh|shin|calf|foot|leg|toe|knee',
  },
  { id: 'sold', label: 'Șold', bones: 'hip|pelvis', slots: 'hip|pelvis' },
  { id: 'corp', label: 'Corp', bones: '^(body|chest|torso|spine)', slots: '^(body|chest|torso|belly)' },
];

export const DEFAULT_ANIMATION_LABELS: Record<string, string> = {
  idle: 'Repaus',
  walk: 'Mers',
  attack: 'Mușcătură',
  ultimate: 'Ultimată',
};

/** Animațiile care se joacă o singură dată (apoi revine repausul). */
export const ONE_SHOT = new Set(['attack', 'ultimate']);

export const groupsOf = (r: DinoRecipe) => [
  ...(r.groups ?? []),
  ...DEFAULT_GROUPS.filter((g) => !r.groups?.some((c) => c.id === g.id)),
];
export const animationLabel = (r: DinoRecipe, name: string) =>
  r.animations?.[name]?.label || DEFAULT_ANIMATION_LABELS[name] || name;

// ---------- rig: rețeta aplicată pe un schelet Spine ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// Reuse CPU preparation across map previews and live stages; GPU contexts stay independent.
const coloredPages = new Map<string, ImageData>();
const measuredRecipes = new Map<string, Map<string, Bounds>>();
function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value!);
}

export interface Rig {
  readonly all: string[];
  visible(): string[];
  readonly usedGroups: Set<string>;
  set(recipe: DinoRecipe): void;
  configure(name: string): void;
  isEffect(slotIndex: number): boolean;
}

export function rigSkeleton(skeleton: Any, state: Any, start: DinoRecipe): Rig {
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
    const groups = groupsOf(recipe).map((g) => ({
      id: g.id,
      bones: new RegExp(g.bones, 'i'),
      slots: new RegExp(g.slots, 'i'),
    }));
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
        if (!Number.isNaN(prev) && dt > 0)
          b.rotation = prev + (b.rotation - prev) * (1 - Math.pow(Math.min(0.97, p.inertia), dt * 60));
        prevRotation[i] = b.rotation;
      }
    }
    const m = recipe.motion ?? {};
    const root = skeleton.getRootBone();
    if (m.bob) root.y += m.bob * Math.abs(Math.sin(TAU * (m.bobSpeed ?? 0.5) * clock));
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
  const pageSources = new Map([...pageRegions.keys()].map((texture) => [texture, texture.getImage()]));
  let colorKey = '';
  let frame = 0;
  const recolor = () => {
    const key = JSON.stringify([recipe.color, groupsOf(recipe).map((g) => [g.slots, colorOf(recipe.parts?.[g.id])])]);
    if (key === colorKey) return;
    colorKey = key;
    const global = recipe.color;
    const globalOn = hasColor(global);
    for (const [texture, regions] of pageRegions) {
      const pageKey = JSON.stringify([start.base.rig, pageSources.get(texture).src, regions, key]);
      const cached = coloredPages.get(pageKey);
      if (cached) {
        texture._image = cached;
        texture.update(false);
        continue;
      }
      let src = originals.get(texture);
      if (!src) {
        if (!globalOn && !parts.some(hasColor)) continue;
        const img = pageSources.get(texture);
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        src = ctx.getImageData(0, 0, c.width, c.height);
        originals.set(texture, src);
      }
      const { width, height } = src;
      // Pixelul aparține primei piese care îl acoperă; piesele cu culoare proprie au prioritate.
      const owner = new Int16Array(width * height).fill(-1);
      for (const r of regions) {
        const g = slotGroup[r.slot];
        if (g < 0 || !hasColor(parts[g])) continue;
        for (let y = Math.max(0, r.y0); y < Math.min(height, r.y1); y++)
          owner.fill(g, y * width + Math.max(0, r.x0), y * width + Math.min(width, r.x1));
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
      remember(coloredPages, pageKey, out, 12);
    }
  };

  const set = (r: DinoRecipe) => {
    recipe = r;
    compile();
    skeleton.scaleX = Math.abs(skeleton.scaleX) * (r.motion?.flip ? -1 : 1);
    if (pageRegions.size) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recolor);
    }
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
      prevRotation.fill(NaN);
    },
    isEffect: (i) => groupIds[slotGroup[i]] === 'efecte' || !!parts[slotGroup[i]]?.hidden,
  };
}

// ---------- player ----------

export interface DinoController {
  /** Animațiile vizibile după rețetă. */
  readonly animations: string[];
  readonly allAnimations: string[];
  /** Ce grupe au piese în acest schelet (pentru editor). */
  readonly usedGroups: Set<string>;
  setAnimation(name: string): void;
  /** Joacă o animație o dată, apoi revine la repaus. */
  playOnce(name: string): void;
  setPaused(value: boolean): void;
  setRecipe(recipe: DinoRecipe): void;
  /** Reîncadrează camera după schimbări mari de proporții. */
  reframe(): void;
  snapshot(): Promise<Blob | null>;
  dispose(): void;
}

export interface DinoOptions {
  animation?: string;
  paused?: boolean;
  background?: string;
  /**
   * Camera: 'fixed' cuprinde repausul și mersul (dinozaurul nu „sare” în cadru, efectele atacului pot ieși),
   * 'follow' se depărtează lin cât să cuprindă animația curentă (laborator).
   */
  camera?: 'fixed' | 'follow';
  /** Marginile din jur, în procente din cadru. */
  pad?: number | { top: number; bottom: number; left: number; right: number };
  /** Fără randare continuă: un singur cadru (miniaturi). */
  still?: boolean;
}

// Dinozaurii care nu se văd (derulați în afara ecranului) nu se randează.
export async function createDino(
  host: HTMLElement,
  initial: DinoRecipe,
  opts: DinoOptions,
  signal: AbortSignal,
): Promise<DinoController> {
  const [spine, rigEntry] = await Promise.all([loadRuntime(), loadRig(initial.base.rig)]);
  if (signal.aborted) throw signal.reason;

  const element = document.createElement('div');
  element.className = 'dino-spine-host';
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
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });

    raw = new spine.SpinePlayer(element, {
      jsonUrl: `${DINO_BASE}/${rigEntry.skeleton}`,
      atlasUrl: `${DINO_BASE}/${rigEntry.atlas}`,
      // texturile sunt premultiplicate la încărcare (runtime.ts, premultiplyTextures)
      premultipliedAlpha: true,
      showControls: false,
      alpha: true,
      preserveDrawingBuffer: !!opts.still,
      backgroundColor: opts.background ?? '#00000000',
      viewport: { ...rigEntry.bounds, transitionTime: 0.35 },
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
    // The app provides its own preview; avoid Spine's extra one-second loading fade.
    raw.loadingScreen.draw = () => {};

    /** SpinePlayer citește la fiecare cadru mărimea canvasului (recalculare de layout); o citim doar la redimensionare. */
    function economize() {
      if (raw.timelineSlider) raw.timelineSlider.setValue = () => {};
      let dirty = true;
      const sizes = new ResizeObserver(() => (dirty = true));
      sizes.observe(element);
      const resize = raw.sceneRenderer.resize.bind(raw.sceneRenderer);
      raw.sceneRenderer.resize = (mode: Any) => {
        if (mode !== spine.webgl.ResizeMode.Expand || dirty) {
          dirty = false;
          resize(mode);
        }
      };
      let looping = true;
      const draw = raw.drawFrame.bind(raw);
      raw.drawFrame = (next = true) => {
        if (next) looping = !raw.stopRequestAnimationFrame;
        return draw(next);
      };
      const seen = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) {
          raw.stopRequestAnimationFrame = true;
          return;
        }
        raw.stopRequestAnimationFrame = false;
        if (!looping) {
          looping = true;
          raw.time?.update?.();
          requestAnimationFrame(() => raw.drawFrame());
        }
      });
      seen.observe(element);
      stops.push(() => {
        sizes.disconnect();
        seen.disconnect();
      });
    }

    function control(): DinoController {
      if (!opts.still) economize();
      const state = raw.animationState;
      const rig = rigSkeleton(raw.skeleton, state, initial);
      let recipe = initial;
      let current = '';
      const idle = () => {
        const names = rig.visible();
        return names.includes('idle') ? 'idle' : (names[0] ?? rig.all[0]);
      };
      const redraw = () => {
        if (!raw.paused) return;
        state.apply(raw.skeleton);
        raw.drawFrame(false);
      };
      const setPad = () => {
        const zoom = Math.max(0.3, Math.min(3, recipe.motion?.zoom ?? 1));
        const extra = (1 / zoom - 1) * 50;
        const pad = opts.pad ?? 6;
        const sides = typeof pad === 'number' ? { top: pad, bottom: pad, left: pad, right: pad } : pad;
        Object.assign(raw.config.viewport, {
          padLeft: sides.left + extra + '%',
          padRight: sides.right + extra + '%',
          padTop: sides.top + extra + '%',
          padBottom: sides.bottom + extra + '%',
        });
      };

      // Conturul corpului (fără efecte) în fiecare animație, cu rețeta aplicată: camera se așază după el.
      const boxes = new Map<string, Bounds>();
      // The runtime otherwise samples another 100 frames every time an animation is selected.
      raw.calculateAnimationViewport = (name: string) => boxes.get(name) ?? rigEntry.bounds;
      const measure = () => {
        boxes.clear();
        const key = JSON.stringify([recipe.base, recipe.parts, recipe.animations, recipe.groups]);
        const cached = measuredRecipes.get(key);
        if (cached) {
          cached.forEach((box, name) => boxes.set(name, box));
          return;
        }
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
          const steps = 24;
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
        remember(measuredRecipes, key, new Map(boxes), 48);
      };
      const union = (names: string[]): Bounds | null => {
        const list = names.map((n) => boxes.get(n)).filter((b): b is Bounds => !!b);
        if (!list.length) return null;
        const x0 = Math.min(...list.map((b) => b.x));
        const y0 = Math.min(...list.map((b) => b.y));
        const x1 = Math.max(...list.map((b) => b.x + b.width));
        const y1 = Math.max(...list.map((b) => b.y + b.height));
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      };
      const play = (name: string, loop = true) => {
        current = name;
        if (opts.camera === 'follow') {
          const box = boxes.get(name);
          if (box) Object.assign(raw.config.viewport, box);
        }
        raw.setAnimation(name, loop);
        rig.configure(name);
        if (!loop) {
          if (opts.camera === 'follow')
            state.getCurrent(0).listener = { complete: () => current === name && play(idle()) };
          else state.addAnimation(0, idle(), true, 0);
        }
        redraw();
      };
      const frame = () => {
        measure();
        if (opts.camera !== 'follow') {
          const box = union(['idle', 'walk'].filter((n) => rig.all.includes(n))) ?? union(rig.visible());
          if (box) Object.assign(raw.config.viewport, box);
        }
        raw.previousViewport = null;
        play(current);
        raw.previousViewport = null;
      };

      setPad();
      raw.speed = recipe.motion?.speed ?? 1;
      current = rig.visible().includes(opts.animation ?? '') ? opts.animation! : idle();
      frame();
      if (opts.paused || opts.still) raw.pause();

      return {
        get animations() {
          return rig.visible();
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
          const before = JSON.stringify([recipe.motion?.zoom, recipe.parts, recipe.animations]);
          recipe = r;
          raw.speed = r.motion?.speed ?? 1;
          setPad();
          rig.set(r);
          if (before !== JSON.stringify([r.motion?.zoom, r.parts, r.animations])) frame();
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
