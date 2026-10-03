// Arena luptei: dragonii animați (Spine) pe un singur canvas WebGL. Rezultatul e deja calculat de reguli
// (battle.ts); aici doar îl punem în scenă, cu animațiile reale ale dragonilor, la viteza lor. Nimeni nu se mută:
//   atac de bază → „attack” pe loc; în momentul loviturii, un proiectil mic pleacă din cap spre țintă;
//   ultimata     → „special1” pe loc, cu efectele ei și un proiectil mare;
//   lovitura     → undă de șoc și scântei în culoarea tipului, ținta se aprinde și se clatină;
//   KO           → cade într-o parte și se stinge; învingătorii sărbătoresc cu „levelup”.
// Camera e fixă, iar luptătorii se așază și se dimensionează astfel încât fiecare animație să încapă întreagă.
// Momentul loviturii se află din animație: cadrul în care capul ajunge cel mai în față.
// Fiecare pas durează cât animația lui; play() întoarce durata și momentul impactului, ca interfața să se sincronizeze.

import type { BattleEvent, Combatant } from '@shared/game';
import { SPECIES, TYPES } from '@shared/game';
import { bossRecipe, speciesRecipe } from '../content/dragons';
import {
  baseFiles,
  borrowAnimations,
  loadSkeletonData,
  rigSkeleton,
  type DragonRecipe,
  type Rig,
} from '../dragon-lab/engine';
import { loadRuntime, sourceKey } from '../dragons/runtime';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

interface Fighter {
  c: Combatant;
  skeleton: Any;
  state: Any;
  rig: Rig;
  /** Unde stă între atacuri (picioarele) și unde e acum. */
  home: { x: number; y: number };
  pos: { x: number; y: number };
  scale: number;
  /** Înălțimea și jumătatea lățimii în scenă, din poza de repaus. */
  height: number;
  half: number;
  /** 1 = privește spre dreapta (haita), -1 = spre stânga (inamicii). */
  facing: 1 | -1;
  /** Unde e privirea acum (se întoarce când pleacă înapoi). */
  look: 1 | -1;
  footY: number;
  centerX: number;
  flyer: boolean;
  idle: string;
  lift: number;
  flash: number;
  flashColor: Any;
  tilt: number;
  alpha: number;
  gray: number;
  fainted: boolean;
  phase: number;
  /** Momentul loviturii (fracție din animație) pentru fiecare animație de atac. */
  impact: Record<string, number>;
  head: Any;
  /** Cât se întind toate animațiile lui (cu efecte), față de mijloc și de picioare, la mărimea 1: în spate, în față, în sus. */
  reach: { back: number; front: number; top: number };
}

interface Tween {
  start: number;
  dur: number;
  update: (p: number) => void;
  done?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: Any;
  gravity: number;
  tex: 'glow' | 'ring';
  additive: boolean;
}

/** Ce trebuie să știe interfața despre un pas: cât durează și când lovește (secunde, la viteză 1). */
export interface StepPlan {
  duration: number;
  impact: number;
}

/** Lățimea lumii vizibile (unități Spine), indiferent de mărimea canvasului. */
const WORLD_W = 1900;
const GROUND_Y = -300;
/** Înălțimea fiecărui luptător, după stadiu; Alfa e mai mare. */
const STAGE_HEIGHT = { pui: 300, juvenil: 400, adult: 480 };
const BOSS_HEIGHT = 620;
/** Linia din spate a formației stă mai sus (mai departe), ca doi luptători să încapă unul lângă altul. */
const BACK_LINE = 230;
/** Cei de pe linia din spate par puțin mai mici (perspectivă). */
const BACK_SCALE = 0.9;
/** Spațiul liber dintre tabere și marginea păstrată la capete (unități Spine). */
const CENTER_GAP = 70;
const EDGE = 24;
/** Cât de mult se grăbesc animațiile de atac. */
const ATTACK_RATE = 1.3;
const SPECIAL_RATE = 1.2;

