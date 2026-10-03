// Imaginile statice ale dragonilor (liste, cartonașe, Atlas): fiecare specie și fiecare boss, randate cu același
// motor ca în joc, în poza de repaus, decupate strâns pe fundal transparent → public/dragons/stills/*.webp.
//   npm run dev            (în alt terminal)
//   npm run stills [-- http://127.0.0.1:5173]

import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = new URL('../public/dragons/stills/', import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.goto(url + '/#stills');

const jobs = await page.evaluate(async () => {
  const { SPECIES } = await import('/shared/game/index.ts');
  const { ZONE_BOSS } = await import('/src/content/dragons.ts');
  return [
    ...Object.keys(SPECIES).map((id) => ({ kind: 'species', id })),
    ...Object.keys(ZONE_BOSS).map((id) => ({ kind: 'boss', id })),
  ];
});

for (const job of jobs) {
  const data = await page.evaluate(async ({ kind, id }) => {
    const { createLabDragon } = await import('/src/dragon-lab/engine.ts');
    const { speciesRecipe, bossRecipe } = await import('/src/content/dragons.ts');
    const recipe = kind === 'boss' ? bossRecipe(id) : speciesRecipe(id);
    document.querySelectorAll('.stills-host').forEach((e) => e.remove());
    const host = document.createElement('div');
    host.className = 'dragon-player stills-host';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:9999;width:800px;height:800px;min-height:0;aspect-ratio:auto';
    document.body.append(host);
    const dragon = await createLabDragon(
      host,
      recipe,
      { paused: true, fixedViewport: true },
      new AbortController().signal,
    );
    const blob = await dragon.snapshot();
    dragon.dispose();
    // Decupaj strâns pe pixelii vizibili, cu o margine mică.
    const img = await createImageBitmap(blob);
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, img.width, img.height);
    let x0 = img.width,
      y0 = img.height,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        if (px[(y * img.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const pad = 6;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(img.width - 1, x1 + pad);
    y1 = Math.min(img.height - 1, y1 + pad);
    const crop = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1);
    crop.getContext('2d').drawImage(img, -x0, -y0);
    const webp = await crop.convertToBlob({ type: 'image/webp', quality: 0.9 });
    const bytes = new Uint8Array(await webp.arrayBuffer());
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, job);
  const name = job.kind === 'boss' ? `boss-${job.id}` : job.id;
  writeFileSync(new URL(name + '.webp', out), Buffer.from(data, 'base64'));
  console.log(name);
}
await browser.close();
