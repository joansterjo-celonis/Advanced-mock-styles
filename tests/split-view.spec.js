// ============================================================
//  Side-by-side asset split — end-to-end regression suite.
// ============================================================
// Run:  npm test            (boots Vite + Chromium automatically)
//
// These specs guard the two things the feature promised: that the split
// behaves correctly, AND that it does not destabilize the single-view shell.
//
// ── MANUAL REGRESSION CHECKLIST (run once per release if not automating) ──
//   Single view (must be UNCHANGED):
//     [ ] Left-click each tab still switches assets (with slide fx).
//     [ ] Edit panel, filter drawer, sub-tabs still work.
//     [ ] Sticky asset header gains its shadow on scroll.
//     [ ] Default AND Flowy layouts, light AND dark — all intact.
//   Split:
//     [ ] Right-click an inactive tab → "Open side by side"; right-click the
//         active/shown tab → no custom menu.
//     [ ] Two assets render side by side, each with its full content.
//     [ ] Dragging the centre gap resizes both; charts reflow to new widths.
//     [ ] Each pane scrolls independently; its header pins + shadows.
//     [ ] Exit via divider ✕, via clicking any tab, and via closing a tab x.
//     [ ] Repeat the split matrix in Flowy AND Flap layouts.
//     [ ] In Flap, BOTH flaps stay fused to their pane as the divider/window resizes
//         (left flap leads the strip over the left pane; right flap tracks the right pane).
// ------------------------------------------------------------

import { test, expect } from '@playwright/test';

const APP = '/Advanced-mock-styles/';
const TAB = (v) => `#main .tabs .ia-tab[data-view="${v}"]`;
const PANE_VIEW = (v) => `.sv-pane > .view[data-view="${v}"]`;

// Bypass the access gate and land directly in the editor (tabs are hidden in
// the overview mode), then make sure the default asset is active.
async function bootEditor(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('proto-access-granted', 'yes'); // skip the access gate
      localStorage.setItem('fb-author', 'Test User');       // skip the feedback name overlay
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

async function viewWidth(page, selector) {
  return page.locator(selector).evaluate((el) => el.getBoundingClientRect().width);
}

test.beforeEach(async ({ page }) => {
  await bootEditor(page);
});

test('single-view tab switching is unaffected by the split layer', async ({ page }) => {
  // Never enters split: guards that the capture-phase exit listener no-ops when
  // not split, so normal asset switching keeps working exactly as before.
  await page.locator(TAB('purchase-order')).click();
  await expect(page.locator('#content .view[data-view="purchase-order"].active')).toBeVisible();
  await expect(page.locator('.sv-split')).toHaveCount(0);
  await expect(page.locator('.view.active')).toHaveCount(1);

  await page.locator(TAB('order-management')).click();
  await expect(page.locator('#content .view[data-view="order-management"].active')).toBeVisible();
  await expect(page.locator('.view.active')).toHaveCount(1);
});

test('right-click an inactive tab offers "Open side by side"; active tab does not', async ({ page }) => {
  // Active tab (order-management) → no custom menu.
  await page.locator(TAB('order-management')).click({ button: 'right' });
  await expect(page.locator('#sv-tab-ctxmenu.open')).toHaveCount(0);

  // Inactive tab → menu appears with the single action.
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  const menu = page.locator('#sv-tab-ctxmenu.open');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-sv-action="split"]')).toHaveText(/Open side by side/);
});

test('opening side by side shows both assets in two panes', async ({ page }) => {
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();

  await expect(page.locator('.sv-split')).toHaveCount(1);
  await expect(page.locator('.sv-pane')).toHaveCount(2);
  // Left = the previously active asset, right = the chosen one — both visible.
  await expect(page.locator(PANE_VIEW('order-management'))).toBeVisible();
  await expect(page.locator(PANE_VIEW('purchase-order'))).toBeVisible();
  // #content is hidden, the canvas is flagged as the split host.
  await expect(page.locator('.ctx-canvas.sv-host')).toHaveCount(1);
  // Both tabs read as paired/open — the secondary borrows the real .active class
  // so it styles identically to the open tab under any tab-style knob.
  await expect(page.locator(TAB('purchase-order'))).toHaveClass(/sv-tab-split/);
  await expect(page.locator(TAB('purchase-order'))).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(page.locator(TAB('order-management'))).toHaveClass(/(^|\s)active(\s|$)/);

  // Single-active invariant preserved: still exactly one .view.active element.
  await expect(page.locator('.view.active')).toHaveCount(1);
});

