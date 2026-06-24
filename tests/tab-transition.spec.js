// ============================================================
//  Tab transition (slide-fade) — state-leak regression suite.
// ============================================================
// The Slide transition animates views with WAAPI fill:'forwards' animations.
// If those animations aren't cancelled on teardown they keep applying their
// final opacity/transform AFTER the inline styles are cleared, so a view can
// end up the single .active view yet be fully invisible (a blank screen). This
// guards the two ways a user hit that: navigating back in DEFAULT mode to a
// view that was previously slid away, and rapid switching that overlaps the
// 380ms animation.

import { test, expect } from '@playwright/test';

const APP = '/Advanced-mock-styles/';
const TAB = (v) => `#main .tabs .ia-tab[data-view="${v}"]`;

async function bootEditor(page) {
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
  await expect(page.locator(TAB('order-management'))).toBeVisible();
}

const setFx = (page, mode) => page.evaluate((m) => document.getElementById(m === 'slide' ? 'tabfx-slide' : 'tabfx-flat').click(), mode);

// The exact state that produced the blank screen: single active view, no leftover
// .fx-face / fx-scene, and the active view actually visible (opacity 1, real size).
async function activeViewState(page) {
  return page.evaluate(() => {
    const actives = [...document.querySelectorAll('.view.active')];
    const a = actives[0];
    const r = a && a.getBoundingClientRect();
    return {
      activeCount: actives.length,
      activeView: a ? a.dataset.view : null,
      opacity: a ? parseFloat(getComputedStyle(a).opacity) : null,
      height: a ? Math.round(r.height) : 0,
      faces: [...document.querySelectorAll('.view.fx-face')].length,
      scene: document.getElementById('content').classList.contains('fx-scene'),
    };
  });
}

test.beforeEach(async ({ page }) => { await bootEditor(page); });

test('slide-away then default navigation back leaves the view visible (no opacity-0 leak)', async ({ page }) => {
  await setFx(page, 'slide');

  // Slide away from order-management → it becomes the "old" view and gets a fill:forwards
  // exit animation that used to linger at opacity:0.
  await page.locator(TAB('purchase-order')).click();
  await page.waitForTimeout(500); // let the slide settle

  // Switch the transition knob to Default, then navigate BACK. The default path only toggles
  // .active — so a lingering exit animation would render order-management active-but-invisible.
  await setFx(page, 'flat');
  await page.locator(TAB('order-management')).click();
  await page.waitForTimeout(50);

  const s = await activeViewState(page);
  expect(s.activeCount).toBe(1);
  expect(s.activeView).toBe('order-management');
  expect(s.faces).toBe(0);
  expect(s.scene).toBe(false);
  expect(s.opacity).toBeGreaterThan(0.99);
  expect(s.height).toBeGreaterThan(50);
});

test('slide plays for registered tabs too, not just the first three static tabs', async ({ page }) => {
  await setFx(page, 'slide');

  // `insights` is a registered (dynamic) tab — these fire selectView TWICE per click (their own
  // listener + the delegated strip handler). The duplicate call must not snap the slide shut.
  // Read the state synchronously right after the click, mid-flight, so the slide is still running.
  const mid = await page.evaluate((sel) => {
    document.querySelector(sel).click();
    return {
      faces: document.querySelectorAll('.view.fx-face').length,
      scene: document.getElementById('content').classList.contains('fx-scene'),
    };
  }, TAB('insights'));
  expect(mid.faces).toBe(2);   // both old + new view are sliding
  expect(mid.scene).toBe(true);

  // …and it settles to a single, visible insights view.
  await page.waitForTimeout(600);
  const s = await activeViewState(page);
  expect(s.activeCount).toBe(1);
  expect(s.activeView).toBe('insights');
  expect(s.faces).toBe(0);
  expect(s.scene).toBe(false);
  expect(s.opacity).toBeGreaterThan(0.99);
});

test('rapid slide switching never leaves a stuck / invisible active view', async ({ page }) => {
  await setFx(page, 'slide');

  // Fire switches faster than the 380ms animation so each one interrupts the last.
  const order = ['purchase-order', 'rework-quality', 'order-management'];
  for (let i = 0; i < 12; i++) {
    await page.locator(TAB(order[i % order.length])).click();
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(600); // safety-net window for any teardown

  const s = await activeViewState(page);
  expect(s.activeCount).toBe(1);
  expect(s.faces).toBe(0);
  expect(s.scene).toBe(false);
  expect(s.opacity).toBeGreaterThan(0.99);
  expect(s.height).toBeGreaterThan(50);
});