export class Arena {
  private canvas: HTMLCanvasElement;
  private context: Any;
  private renderer: Any;
  private spine: Any = null;
  private fighters = new Map<string, Fighter>();
  private tweens: Tween[] = [];
  private particles: Particle[] = [];
  private orbs: { x: number; y: number; size: number; color: Any }[] = [];
  private shake = 0;
  private raf = 0;
  private time = 0;
  private last = 0;
  private speed = 1;
  private disposed = false;
  private resize: ResizeObserver;
  private camY = 0;
  private baseZoom = 1;
  private tex: Record<'glow' | 'ring', Any> = { glow: null, ring: null };
  private data = new Map<string, Promise<Any>>();
  private assets: Any = null;

  constructor(
    private container: HTMLElement,
    private zoneId: string,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'arena3d-canvas';
    container.appendChild(this.canvas);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(container);
  }

  /** Încarcă dragonii și îi așază: haita în stânga (pe rânduri, ca în formație), inamicii în dreapta. */
  async load(start: Combatant[]) {
    this.spine = await loadRuntime();
    if (this.disposed) return;
    const { webgl } = this.spine;
    this.context = new webgl.ManagedWebGLRenderingContext(this.canvas, { alpha: true });
    this.renderer = new webgl.SceneRenderer(this.canvas, this.context, true);
    this.assets = new webgl.AssetManager(this.context);
    this.tex.glow = new webgl.GLTexture(this.context, gradientCanvas(false));
    this.tex.ring = new webgl.GLTexture(this.context, gradientCanvas(true));
    this.fit();

    await Promise.all(start.map((c) => this.add(c)));
    if (this.disposed) return;
    this.layout();
    // Alfa își face intrarea cu un răget.
    for (const f of this.fighters.values()) if (f.c.boss) this.once(f, 'levelup', 1);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** ×1, ×2, ×4: toată scena (animații, mișcare, efecte) merge mai repede. */
  setSpeed(speed: number) {
    this.speed = speed;
  }

  private fit() {
    if (!this.renderer) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.context.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.renderer.camera.setViewport(this.canvas.width, this.canvas.height);
    this.baseZoom = WORLD_W / this.canvas.width;
    this.camY = GROUND_Y + (this.baseZoom * this.canvas.height) / 2 - 70;
  }

  /** Datele unui dragon (schelet + atlas + texturi), o singură dată pe arenă. */
  private skeletonData(recipe: DragonRecipe): Promise<Any> {
    const key = sourceKey(recipe.base) + JSON.stringify(recipe.borrow ?? null);
    let p = this.data.get(key);
    if (!p) {
      p = (async () => {
        const files = await baseFiles(recipe.base, new AbortController().signal);
        for (const [path, url] of Object.entries(files.urls)) this.assets.setRawDataURI(path, url);
        this.assets.loadBinary(files.skel);
        this.assets.loadTextureAtlas(files.atlas);
        await new Promise<void>((resolve, reject) => {
          const tick = () => {
            if (this.disposed) return reject(new Error('Arena a fost închisă.'));
            if (!this.assets.isLoadingComplete()) return void requestAnimationFrame(tick);
            if (this.assets.hasErrors()) return reject(new Error(Object.values(this.assets.getErrors()).join('; ')));
            resolve();
          };
          tick();
        });
        const atlas = this.assets.get(files.atlas);
        const data = new this.spine.SkeletonBinary(new this.spine.AtlasAttachmentLoader(atlas)).readSkeletonData(
          this.assets.get(files.skel),
        );
        if (recipe.borrow)
          borrowAnimations(
            this.spine,
            data,
            await loadSkeletonData(this.spine, recipe.borrow.from),
            recipe.borrow.animations,
          );
        Object.values(files.urls).forEach((u) => URL.revokeObjectURL(u));
        return data;
      })();
      this.data.set(key, p);
    }
    return p;
  }

  private newSkeleton(data: Any) {
    const skeleton = new this.spine.Skeleton(data);
    // Exporturile n-au skin „default”, ci unul singur cu alt nume.
    if (!data.defaultSkin && data.skins.length) skeleton.setSkin(data.skins[0]);
    skeleton.setToSetupPose();
    return skeleton;
  }

  private async add(c: Combatant) {
    const recipe = c.boss ? bossRecipe(this.zoneId) : speciesRecipe(c.speciesId);
    const data = await this.skeletonData(recipe);
    if (this.disposed) return;
    const skeleton = this.newSkeleton(data);
    const stateData = new this.spine.AnimationStateData(data);
    stateData.defaultMix = 0.2;
    const state = new this.spine.AnimationState(stateData);
    const rig = rigSkeleton(skeleton, state, recipe, { colors: false });
    const names: string[] = rig.all;
    const species = SPECIES[c.speciesId];
    const flyer = !c.boss && species.line === 'ptero' && names.includes('fly');
    const idle = flyer ? 'fly' : names.includes('breathe') ? 'breathe' : names[0];

    // Mărimea și punctele de sprijin, din poza de repaus, fără efecte (strălucirile ar umfla conturul).
    state.setAnimation(0, idle, true);
    state.update(0);
    state.apply(skeleton);
    skeleton.slots.forEach((s: Any, i: number) => rig.isEffect(i) && (s.attachment = null));
    skeleton.updateWorldTransform();
    const offset = new this.spine.Vector2();
    const size = new this.spine.Vector2();
    skeleton.getBounds(offset, size);
    const ok = Number.isFinite(size.y) && size.y > 0;
    const native = ok ? size.y : 600;
    const target = c.boss ? BOSS_HEIGHT : STAGE_HEIGHT[species.stage];
    const scale = target / native;
    rig.configure(idle);

    const enemy = c.side === 'enemy';
    if (c.variant === 'albino') skeleton.color.set(1, 0.95, 0.97, 1);
    const home = { x: 0, y: GROUND_Y };
    const head = data.findBone('head') ?? data.bones.find((b: Any) => /head|jaw/i.test(b.name)) ?? null;
    const f: Fighter = {
      c,
      skeleton,
      state,
      rig,
      home,
      pos: { ...home },
      scale,
      height: target,
      half: ok ? (size.x * scale) / 2 : target * 0.4,
      facing: enemy ? -1 : 1,
      look: enemy ? -1 : 1,
      footY: ok ? offset.y : 0,
      centerX: ok ? offset.x + size.x / 2 : 0,
      flyer,
      idle,
      lift: flyer ? 70 : 0,
      flash: 0,
      flashColor: new this.spine.Color(1, 1, 1, 1),
      tilt: 0,
      alpha: 1,
      gray: 0,
      fainted: false,
      phase: Math.random() * Math.PI * 2,
      impact: {},
      head: head ? skeleton.findBone(head.name) : null,
      reach: { back: 0, front: 0, top: 0 },
    };
    f.reach = this.reachOf(data, rig, [idle, 'attack', 'special1', 'levelup'], f.centerX, f.footY);
    for (const name of ['attack', 'special1'])
      if (names.includes(name)) f.impact[name] = this.findImpact(data, name, head?.name);
    this.fighters.set(c.key, f);
  }

  /**
   * Conturul corpului în toate animațiile (eșantionat): cât de departe ajunge în spate, în față și în sus.
   * Efectele (raze, străluciri) nu contează: ele pot ieși din cadru, dragonul însă se vede mereu întreg.
   */
  private reachOf(data: Any, rig: Rig, names: string[], centerX: number, footY: number) {
    const sk = this.newSkeleton(data);
    const { MixBlend, MixDirection } = this.spine;
    const o = new this.spine.Vector2();
    const size = new this.spine.Vector2();
    const r = { back: 0, front: 0, top: 0 };
    for (const name of new Set(names)) {
      const anim = data.findAnimation(name);
      if (!anim) continue;
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = (anim.duration * i) / steps;
        sk.setToSetupPose();
        anim.apply(sk, t, t, false, null, 1, MixBlend.setup, MixDirection.mixIn);
        sk.slots.forEach((slot: Any, s: number) => rig.isEffect(s) && (slot.attachment = null));
        sk.updateWorldTransform();
        sk.getBounds(o, size);
        if (!Number.isFinite(o.x) || !Number.isFinite(size.x)) continue;
        r.back = Math.max(r.back, centerX - o.x);
        r.front = Math.max(r.front, o.x + size.x - centerX);
        r.top = Math.max(r.top, o.y + size.y - footY);
      }
    }
    return r;
  }

