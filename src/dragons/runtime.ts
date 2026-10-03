// Dragoni animați (Spine 3.8, preluați din DCAT). Totul e static, în public/dragons:
//   manifest.json     – catalogul: modelele generate („models”) și arhivele Dragon City („library”)
//   models/<id>/<stage>/{skeleton.skel, atlas.atlas, texture.png, preview.png}
//   library/*.zip     – arhive originale (atlas + skel + textură DDS); se despachetează și se convertesc în browser
//   spine-player.js   – runtime-ul Spine adaptat (expune window.DragonPackSpine)
// Lista „library” se reface cu `npm run dragons` după ce adaugi arhive noi.

import { strFromU8, unzipSync } from 'fflate';

export const DRAGON_BASE = import.meta.env.BASE_URL + 'dragons';

export interface DragonStage {
  id: string;
  label: string;
  scale: number;
  bodyBounds?: Bounds;
  sceneBounds?: Bounds;
  extension?: string;
  extensionConfig?: { sourceBounds: Bounds; companion: string; weapon: string };
}
export interface DragonModel {
  id: string;
  name: string;
  element: string;
  color: string;
  description: string;
  stages: DragonStage[];
}
export interface LibraryEntry {
  id: string;
  name: string;
  kind: 'dragon' | 'efect';
  forms: { label: string; file: string }[];
}
export interface DragonCatalog {
  models: DragonModel[];
  library: LibraryEntry[];
  spectacular?: string[];
  grandiose?: { id: string; name: string; description: string; archive: string; preview: string; recommendedAnimation: string; fatalityArchive?: string; bodyBounds: Bounds; sceneBounds: Bounds }[];
}
interface Bounds { x: number; y: number; width: number; height: number }

/** Ce redăm: un model generat (model + stadiu) sau o arhivă din bibliotecă. */
export type DragonSource = { model: string; stage: string } | { archive: string };

export const previewUrl = (model: string, stage: string) => `${DRAGON_BASE}/models/${model}/${stage}/preview.png`;
export const sourceKey = (s: DragonSource) => ('archive' in s ? s.archive : `${s.model}/${s.stage}`);

let catalog: Promise<DragonCatalog> | undefined;
export function loadCatalog(): Promise<DragonCatalog> {
  catalog ??= fetch(DRAGON_BASE + '/manifest.json').then((r) => {
    if (!r.ok) throw new Error(`Catalogul dragonilor nu a putut fi încărcat (${r.status}).`);
    return r.json();
  });
  catalog.catch(() => (catalog = undefined));
  return catalog;
}

// ---------- runtime Spine (script global, încărcat o singură dată) ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Spine = any;
let runtime: Promise<Spine> | undefined;
export function loadRuntime(): Promise<Spine> {
  const w = window as any;
  if (w.DragonPackSpine) return Promise.resolve(w.DragonPackSpine);
  runtime ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = DRAGON_BASE + '/spine-player.js';
    script.onload = () =>
      w.DragonPackSpine ? resolve(w.DragonPackSpine) : reject(new Error('Runtime-ul Spine nu s-a inițializat.'));
    script.onerror = () => {
      script.remove();
      runtime = undefined;
      reject(new Error('Runtime-ul Spine nu a putut fi încărcat.'));
    };
    document.head.append(script);
  });
  return runtime;
}

// ---------- arhive Dragon City: zip → skel + atlas + PNG (din DDS) ----------

export interface Files {
  skel: string;
  atlas: string;
  urls: Record<string, string>;
}

export async function openArchive(file: string, signal: AbortSignal): Promise<Files> {
  const res = await fetch(`${DRAGON_BASE}/library/${file}`, { signal });
  if (!res.ok) throw new Error(`Arhiva ${file} nu a putut fi descărcată (${res.status}).`);
  const stem = file.replace(/\.zip$/, '');
  const entries = unzipSync(new Uint8Array(await res.arrayBuffer()), { filter: (f) => !f.name.includes('_map.') });
  const skel = entries[stem + '.skel'];
  const atlas = entries[stem + '.atlas'];
  if (!skel || !atlas) throw new Error(`Arhiva ${file} nu conține un schelet Spine.`);
  const urls: Record<string, string> = {
    [`lib/${stem}.skel`]: URL.createObjectURL(new Blob([skel])),
    [`lib/${stem}.atlas`]: URL.createObjectURL(new Blob([strFromU8(atlas).replace(/\.dds\b/g, '.png')])),
  };
  for (const [name, data] of Object.entries(entries)) {
    if (!name.endsWith('.dds')) continue;
    urls['lib/' + name.replace(/\.dds$/, '.png')] = URL.createObjectURL(await ddsToPng(data));
  }
  return { skel: `lib/${stem}.skel`, atlas: `lib/${stem}.atlas`, urls };
}

