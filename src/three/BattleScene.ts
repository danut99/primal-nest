// Arena 3D a luptei. Rezultatul e deja calculat de reguli (battle.ts); aici doar îl punem în scenă:
// dinozaurii respiră, aleargă spre țintă și atacă, se clatină la lovituri și se prăbușesc.
// Modelele cu animații (Quaternius) își folosesc clipurile; celelalte primesc mișcări din cod.

import * as THREE from 'three';
import type { BattleEvent, Combatant } from '@shared/game';
import { SPECIES, TYPES } from '@shared/game';
import { jobFor, prepareModel } from './models';

type Clip = 'idle' | 'run' | 'attack' | 'death';

interface Fighter {
  c: Combatant;
  group: THREE.Group;
  /** Poziția de bază, unde stă între atacuri. */
  home: THREE.Vector3;
  facing: number;
  mixer?: THREE.AnimationMixer;
  actions: Partial<Record<Clip, THREE.AnimationAction>>;
  current?: Clip;
  materials: THREE.MeshStandardMaterial[];
  flash: number;
  flashColor: THREE.Color;
  flyer: boolean;
  height: number;
  umbra?: THREE.PointLight;
  fainted: boolean;
  phase: number;
}

interface Tween {
  start: number;
  dur: number;
  update: (p: number) => void;
  done?: () => void;
}

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  max: number;
  gravity: number;
}

const ZONE_LIGHT: Record<string, { rim: number; hemiSky: number; hemiGround: number; fog: number }> = {
  mlastina: { rim: 0x7dffc8, hemiSky: 0x9fc4ff, hemiGround: 0x1d2a1a, fog: 0x0d1a18 },
  jungla: { rim: 0xb6ffd0, hemiSky: 0xc4e6ff, hemiGround: 0x16240f, fog: 0x0b140b },
  vulcan: { rim: 0xff7a2a, hemiSky: 0xffb38a, hemiGround: 0x2a0d06, fog: 0x1a0805 },
};

/** Lungimea țintă a modelului (unități de scenă), după stadiu. */
const STAGE_LENGTH = { pui: 1.6, juvenil: 2.1, adult: 2.7 };
const UMBRA_GLOW = 0.16;