test('dragging the centre divider resizes panes and reflows charts', async ({ page }) => {
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  const leftView = PANE_VIEW('order-management');
  const leftBefore = await viewWidth(page, leftView);

  // Stamp the current chart <svg>. renderChartsIn rebuilds the wrapper's innerHTML,
  // so if the chart genuinely re-renders for the new width this stamped node is
  // discarded — a reliable signal even when the chart's min-width clamp hides a
  // viewBox change.
  const chart = `${leftView} [data-chart="combo"]`;
  await page.locator(chart).first().evaluate((el) => {
    const s = el.querySelector('svg'); if (s) s.setAttribute('data-test-stamp', '1');
  });

  // Drag the divider ~220px to the left → left pane shrinks, right pane grows.
  const divider = page.locator('.sv-divider');
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 220, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  // Width responds immediately; the chart re-render follows the debounced observer.
  await expect.poll(() => viewWidth(page, leftView)).toBeLessThan(leftBefore - 80);
  await expect.poll(
    () => page.locator(`${chart} svg[data-test-stamp="1"]`).count(),
    { timeout: 4000 },
  ).toBe(0);
});

test('each pane scrolls independently', async ({ page }) => {
  await page.locator(TAB('rework-quality')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  const right = page.locator(PANE_VIEW('rework-quality'));
  await right.evaluate((el) => { el.scrollTop = 200; });
  await expect.poll(() => right.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // The left pane is untouched by the right pane's scroll.
  const leftTop = await page.locator(PANE_VIEW('order-management')).evaluate((el) => el.scrollTop);
  expect(leftTop).toBe(0);
});

test('exit via the divider close button returns to a single view', async ({ page }) => {
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  await page.locator('.sv-divider-close').click({ force: true });

  await expect(page.locator('.sv-split')).toHaveCount(0);
  await expect(page.locator('.ctx-canvas.sv-host')).toHaveCount(0);
  await expect(page.locator('.view.active')).toHaveCount(1);
  // The left/active asset is back inside #content and rendered.
  await expect(page.locator('#content .view[data-view="order-management"].active')).toBeVisible();
  await expect(page.locator('.ia-tab.sv-tab-split')).toHaveCount(0);
  // The borrowed .active was cleaned up → exactly one active tab again.
  await expect(page.locator('#main .tabs .ia-tab.active')).toHaveCount(1);
});

test('clicking a tab exits split and switches to that asset', async ({ page }) => {
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  // Click the rework-quality tab → split tears down, that asset becomes single.
  await page.locator(TAB('rework-quality')).click();
  await expect(page.locator('.sv-split')).toHaveCount(0);
  await expect(page.locator('#content .view[data-view="rework-quality"].active')).toBeVisible();
});

test('split works in the Flowy layout too', async ({ page }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-layout', 'flowy'));

  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();

  await expect(page.locator('.sv-split')).toHaveCount(1);
  await expect(page.locator(PANE_VIEW('order-management'))).toBeVisible();
  await expect(page.locator(PANE_VIEW('purchase-order'))).toBeVisible();
  // In Flowy each pane reads as the framed scroll card (has a border-radius).
  const radius = await page.locator(PANE_VIEW('purchase-order')).evaluate(
    (el) => getComputedStyle(el).borderTopLeftRadius,
  );
  expect(parseFloat(radius)).toBeGreaterThan(0);

  await page.locator('.sv-divider-close').click({ force: true });
  await expect(page.locator('.sv-split')).toHaveCount(0);
});

test('Flap layout anchors BOTH flaps over their panes (left flap reflows like the right)', async ({ page }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-layout', 'flap'));

  // Make a NON-first tab the active/left view so its natural strip slot is mid-strip — the
  // exact case where the old code left the left flap floating off its pane.
  await page.locator(TAB('rework-quality')).click();
  await expect(page.locator('#content .view[data-view="rework-quality"].active')).toBeVisible();

  // Split with another asset on the right.
  await page.locator(TAB('purchase-order')).click({ button: 'right' });
  await page.locator('#sv-tab-ctxmenu [data-sv-action="split"]').click();
  await expect(page.locator('.sv-split')).toHaveCount(1);

  // The left flap now LEADS the strip: the first real tab is the active/left flap, not an
  // inactive tab that used to sit ahead of it (only an inert spacer may precede it).
  const firstTabView = await page.locator('#main .tabs .ia-tab').first().evaluate((el) => el.dataset.view);
  expect(firstTabView).toBe('rework-quality');

  // A flap is "connected" to its pane when its box sits within that pane horizontally.
  const flapInPane = (tabView, paneSel) => page.evaluate(({ tv, ps }) => {
    const f = document.querySelector(`#main .tabs .ia-tab[data-view="${tv}"]`).getBoundingClientRect();
    const p = document.querySelector(ps).getBoundingClientRect();
    return f.left >= p.left - 1 && f.right <= p.right + 1;
  }, { tv: tabView, ps: paneSel });

  // Both flaps start within their own pane.
  expect(await flapInPane('rework-quality', '.sv-pane-left')).toBe(true);
  expect(await flapInPane('purchase-order', '.sv-pane-right')).toBe(true);

  // Drag the divider left → the left pane shrinks. The left flap must REFLOW to stay within it
  // (the regression: it used to keep its slot and spill across the divider).
  const divider = page.locator('.sv-divider');
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 160, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => flapInPane('rework-quality', '.sv-pane-left')).toBe(true);
  expect(await flapInPane('purchase-order', '.sv-pane-right')).toBe(true);
});