/** Decodează primul nivel (mipmap 0) al unei texturi DDS DXT1/3/5, cu alpha. */
async function ddsToPng(dds: Uint8Array): Promise<Blob> {
  const view = new DataView(dds.buffer, dds.byteOffset, dds.byteLength);
  if (view.getUint32(0, true) !== 0x20534444) throw new Error('Textură DDS invalidă.');
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const format = String.fromCharCode(dds[84], dds[85], dds[86], dds[87]);
  if (!['DXT1', 'DXT3', 'DXT5'].includes(format)) throw new Error(`Format DDS nesuportat: ${format}`);
  const out = new Uint8ClampedArray(width * height * 4);
  const blockSize = format === 'DXT1' ? 8 : 16;
  const colors = new Uint8Array(16);
  const alphas = new Uint8Array(8);
  let offset = 128;
  for (let by = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4, offset += blockSize) {
      const color = offset + blockSize - 8;
      const c0 = view.getUint16(color, true);
      const c1 = view.getUint16(color + 2, true);
      rgb565(c0, colors, 0);
      rgb565(c1, colors, 4);
      const four = format !== 'DXT1' || c0 > c1;
      for (let i = 0; i < 3; i++) {
        colors[8 + i] = four ? (2 * colors[i] + colors[4 + i]) / 3 : (colors[i] + colors[4 + i]) / 2;
        colors[12 + i] = four ? (colors[i] + 2 * colors[4 + i]) / 3 : 0;
      }
      colors[3] = colors[7] = colors[11] = 255;
      colors[15] = four ? 255 : 0;
      if (format === 'DXT5') {
        const a0 = (alphas[0] = dds[offset]);
        const a1 = (alphas[1] = dds[offset + 1]);
        for (let i = 1; i < 7; i++) {
          if (a0 > a1) alphas[i + 1] = ((7 - i) * a0 + i * a1) / 7;
          else alphas[i + 1] = i < 5 ? ((5 - i) * a0 + i * a1) / 5 : i === 5 ? 0 : 255;
        }
      }
      const bits = view.getUint32(color + 4, true);
      for (let p = 0; p < 16; p++) {
        const x = bx + (p & 3);
        const y = by + (p >> 2);
        if (x >= width || y >= height) continue;
        const o = (y * width + x) * 4;
        const c = ((bits >>> (2 * p)) & 3) * 4;
        out[o] = colors[c];
        out[o + 1] = colors[c + 1];
        out[o + 2] = colors[c + 2];
        if (format === 'DXT5') {
          const bit = 3 * p;
          const byte = offset + 2 + (bit >> 3);
          const idx = ((dds[byte] | (dds[byte + 1] << 8)) >> (bit & 7)) & 7;
          out[o + 3] = alphas[idx];
        } else if (format === 'DXT3') {
          out[o + 3] = ((dds[offset + (p >> 1)] >> ((p & 1) * 4)) & 15) * 17;
        } else out[o + 3] = colors[c + 3];
      }
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(out, width, height), 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversia texturii a eșuat.'))), 'image/png'),
  );
}

function rgb565(c: number, out: Uint8Array, i: number) {
  out[i] = ((c >> 11) & 31) * (255 / 31);
  out[i + 1] = ((c >> 5) & 63) * (255 / 63);
  out[i + 2] = (c & 31) * (255 / 31);
}

// ---------- player ----------

export interface DragonOptions {
  framing?: 'animation' | 'scene' | 'body';
  animation?: string;
  speed?: number;
  paused?: boolean;
  /** #rrggbb opac sau #rrggbbaa (ex. '#00000000' pentru fundal transparent). */
  background?: string;
  zoom?: number;
}

export interface DragonController {
  readonly animations: string[];
  readonly canvas: HTMLCanvasElement;
  setAnimation(name: string): void;
  setSpeed(value: number): void;
  setPaused(value: boolean): void;
  setBackground(value: string): void;
  setZoom(value: number): void;
  setFraming(value: 'animation' | 'scene' | 'body'): void;
  snapshot(): Promise<Blob | null>;
  dispose(): void;
}

