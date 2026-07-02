// TEMP verification: the P2P Analytics panels now use a varied vanilla+bespoke
// chart mix. Confirm every builder draws on each sub-tab, and that the bespoke
// ones survive per-chart iso/glass looks (3D code paths).
import { test, expect } from '@playwright/test';

const APP = '/Advanced-mock-styles/';
const VIEW = '.view[data-view="p2p-analytics"]';

async function boot(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('proto-access-granted', 'yes'); localStorage.setItem('fb-author', 'Test User'); } catch (e) {}
  });
  await page.goto(APP);
  await page.evaluate(() => {
    const rc = document.getElementById('route-context');
    rc.classList.remove('mode-overview');
    rc.classList.add('mode-editor');
  });
  await page.locator('.l1-children .l1-leaf[data-view="p2p-analytics"]').click();
  await expect(page.locator(VIEW + '.active')).toBeVisible();
  await page.waitForTimeout(300);
}

// count child <svg> nodes for a chart type inside the currently visible panel
const drawn = (page, type) => page.evaluate(([v, t]) => {
  const wraps = [...document.querySelectorAll(`${v} [data-p2p-panel] [data-chart="${t}"]`)]
    .filter(w => w.offsetParent !== null); // visible panel only
  return wraps.map(w => { const s = w.querySelector('svg'); return s ? s.querySelectorAll('*').length : 0; });
}, [VIEW, type]);

async function expectDrawn(page, types) {
  for (const t of types) {
    const counts = await drawn(page, t);
    expect(counts.length, `${t} present`).toBeGreaterThan(0);
    for (const c of counts) expect(c, `${t} has nodes`).toBeGreaterThan(0);
  }
}

// force a per-chart look on the visible panel and re-render; assert nothing blanks out
async function withLook(page, look, types) {
  await page.evaluate(([v, l]) => {
    document.querySelectorAll(`${v} [data-p2p-panel] .chart-wrap`).forEach(w => {
      if (w.offsetParent !== null) w.setAttribute('data-chart-look', l);
    });
    if (window.IA) window.IA.renderChartsIn(document.querySelector(`${v}`));
  }, [VIEW, look]);
  await page.waitForTimeout(150);
  await expectDrawn(page, types);
  await page.evaluate((v) => {
    document.querySelectorAll(`${v} [data-p2p-panel] .chart-wrap`).forEach(w => w.removeAttribute('data-chart-look'));
    if (window.IA) window.IA.renderChartsIn(document.querySelector(`${v}`));
  }, VIEW);
  await page.waitForTimeout(120);
}

test('P2P Analytics — creative chart mix renders on every sub-tab (flat/iso/glass)', async ({ page }) => {
  await boot(page);

  // --- KPI Overview: bullet + dotgrid waffle + linechart + funnel ---
  const kpiTypes = ['bullet', 'dotgrid', 'linechart', 'funnel'];
  await expectDrawn(page, kpiTypes);
  await page.locator(VIEW + ' [data-p2p-panel="kpi"]').screenshot({ path: 'test-results/p2p-kpi.png' });
  await withLook(page, 'iso', kpiTypes);
  await withLook(page, 'glass', kpiTypes);

  // --- Cycle Time: linechart + dotplot + bubble + barcat + heatmap ---
  await page.locator(VIEW + ' .subtab[data-p2psub="cycle"]').click();
  await page.waitForTimeout(300);
  const cycleTypes = ['linechart', 'dotplot', 'bubble', 'barcat', 'heatmap'];
  await expectDrawn(page, cycleTypes);
  await page.locator(VIEW + ' [data-p2p-panel="cycle"]').screenshot({ path: 'test-results/p2p-cycle.png' });
  await withLook(page, 'iso', cycleTypes);
  await withLook(page, 'glass', cycleTypes);

  // --- Approval Workflow: funnel + hbarcat + linechart + dotplot + barcat + heatmap ---
  await page.locator(VIEW + ' .subtab[data-p2psub="approval"]').click();
  await page.waitForTimeout(300);
  const apprTypes = ['funnel', 'hbarcat', 'linechart', 'dotplot', 'barcat', 'heatmap'];
  await expectDrawn(page, apprTypes);
  await page.locator(VIEW + ' [data-p2p-panel="approval"]').screenshot({ path: 'test-results/p2p-approval.png' });
  await withLook(page, 'iso', apprTypes);
  await withLook(page, 'glass', apprTypes);

  // counters still animate on the last-revealed panel
  const counters = await page.evaluate((v) => {
    const els = [...document.querySelectorAll(`${v} [data-counter]`)].filter(e => e.offsetParent !== null);
    return { n: els.length, sample: els.slice(0, 3).map(e => e.textContent) };
  }, VIEW);
  expect(counters.n).toBeGreaterThan(0);
});
