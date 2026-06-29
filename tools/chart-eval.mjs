// Dev-only visual eval harness for the glass pie/donut work.
// Boots a headless Chromium against the running Vite dev server, flips charts
// into Glass mode, and screenshots the donut + pie cards so we can iterate on
// the look. Not shipped. Usage: node tools/chart-eval.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = process.env.APP || 'http://localhost:5173/Advanced-mock-styles/';
const OUT = process.argv[2] || 'tools/.chart-eval';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });

await page.addInitScript(() => {
  try {
    localStorage.setItem('proto-access-granted', 'yes');
    localStorage.setItem('fb-author', 'Test User');
  } catch (e) {}
});

await page.goto(APP, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const rc = document.getElementById('route-context');
  if (rc) { rc.classList.remove('mode-overview'); rc.classList.add('mode-editor'); }
});

// Match the user's environment: Color theme + chosen 3D look (full scope).
const MODE = process.env.MODE || 'glass'; // 'glass' | 'iso'
await page.evaluate(() => {
  const tc = document.getElementById('theme-color');
  if (tc) tc.click();
});
if (process.env.DARK) {
  await page.evaluate(() => { const b = document.getElementById('mode-dark'); if (b) b.click(); });
}
await page.waitForTimeout(150);
await page.evaluate((mode) => {
  document.documentElement.setAttribute('data-3dscope', 'full');
  const b = document.getElementById(mode === 'iso' ? 'c3d-iso' : 'c3d-glass');
  if (b) b.click(); else document.documentElement.setAttribute('data-charts3d', mode);
}, MODE);
await page.waitForTimeout(300);

async function gotoView(view) {
  await page.evaluate((v) => {
    const leaf = document.querySelector(`.l1-leaf[data-view="${v}"]`);
    if (leaf) leaf.click();
  }, view);
  await page.waitForSelector(`.view[data-view="${view}"].active`, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function shotCard(view, chart, name) {
  const card = page.locator(`.view[data-view="${view}"].active .card:has([data-chart="${chart}"])`).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  await card.screenshot({ path: `${OUT}/${name}.png` });
  // Also a tight crop of just the chart svg for close inspection.
  const svg = page.locator(`.view[data-view="${view}"].active .card:has([data-chart="${chart}"]) [data-chart="${chart}"] svg`).first();
  await svg.screenshot({ path: `${OUT}/${name}-svg.png` }).catch(() => {});
}

await gotoView('order-management');
await shotCard('order-management', 'donut', 'donut');

await gotoView('rework-quality');
await shotCard('rework-quality', 'pie', 'pie');

await gotoView('ocpm-activity');
await shotCard('ocpm-activity', 'pie', 'ocpm-pie');
// also grab the whole second bento row so we can compare with sibling legends
const row = page.locator('.view[data-view="ocpm-activity"].active .ocpm2-content').first();
await row.screenshot({ path: `${OUT}/ocpm-row.png` }).catch(() => {});

await browser.close();
console.log('eval screenshots written to', OUT);