  /**
   * Formația: fiecare tabără în jumătatea ei de arenă, de la mijloc spre margine, pe două linii — unul în față (jos),
   * următorul în spate (mai sus), alternativ — ca să încapă mai mulți fără să se acopere. Mărimea rămâne cea a
   * stadiului; doar dacă un corp tot n-ar încăpea întreg în cadru, tabăra se micșorează puțin (cel mult până la 80%).
   */
  private layout() {
    const half = WORLD_W / 2;
    const top = this.camY + (this.baseZoom * this.canvas.height) / 2 - EDGE;
    for (const side of ['player', 'enemy'] as const) {
      const list = [...this.fighters.values()]
        .filter((f) => f.c.side === side)
        .sort((a, b) => Number(!!a.c.back) - Number(!!b.c.back));
      if (!list.length) continue;
      const dir = side === 'player' ? -1 : 1;
      const place = (k: number) => {
        // Pe aceeași linie stau la o lățime de corp; între linii (față/spate) se pot apropia mai mult.
        let cursor = CENTER_GAP;
        return list.map((f, i) => {
          const s = k * (i % 2 ? BACK_SCALE : 1);
          const width = f.half * 2 * s;
          const x = cursor + (i === 0 ? width / 2 : width * 0.6);
          cursor = x;
          return { x, y: GROUND_Y + (i % 2) * BACK_LINE, s };
        });
      };
      const fits = (k: number) =>
        place(k).every(
          (p, i) =>
            p.x + list[i].reach.back * list[i].scale * p.s <= half - EDGE &&
            p.y + list[i].lift + list[i].reach.top * list[i].scale * p.s <= top,
        );
      let k = 1;
      while (k > 0.8 && !fits(k)) k -= 0.02;
      place(k).forEach((p, i) => {
        const f = list[i];
        f.scale *= p.s;
        f.height *= p.s;
        f.half *= p.s;
        f.home = { x: dir * p.x, y: p.y };
        f.pos = { ...f.home };
      });
    }
  }

