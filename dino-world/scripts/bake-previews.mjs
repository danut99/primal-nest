// Miniaturile gata făcute (public/dinosaurs/previews/*.webp + src/dino-lab/previews.json): fiecare specie, la
// fiecare vârstă, desenată cu motorul jocului, ca harta și listele să nu pornească WebGL pentru ele.
//   node scripts/bake-previews.mjs
// Rulează după build-trex.mjs / build-species.mjs sau după ce schimbi rețetele. Are nevoie de Chrome și de
// playwright-core (din dino-world sau din proiectul părinte, primal-nest).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/dinosaurs/previews');
const SIZE = 512;
const ONLY = process.argv.slice(2);

function playwright() {
  for (const base of [ROOT, path.join(ROOT, '..')]) {
    try {
      return createRequire(path.join(base, 'package.json'))('playwright-core');
    } catch {}
  }
  throw new Error('Lipsește playwright-core (npm i -D playwright-core).');
}
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && fs.existsSync(p));

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
// o pagină goală pe același server, ca modulele jocului să se încarce prin Vite
server.middlewares.use('/__bake', (_, res) => res.end('<!doctype html><html><head></head><body></body></html>'));
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await playwright().chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pagină]', e.message));
  await page.goto(url + '__bake');
  const shots = await page.evaluate(async ({size, only}) => {
    const game = await import('/shared/game/index.ts');
    const { recipeFor } = await import('/src/dino-lab/recipes.ts');
    const { createDino } = await import('/src/dino-lab/engine.ts');
    const { thumbnailRecipeKey } = await import('/src/dino-lab/thumbnail-key.ts');
    const css = document.createElement('style');
    css.textContent = '.dino-view .dino-spine-host,.dino-view .dino-spine-host>div,.dino-view canvas{width:100%!important;height:100%!important}';
    document.head.append(css);
    const out = [];
    for (const species of game.SPECIES.filter((s) => !only.length || only.includes(s.id)))
      for (const stage of game.EVOLUTION_STAGES) {
        const recipe = recipeFor(species.id, stage.id);
        const host = document.createElement('div');
        host.className = 'dino-view';
        host.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px`;
        document.body.append(host);
        const dino = await createDino(host, recipe, { still: true, pad: 4 }, new AbortController().signal);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const png = await dino.snapshot();
        const bitmap = await createImageBitmap(png);
        const canvas = new OffscreenCanvas(size, size);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, size, size);
        const rgba = canvas.getContext('2d').getImageData(0, 0, size, size).data;
        let x0 = size, y0 = size, x1 = -1, y1 = -1;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          if (rgba[(y * size + x) * 4 + 3] <= 20) continue;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        const bounds = x1 < 0 ? undefined : {x:x0, y:y0, width:x1-x0+1, height:y1-y0+1, imageWidth:size, imageHeight:size};
        const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
        const bytes = new Uint8Array(await webp.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        out.push({ file: `${species.id}-${stage.id}.webp`, key: thumbnailRecipeKey(recipe), data: btoa(bin), bounds });
        dino.dispose();
        host.remove();
      }
    return out;
  }, {size: SIZE, only: ONLY});
  if (!ONLY.length) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const mapFile = path.join(ROOT, 'src/dino-lab/previews.json');
  const map = ONLY.length && fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {};
  const boundsFile = path.join(ROOT, 'src/dino-lab/preview-bounds.json');
  const bounds = ONLY.length && fs.existsSync(boundsFile) ? JSON.parse(fs.readFileSync(boundsFile, 'utf8')) : {};
  for (const s of shots) {
    fs.writeFileSync(path.join(OUT, s.file), Buffer.from(s.data, 'base64'));
    map[s.key] = `dinosaurs/previews/${s.file}`;
    if (s.bounds) bounds[map[s.key]] = s.bounds;
  }
  fs.writeFileSync(path.join(ROOT, 'src/dino-lab/previews.json'), JSON.stringify(map, null, 2) + '\n');
  fs.writeFileSync(boundsFile, JSON.stringify(bounds, null, 2) + '\n');
  console.log(`${shots.length} miniaturi în public/dinosaurs/previews`);
} finally {
  await browser.close();
  await server.close();
}
