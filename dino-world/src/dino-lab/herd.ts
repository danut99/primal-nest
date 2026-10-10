// Turma de pe hartă: dinozaurii din habitate, animați cu Spine într-un singur canvas WebGL peste scenă.
// Un singur context (nu câte unul pe dinozaur), texturi la jumătate făcute pentru hartă (*-map.webp), doar cei de
// pe ecran se desenează, de cel mult HERD_FPS ori pe secundă. Fiind un strat separat, harta SVG nu se redesenează
// când se mișcă dinozaurii.
// Fiecare dinozaur trăiește singur: stă (repaus), se plimbă pe insulă (mers), uneori atacă și, mai rar, își face
// ultimata.

import { DINO_BASE, loadRig, loadRuntime } from './runtime';
import { rigSkeleton, type DinoRecipe } from './engine';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const HERD_FPS = 30;
/** Când toți dinozaurii de pe ecran sunt mai mici de atâția pixeli, ajung jumătate din cadre. */
const SMALL_PX = 90;
/** Un dinozaur abia încărcat apare treptat, nu brusc (secunde). */
const FADE_IN = 0.6;
/** Viteza minimă de plimbare: lungimi de corp pe secundă. */
const MIN_WALK_SPEED = 0.03;
/** Cât se poate grăbi animația de mers ca să țină pasul cu viteza minimă. */
const MAX_WALK_PACE = 1.8;
/** Lungimea de referință a scheletului (unități Spine), de la coadă la bot. */
const SKELETON_LENGTH = 950;
/** Texturile mici (jumătate) și atlasul lor, generate de scripts/world-images.py. */
const MAP_ATLAS = (atlas: string) => atlas.replace(/\.atlas$/, '-map.atlas');

export interface HerdMember {
  id: string;
  recipe: DinoRecipe;
  /** Insula pe care stă (dinozaurii de pe aceeași insulă se ocolesc). */
  island: string;
  /** Locul de acasă și zona în care se plimbă, în coordonatele scenei. */
  home: { x: number; y: number };
  area: { x0: number; y0: number; x1: number; y1: number };
  /** Lungimea dinozaurului în scenă. */
  size: number;
  facing: 1 | -1;
}

/** Camera hărții: ecran = (scenă − origine) × z + (x, y). */
export interface HerdCamera {
  x: number;
  y: number;
  z: number;
  originX: number;
  originY: number;
}

export interface Herd {
  setMembers(list: HerdMember[]): void;
  /** Desenează imediat (la mișcarea camerei, ca dinozaurii să nu rămână în urma insulelor). */
  render(): void;
  /** Dinozaurul de sub punctul de pe ecran, dacă e vreunul. */
  hit(x: number, y: number): string | undefined;
  dispose(): void;
}

interface Options {
  camera: () => HerdCamera;
  /** Ce dinozauri se văd animat (restul rămân miniaturi statice). */
  onLive: (ids: Set<string>) => void;
}

// ---------- resursele unui schelet (o dată) și ale unei rețete (o dată pe specie și vârstă) ----------

interface RigAssets {
  /** biped, quadruped, flyer, swimmer (din manifest). */
  body: string;
  json: Any;
  atlasText: string;
  images: Map<string, HTMLImageElement>;
}
const rigAssets = new Map<string, Promise<RigAssets>>();
function loadRigAssets(rigId: string): Promise<RigAssets> {
  let p = rigAssets.get(rigId);
  if (!p) {
    p = (async () => {
      const rig = await loadRig(rigId);
      const dir = `${DINO_BASE}/${rig.skeleton.replace(/[^/]+$/, '')}`;
      const [json, atlasText] = await Promise.all([
        fetch(`${DINO_BASE}/${rig.skeleton}`).then((r) => r.json()),
        fetch(`${DINO_BASE}/${MAP_ATLAS(rig.atlas)}`).then((r) => {
          if (!r.ok) throw new Error('Lipsește atlasul pentru hartă (python scripts/world-images.py).');
          return r.text();
        }),
      ]);
      // paginile atlasului: liniile fără indentare care sunt nume de fișiere
      const pages = atlasText.split('\n').filter((l) => /^[^\s].*\.(webp|png)$/.test(l));
      const images = new Map<string, HTMLImageElement>();
      await Promise.all(
        pages.map(async (file) => {
          const img = new Image();
          img.src = dir + file;
          await img.decode().catch(() => undefined);
          if (img.naturalWidth) images.set(file, img);
        }),
      );
      return { body: rig.body, json, atlasText, images };
    })();
    p.catch(() => rigAssets.delete(rigId));
    rigAssets.set(rigId, p);
  }
  return p;
}