  /** Cadrul loviturii: când capul ajunge cel mai în față (în primele 85% din animație). Implicit, la mijloc. */
  private findImpact(data: Any, name: string, headName?: string): number {
    const anim = data.findAnimation(name);
    if (!anim || !headName || anim.duration <= 0) return 0.5;
    const sk = this.newSkeleton(data);
    const bone = sk.findBone(headName);
    const { MixBlend, MixDirection } = this.spine;
    let best = 0.5;
    let bestX = -Infinity;
    let firstX = 0;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = (anim.duration * 0.85 * i) / steps;
      sk.setToSetupPose();
      anim.apply(sk, t, t, false, null, 1, MixBlend.setup, MixDirection.mixIn);
      sk.updateWorldTransform();
      if (i === 0) firstX = bone.worldX;
      if (bone.worldX > bestX) {
        bestX = bone.worldX;
        best = t / anim.duration;
      }
    }
    // Dacă abia se mișcă înainte (atac pe loc, de ex. suflare), lovitura e pe la mijloc.
    return bestX - firstX < 15 ? 0.5 : Math.min(0.8, Math.max(0.25, best));
  }

  /** Joacă o animație o dată, apoi revine la repaus. Întoarce durata reală (s) sau 0 dacă lipsește. */
  private once(f: Fighter, name: string, rate = 1): number {
    if (!f.rig.all.includes(name)) return 0;
    const anim = f.skeleton.data.findAnimation(name);
    const entry = f.state.setAnimation(0, name, false);
    entry.timeScale = rate;
    f.state.addAnimation(0, f.idle, true, 0);
    return anim.duration / rate;
  }

  /** Poziția pe ecran (px, relativ la container) deasupra capului unui luptător. */
  screenPos(key: string): { x: number; y: number } | null {
    const f = this.fighters.get(key);
    if (!f || !this.renderer) return null;
    const cam = this.renderer.camera;
    const dpr = this.canvas.width / Math.max(1, this.container.clientWidth);
    const wy = f.pos.y + f.lift + f.height + 30;
    return {
      x: ((f.pos.x - cam.position.x) / cam.zoom + this.canvas.width / 2) / dpr,
      y: (this.canvas.height / 2 - (wy - cam.position.y) / cam.zoom) / dpr,
    };
  }

  /** Pune în scenă un eveniment din jurnalul luptei și spune cât durează și când lovește. */
  play(ev: BattleEvent): StepPlan {
    if (ev.t === 'attack') return this.attack(ev);
    if (ev.t === 'faint') return this.faint(ev.target);
    let longest = 0;
    for (const f of this.fighters.values()) {
      if (!f.fainted && ev.win === (f.c.side === 'player')) longest = Math.max(longest, this.once(f, 'levelup'));
    }
    return { duration: Math.min(longest, 2), impact: 0 };
  }

  private attack(ev: Extract<BattleEvent, { t: 'attack' }>): StepPlan {
    const a = this.fighters.get(ev.actor);
    const t = this.fighters.get(ev.target);
    if (!a || !t) return { duration: 0.6, impact: 0.3 };
    const color = hex(this.spine, ev.moveType ? TYPES[ev.moveType].color : '#fff4d6');
    const now = this.time;
    const move =
      ev.special && a.rig.all.includes('special1') ? 'special1' : a.rig.all.includes('attack') ? 'attack' : 'special1';
    const anim = a.skeleton.data.findAnimation(move);
    const rate = move === 'special1' ? SPECIAL_RATE : ATTACK_RATE;
    const animDur = anim ? anim.duration / rate : 1;
    const hitAt = animDur * (a.impact[move] ?? 0.5);

    // Fiecare dragon rămâne pe locul lui și joacă doar animația: „attack” la atacul de bază, „special1” la ultimată.
    // Când animația ajunge la lovitură, din cap pleacă spre țintă un proiectil în culoarea tipului (mai mare la ultimată).
    this.once(a, move, rate);
    const flight = ev.special ? 0.32 : 0.22;
    this.at(now + hitAt, () => this.projectile(a, t, color, flight, ev.special ? 130 : 70));
    const impact = hitAt + flight;
    this.at(now + impact, () => this.hit(a, t, ev, color, ev.special));
    return { duration: Math.max(animDur, impact + 0.35), impact };
  }

  private hit(a: Fighter, t: Fighter, ev: Extract<BattleEvent, { t: 'attack' }>, color: Any, special: boolean) {
    const heavy = ev.crit || ev.eff > 1;
    t.flash = 1;
    t.flashColor = color;
    const dir = Math.sign(t.home.x - a.home.x) || 1;
    const kick = heavy ? 60 : 30;
    const from = { ...t.pos };
    this.tween(this.time, 0.35, (p) => {
      if (t.fainted) return;
      const k = Math.sin(p * Math.PI);
      t.pos.x = from.x + dir * k * kick;
      t.tilt = -dir * k * (heavy ? 6 : 3);
    });
    const hx = t.pos.x - dir * t.half * 0.3;
    const hy = t.pos.y + t.lift + t.height * 0.5;
    // Undă de șoc + scântei în culoarea tipului; la critic, un al doilea inel, alb.
    this.ring(hx, hy, color, special ? 420 : 300, 0.45);
    if (heavy) this.ring(hx, hy, hex(this.spine, '#ffffff'), 520, 0.35);
    this.burst(hx, hy, color, heavy ? 26 : 14, heavy ? 900 : 650, 0.55, 1600, 22);
    this.flare(hx, hy, color, special ? 360 : 240, 0.25);
    if (heavy) this.shake = 22;
  }

  private projectile(a: Fighter, t: Fighter, color: Any, dur: number, size: number) {
    const head = a.head
      ? { x: a.head.worldX, y: a.head.worldY }
      : { x: a.pos.x + a.look * a.half * 0.6, y: a.pos.y + a.height * 0.7 };
    const to = { x: t.pos.x, y: t.pos.y + t.lift + t.height * 0.5 };
    const orb = { x: head.x, y: head.y, size, color };
    this.orbs.push(orb);
    this.flare(head.x, head.y, color, size * 2, 0.2);
    this.tween(
      this.time,
      dur,
      (p) => {
        orb.x = head.x + (to.x - head.x) * p;
        orb.y = head.y + (to.y - head.y) * p + Math.sin(p * Math.PI) * 80;
        this.particles.push({
          x: orb.x,
          y: orb.y,
          vx: 0,
          vy: 0,
          life: 0.28,
          max: 0.28,
          size: 70,
          grow: -120,
          color,
          gravity: 0,
          tex: 'glow',
          additive: true,
        });
      },
      () => (this.orbs = this.orbs.filter((o) => o !== orb)),
    );
  }

  private faint(key: string): StepPlan {
    const f = this.fighters.get(key);
    if (!f) return { duration: 0.6, impact: 0 };
    f.fainted = true;
    f.state.setAnimation(0, f.idle, true).timeScale = 0.25;
    const side = f.facing;
    const fromLift = f.lift;
    this.tween(this.time, 0.7, (p) => {
      const e = easeIn(p);
      f.tilt = side * 70 * e;
      f.lift = fromLift * (1 - e);
      f.gray = e;
    });
    if (f.c.side === 'enemy') {
      // Umbra iese din trup: fum violet care urcă.
      this.burst(f.pos.x, f.pos.y + f.height * 0.4, hex(this.spine, '#9b5cff'), 24, 220, 1.4, -380, 60, true);
    }
    // Învinsul se stinge și dispare, ca terenul să rămână clar.
    this.tween(this.time + 0.6, 0.6, (p) => (f.alpha = 1 - p));
    return { duration: 1.1, impact: 0 };
  }

  private at(time: number, fn: () => void) {
    this.tween(time, 0.001, () => {}, fn);
  }

  private tween(start: number, dur: number, update: (p: number) => void, done?: () => void) {
    this.tweens.push({ start, dur: Math.max(0.001, dur), update, done });
  }

  private ring(x: number, y: number, color: Any, size: number, life: number) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      max: life,
      size: size * 0.25,
      grow: size / life,
      color,
      gravity: 0,
      tex: 'ring',
      additive: true,
    });
  }

  private flare(x: number, y: number, color: Any, size: number, life: number) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      max: life,
      size,
      grow: -size / life / 2,
      color,
      gravity: 0,
      tex: 'glow',
      additive: true,
    });
  }

  private burst(
    x: number,
    y: number,
    color: Any,
    count: number,
    speed: number,
    life: number,
    gravity: number,
    size: number,
    additive = true,
  ) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v * 0.8 + v * 0.25,
        life: life * (0.6 + Math.random() * 0.4),
        max: life,
        size: size * (0.6 + Math.random() * 0.8),
        grow: 0,
        color,
        gravity,
        tex: 'glow',
        additive,
      });
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const dt = real * this.speed;
    this.time += dt;

    // Tween-urile pornite din alt tween (proiectilul, reculul la lovitură) intră în lista nouă, nu se pierd.
    const due = this.tweens;
    this.tweens = [];
    const keep = due.filter((tw) => {
      if (this.time < tw.start) return true;
      const p = Math.min(1, (this.time - tw.start) / tw.dur);
      tw.update(p);
      if (p >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    this.tweens = keep.concat(this.tweens);

    for (const f of this.fighters.values()) {
      f.phase += dt;
      f.state.update(dt);
      // Strălucirea la lovitură e „culoarea întunecată” a sloturilor; cele cu dark color propriu rămân ale animației.
      for (const s of f.skeleton.slots) if (!s.data.darkColor) s.darkColor = null;
      f.state.apply(f.skeleton);
      const hover = f.flyer && !f.fainted ? Math.sin(f.phase * 2.2) * 12 : 0;
      const root = f.skeleton.getRootBone();
      root.rotation += f.tilt;
      f.skeleton.scaleX = f.scale * f.look;
      f.skeleton.scaleY = f.scale;
      f.skeleton.x = f.pos.x - f.centerX * f.scale * f.look;
      f.skeleton.y = f.pos.y + f.lift + hover - f.footY * f.scale;
      const g = 1 - f.gray * 0.55;
      const base = f.c.variant === 'albino' ? [1, 0.95, 0.97] : [1, 1, 1];
      f.skeleton.color.set(base[0] * g, base[1] * g, base[2] * g, f.alpha);
      if (f.flash > 0) {
        f.flash = Math.max(0, f.flash - dt * 3.5);
        const k = f.flash * 0.45;
        const dark = new this.spine.Color(f.flashColor.r * k, f.flashColor.g * k, f.flashColor.b * k, 1);
        for (const s of f.skeleton.slots) if (!s.data.darkColor) s.darkColor = dark;
      }
      f.skeleton.updateWorldTransform();
    }

    for (const p of this.particles) {
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.vx *= 1 - dt * 2;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.size > 0);

    // Camera: se apropie de acțiune, apoi revine; se zguduie la loviturile grele.
    const cam = this.renderer.camera;
    cam.zoom = this.baseZoom;
    const shake = this.shake > 0 ? this.shake : 0;
    cam.position.x = (Math.random() - 0.5) * shake;
    cam.position.y = this.camY + (Math.random() - 0.5) * shake;
    this.shake = Math.max(0, this.shake - real * 70);
    this.render();
  };

  private render() {
    const gl = this.context.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const r = this.renderer;
    r.begin();
    const normal = () => r.batcher.setBlendMode(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const additive = () => r.batcher.setBlendMode(gl.SRC_ALPHA, gl.ONE);
    // Cei mai din spate (sus) se desenează primii.
    const order = [...this.fighters.values()].sort((a, b) => b.home.y - a.home.y);
    normal();
    const shadow = new this.spine.Color(0, 0, 0, 0.55);
    for (const f of order) {
      const w = f.half * 2.1 * (1 - Math.min(0.5, f.lift / 400));
      shadow.a = 0.55 * f.alpha;
      r.drawTexture(this.tex.glow, f.pos.x - w / 2, f.pos.y - w * 0.12, w, w * 0.24, shadow);
    }
    for (const f of order) if (f.alpha > 0) r.drawSkeleton(f.skeleton, false);
    additive();
    const c = new this.spine.Color();
    for (const o of this.orbs) {
      c.set(o.color.r, o.color.g, o.color.b, 0.45);
      r.drawTexture(this.tex.glow, o.x - o.size, o.y - o.size, o.size * 2, o.size * 2, c);
      c.set(1, 1, 1, 0.9);
      r.drawTexture(this.tex.glow, o.x - o.size * 0.3, o.y - o.size * 0.3, o.size * 0.6, o.size * 0.6, c);
    }
    for (const pass of [true, false]) {
      if (pass) additive();
      else normal();
      for (const p of this.particles) {
        if (p.additive !== pass) continue;
        c.set(p.color.r, p.color.g, p.color.b, Math.min(1, (p.life / p.max) * 1.4));
        r.drawTexture(this.tex[p.tex], p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, c);
      }
    }
    r.end();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.assets?.dispose();
    this.renderer?.dispose();
    this.context?.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}

/** Textura pentru străluciri (pată moale) sau unde de șoc (inel). */
function gradientCanvas(ring: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (ring) {
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function hex(spine: Any, value: string) {
  return new spine.Color().setFromString(value.replace('#', ''));
}

const easeIn = (p: number) => p * p;
