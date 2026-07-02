// ============================================================
//  Figma export package regression suite.
// ============================================================

import { test, expect } from '@playwright/test';

const APP = '/Advanced-mock-styles/';

async function bootEditor(page) {
  await page.route('https://api.jsonbin.io/**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], updatedAt: Date.now() }) });
  });
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
  await page.locator('#fab').click();
  await expect(page.locator('#preset-export-btn')).toBeVisible();
}

async function openExportMenu(page) {
  const trigger = page.locator('#preset-export-btn');
  if (await page.locator('#preset-export-menu').isHidden()) {
    await trigger.click();
  }
  await expect(page.locator('#preset-export-figma')).toBeVisible();
}

test('export package contains primary screens and restores prototype state', async ({ page }) => {
  await bootEditor(page);
  await page.locator('#main .tabs .ia-tab[data-view="rework-quality"]').click();
  await expect(page.locator('#content .view[data-view="rework-quality"].active')).toBeVisible();

  const result = await page.evaluate(async () => {
    const before = {
      route: document.getElementById('app')?.dataset.route || null,
      view: document.querySelector('.view.active')?.getAttribute('data-view') || null,
      scroll: document.querySelector('.ctx-canvas')?.scrollTop || 0,
    };
    const mod = await import('/Advanced-mock-styles/src/scripts/figma-export.js');
    const pkg = await mod.createFigmaExportPackage({ includeSubtabs: false, includeVisuals: false, download: false });
    const after = {
      route: document.getElementById('app')?.dataset.route || null,
      view: document.querySelector('.view.active')?.getAttribute('data-view') || null,
      scroll: document.querySelector('.ctx-canvas')?.scrollTop || 0,
    };
    return {
      schema: pkg.manifest.schema,
      screenIds: pkg.manifest.screens.map((screen) => screen.viewId),
      editableLayerCounts: pkg.manifest.screens.map((screen) => JSON.parse(pkg.files[screen.path]).editableLayers.length),
      fileNames: Object.keys(pkg.files).sort(),
      byteLength: pkg.bytes.length,
      zipHeader: Array.from(pkg.bytes.slice(0, 4)),
      before,
      after,
    };
  });

  expect(result.schema).toBe('ams-figma-export-v1');
  expect(result.screenIds).toContain('order-management');
  expect(result.screenIds).toContain('rework-quality');
  expect(result.screenIds).toContain('inventory-cockpit');
  expect(result.screenIds).not.toContain('incident-details');
  expect(Math.min(...result.editableLayerCounts)).toBeGreaterThan(10);
  expect(result.fileNames).toContain('manifest.json');
  expect(result.fileNames).toContain('tokens.json');
  expect(result.fileNames).toContain('components/inventory.json');
  expect(result.fileNames.some((name) => name.startsWith('screens/order-management/'))).toBe(true);
  expect(result.fileNames.some((name) => name.startsWith('assets/screens/') && name.endsWith('.png'))).toBe(false);
  expect(result.byteLength).toBeGreaterThan(1000);
  expect(result.zipHeader).toEqual([80, 75, 3, 4]);
  expect(result.after).toEqual(result.before);
});

test('export package can include pixel reference images for Figma fidelity', async ({ page }) => {
  test.setTimeout(45_000);
  await bootEditor(page);

  const result = await page.evaluate(async () => {
    const mod = await import('/Advanced-mock-styles/src/scripts/figma-export.js');
    const pkg = await mod.createFigmaExportPackage({
      includeSubtabs: false,
      viewIds: ['order-management', 'inventory-cockpit'],
      download: false,
    });
    return {
      screenIds: pkg.manifest.screens.map((screen) => screen.viewId),
      visualCount: pkg.manifest.screens.filter((screen) => screen.visual && screen.visual.path).length,
      editableLayerCounts: pkg.manifest.screens.map((screen) => JSON.parse(pkg.files[screen.path]).editableLayers.length),
      fileNames: Object.keys(pkg.files).sort(),
      byteLength: pkg.bytes.length,
    };
  });

  expect(result.screenIds).toEqual(['order-management', 'inventory-cockpit']);
  expect(result.visualCount).toBe(2);
  expect(Math.min(...result.editableLayerCounts)).toBeGreaterThan(10);
  expect(result.fileNames.filter((name) => name.startsWith('assets/screens/') && name.endsWith('.png'))).toHaveLength(2);
  expect(result.byteLength).toBeGreaterThan(10000);
});

