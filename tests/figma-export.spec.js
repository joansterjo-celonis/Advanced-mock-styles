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
  await expect(page.locator('#preset-export-figma')).toBeVisible();
}

test('export package contains primary screens and restores prototype state', async ({ page }) => {
  await bootEditor(page);
  await page.locator('#main .tabs .ia-tab[data-view="purchase-order"]').click();
  await expect(page.locator('#content .view[data-view="purchase-order"].active')).toBeVisible();

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
  expect(result.screenIds).toContain('purchase-order');
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

test('export button is isolated from startup and only loads exporter on demand', async ({ page }) => {
  await bootEditor(page);
  const btn = page.locator('#preset-export-figma');
  await expect(btn).toHaveText('Export Figma');
  await expect(btn).toBeEnabled();

  const loadedBeforeClick = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return resources.some((name) => name.includes('/src/scripts/figma-export.js'));
  });
  expect(loadedBeforeClick).toBe(false);
});
