// ============================================================
//  Feedback preview restore regression suite.
// ============================================================

import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const APP = '/Advanced-mock-styles/';
const FEEDBACK_BIN = '6a3a29afda38895dfeefd1c8';
const BIN_KEY = `cloud-bin-${FEEDBACK_BIN}`;
const PENDING_KEY = `cloud-pending-${FEEDBACK_BIN}`;
const TAB = (v) => `#main .tabs .ia-tab[data-view="${v}"]`;
const VIEW = (v) => `#content .view[data-view="${v}"]`;
const BASE_RECT = { x: 260, y: 210, w: 180, h: 92 };

function feedbackEntry({
  id = 'fb-test',
  viewId = 'purchase-order',
  sub = null,
  scroll = { source: 'ctx-canvas', top: 0, viewId },
  rect = BASE_RECT,
  oldShape = false,
} = {}) {
  const base = {
    id,
    author: 'Test User',
    text: `Preview ${viewId}`,
    ts: Date.now() - 1000,
    controls: null,
    viewport: { w: 1440, h: 900 },
    rect,
    anchor: null,
  };
  const view = { id: viewId, sub, scroll: scroll.top || 0 };
  if (oldShape) return { ...base, view };
  return {
    ...base,
    screen: {
      route: 'context',
      contextMode: 'editor',
      viewId,
      tabViewId: viewId,
      sub,
      scroll,
      viewport: { w: 1440, h: 900 },
      rootAttrs: {},
      split: { active: false },
    },
    view,
  };
}

async function boot(page, items = []) {
  await page.route('https://api.jsonbin.io/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items, updatedAt: Date.now() }) });
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ record: { items, updatedAt: Date.now() } }) });
    }
  });
  await page.addInitScript(({ binKey, pendingKey, seed }) => {
    try {
      localStorage.setItem('proto-access-granted', 'yes');
      localStorage.setItem('fb-author', 'Test User');
      localStorage.setItem(binKey, JSON.stringify({ items: seed, updatedAt: Date.now() }));
      localStorage.removeItem(pendingKey);
    } catch (e) {}
  }, { binKey: BIN_KEY, pendingKey: PENDING_KEY, seed: items });
  await page.goto(APP);
  await expect(page.locator('#fab-feedback')).toBeVisible();
}

async function enterEditor(page) {
  await page.evaluate(() => {
    const rc = document.getElementById('route-context');
    rc.classList.remove('mode-overview');
    rc.classList.add('mode-editor');
  });
  await expect(page.locator(TAB('order-management'))).toBeVisible();
}

async function openFirstFeedback(page) {
  await page.locator('#fab-feedback').click();
  await page.locator('.fb-menu-item[data-act="see"]').click();
  await expect(page.locator('.fb-row-main')).toHaveCount(1);
  await page.locator('.fb-row-main').first().click();
  await expect(page.locator('.fb-viewbar')).toBeVisible();
  await expect(page.locator('.fb-marker')).toBeVisible();
}

async function attachPage(testInfo, name, page) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

async function expectMarkerNear(page, rect = BASE_RECT) {
  const box = await page.locator('.fb-marker-rect').boundingBox();
  expect(box).toBeTruthy();
  expect(Math.abs(box.x - rect.x)).toBeLessThan(6);
  expect(Math.abs(box.y - rect.y)).toBeLessThan(6);
  expect(Math.abs(box.width - rect.w)).toBeLessThan(6);
  expect(Math.abs(box.height - rect.h)).toBeLessThan(6);
}

test('preview from overview jumps into the captured asset screen', async ({ page }, testInfo) => {
  const item = feedbackEntry({ id: 'fb-overview', viewId: 'order-management', scroll: { source: 'ctx-canvas', top: 160, viewId: 'order-management' } });
  await boot(page, [item]);
  await expect(page.locator('#route-context')).toHaveClass(/mode-overview/);
  await attachPage(testInfo, 'before-overview-preview', page);

  await openFirstFeedback(page);

  await expect(page.locator('#route-context')).toHaveClass(/mode-editor/);
  await expect(page.locator(`${VIEW('order-management')}.active`)).toBeVisible();
  await expect.poll(() => page.locator('.ctx-canvas').evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await expectMarkerNear(page);
  await attachPage(testInfo, 'after-overview-preview', page);
});

test('preview from another route returns to Context Models editor', async ({ page }) => {
  const sub = { attr: 'data-ocsub', val: 'valid' };
  await boot(page, [feedbackEntry({ id: 'fb-route', viewId: 'ocpm-adoption', sub })]);
  await page.evaluate(() => {
    const app = document.getElementById('app');
    const routes = { home: 'route-home', studio: 'route-studio', context: 'route-context', datalake: 'route-datalake', space: 'route-space' };
    Object.keys(routes).forEach((k) => {
      const el = document.getElementById(routes[k]);
      if (el) el.classList.toggle('active', k === 'home');
    });
    if (app) app.dataset.route = 'home';
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === 'home'));
  });
  await expect(page.locator('#app')).toHaveAttribute('data-route', 'home');

  await openFirstFeedback(page);

  await expect(page.locator('#app')).toHaveAttribute('data-route', 'context');
  await expect(page.locator('#route-context')).toHaveClass(/mode-editor/);
  await expect(page.locator(`${VIEW('ocpm-adoption')}.active`)).toBeVisible();
  await expect(page.locator(`${VIEW('ocpm-adoption')} .subtab[data-ocsub="valid"]`)).toHaveClass(/(^|\s)on(\s|$)/);
});