test('export dropdown is isolated from startup and only loads exporter on demand', async ({ page }) => {
  await bootEditor(page);
  const trigger = page.locator('#preset-export-btn');
  await expect(trigger).toContainText('Export');
  await expect(trigger).toBeEnabled();

  // the menu starts closed and reveals both options on demand
  await expect(page.locator('#preset-export-menu')).toBeHidden();
  await trigger.click();
  await expect(page.locator('#preset-export-figma')).toBeVisible();
  await expect(page.locator('#preset-export-shots')).toBeVisible();

  const loadedBeforeClick = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return resources.some((name) => name.includes('/src/scripts/figma-export.js'));
  });
  expect(loadedBeforeClick).toBe(false);
});

test('screenshot export captures home, packages, editor views, and modals', async ({ page }) => {
  test.setTimeout(60_000);
  await bootEditor(page);
  await openExportMenu(page);
  await page.locator('#main .tabs .ia-tab[data-view="rework-quality"]').click();
  await expect(page.locator('#content .view[data-view="rework-quality"].active')).toBeVisible();

  const result = await page.evaluate(async () => {
    const before = {
      route: document.getElementById('app')?.dataset.route || null,
      view: document.querySelector('.view.active')?.getAttribute('data-view') || null,
      openModals: Array.from(document.querySelectorAll('.modal-overlay.open')).map((el) => el.id),
    };
    const mod = await import('/Advanced-mock-styles/src/scripts/figma-export.js');
    const pkg = await mod.exportAllScreenshots(
      { id: 'custom', name: 'Custom' },
      { scale: 0.5, download: false, viewIds: ['order-management'] },
    );
    const after = {
      route: document.getElementById('app')?.dataset.route || null,
      view: document.querySelector('.view.active')?.getAttribute('data-view') || null,
      openModals: Array.from(document.querySelectorAll('.modal-overlay.open')).map((el) => el.id),
    };
    return {
      kind: pkg.kind,
      screenIds: pkg.manifest.screens.map((screen) => screen.id),
      screenDims: pkg.manifest.screens.map((screen) => ({ id: screen.id, w: screen.width, h: screen.height })),
      fileNames: Object.keys(pkg.files).sort(),
      pngCount: Object.keys(pkg.files).filter((name) => name.endsWith('.png')).length,
      zipHeader: Array.from(pkg.bytes.slice(0, 4)),
      viewportW: window.innerWidth,
      before,
      after,
    };
  });

  expect(result.kind).toBe('screenshots');
  expect(result.screenIds).toContain('home');
  expect(result.screenIds).toContain('packages');
  expect(result.screenIds).toContain('modal-deploy');
  expect(result.screenIds).toContain('modal-package-history');
  expect(result.fileNames).toContain('manifest.json');
  expect(result.fileNames).toContain('screens/home.png');
  expect(result.fileNames).toContain('screens/packages.png');
  expect(result.fileNames).toContain('modals/deploy.png');
  expect(result.fileNames).toContain('modals/package-history.png');

  // Inner view sub-tabs are captured: Order Management has several sub-tabs, so it
  // must produce more than one screen, each on its own file.
  const orderManagementScreens = result.screenIds.filter((id) => id.startsWith('view-order-management'));
  expect(orderManagementScreens.length).toBeGreaterThan(1);
  expect(result.fileNames.some((name) => /^screens\/view-order-management__.*\.png$/.test(name))).toBe(true);

  // Screens are full-app captures (not cropped cut-outs): width tracks the viewport.
  const homeShot = result.screenDims.find((s) => s.id === 'home');
  expect(homeShot.w).toBeGreaterThan(result.viewportW * 0.6);
  const modalShot = result.screenDims.find((s) => s.id === 'modal-deploy');
  expect(modalShot.w).toBe(homeShot.w);
  expect(modalShot.h).toBe(homeShot.h);

  expect(result.pngCount).toBeGreaterThan(4);
  expect(result.zipHeader).toEqual([80, 75, 3, 4]);
  expect(result.after).toEqual(result.before);
});