/**
 * Viteza de mers a unui schelet (unități Spine pe secundă): cât de repede se deplasează labele pe sol cât timp
 * sunt sprijinite, în animația „walk”. Zburătorii și înotătorii n-au sprijin: plutesc încet, după lungime.
 */
function groundSpeed(spine: Any, data: Any, body: string): number {
  const glide = 0.05 * (data.width || SKELETON_LENGTH);
  const walk = data.findAnimation('walk');
  if (!walk || body === 'flyer' || body === 'swimmer') return glide;
  const skeleton = new spine.Skeleton(data);
  const feet = skeleton.bones.filter((b: Any) => /foot/i.test(b.data.name));
  if (!feet.length) return glide;
  const N = 120;
  const tracks: [number, number][][] = feet.map(() => []);
  for (let i = 0; i <= N; i++) {
    const t = (walk.duration * i) / N;
    skeleton.setToSetupPose();
    // doar oasele: deformarea plaselor nu mută labele și ar decoda degeaba animația
    for (const timeline of walk.timelines)
      if (!(timeline instanceof spine.DeformTimeline))
        timeline.apply(skeleton, t, t, null, 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
    skeleton.updateWorldTransform();
    feet.forEach((b: Any, k: number) => tracks[k].push([b.worldX, b.worldY]));
  }
  // pe sol = în partea de jos a ridicării labei; se adună cât merge înapoi în acele cadre
  const speeds = tracks.map((track) => {
    const ys = track.map((p) => p[1]);
    const low = Math.min(...ys);
    const ground = low + Math.max(1, 0.12 * (Math.max(...ys) - low));
    let dist = 0;
    let time = 0;
    for (let i = 1; i < track.length; i++)
      if (track[i - 1][1] <= ground && track[i][1] <= ground) {
        dist += Math.abs(track[i - 1][0] - track[i][0]);
        time += walk.duration / N;
      }
    return time ? dist / time : 0;
  });
  const speed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  return speed > 0 ? speed : glide;
}

/** Fără culori: doar primul dinozaur al unei rețete recolorează textura comună. */
function withoutColors(r: DinoRecipe): DinoRecipe {
  const parts = Object.fromEntries(
    Object.entries(r.parts ?? {}).map(([id, p]) => {
      const { hue: _h, saturation: _s, lightness: _l, colorize: _c, colorizeAmount: _a, ...rest } = p;
      return [id, rest];
    }),
  );
  return { ...r, color: undefined, parts };
}

// ---------- turma ----------

/** `host` primește un canvas propriu (scos la `dispose`), ca o turmă închisă să nu lase în urmă un context pierdut. */
export async function createHerd(host: HTMLElement, opts: Options): Promise<Herd> {
  const spine = await loadRuntime();
  const canvas = document.createElement('canvas');
  canvas.className = 'world-herd';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const context = new spine.webgl.ManagedWebGLRenderingContext(canvas, { alpha: true });
  if (!context.gl) {
    canvas.remove();
    throw new Error('WebGL indisponibil');
  }
  const renderer = new spine.webgl.SceneRenderer(canvas, context, true);

  // o rețetă = un atlas cu texturile ei (recolorate o dată) + datele scheletului
  const recipes = new Map<string, Promise<{ data: Any; colored: boolean; groundSpeed: number }>>();
  const recipeAssets = (recipe: DinoRecipe) => {
    const key = JSON.stringify(recipe);
    let p = recipes.get(key);
    if (!p) {
      p = loadRigAssets(recipe.base.rig).then(({ body, json, atlasText, images }) => {
        const atlas = new spine.TextureAtlas(
          atlasText,
          (file: string) => new spine.webgl.GLTexture(context, images.get(file)),
        );
        const reader = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas));
        // pe hartă dinozaurii sunt mici: deformările la 15 cadre pe secundă ajung (jumătate din calcul)
        reader.pcaStep = 4;
        const data = reader.readSkeletonData(json);
        return { data, colored: false, groundSpeed: groundSpeed(spine, data, body) };
      });
      recipes.set(key, p);
    }
    return p;
  };

  interface Dino {
    m: HerdMember;
    skeleton: Any;
    state: Any;
    has: Set<string>;
    pos: { x: number; y: number };
    target: { x: number; y: number } | null;
    facing: 1 | -1;
    mode: 'idle' | 'walk' | 'act';
    until: number;
    born: number;
    scale: number;
    speed: number;
    /** Cât de repede se joacă mersul (>1 la speciile cu pași foarte mici). */
    walkPace: number;
    screen: { x: number; y: number; visible: boolean };
  }
  const dinos = new Map<string, Dino>();
  const pending = new Set<string>();
  let disposed = false;
  let clock = 0;
  const live = () => opts.onLive(new Set(dinos.keys()));

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const idle = (d: Dino, seconds = rand(2.5, 6.5)) => {
    d.mode = 'idle';
    d.target = null;
    d.until = clock + seconds;
    d.state.setAnimation(0, 'idle', true);
  };
  /**
   * Cât de aproape sunt doi dinozauri de pe aceeași insulă, ca o elipsă turtită (adâncimea contează mai puțin):
   * sub 1 se ating.
   */
  const closeness = (a: Dino, b: Dino, p: { x: number; y: number }, q: { x: number; y: number }) => {
    const gap = (a.m.size + b.m.size) * 0.38;
    return Math.hypot((p.x - q.x) / gap, (p.y - q.y) / (gap * 0.4));
  };
  /** Locul e ocupat de altcineva (unde stă acum sau unde merge). */
  const taken = (d: Dino, p: { x: number; y: number }) => {
    for (const o of dinos.values()) {
      if (o === d || o.m.island !== d.m.island) continue;
      if (closeness(d, o, p, o.pos) < 1 || (o.target && closeness(d, o, p, o.target) < 1)) return true;
    }
    return false;
  };
  /** Pasul următor l-ar duce peste un vecin (doar dacă se apropie; dacă deja se ating, îl lasă să iasă). */
  const blocked = (d: Dino, next: { x: number; y: number }) => {
    for (const o of dinos.values()) {
      if (o === d || o.m.island !== d.m.island) continue;
      const after = closeness(d, o, next, o.pos);
      if (after < 1 && after < closeness(d, o, d.pos, o.pos)) return true;
    }
    return false;
  };

  /** Ce face după repaus: se plimbă (cel mai des), se întoarce, atacă sau, rar, ultimata. */
  const decide = (d: Dino) => {
    const roll = Math.random();
    const { area } = d.m;
    if (roll < 0.5) {
      // câteva încercări: un loc liber, în care nu stă și nu merge nimeni altcineva
      // o plimbare de câteva secunde, cu pașii lui (un dinozaur lent nu traversează insula dintr-o dată)
      let spot: { x: number; y: number } | null = null;
      for (let i = 0; i < 6 && !spot; i++) {
        const dist = d.speed * rand(3, 8) * (Math.random() < 0.5 ? -1 : 1);
        const x = Math.max(area.x0, Math.min(area.x1, d.pos.x + dist));
        const y = Math.max(area.y0, Math.min(area.y1, d.pos.y + rand(-0.25, 0.25) * Math.abs(dist)));
        if (Math.abs(x - d.pos.x) >= d.speed * 1.5 && !taken(d, { x, y })) spot = { x, y };
      }
      if (!spot) return idle(d, rand(1, 3));
      const { x } = spot;
      d.mode = 'walk';
      d.target = spot;
      d.facing = x > d.pos.x ? 1 : -1;
      d.state.setAnimation(0, 'walk', true).timeScale = d.walkPace;
    } else if (roll < 0.68) {
      d.facing = d.facing === 1 ? -1 : 1;
      idle(d);
    } else {
      const move = roll > 0.9 && d.has.has('ultimate') ? 'ultimate' : 'attack';
      if (!d.has.has(move)) return idle(d);
      d.mode = 'act';
      const entry = d.state.setAnimation(0, move, false);
      entry.timeScale = d.m.recipe.animations?.[move]?.speed ?? 1;
      d.state.addAnimation(0, 'idle', true, 0);
      d.until = clock + entry.animation.duration / entry.timeScale;
    }
  };

  async function add(m: HerdMember) {
    pending.add(m.id);
    try {
      const assets = await recipeAssets(m.recipe);
      if (disposed || !pending.has(m.id)) return;
      const skeleton = new spine.Skeleton(assets.data);
      const stateData = new spine.AnimationStateData(assets.data);
      stateData.defaultMix = 0.25;
      const state = new spine.AnimationState(stateData);
      rigSkeleton(skeleton, state, assets.colored ? withoutColors(m.recipe) : m.recipe);
      assets.colored = true;
      state.timeScale = m.recipe.motion?.speed ?? 1;
      const length = m.recipe.base.rig.includes('-') && assets.data.width > 0 ? assets.data.width : SKELETON_LENGTH;
      const scale = (m.size * (m.recipe.motion?.zoom ?? 1)) / length;
      const walkPace = Math.min(MAX_WALK_PACE, Math.max(1, (MIN_WALK_SPEED * length) / assets.groundSpeed));
      // animațiile ascunse din rețetă (ex. o ultimată pusă deoparte) nu se joacă nici pe hartă
      const has = new Set<string>(
        assets.data.animations.map((a: Any) => a.name).filter((n: string) => !m.recipe.animations?.[n]?.hidden),
      );
      const d: Dino = {
        m,
        skeleton,
        state,
        has,
        pos: { ...m.home },
        target: null,
        facing: m.facing,
        mode: 'idle',
        until: 0,
        born: clock,
        scale,
        // cât înaintează labele pe sol în animația de mers, ca să nu alunece; speciile cu pași foarte mici
        // merg cu mersul grăbit (până la MAX_WALK_PACE) și cel puțin MIN_WALK_SPEED, altfel ar sta pe loc
        walkPace,
        speed: Math.max(assets.groundSpeed * walkPace, MIN_WALK_SPEED * length) * scale * state.timeScale,
        screen: { x: 0, y: 0, visible: false },
      };
      idle(d, rand(0.5, 5));
      state.update(Math.random() * 3);
      dinos.set(m.id, d);
      live();
    } catch {
      // rămâne miniatura statică
    } finally {
      pending.delete(m.id);
    }
  }

  // ---------- desenul ----------

  let width = 0;
  let height = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    renderer.camera.setViewport(width, height);
    renderer.camera.position.x = width / 2;
    renderer.camera.position.y = height / 2;
  };
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);
  resize();

  let last = performance.now();
  let small = false;
  const draw = (step: number) => {
    clock += step;
    const cam = opts.camera();
    const visible: Dino[] = [];
    for (const d of dinos.values()) {
      // comportamentul merge și când nu se vede
      if (d.mode === 'walk' && d.target) {
        const dx = d.target.x - d.pos.x;
        const dy = d.target.y - d.pos.y;
        const dist = Math.hypot(dx, dy);
        const move = d.speed * step;
        if (dist <= move) {
          d.pos = { ...d.target };
          idle(d);
        } else {
          const next = { x: d.pos.x + (dx / dist) * move, y: d.pos.y + (dy / dist) * move };
          // cineva i-a ieșit în cale: se oprește și își alege alt drum după o pauză scurtă
          if (blocked(d, next)) idle(d, rand(0.8, 2));
          else d.pos = next;
        }
      } else if (clock >= d.until && d.mode !== 'walk') {
        if (d.mode === 'act') idle(d, rand(2, 5));
        else decide(d);
      }
      d.state.update(step);
      const sx = (d.pos.x - cam.originX) * cam.z + cam.x;
      const sy = (d.pos.y - cam.originY) * cam.z + cam.y;
      const r = d.m.size * cam.z;
      d.screen = { x: sx, y: sy, visible: sx > -r && sx < width + r && sy > -r * 0.2 && sy < height + r };
      if (d.screen.visible) visible.push(d);
    }
    const gl = context.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    small = visible.every((d) => d.m.size * cam.z < SMALL_PX);
    if (!visible.length) return;
    visible.sort((a, b) => a.screen.y - b.screen.y);
    renderer.begin();
    for (const d of visible) {
      const s = d.scale * cam.z;
      d.skeleton.color.a = Math.min(1, (clock - d.born) / FADE_IN);
      d.skeleton.x = d.screen.x;
      d.skeleton.y = height - d.screen.y;
      d.skeleton.scaleX = s * d.facing;
      d.skeleton.scaleY = s;
      d.state.apply(d.skeleton);
      // efectele stau transparente în afara atacurilor: nu le mai calculăm mesh-urile degeaba
      for (const slot of d.skeleton.slots) if (slot.color.a === 0) slot.attachment = null;
      d.skeleton.updateWorldTransform();
      // texturile sunt premultiplicate la încărcare (runtime.ts, premultiplyTextures)
      renderer.drawSkeleton(d.skeleton, true);
    }
    renderer.end();
  };

  let frame = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (document.hidden || now - last < 1000 / (small ? HERD_FPS / 2 : HERD_FPS) - 2) return;
    draw(Math.min(0.1, (now - last) / 1000));
    last = now;
  };
  frame = requestAnimationFrame(loop);

  return {
    setMembers(list) {
      const ids = new Set(list.map((m) => m.id));
      for (const id of [...dinos.keys()]) if (!ids.has(id)) dinos.delete(id);
      for (const id of [...pending]) if (!ids.has(id)) pending.delete(id);
      for (const m of list) {
        const d = dinos.get(m.id);
        if (d && JSON.stringify(d.m.recipe) === JSON.stringify(m.recipe)) {
          // aceeași rețetă: doar noul loc de acasă și zona
          if (d.m.home.x !== m.home.x || d.m.home.y !== m.home.y) d.pos = { ...m.home };
          d.m = m;
        } else if (!pending.has(m.id)) {
          dinos.delete(m.id);
          void add(m);
        }
      }
      live();
    },
    render() {
      draw(0);
    },
    hit(x, y) {
      let found: Dino | undefined;
      for (const d of dinos.values()) {
        if (!d.screen.visible) continue;
        const r = d.m.size * (d.m.recipe.motion?.zoom ?? 1) * opts.camera().z;
        // corpul: de la coadă la bot pe orizontală, cam o jumătate din lungime pe verticală
        if (Math.abs(x - d.screen.x) < r * 0.45 && y < d.screen.y + r * 0.05 && y > d.screen.y - r * 0.5)
          if (!found || d.screen.y > found.screen.y) found = d;
      }
      return found?.m.id;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      sizes.disconnect();
      dinos.clear();
      renderer.dispose();
      context.gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
