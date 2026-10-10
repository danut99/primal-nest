// Deformările comprimate (PCA) ale scheletelor din studio: se decodează leneș, cadru cu cadru (runtime.ts).
// Testul încarcă runtime-ul Spine adevărat și verifică plasa în mișcare; dacă exportul original din
// rig-lab/tempest-studio e pe disc, compară cadrele decodate cu el.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { readPcaDeform } from './runtime';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ROOT = path.resolve(__dirname, '../..');
const STUDIO = path.resolve(ROOT, '../rig-lab/tempest-studio/public/models');

function loadSpine(): any {
  const ctx: any = { console, Math, Float32Array, Int16Array, Uint16Array, Uint8Array, Array, Object, Map, Set, JSON, Error };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {} };
  ctx.navigator = { userAgent: 'node' };
  ctx.HTMLElement = function () {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/dinosaurs/runtime/spine-player.js'), 'utf8'), ctx);
  return ctx.DragonPackSpine;
}
const spine = loadSpine();
readPcaDeform(spine);

/** Atașamente fără texturi: doar geometria. */
const loader = {
  newRegionAttachment: (_: any, name: string) => new spine.RegionAttachment(name),
  newMeshAttachment: (_: any, name: string) => {
    const m = new spine.MeshAttachment(name);
    m.region = { u: 0, v: 0, u2: 1, v2: 1, rotate: false, degrees: 0 };
    return m;
  },
  newBoundingBoxAttachment: (_: any, name: string) => new spine.BoundingBoxAttachment(name),
  newPathAttachment: (_: any, name: string) => new spine.PathAttachment(name),
  newPointAttachment: (_: any, name: string) => new spine.PointAttachment(name),
  newClippingAttachment: (_: any, name: string) => new spine.ClippingAttachment(name),
};

/** Vârfurile unei plase în lume, la momentul `t` al animației. */
function pose(json: unknown, anim: string, slotName: string, t: number): Float32Array {
  const data = new spine.SkeletonJson(loader).readSkeletonData(json);
  const skeleton = new spine.Skeleton(data);
  skeleton.setToSetupPose();
  data.findAnimation(anim).apply(skeleton, t, t, true, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
  skeleton.updateWorldTransform();
  const slot = skeleton.findSlot(slotName);
  const att = slot.getAttachment();
  const out = new Float32Array(att.worldVerticesLength);
  att.computeWorldVertices(slot, 0, att.worldVerticesLength, out, 0, 2);
  return out;
}
const game = (rig: string) => fs.readFileSync(path.join(ROOT, 'public/dinosaurs', rig, 'skeleton.json'), 'utf8');

describe.each([
  ['tundraceratops-adult', 'tundraceratops', 'art'],
  ['fulgurodrome-adult', 'fulgurodrome', 'body'],
])('%s', (rig, studio, slot) => {
  it('moves while walking (frames are decoded, including the first)', () => {
    const a = pose(game(rig), 'walk', slot, 0);
    const b = pose(game(rig), 'walk', slot, 0.5);
    let moved = 0;
    for (let i = 0; i < a.length; i++) moved = Math.max(moved, Math.abs(a[i] - b[i]));
    expect(moved).toBeGreaterThan(2);
  });

  it.skipIf(!fs.existsSync(path.join(STUDIO, studio, 'animated.json')))('matches the studio export', () => {
    const original = fs.readFileSync(path.join(STUDIO, studio, 'animated.json'), 'utf8');
    for (const t of [0, 0.37, 0.81, 1.2]) {
      const mine = pose(game(rig), 'walk', slot, t);
      const theirs = pose(original, 'walk', slot, t);
      // jocul a ridicat tot scheletul (picioarele pe sol): diferența trebuie să fie aceeași peste tot
      const dy = mine[1] - theirs[1];
      let worst = 0;
      for (let i = 0; i < mine.length; i += 2)
        worst = Math.max(worst, Math.abs(mine[i] - theirs[i]), Math.abs(mine[i + 1] - dy - theirs[i + 1]));
      // PCA + 30 Hz în loc de 60 Hz: câteva unități, din ~1700 cât e dinozaurul
      expect(worst).toBeLessThan(6);
    }
  }, 120_000);
});
