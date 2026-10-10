// Scheletele animate (Spine 3.8 JSON) din public/dinosaurs:
//   manifest.json            – lista scheletelor („rigs”): fișiere, animații, contur
//   <rig>/skeleton.json      – oase, sloturi, mesh-uri, animații
//   <rig>/parts.atlas + .png – piesele desenate
//   runtime/spine-player.js  – runtime-ul Spine (expune window.DragonPackSpine)
// Un schelet nou = un folder nou + o intrare în manifest. Rețetele îl aleg prin `base.rig`.

export const DINO_BASE = import.meta.env.BASE_URL + 'dinosaurs';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RigEntry {
  id: string;
  name: string;
  /** biped (T-Rex, raptor), quadruped (triceratops, sauropod), flyer (pterozaur), swimmer. */
  body: string;
  skeleton: string;
  atlas: string;
  animations: { name: string; label: string; duration: number; loop: boolean }[];
  bounds: Bounds;
  animationBounds?: Record<string, Bounds>;
}

let manifest: Promise<{ rigs: RigEntry[] }> | undefined;
export function loadManifest() {
  manifest ??= fetch(DINO_BASE + '/manifest.json').then((r) => {
    if (!r.ok) throw new Error(`Catalogul scheletelor nu a putut fi încărcat (${r.status}).`);
    return r.json();
  });
  manifest.catch(() => (manifest = undefined));
  return manifest;
}

export async function loadRig(id: string): Promise<RigEntry> {
  const rig = (await loadManifest()).rigs.find((r) => r.id === id);
  if (!rig) throw new Error(`Schelet necunoscut: ${id}`);
  return rig;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Spine = any;
let runtime: Promise<Spine> | undefined;
export function loadRuntime(): Promise<Spine> {
  const w = window as any;
  if (w.DragonPackSpine) return Promise.resolve(w.DragonPackSpine);
  runtime ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = DINO_BASE + '/runtime/spine-player.js';
    script.onload = () => {
      if (!w.DragonPackSpine) return reject(new Error('Runtime-ul Spine nu s-a inițializat.'));
      readPcaDeform(w.DragonPackSpine);
      premultiplyTextures(w.DragonPackSpine);
      resolve(w.DragonPackSpine);
    };
    script.onerror = () => {
      script.remove();
      runtime = undefined;
      reject(new Error('Runtime-ul Spine nu a putut fi încărcat.'));
    };
    document.head.append(script);
  });
  return runtime;
}

// ---------- deformările comprimate (scripts/import-studio.py) ----------

/** Deformările animate se decodează din PCA la acest pas (30 Hz în loc de 60: jumătate din memorie). */
const PCA_STEP = 2;

interface PcaMesh {
  n: number;
  mean: [number, string];
  basis: [number, string][];
  anims: Record<string, { step: number; frames: number; coef: [number, string][] }>;
}

/** Base64 de int16 little-endian → valori reale (o buclă simplă: `Uint8Array.from` cu funcție e de ~10× mai lent). */
function int16(base64: string, scale: number): Float32Array {
  const text = atob(base64);
  const out = new Float32Array(text.length >> 1);
  for (let i = 0, j = 0; i < out.length; i++, j += 2) {
    const v = text.charCodeAt(j) | (text.charCodeAt(j + 1) << 8);
    out[i] = (v > 32767 ? v - 65536 : v) * scale;
  }
  return out;
}

/**
 * Scheletele importate din studio țin deformările ca medie + componente. Nu le refacem la încărcare (zeci de mii de
 * vârfuri × sute de cadre × fiecare animație, pentru fiecare model de pe hartă): fiecare animație primește direct o
 * cronologie Spine care își calculează cadrele abia când se joacă prima dată.
 */
