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

function measure(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('.view[data-view="service-request"] .card.metric')];
    return cards.map((c) => {
      const wrap = c.querySelector('.chart-wrap');
      const svg = wrap && wrap.querySelector('svg');
      const cs = wrap ? getComputedStyle(wrap) : null;
      return {
        title: (c.querySelector('.card-title') || {}).textContent,
        cardH: Math.round(c.getBoundingClientRect().height),
        cardMinH: getComputedStyle(c).minHeight,
        wrapH: wrap ? Math.round(wrap.getBoundingClientRect().height) : null,
        wrapClientH: wrap ? wrap.clientHeight : null,
        wrapFlex: cs ? cs.flex : null,
        svgBox: svg ? Math.round(svg.getBoundingClientRect().height) : null,
        svgViewBox: svg ? svg.getAttribute('viewBox') : null,
        svgWAttr: svg ? svg.getAttribute('width') : null,
        svgHAttr: svg ? svg.getAttribute('height') : null,
      };
    });
  });
}

for (const layout of ['default', 'flowy', 'flap']) {
  test(`service-request metric heights · layout=${layout}`, async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    await boot(page);
    await page.evaluate((l) => document.documentElement.setAttribute('data-layout', l), layout);
    await page.locator('.l1-children .l1-leaf[data-view="service-request"]').click();
    await expect(page.locator('.view[data-view="service-request"].active')).toBeVisible();
    await page.waitForTimeout(300);
    console.log(`layout=${layout}`, JSON.stringify(await measure(page), null, 2));
  });
}
