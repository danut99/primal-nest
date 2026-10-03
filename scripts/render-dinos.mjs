// Randează dinozaurii din modelele 3D gratuite (public/models, vezi CREDITS.md)
// în src/local-art/dinos/<specie>.png, cu fundal transparent. Setările sunt în src/content/dinoModels.ts.
// Cere serverul Vite pornit (npm run dev) și Chrome instalat.
//   node scripts/render-dinos.mjs                     → toate speciile
//   node scripts/render-dinos.mjs --only=mugurel,...  → doar unele
//   node scripts/render-dinos.mjs --preview=plansa.png → o planșă cu toate, pentru verificare
//   URL=http://127.0.0.1:5174 node scripts/render-dinos.mjs → alt port

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.URL ?? 'http://127.0.0.1:5173';
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const preview = arg('preview');
const only = arg('only')?.split(',');
const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('Eroare în pagină:', e.message));
await page.goto(`${base}/tools/render/index.html`);
await page.waitForFunction(() => window.renderReady === true, null, { timeout: 30000 });

const names = await page.evaluate(() => window.speciesNames);

if (preview) {
  const url = await page.evaluate(async (names) => {
    const cell = 240;
    const cols = 4;
    const c = document.createElement('canvas');
    c.width = cell * cols;
    c.height = cell * Math.ceil(names.length / cols);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#15131a';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < names.length; i++) {
      const img = new Image();
      img.src = await window.renderSpecies(names[i], cell);
      await img.decode();
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * cell;
      ctx.drawImage(img, x, y);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(names[i], x + 6, y + 16);
    }
    return c.toDataURL('image/png');
  }, names);
  save(preview, url);
  console.log('Planșă:', preview);
} else {
  mkdirSync('src/local-art/dinos', { recursive: true });
  for (const species of names) {
    if (only && !only.includes(species)) continue;
    const url = await page.evaluate((s) => window.renderSpecies(s), species);
    save(`src/local-art/dinos/${species}.png`, url);
    console.log('✓', species);
  }
}
await browser.close();