function attachPcaTimelines(
  spine: any,
  data: any,
  pca: Record<string, Record<string, Record<string, PcaMesh>>>,
  step = PCA_STEP,
) {
  for (const [skinName, slots] of Object.entries(pca))
    for (const [slotName, atts] of Object.entries(slots))
      for (const [attName, mesh] of Object.entries(atts)) {
        const slotIndex = data.findSlotIndex(slotName);
        const attachment = data.findSkin(skinName)?.getAttachment(slotIndex, attName);
        if (slotIndex < 0 || !attachment) continue;
        const weighted = attachment.bones != null;
        const setup: ArrayLike<number> = attachment.vertices;
        // media și componentele sunt comune animațiilor unei plase: se decodează o dată, la prima nevoie
        let shared: { mean: Float32Array; basis: Float32Array[] } | undefined;
        const base = () =>
          (shared ??= {
            mean: int16(mesh.mean[1], mesh.mean[0]),
            basis: mesh.basis.map(([scale, b64]) => int16(b64, scale)),
          });
        for (const [name, anim] of Object.entries(mesh.anims)) {
          const animation = data.findAnimation(name);
          if (!animation) continue;
          const picks: number[] = [];
          for (let f = 0; f < anim.frames; f += step) picks.push(f);
          if (picks.at(-1) !== anim.frames - 1) picks.push(anim.frames - 1);
          const timeline = new spine.DeformTimeline(picks.length);
          timeline.slotIndex = slotIndex;
          timeline.attachment = attachment;
          picks.forEach((f, k) => (timeline.frames[k] = f * anim.step));
          // fiecare cadru se calculează abia când animația ajunge la el (costul se întinde pe toată animația)
          let coef: Float32Array[] | undefined;
          const frameAt = (k: number) => {
            if (timeline.frameVertices[k]) return;
            const { mean, basis } = base();
            coef ??= anim.coef.map(([scale, b64]) => int16(b64, scale));
            const f = picks[k];
            const v = new Float32Array(mean);
            for (let j = 0; j < basis.length; j++) {
              const c = coef[j][f];
              const b = basis[j];
              for (let i = 0; i < v.length; i++) v[i] += c * b[i];
            }
            // ca SkeletonJson: la plasele neponderate cadrul ține pozițiile întregi, nu doar deplasarea
            if (!weighted) for (let i = 0; i < v.length; i++) v[i] += setup[i];
            timeline.frameVertices[k] = v;
          };
          const frames: Float32Array = timeline.frames;
          const last = picks.length - 1;
          const apply = timeline.apply;
          timeline.apply = function (skeleton: unknown, lastTime: number, time: number, ...rest: unknown[]) {
            // Spine citește mereu lungimea din primul cadru, deci el trebuie să existe
            frameAt(0);
            if (time >= frames[0]) {
              if (time >= frames[last]) frameAt(last);
              else {
                let k = 1;
                while (frames[k] <= time) k++;
                frameAt(k - 1);
                frameAt(k);
              }
            }
            return apply.call(this, skeleton, lastTime, time, ...rest);
          };
          animation.timelines.push(timeline);
          animation.timelineIds[timeline.getPropertyId()] = true;
          animation.duration = Math.max(animation.duration, timeline.frames[picks.length - 1]);
        }
      }
}

/**
 * Canvasurile WebGL transparente sunt compuse de browser ca alfa premultiplicat. Desenate cu alfa obișnuit, pixelii
 * semi-transparenți (marginile straturilor și ale plaselor) lasă fundalul să treacă de două ori: linii deschise pe
 * insule luminoase (zăpadă). Texturile se premultiplică la încărcare și se desenează premultiplicat
 * (herd.ts: drawSkeleton(…, true); engine.ts: premultipliedAlpha: true).
 */
function premultiplyTextures(spine: any) {
  const proto = spine.webgl.GLTexture.prototype;
  if (proto.premultiplies) return;
  proto.premultiplies = true;
  const update = proto.update;
  proto.update = function (useMipMaps: boolean) {
    const gl = this.context.gl;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try {
      update.call(this, useMipMaps);
    } finally {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }
  };
}

/** Exportat pentru teste (src/dino-lab/pca-deform.test.ts). */
export function readPcaDeform(spine: any) {
  if (spine.SkeletonJson.prototype.readsPca) return;
  spine.SkeletonJson.prototype.readsPca = true;
  const read = spine.SkeletonJson.prototype.readSkeletonData;
  spine.SkeletonJson.prototype.readSkeletonData = function (json: unknown) {
    const root = typeof json === 'string' ? JSON.parse(json) : json;
    const pca = root.pcaDeform;
    delete root.pcaDeform;
    const data = read.call(this, root);
    // `pcaStep` pe cititor: turma de pe hartă cere mai puține cadre (dinozauri mici)
    if (pca) attachPcaTimelines(spine, data, pca, this.pcaStep ?? PCA_STEP);
    return data;
  };
}
