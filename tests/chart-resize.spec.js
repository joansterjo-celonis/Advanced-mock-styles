// ============================================================
//  Chart resize growth — regression suite.
// ============================================================
// hbarcat draws a preserveAspectRatio:none SVG whose viewBox is sized from the live
// clientWidth/Height. Inside a metric card's AUTO grid-row, an in-flow SVG let that viewBox
// aspect ratio drive the row height: shrinking the window baked a near-square viewBox, and
// growing it again made the stale aspect balloon the card (then the debounced re-render read
// the inflated height and baked it in — a permanent measure→write→measure growth loop). The
// SVG is now pinned out of flow in .metric cards, so the chart can never dictate the card
// height. This guards that fix without regressing the responsive width / OCPM hbar charts.

import { test, expect } from '@playwright/test';

const APP = '/Advanced-mock-styles/';

async function boot(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('proto-access-granted', 'yes');
      localStorage.setItem('fb-author', 'Test User');
    } catch (e) {}
  });
  await page.goto(APP);
  await page.evaluate(() => {
    const rc = document.getElementById('route-context');
    rc.classList.remove('mode-overview');
    rc.classList.add('mode-editor');
  });
}

const metricCardHeights = (page) => page.$$eval(
  '.view[data-view="service-request"] .card.metric',
  (els) => els.map((c) => Math.round(c.getBoundingClientRect().height)),
);

test('hbarcat metric card never grows across small→large window resizes', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  await boot(page);
  await page.locator('.l1-children .l1-leaf[data-view="service-request"]').click();
  await expect(page.locator('.view[data-view="service-request"].active')).toBeVisible();
  await page.waitForTimeout(250);

  const baseline = await metricCardHeights(page);
  expect(baseline.length).toBeGreaterThan(0);
  for (const h of baseline) expect(h).toBeLessThanOrEqual(360);

  // Shrink (bakes a narrow viewBox), then grow — the exact trigger. Check mid-flight (before the
  // debounced re-render) AND after it settles: the card must stay put either way.
  for (let i = 0; i < 4; i++) {
    await page.setViewportSize({ width: 460, height: 1117 });
    await page.waitForTimeout(180);
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.waitForTimeout(40);
    for (const h of await metricCardHeights(page)) expect(h).toBeLessThanOrEqual(360);
    await page.waitForTimeout(220);
    for (const h of await metricCardHeights(page)) expect(h).toBeLessThanOrEqual(360);
  }

  // The pinned SVG still fills its wrap and draws its bars (responsiveness intact).
  const drawn = await page.evaluate(() => {
    const svg = document.querySelector('.metric > .chart-wrap[data-chart="hbarcat"] > svg');
    return { pos: svg ? getComputedStyle(svg).position : null, bars: svg ? svg.querySelectorAll('rect,path').length : 0 };
  });
  expect(drawn.pos).toBe('absolute');
  expect(drawn.bars).toBeGreaterThan(0);
});

test('OCPM hbar charts keep their in-flow, content-sized height (fix is scoped)', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  await boot(page);
  await page.locator('.l1-children .l1-leaf[data-view="ocpm-adoption"]').click();
  await expect(page.locator('.view[data-view="ocpm-adoption"].active')).toBeVisible();
  await page.waitForTimeout(300);

  const ocpm = await page.evaluate(() => {
    const w = document.querySelector('.chart-wrap[data-chart="hbarcat"].ocpm-hbar');
    const svg = w && w.querySelector('svg');
    return { wrapH: w ? Math.round(w.getBoundingClientRect().height) : null, svgPos: svg ? getComputedStyle(svg).position : null };
  });
  expect(ocpm.svgPos).toBe('static');
  expect(ocpm.wrapH).toBeGreaterThan(120);
});