export class BattleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  private clock = new THREE.Clock();
  private fighters = new Map<string, Fighter>();
  private tweens: Tween[] = [];
  private bursts: Burst[] = [];
  private shake = 0;
  private flashLight: THREE.PointLight;
  private raf = 0;
  private resize: ResizeObserver;
  private time = 0;
  private disposed = false;
  private camTarget = new THREE.Vector3(0, 1, 0);
  private camFocus = new THREE.Vector3(0, 1, 0);

  constructor(
    private container: HTMLElement,
    private zoneId: string,
    private blood: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'arena3d-canvas';
    container.appendChild(this.renderer.domElement);

    const z = ZONE_LIGHT[zoneId] ?? ZONE_LIGHT.mlastina;
    this.scene.fog = new THREE.Fog(z.fog, 14, 30);
    this.scene.add(new THREE.HemisphereLight(z.hemiSky, z.hemiGround, 0.9));
    const key = new THREE.DirectionalLight(0xffe6c4, 2.4);
    key.position.set(-5, 9, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(z.rim, 3.2);
    rim.position.set(2, 4, -8);
    this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight(z.rim, 1.4);
    rim2.position.set(-8, 2, -4);
    this.scene.add(rim2);

    // Solul: doar umbre peste imaginea regiunii, plus o pată de lumină caldă.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.55 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,210,150,0.28)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    pool.scale.set(1.4, 0.8, 1);
    this.scene.add(pool);

    this.flashLight = new THREE.PointLight(0xffffff, 0, 8, 2);
    this.scene.add(this.flashLight);

    this.camera.position.set(0, 2.8, 10);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(container);
    this.fit();
    this.loop();
  }

  private fit() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Pe ecrane înguste camera se dă înapoi, ca să încapă ambele tabere.
    this.camera.position.z = w / h < 1.4 ? 14 : 8.8;
    this.camera.updateProjectionMatrix();
  }

  /** Încarcă modelele și le așază: haita în stânga, inamicii în dreapta. */
  async load(start: Combatant[]) {
    const slots = [
      new THREE.Vector3(3.2, 0, 0.6),
      new THREE.Vector3(4.2, 0, -1.6),
      new THREE.Vector3(2.6, 0, 2.4),
    ];
    const sides = { player: 0, enemy: 0 };
    await Promise.all(
      start.map(async (c) => {
        const index = sides[c.side]++;
        const slot = slots[index % slots.length].clone();
        if (c.side === 'player') slot.x *= -1;
        if (c.boss) slot.set(3.6, 0, 0);
        await this.addFighter(c, slot);
      }),
    );
  }

  private async addFighter(c: Combatant, home: THREE.Vector3) {
    const job = jobFor(c.speciesId);
    if (!job) return;
    const prepared = await prepareModel(job);
    const species = SPECIES[c.speciesId];
    const flyer = species.line === 'ptero';
    // Scalare la o lungime țintă pe stadiu; Alfa e mult mai mare.
    const length = Math.max(prepared.size.x, prepared.size.z * 0.5, prepared.size.y * 0.8);
    const target = STAGE_LENGTH[species.stage] * (c.boss ? 1.6 : 1);
    const scale = target / length;
    const group = new THREE.Group();
    prepared.root.scale.setScalar(scale);
    group.add(prepared.root);
    const facing = c.side === 'player' ? 0 : Math.PI;
    group.rotation.y = facing;
    group.position.copy(home);
    if (flyer) group.position.y = 1.1;
    this.scene.add(group);

    const materials: THREE.MeshStandardMaterial[] = [];
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        if (c.variant === 'albino' && mat.color) mat.color.lerp(new THREE.Color('#fff4f6'), 0.75);
        if (c.side === 'enemy' && mat.emissive) {
          // Umbra: o strălucire violetă care se stinge la înfrângere.
          mat.emissive = new THREE.Color('#5a1fb0');
          mat.emissiveIntensity = UMBRA_GLOW;
        }
        materials.push(mat);
      }
    });

    const f: Fighter = {
      c,
      group,
      home: group.position.clone(),
      facing,
      actions: {},
      materials,
      flash: 0,
      flashColor: new THREE.Color(),
      flyer,
      height: prepared.size.y * scale,
      fainted: false,
      phase: Math.random() * Math.PI * 2,
    };

    if (prepared.animations.length) {
      f.mixer = new THREE.AnimationMixer(prepared.root);
      const find = (name: string) => prepared.animations.find((a) => a.name.toLowerCase().includes(name));
      const map: Record<Clip, string> = { idle: 'idle', run: 'run', attack: 'attack', death: 'death' };
      for (const [k, n] of Object.entries(map) as [Clip, string][]) {
        const clip = find(n);
        if (clip) f.actions[k] = f.mixer.clipAction(clip);
      }
      f.actions.death?.setLoop(THREE.LoopOnce, 1);
      if (f.actions.death) f.actions.death.clampWhenFinished = true;
      f.actions.attack?.setLoop(THREE.LoopOnce, 1);
      this.playClip(f, 'idle');
      f.mixer.setTime(Math.random() * 2);
    }

    if (c.side === 'enemy') {
      f.umbra = new THREE.PointLight(0x9b5cff, c.boss ? 6 : 3, 4, 2);
      f.umbra.position.set(0, 0.4, 0);
      group.add(f.umbra);
    }
    this.fighters.set(c.key, f);
  }

  private playClip(f: Fighter, clip: Clip, fade = 0.2) {
    const next = f.actions[clip] ?? (clip === 'run' ? f.actions.idle : undefined);
    if (!next || f.current === clip) return;
    const prev = f.current ? f.actions[f.current] : undefined;
    next.reset().play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    f.current = clip;
  }

  /** Poziția pe ecran (px, relativ la container) deasupra capului unui luptător. */
  screenPos(key: string): { x: number; y: number } | null {
    const f = this.fighters.get(key);
    if (!f) return null;
    const p = f.group.position.clone();
    p.y += f.height * 0.9 + (f.flyer ? 0.3 : 0.4);
    p.project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.container.clientWidth,
      y: ((1 - p.y) / 2) * this.container.clientHeight,
    };
  }

  /** Pune în scenă un eveniment din jurnalul luptei. durationMs = cât durează pasul. */
  play(ev: BattleEvent, durationMs: number) {
    if (ev.t === 'attack') this.attack(ev, durationMs / 1000);
    else if (ev.t === 'faint') this.faint(ev.target, durationMs / 1000);
    else if (ev.t === 'end') {
      for (const f of this.fighters.values()) {
        if (!f.fainted && ev.win === (f.c.side === 'player')) this.playClip(f, 'attack');
      }
    }
  }

  private attack(ev: Extract<BattleEvent, { t: 'attack' }>, dur: number) {
    const a = this.fighters.get(ev.actor);
    const t = this.fighters.get(ev.target);
    if (!a || !t) return;
    const total = Math.min(dur * 0.92, 0.9);
    const toTarget = t.home.clone().sub(a.home);
    // Atacurile speciale se trag de la distanță; cele de bază merg aproape de țintă.
    const reach = ev.special ? 0.25 : 0.62;
    const strike = a.home.clone().add(toTarget.clone().multiplyScalar(reach));
    strike.y = a.home.y;
    const typeColor = new THREE.Color(ev.moveType ? TYPES[ev.moveType].color : '#ffffff');
    const now = this.time;
    this.focus(a.home.clone().lerp(t.home, 0.5));

    this.playClip(a, 'run', 0.12);
    this.tween(now, total * 0.38, (p) => a.group.position.lerpVectors(a.home, strike, easeOut(p)));
    this.tween(
      now + total * 0.3,
      0.01,
      () => {},
      () => {
        if (a.actions.attack) {
          a.current = undefined;
          this.playClip(a, 'attack', 0.08);
        }
      },
    );
    // Fără animație de atac: o smucitură spre înainte, cu capul plecat.
    if (!a.actions.attack) {
      this.tween(now + total * 0.3, total * 0.25, (p) => {
        a.group.rotation.z = Math.sin(p * Math.PI) * -0.18 * (a.c.side === 'player' ? 1 : -1);
      });
    }
    const impactAt = now + total * 0.5;
    if (ev.special) this.projectile(a, t, typeColor, now + total * 0.32, total * 0.18);
    this.tween(impactAt, 0.01, () => {}, () => this.impact(a, t, ev, typeColor));
    this.tween(now + total * 0.62, total * 0.38, (p) => a.group.position.lerpVectors(strike, a.home, easeInOut(p)), () => {
      if (!a.fainted) this.playClip(a, 'idle', 0.25);
    });
  }

  private impact(a: Fighter, t: Fighter, ev: Extract<BattleEvent, { t: 'attack' }>, color: THREE.Color) {
    const heavy = ev.crit || ev.eff > 1;
    t.flash = 1;
    t.flashColor.copy(heavy ? new THREE.Color('#ffffff') : color);
    const dir = t.home.clone().sub(a.home).setY(0).normalize();
    const kick = heavy ? 0.45 : 0.22;
    const from = t.home.clone();
    this.tween(this.time, 0.32, (p) => {
      if (t.fainted) return;
      t.group.position.copy(from).addScaledVector(dir, Math.sin(p * Math.PI) * kick);
      t.group.rotation.z = Math.sin(p * Math.PI * 2) * 0.08;
    });
    const hitPoint = t.group.position.clone();
    hitPoint.y += t.height * 0.55;
    this.flashLight.color.copy(color);
    this.flashLight.position.copy(hitPoint);
    this.flashLight.intensity = heavy ? 60 : 25;
    this.spark(hitPoint, color, heavy ? 70 : 36, heavy ? 5 : 3.2, 0.6);
    if (this.blood) this.spark(hitPoint, new THREE.Color('#a80d12'), heavy ? 40 : 18, 2.6, 0.9, 9, 0.09);
    if (heavy) this.shake = 0.35;
  }

  private projectile(a: Fighter, t: Fighter, color: THREE.Color, at: number, dur: number) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.scale.setScalar(1.6);
    orb.add(glow);
    const light = new THREE.PointLight(color, 20, 5, 2);
    orb.add(light);
    const from = a.group.position.clone().setY(a.home.y + a.height * 0.6);
    const to = t.home.clone().setY(t.home.y + t.height * 0.55);
    this.tween(
      at,
      dur,
      (p) => {
        if (!orb.parent) this.scene.add(orb);
        orb.position.lerpVectors(from, to, p);
        orb.position.y += Math.sin(p * Math.PI) * 0.6;
      },
      () => {
        this.scene.remove(orb);
        orb.geometry.dispose();
      },
    );
  }

  private faint(key: string, dur: number) {
    const f = this.fighters.get(key);
    if (!f) return;
    f.fainted = true;
    if (f.actions.death) {
      f.current = undefined;
      this.playClip(f, 'death', 0.1);
    } else {
      const fromY = f.group.position.y;
      this.tween(this.time, Math.max(0.4, dur * 0.8), (p) => {
        if (f.flyer) {
          // Zburătorul cade din aer, cu aripile strânse.
          f.group.position.y = fromY * (1 - easeIn(p));
          f.group.rotation.x = easeOut(p) * 0.9;
        } else {
          f.group.rotation.x = easeOut(p) * (Math.PI / 2.3);
          f.group.position.y = -0.05 * p;
        }
      });
    }
    if (f.c.side === 'enemy') {
      // Umbra iese din trup: fum violet care urcă, lumina se stinge.
      const p = f.group.position.clone();
      p.y += f.height * 0.5;
      this.spark(p, new THREE.Color('#9b5cff'), 60, 1.4, 1.6, -1.2, 0.14);
      this.tween(this.time, 1.2, (k) => {
        if (f.umbra) f.umbra.intensity = (1 - k) * 3;
        for (const m of f.materials) if (m.emissive) m.emissiveIntensity = UMBRA_GLOW * (1 - k);
      });
    }
    // Învinsul se stinge și dispare, ca terenul să rămână clar.
    this.tween(this.time + 1.1, 0.7, (k) => {
      for (const m of f.materials) {
        m.transparent = true;
        m.opacity = 1 - k;
      }
    }, () => {
      f.group.visible = false;
    });
  }

  private focus(point: THREE.Vector3) {
    this.camFocus.set(point.x * 0.35, 1, point.z * 0.2);
  }

  private tween(start: number, dur: number, update: (p: number) => void, done?: () => void) {
    this.tweens.push({ start, dur: Math.max(0.001, dur), update, done });
  }

  private spark(at: THREE.Vector3, color: THREE.Color, count: number, speed: number, life: number, gravity = 6, size = 0.12) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([at.x, at.y, at.z], i * 3);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      velocities.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true,
      blending: color.getHex() === 0xa80d12 ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, velocities, life, max: life, gravity });
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    for (const f of this.fighters.values()) {
      f.mixer?.update(dt);
      if (!f.fainted) {
        f.phase += dt;
        // Respirație pentru modelele fără animație; zburătorii plutesc.
        if (!f.actions.idle) f.group.scale.y = 1 + Math.sin(f.phase * 2.2) * 0.015;
        if (f.flyer) f.group.position.y = f.home.y + Math.sin(f.phase * 2.4) * 0.15;
      }
      if (f.flash > 0) {
        f.flash = Math.max(0, f.flash - dt * 4);
        for (const m of f.materials) {
          if (!m.emissive) continue;
          if (f.flash > 0) {
            m.emissive.copy(f.flashColor);
            m.emissiveIntensity = f.flash * 1.4;
          } else if (f.c.side === 'enemy' && !f.fainted) {
            m.emissive.set('#5a1fb0');
            m.emissiveIntensity = UMBRA_GLOW;
          } else m.emissiveIntensity = 0;
        }
      }
    }

    this.tweens = this.tweens.filter((tw) => {
      if (this.time < tw.start) return true;
      const p = Math.min(1, (this.time - tw.start) / tw.dur);
      tw.update(p);
      if (p >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });

    this.bursts = this.bursts.filter((b) => {
      b.life -= dt;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        b.velocities[i * 3 + 1] -= b.gravity * dt;
        pos.setXYZ(i, pos.getX(i) + b.velocities[i * 3] * dt, pos.getY(i) + b.velocities[i * 3 + 1] * dt, pos.getZ(i) + b.velocities[i * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });

    this.flashLight.intensity *= Math.pow(0.02, dt);
    this.camTarget.lerp(this.camFocus, Math.min(1, dt * 2));
    this.camFocus.lerp(new THREE.Vector3(0, 1, 0), dt * 0.6);
    const sway = Math.sin(this.time * 0.25) * 0.5;
    const base = this.camera.position;
    base.x = sway + this.camTarget.x * 0.6;
    base.y = 2.8;
    if (this.shake > 0) {
      base.x += (Math.random() - 0.5) * this.shake;
      base.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}


const textureCache = new Map<string, THREE.Texture>();
function radialTexture(inner: string, outer: string): THREE.Texture {
  const key = inner + outer;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  textureCache.set(key, tex);
  return tex;
}

const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeIn = (p: number) => p * p;
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