/** Creează un player Spine în `host`. Se oprește singur dacă `signal` e anulat. */
export async function createDragon(
  host: HTMLElement,
  source: DragonSource,
  opts: DragonOptions,
  signal: AbortSignal,
): Promise<DragonController> {
  const [cat, spine] = await Promise.all([loadCatalog(), loadRuntime()]);
  const fatality = 'archive' in source && cat.grandiose?.some((m) => m.fatalityArchive === source.archive);
  const featured = 'archive' in source ? cat.grandiose?.find((m) => m.archive === source.archive || m.fatalityArchive === source.archive) : undefined;
  let files: Files;
  let scale = 1;
  let modelBounds: { bodyBounds?: Bounds; sceneBounds?: Bounds } | undefined;
  let extensionVariant: DragonStage | undefined;
  if ('archive' in source) {
    files = await openArchive(source.archive, signal);
  } else {
    const stage = cat.models.find((m) => m.id === source.model)?.stages.find((s) => s.id === source.stage);
    if (!stage) throw new Error(`Model sau evoluție necunoscută: ${source.model}/${source.stage}`);
    const dir = `${DRAGON_BASE}/models/${source.model}/${source.stage}/`;
    files = { skel: dir + 'skeleton.skel', atlas: dir + 'atlas.atlas', urls: {} };
    scale = stage.scale;
    modelBounds = stage;
    extensionVariant = stage;
  }
  const revoke = () => Object.values(files.urls).forEach((u) => URL.revokeObjectURL(u));
  let install: ((raw: Spine, spine: Spine) => () => void) | undefined;
  if (extensionVariant?.extension) {
    try {
      const extensionUrl = new URL(`${DRAGON_BASE}/${extensionVariant.extension}`, window.location.href).href;
      const module = await import(/* @vite-ignore */ extensionUrl);
      install = await module.prepare({ baseUrl: DRAGON_BASE, variant: extensionVariant, signal });
    } catch (error) { revoke(); throw error; }
  }
  if (signal.aborted) {
    revoke();
    throw signal.reason;
  }

  let { animation = 'breathe', speed = 1, paused = false, background = '#101e30', zoom = 1, framing = 'animation' } = opts;
  const element = document.createElement('div');
  element.className = 'dragon-spine-host';
  host.append(element);

  return new Promise((resolve, reject) => {
    let disposed = false;
    let raw: Spine;
    let extensionCleanup: (() => void) | undefined;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', onAbort);
      extensionCleanup?.();
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
      animation: install ? 'breathe' : undefined,
      atlasUrl: files.atlas,
      rawDataURIs: files.urls,
      premultipliedAlpha: false,
      showControls: false,
      alpha: true,
      backgroundColor: background,
      viewport: { padLeft: '10%', padRight: '10%', padTop: '10%', padBottom: '10%' },
      success: () => {
        if (disposed) return;
        try { extensionCleanup = install?.(raw, spine); } catch (error) { cleanup(); reject(error); return; }
        const names: string[] = raw.animationState.data.skeletonData.animations.map((a: { name: string }) => a.name);
        if (!names.includes(animation)) animation = names.includes('breathe') ? 'breathe' : names[0];
        const viewport = () => {
          for (const key of ['x', 'y', 'width', 'height']) delete raw.config.viewport[key];
          const bounds = fatality && framing === 'body' ? { x: -700, y: -700, width: 1400, height: 1400 } : featured && !fatality ? framing === 'body' ? featured.bodyBounds : framing === 'scene' ? featured.sceneBounds : undefined : undefined;
          const generatedBounds = framing === 'body' ? modelBounds?.bodyBounds : framing === 'scene' ? modelBounds?.sceneBounds : undefined;
          if (bounds || generatedBounds) Object.assign(raw.config.viewport, bounds || generatedBounds);
          const f = Math.max(0.2, Math.min(2, zoom)) * scale;
          const pad = 10 + (1 / f - 1) * 50 + '%';
          Object.assign(raw.config.viewport, { padLeft: pad, padRight: pad, padTop: pad, padBottom: pad });
        };
        const redraw = () => raw.paused && raw.drawFrame(false);
        const controller: DragonController = {
          animations: names,
          canvas: raw.canvas,
          setAnimation(name) {
            if (!names.includes(name)) return;
            animation = name;
            raw.setAnimation(name, true);
            redraw();
          },
          setSpeed(value) {
            speed = value;
            raw.speed = value;
          },
          setPaused(value) {
            if (value) raw.pause();
            else raw.play();
          },
          setBackground(value) {
            raw.config.backgroundColor = value;
            redraw();
          },
          setZoom(value) {
            zoom = value;
            viewport();
            raw.setAnimation(animation, true);
            redraw();
          },
          setFraming(value) {
            framing = value;
            viewport();
            raw.setAnimation(animation, true);
            redraw();
          },
          snapshot() {
            raw.drawFrame(false);
            return new Promise((r) => raw.canvas.toBlob(r, 'image/png'));
          },
          dispose: cleanup,
        };
        raw.speed = speed;
        viewport();
        raw.setAnimation(animation, true);
        if (paused) raw.pause();
        resolve(controller);
      },
      error: (_: unknown, message: string) => {
        cleanup();
        reject(new Error(String(message)));
      },
    });
  });
}
