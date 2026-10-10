import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = new URL('../output/wiki/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5211 } });
await server.listen();
const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(async () => {
    const { newGame } = await import('/shared/game/index.ts');
    localStorage.setItem('dino-world-save-v3', JSON.stringify(newGame(Date.now(), 12345)));
    localStorage.setItem('dino-world:first-steps', 'done');
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  const trigger = page.locator('[data-tour="wikipedia"]');
  await trigger.waitFor();
  await page.locator('.world-loader').waitFor({ state: 'hidden', timeout: 60000 });
  const audit = await page.evaluate(async () => {
    const { WIKI_ARTICLES, WIKI_BY_ID } = await import('/src/content/wiki.ts');
    const { SPECIES, ELEMENT_IDS, BUILDINGS, ITEMS } = await import('/shared/game/index.ts');
    const missing = [
      ...SPECIES.map((s) => 'species-' + s.id),
      ...ELEMENT_IDS.map((e) => 'world-' + e),
      ...Object.keys(BUILDINGS).map((k) => 'building-' + k),
      ...Object.keys(ITEMS).map((id) => 'item-' + id),
    ].filter((id) => !WIKI_BY_ID.has(id));
    const brokenLinks = WIKI_ARTICLES.flatMap((a) => (a.related ?? []).filter((id) => !WIKI_BY_ID.has(id)));
    const images = await Promise.all(
      WIKI_ARTICLES.filter((a) => a.image).map(async (a) => ({ id: a.id, ok: (await fetch('/' + a.image)).ok })),
    );
    return { articles: WIKI_ARTICLES.length, missing, brokenLinks, images };
  });
  if (audit.missing.length || audit.brokenLinks.length || audit.images.some((i) => !i.ok))
    throw Error('Incomplete wiki catalog: ' + JSON.stringify(audit));
  await page.screenshot({ path: fileURLToPath(new URL('button-desktop.png', out)) });
  await trigger.click();
  await page.getByRole('dialog', { name: 'Wikipedia' }).waitFor();
  const closeBounds=await page.getByRole('dialog',{name:'Wikipedia'}).getByRole('button',{name:'Închide',exact:true}).boundingBox(),dialogBounds=await page.locator('.wiki-modal').boundingBox();
  if(closeBounds.x<dialogBounds.x||closeBounds.x+closeBounds.width>dialogBounds.x+dialogBounds.width+1)throw Error('Close button outside Wikipedia');
  await page.screenshot({ path: fileURLToPath(new URL('desktop.png', out)) });
  const input = page.getByRole('searchbox', { name: 'Caută în Wikipedia' });
  await input.fill('imperechere');
  await page
    .locator('.wiki-card')
    .filter({ has: page.getByRole('heading', { name: 'Împerecherea în Bârlog', exact: true }) })
    .click();
  await page.getByRole('heading', { name: 'Împerecherea în Bârlog', exact: true }).waitFor();
  if (!(await page.locator('.wiki-article').getByText('Ignisaur', { exact: true }).count()))
    throw Error('Breeding recipes missing');
  await page.screenshot({ path: fileURLToPath(new URL('breeding.png', out)) });
  await input.fill('Ignisaur');
  await page
    .locator('.wiki-card')
    .filter({ has: page.getByRole('heading', { name: 'Ignisaur', exact: true }) })
    .click();
  await page.getByRole('heading', { name: 'Ignisaur', exact: true }).waitFor();
  await page.locator('.wiki-nav').getByRole('button',{name:/Clădiri/}).click();
  await page.locator('.wiki-card').filter({has:page.getByRole('heading',{name:'Forja',exact:true})}).click();
  await page.locator('.wiki-illustration').evaluate(async img=>{await img.decode();});
  await page.screenshot({path:fileURLToPath(new URL('forge.png',out))});
  await input.fill('nimic-de-acest-fel');
  await page.getByRole('heading', { name: 'Niciun articol găsit' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Wikipedia' }).waitFor({ state: 'hidden' });
  if (!(await trigger.evaluate((e) => e === document.activeElement))) throw Error('Focus not returned to Wikipedia');
  const layouts = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await trigger.boundingBox();
    if (bounds.x < 0 || bounds.x + bounds.width > width) throw Error('Button outside viewport');
    await trigger.click();
    await page.getByRole('dialog', { name: 'Wikipedia' }).waitFor();
    const overflow = await page.evaluate(() => {
      const modal = document.querySelector('.wiki-modal'),
        content = document.querySelector('.wiki-content');
      return {
        page: document.documentElement.scrollWidth > innerWidth,
        modal: modal.scrollWidth > modal.clientWidth + 1,
        content: content.scrollWidth > content.clientWidth + 1,
      };
    });
    if (Object.values(overflow).some(Boolean)) throw Error('Wiki overflow ' + width + ': ' + JSON.stringify(overflow));
    await page.screenshot({ path: fileURLToPath(new URL('mobile-' + width + '.png', out)) });
    await input.fill('foc');
    await page
      .locator('.wiki-card')
      .filter({ has: page.getByRole('heading', { name: 'Lumea de Foc', exact: true }) })
      .click();
    await page.locator('.wiki-illustration').evaluate(async (img) => {
      await img.decode();
    });
    await page.screenshot({ path: fileURLToPath(new URL('world-' + width + '.png', out)) });
    await page.getByRole('dialog',{name:'Wikipedia'}).getByRole('button',{name:'Închide',exact:true}).click();
    layouts.push({ width, overflow });
  }
  const result = { ...audit, layouts, errors };
  await fs.writeFile(new URL('review.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
