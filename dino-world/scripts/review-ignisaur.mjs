import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'output/ignisaur');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { port: 5207 } });
server.middlewares.use('/__review', (_, res) => res.end('<html><body style="margin:0;background:#182129"></body></html>'));
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 650 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__review', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#182129"></body></html>' }));
  await page.goto(server.resolvedUrls.local[0] + '__review');
  const result = await page.evaluate(async () => {
    const { recipeFor } = await import('/src/dino-lab/recipes.ts');
    const { createDino } = await import('/src/dino-lab/engine.ts');
    const { readyThumbnail } = await import('/src/dino-lab/thumbnails.ts');
    const { SPECIES, EVOLUTION_STAGES } = await import('/shared/game/index.ts');
    document.head.insertAdjacentHTML('beforeend', '<style>.dino-view .dino-spine-host,.dino-view .dino-spine-host>div,.dino-view canvas{width:100%!important;height:100%!important} body{display:flex;color:#fff;font:24px sans-serif}.card{width:500px;text-align:center}.dino-view{width:500px;height:560px}</style>');
    const rigs = [];
    window.reviewDinos = [];
    for (const stage of ['pui', 'juvenil', 'adult']) {
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `<h3>Ignisaur · ${stage}</h3><div class="dino-view"></div>`;
      document.body.append(card);
      const recipe = recipeFor('ignisaur', stage);
      const dino = await createDino(card.lastElementChild, recipe, { pad: 4 }, new AbortController().signal);
      window.reviewDinos.push(dino);
      rigs.push({ stage, rig: recipe.base.rig, animations: dino.allAnimations, thumbnail: readyThumbnail(recipe, 512) });
    }
    const missingThumbnails = SPECIES.flatMap(species => EVOLUTION_STAGES.filter(stage => !readyThumbnail(recipeFor(species.id, stage.id), 512)).map(stage => `${species.id}-${stage.id}`));
    return { rigs, missingThumbnails };
  });
  for (const animation of ['idle', 'walk', 'attack', 'ultimate']) {
    await page.evaluate(name => window.reviewDinos.forEach(dino => dino.setAnimation(name)), animation);
    await page.waitForTimeout(650);
    await page.screenshot({ path: path.join(out, `${animation}-three-ages.png`) });
  }
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newGame } = await import('/shared/game/index.ts');
    const now = Date.now();
    const state = newGame(now, 12345);
    state.buildings.push({ id: 'review-fire', kind: 'habitat', element: 'fire', level: 5, slot: 'world-fire', stored: 0, since: now });
    state.dinos = [1, 4, 7].map(level => ({ id: `ignisaur-review-${level}`, species: 'ignisaur', level, habitatId: 'review-fire' }));
    localStorage.setItem('dino-world-save-v3', JSON.stringify(state));
    localStorage.setItem('dino-world:first-steps', 'done');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.world-loader').waitFor({ state: 'hidden', timeout: 30000 });
  await page.locator('[data-tour="island-fire"]').dispatchEvent('click');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(out, 'fire-habitat.png') });
  await fs.writeFile(path.join(out, 'browser-validation.json'), JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }));
  if (errors.length || result.rigs.some(rig => !rig.thumbnail)) throw new Error('Ignisaur browser review failed');
} finally {
  await browser.close();
  await server.close();
}
