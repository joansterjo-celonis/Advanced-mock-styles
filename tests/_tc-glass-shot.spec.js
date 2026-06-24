// TEMP: visual compare of glass illustration vs product. Delete after.
import { test } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });
const APP = '/Advanced-mock-styles/';
const STEP = (i) => `.tc-step[data-step="${i}"]`;

async function setGlass(page, value) {
  await page.evaluate((v) => {
    const card = [...document.querySelectorAll('.tc-range-card')].find((c) => c.querySelector('.tc-glass-scene'));
    const input = card?.querySelector('.tc-glass-simple input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.waitForTimeout(220);
}

test('glass illustration shots', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('proto-access-granted', 'yes');
    localStorage.setItem('fb-author', 'T');
  });
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForSelector('#theme-creator-open[data-tc-ready="true"]', { state: 'attached' });
  await page.$eval('#theme-creator-open', (el) => el.click());
  await page.waitForSelector('.tc-overlay.open .tc-stage', { state: 'visible' });

  for (const mode of ['light', 'dark']) {
    await page.click(STEP(0));
    await page.click(`.tc-option[data-key="appearance"][data-value="${mode}"]`);
    await page.click(STEP(1));
    await page.click('.tc-option[data-key="palette"][data-value="vivid"]');
    await page.click(STEP(2));
    await page.waitForTimeout(200);
    for (const g of [0, 60, 100]) {
      await setGlass(page, g);
      await page.locator('.tc-glass-scene').first().screenshot({ path: `tests/__shot-${mode}-${g}.png` });
    }
  }
});