test('preview reopens a closed target tab', async ({ page }) => {
  await boot(page, [feedbackEntry({ id: 'fb-closed', viewId: 'purchase-order' })]);
  await enterEditor(page);
  await page.locator(TAB('purchase-order')).evaluate((tab) => tab.remove());
  await expect(page.locator(TAB('purchase-order'))).toHaveCount(0);

  await openFirstFeedback(page);

  await expect(page.locator(TAB('purchase-order'))).toBeVisible();
  await expect(page.locator(TAB('purchase-order'))).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(page.locator(`${VIEW('purchase-order')}.active`)).toBeVisible();
});

test('preview exits split view before restoring the captured screen', async ({ page }, testInfo) => {
  await boot(page, [feedbackEntry({ id: 'fb-split-preview', viewId: 'purchase-order' })]);
  await enterEditor(page);
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);
  await attachPage(testInfo, 'before-split-preview', page);

  await openFirstFeedback(page);

  await expect(page.locator('.sv-split')).toHaveCount(0);
  await expect(page.locator(`${VIEW('purchase-order')}.active`)).toBeVisible();
  await expect(page.locator('.fb-marker')).toBeVisible();
  await attachPage(testInfo, 'after-split-preview', page);
});

test('creating feedback in split view captures the marked pane screen', async ({ page }) => {
  await boot(page, []);
  await enterEditor(page);
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  const right = await page.locator('.sv-pane-right > .view[data-view="purchase-order"]').boundingBox();
  await page.locator('#fab-feedback').click();
  await page.locator('.fb-menu-item[data-act="give"]').click();
  await page.mouse.move(right.x + 80, right.y + 110);
  await page.mouse.down();
  await page.mouse.move(right.x + 230, right.y + 190, { steps: 8 });
  await page.mouse.up();
  await page.locator('.fb-textarea').fill('Right pane capture');
  await page.locator('.fb-submit').click();

  await expect(page.locator('.fb-toast')).toBeVisible();
  const saved = await page.evaluate((key) => {
    const doc = JSON.parse(localStorage.getItem(key) || '{"items":[]}');
    return doc.items[doc.items.length - 1];
  }, BIN_KEY);
  expect(saved.screen.viewId).toBe('purchase-order');
  expect(saved.screen.split.active).toBe(true);
  expect(saved.screen.split.pane).toBe('right');
  expect(saved.view.id).toBe('purchase-order');
});

[
  { viewId: 'order-management', attr: 'data-sub', val: 'process' },
  { viewId: 'rework-quality', attr: 'data-rqsub', val: 'more' },
  { viewId: 'ocpm-adoption', attr: 'data-ocsub', val: 'valid' },
  { viewId: 'ocpm-activity', attr: 'data-acsub', val: 'summary' },
  { viewId: 'inventory-cockpit', attr: 'data-invsub', val: 'batch' },
  { viewId: 'ocpm-history', attr: 'data-shsub', val: 'status' },
  { viewId: 'tracking-analysis', attr: 'data-trsub', val: 'criteria' },
].forEach(({ viewId, attr, val }) => {
  test(`preview restores ${attr} for ${viewId}`, async ({ page }) => {
    await boot(page, [feedbackEntry({ id: `fb-${attr}`, viewId, sub: { attr, val } })]);

    await openFirstFeedback(page);

    await expect(page.locator(`${VIEW(viewId)}.active`)).toBeVisible();
    await expect(page.locator(`${VIEW(viewId)} .subtab[${attr}="${val}"]`)).toHaveClass(/(^|\s)on(\s|$)/);
  });
});

test('old feedback entries with only view data still replay', async ({ page }) => {
  const sub = { attr: 'data-rqsub', val: 'more' };
  await boot(page, [feedbackEntry({ id: 'fb-old', viewId: 'rework-quality', sub, oldShape: true })]);

  await openFirstFeedback(page);

  await expect(page.locator(`${VIEW('rework-quality')}.active`)).toBeVisible();
  await expect(page.locator(`${VIEW('rework-quality')} .subtab[data-rqsub="more"]`)).toHaveClass(/(^|\s)on(\s|$)/);
  await expectMarkerNear(page);
});
