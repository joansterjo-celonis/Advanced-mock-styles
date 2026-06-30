// TEMP visual harness — dumps pattern-mode chart screenshots for review. Not a real test.
import { test } from '@playwright/test';
import fs from 'fs';

const APP = '/Advanced-mock-styles/';
const OUT = 'test-results/patshots';

async function boot(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('proto-access-granted', 'yes'); localStorage.setItem('fb-author', 'Test User'); } catch (e) {}
  });
  await page.goto(APP);
  await page.evaluate(() => {
    const rc = document.getElementById('route-context');
    rc.classList.remove('mode-overview'); rc.classList.add('mode-editor');
  });
}

const PANELS = ['charts', 'more', 'even', 'evencopy', 'play'];

test('dump pattern shots', async ({ page }) => {
  test.setTimeout(120000);
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1728, height: 1117 });
  await boot(page);

  // open the Rework & Quality view
  await page.evaluate(() => {
    const leaf = document.querySelector('.l1-leaf[data-view="rework-quality"]');
    if (leaf) leaf.click();
  });
  await page.waitForTimeout(400);

  // flat + patterns on
  await page.evaluate(() => {
    document.getElementById('c3d-default')?.click();
    document.getElementById('cfill-pattern')?.click();
  });
  await page.waitForTimeout(300);

  for (const palette of ['mono', 'color']) {
    await page.evaluate((p) => { document.getElementById('theme-' + p)?.click(); }, palette);
    await page.waitForTimeout(250);
    for (const panel of PANELS) {
      await page.evaluate((sub) => {
        const view = document.querySelector('.view[data-view="rework-quality"]');
        view.querySelectorAll('.rq-content').forEach((c) => { c.style.display = (c.dataset.rqcontent === sub) ? 'grid' : 'none'; });
        if (window.IA && window.IA.renderChartsIn) window.IA.renderChartsIn(view);
      }, panel);
      await page.waitForTimeout(450);
      const el = page.locator(`.rq-content[data-rqcontent="${panel}"]`);
      await el.screenshot({ path: `${OUT}/${palette}-${panel}.png` }).catch((e) => console.log('shot fail', panel, e.message));
    }
  }
  console.log('DONE shots ->', OUT);
});
