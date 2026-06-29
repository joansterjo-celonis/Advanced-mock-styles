// ============================================================
//  Figma export package builder
// ============================================================
//
// Produces a no-auth .figma-export.zip that can be imported by the
// companion local Figma plugin. This module is intentionally side-effect
// free: nothing runs until exportPresetToFigma() or createFigmaExportPackage()
// is called.

import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { getViews } from './engine.js';

export const FIGMA_EXPORT_SCHEMA = 'ams-figma-export-v1';

const SUBTAB_ATTRS = ['data-sub', 'data-rqsub', 'data-ocsub', 'data-acsub', 'data-invsub', 'data-shsub', 'data-trsub'];
const ROOT_KEEP_IDS = new Set(['route-context', 'l1', 'main', 'content', 'ia-canvas']);
const SKIP_SELECTOR = [
  '.edit-panel',
  '.ctxmenu',
  '.gsearch-overlay',
  '.modal-overlay',
  '.fb-overlay',
  '.fb-popup',
  '.fb-panel',
  '.fb-marker',
].join(',');

const encoder = new TextEncoder();

export async function exportPresetToFigma(preset, options = {}) {
  const result = await createFigmaExportPackage({ ...options, preset });
  if (options.download !== false) downloadBlob(result.blob, result.filename);
  return result;
}

export async function createFigmaExportPackage(options = {}) {
  const preset = normalizePreset(options.preset, options.state);
  const includeSubtabs = options.includeSubtabs !== false;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const startedAt = new Date().toISOString();
  const previous = captureRuntimeState();
  const files = {};
  const screens = [];
  const viewport = {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };

  onProgress({ type: 'started', preset });

  try {
    if (preset.state && window.IA && typeof window.IA.applyState === 'function') {
      window.IA.applyState(preset.state);
      await settle();
    }

    const views = primaryViews().filter((view) => {
      if (!Array.isArray(options.viewIds) || !options.viewIds.length) return true;
      return options.viewIds.includes(view.id);
    });
    const jobs = [];
    views.forEach((view) => {
      const variants = includeSubtabs ? subtabVariants(view.id) : [];
      if (variants.length) variants.forEach((variant) => jobs.push({ view, variant }));
      else jobs.push({ view, variant: defaultVariant() });
    });

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      const screen = await captureScreen(job.view, job.variant, {
        includeVisual: options.includeVisuals !== false,
        visualScale: options.visualScale || 1,
      });
      const path = screenPath(screen);
      const visualDataUrl = screen._visualDataUrl;
      delete screen._visualDataUrl;
      if (visualDataUrl) {
        const assetPath = visualPath(screen);
        files[assetPath] = dataUrlToBytes(visualDataUrl);
        screen.visual = {
          type: 'image/png',
          path: assetPath,
          width: screen.frame.w,
          height: screen.frame.h,
          role: 'pixel-reference',
        };
      }
      files[path] = stableJson(screen);
      screens.push({
        id: screen.id,
        viewId: screen.viewId,
        label: screen.label,
        variant: screen.variant,
        path,
        width: screen.frame.w,
        height: screen.frame.h,
        visual: screen.visual || null,
        componentRoles: screen.componentRoles,
      });
      onProgress({ type: 'screen-captured', index: i + 1, total: jobs.length, screen });
    }

    const tokens = captureTokens();
    const manifest = {
      schema: FIGMA_EXPORT_SCHEMA,
      exportedAt: startedAt,
      app: {
        name: 'Advanced Mock Styles',
        route: 'context',
        viewport,
      },
      preset: {
        id: preset.id,
        name: preset.name,
        state: preset.state || null,
      },
      counts: {
        screens: screens.length,
        primaryViews: views.length,
      },
      screens,
      components: componentInventory(screens),
      importer: {
        pluginFolder: 'figma-importer',
        requiresAuth: false,
      },
    };

    files['manifest.json'] = stableJson(manifest);
    files['tokens.json'] = stableJson(tokens);
    files['components/inventory.json'] = stableJson(manifest.components);
    files['README.md'] = exportReadme(manifest);

    const bytes = makeZip(files);
    const blob = new Blob([bytes], { type: 'application/zip' });
    const filename = filenameFor(preset.name, startedAt);
    onProgress({ type: 'packaged', filename, bytes: bytes.length, screens: screens.length });

    return { schema: FIGMA_EXPORT_SCHEMA, manifest, tokens, files, bytes, blob, filename };
  } catch (error) {
    onProgress({ type: 'failed', error: errorMessage(error) });
    throw error;
  } finally {
    await restoreRuntimeState(previous);
    onProgress({ type: 'restored' });
  }
}

function normalizePreset(preset, state) {
  const liveState = state || (window.IA && typeof window.IA.captureState === 'function' ? safeCall(window.IA.captureState) : null);
  if (preset && typeof preset === 'object') {
    return {
      id: String(preset.id || 'custom'),
      name: String(preset.name || 'Custom'),
      state: preset.state || liveState,
    };
  }
  return { id: 'custom', name: 'Custom', state: liveState };
}

function primaryViews() {
  return getViews()
    .filter((view) => view && view.id && document.querySelector(`.l1-leaf[data-view="${cssEscape(view.id)}"]`))
    .map((view) => ({ ...view, label: view.label || labelForView(view.id) }));
}

function labelForView(id) {
  const leaf = document.querySelector(`.l1-leaf[data-view="${cssEscape(id)}"]`);
  return (leaf && leaf.textContent.trim()) || id;
}

async function captureScreen(view, variant, options = {}) {
  await activateScreen(view.id, variant);
  const route = document.getElementById('route-context');
  if (!route) throw new Error('Cannot export: #route-context is missing.');
  const activeView = document.querySelector(`.view[data-view="${cssEscape(view.id)}"].active`);
  if (!activeView) throw new Error(`Cannot export: view "${view.id}" did not activate.`);

  const routeRect = route.getBoundingClientRect();
  const clone = cloneRouteForScreen(route, view.id);
  const tree = serializeElement(route, routeRect);
  const editableLayers = captureEditableLayers(route, routeRect);
  const variantKey = variant && variant.attr ? `${variant.attr}:${variant.val}` : 'default';
  const id = `${view.id}__${slug(variantKey)}`;
  const componentRoles = {};
  collectRoles(tree, componentRoles);
  const visualDataUrl = options.includeVisual === false ? null : await captureVisual(clone, routeRect, options);

  return {
    schema: FIGMA_EXPORT_SCHEMA,
    id,
    viewId: view.id,
    label: view.label || labelForView(view.id),
    variant,
    frame: {
      x: 0,
      y: 0,
      w: Math.round(routeRect.width),
      h: Math.round(routeRect.height),
    },
    html: clone ? clone.outerHTML : '',
    nodeTree: tree,
    editableLayers,
    componentRoles,
    scroll: captureScrollState(activeView),
    _visualDataUrl: visualDataUrl,
  };
}

async function captureVisual(clone, rect, options = {}) {
  if (!clone) return null;
  const scale = Math.max(0.5, Math.min(2, Number(options.visualScale) || 1));
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = [
    'position:fixed',
    'left:-20000px',
    'top:0',
    `width:${Math.round(rect.width)}px`,
    `height:${Math.round(rect.height)}px`,
    'overflow:hidden',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  clone.style.width = Math.round(rect.width) + 'px';
  clone.style.height = Math.round(rect.height) + 'px';
  stage.appendChild(clone);
  document.body.appendChild(stage);
  try {
    await settle();
    normalizeCloneForRaster(clone);
    const canvas = await html2canvas(clone, {
      backgroundColor: getComputedStyle(clone).backgroundColor || null,
      scale,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      windowWidth: Math.round(rect.width),
      windowHeight: Math.round(rect.height),
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      logging: false,
      ignoreElements: (node) => node instanceof Element && node.matches(SKIP_SELECTOR),
    });
    return canvas.toDataURL('image/png');
  } catch (primaryError) {
    try {
      return await toPng(clone, {
        cacheBust: true,
        pixelRatio: scale,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        canvasWidth: Math.round(rect.width * scale),
        canvasHeight: Math.round(rect.height * scale),
        backgroundColor: getComputedStyle(clone).backgroundColor || undefined,
        filter: (node) => {
          if (!(node instanceof Element)) return true;
          return !node.matches(SKIP_SELECTOR);
        },
      });
    } catch (fallbackError) {
      console.warn('[figma-export] visual capture failed ' + JSON.stringify({
        primary: errorDetails(primaryError),
        fallback: errorDetails(fallbackError),
      }));
      return null;
    }
  } finally {
    stage.remove();
  }
}

function normalizeCloneForRaster(root) {
  const nodes = [root, ...root.querySelectorAll('*')];
  const colorProps = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'fill',
    'stroke',
  ];
  nodes.forEach((node) => {
    const cs = getComputedStyle(node);
    colorProps.forEach((prop) => {
      const value = normalizeCssColorFunctions(cs[prop]);
      if (value && !value.includes('color(')) {
        try { node.style[prop] = value; } catch (e) { /* noop */ }
      }
    });
    ['backgroundImage', 'boxShadow', 'textShadow', 'filter'].forEach((prop) => {
      const value = normalizeCssColorFunctions(cs[prop]);
      if (value && !value.includes('color(')) {
        try { node.style[prop] = value; } catch (e) { /* noop */ }
      }
    });
  });
}

function normalizeCssColorFunctions(value) {
  if (!value || !String(value).includes('color(')) return value;
  return String(value).replace(/color\(([^)]+)\)/g, (match, body) => {
    const parts = String(body).trim().split(/\s+/);
    if (parts.length < 4) return match;
    const nums = parts.slice(1);
    const slash = nums.indexOf('/');
    const rgbParts = slash >= 0 ? nums.slice(0, slash) : nums.slice(0, 3);
    const alphaPart = slash >= 0 ? nums[slash + 1] : nums[3];
    if (rgbParts.length < 3) return match;
    const rgb = rgbParts.slice(0, 3).map((part) => colorChannel(part));
    const alpha = alphaPart == null ? 1 : alphaChannel(alphaPart);
    if (rgb.some((n) => !Number.isFinite(n)) || !Number.isFinite(alpha)) return match;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  });
}

function colorChannel(value) {
  const str = String(value || '').trim();
  if (str.endsWith('%')) return Math.round(clamp(Number(str.slice(0, -1)) / 100, 0, 1) * 255);
  const n = Number(str);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(clamp(n <= 1 ? n : n / 255, 0, 1) * 255);
}

function alphaChannel(value) {
  const str = String(value || '').trim();
  if (str.endsWith('%')) return clamp(Number(str.slice(0, -1)) / 100, 0, 1);
  return clamp(Number(str), 0, 1);
}

async function activateScreen(viewId, variant) {
  if (window.IA && typeof window.IA.restoreScreen === 'function') {
    window.IA.restoreScreen({ viewId });
  } else {
    ensureContextEditor();
  }
  forceViewNoAnimation(viewId);
  await settle();

  const view = document.querySelector(`.view[data-view="${cssEscape(viewId)}"]`);
  if (view && variant && variant.attr && variant.val != null) {
    const tab = view.querySelector(`.subtab[${variant.attr}="${attrEscape(variant.val)}"]`);
    if (tab && !tab.classList.contains('on')) {
      tab.click();
      await settle();
    }
  }

  if (window.IA && typeof window.IA.renderChartsIn === 'function') window.IA.renderChartsIn(view);
  if (window.IA && typeof window.IA.runCounters === 'function') window.IA.runCounters(view);
  await settle();
}

function ensureContextEditor() {
  const app = document.getElementById('app');
  const routeIds = { home: 'route-home', studio: 'route-studio', context: 'route-context', datalake: 'route-datalake', space: 'route-space' };
  Object.keys(routeIds).forEach((key) => {
    const el = document.getElementById(routeIds[key]);
    if (el) el.classList.toggle('active', key === 'context');
  });
  if (app) app.dataset.route = 'context';
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.toggle('active', nav.dataset.nav === 'context'));
  const route = document.getElementById('route-context');
  if (route) {
    route.classList.remove('mode-overview');
    route.classList.add('mode-editor');
  }
}

function forceViewNoAnimation(viewId) {
  ensureContextEditor();
  const view = document.querySelector(`.view[data-view="${cssEscape(viewId)}"]`);
  if (!view) return false;
  const content = document.getElementById('content');
  if (content) {
    content.classList.remove('is-empty', 'fx-scene');
    content.style.height = '';
  }
  document.querySelectorAll('.view.fx-face').forEach((face) => {
    face.classList.remove('fx-face');
    ['left', 'top', 'width', 'height', 'transform', 'opacity'].forEach((prop) => { face.style[prop] = ''; });
  });
  document.querySelectorAll('.view').forEach((candidate) => candidate.classList.toggle('active', candidate === view));
  document.querySelectorAll('.tabbar .tabs .ia-tab[data-view]').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId));
  document.querySelectorAll('.l1-leaf[data-view]').forEach((leaf) => leaf.classList.toggle('active', leaf.dataset.view === viewId));
  if (window.IA && typeof window.IA.renderChartsIn === 'function') window.IA.renderChartsIn(view);
  if (window.IA && typeof window.IA.runCounters === 'function') window.IA.runCounters(view);
  return true;
}

function subtabVariants(viewId) {
  const view = document.querySelector(`.view[data-view="${cssEscape(viewId)}"]`);
  if (!view) return [];
  const variants = [];
  const seen = new Set();
  view.querySelectorAll('.subtab').forEach((tab) => {
    let attr = SUBTAB_ATTRS.find((name) => tab.hasAttribute(name));
    if (!attr) attr = tab.getAttributeNames().find((name) => /^data-.+sub$/.test(name));
    if (!attr) return;
    const val = tab.getAttribute(attr);
    const key = `${attr}:${val}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({
      attr,
      val,
      label: tab.textContent.trim() || val,
      default: tab.classList.contains('on'),
    });
  });
  return variants;
}

function defaultVariant() {
  return { attr: null, val: 'default', label: 'Default', default: true };
}

function cloneRouteForScreen(route, viewId) {
  const clone = route.cloneNode(true);
  clone.classList.add('active', 'mode-editor');
  clone.classList.remove('mode-overview');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  clone.querySelector('.ctx-overview')?.remove();
  clone.querySelectorAll('.view').forEach((view) => {
    if (view.getAttribute('data-view') === viewId) view.classList.add('active');
    else view.remove();
  });
  clone.querySelectorAll('.tabbar .ia-tab[data-view]').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-view') === viewId);
  });
  clone.querySelectorAll(SKIP_SELECTOR).forEach((el) => el.remove());
  clone.querySelectorAll('[id]').forEach((el) => { if (!ROOT_KEEP_IDS.has(el.id)) el.removeAttribute('id'); });
  clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((el) => el.setAttribute('tabindex', '-1'));
  return clone;
}

function serializeElement(el, rootRect, depth = 0) {
  if (!el || depth > 80 || el.nodeType !== Node.ELEMENT_NODE) return null;
  if (el.matches(SKIP_SELECTOR) || ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(el.tagName)) return null;

  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return null;
  const rect = el.getBoundingClientRect();
  const isRoot = el.id === 'route-context';
  if (!isRoot && (rect.width < 0.5 || rect.height < 0.5)) return null;

  const node = {
    tag: el.tagName.toLowerCase(),
    role: componentRole(el),
    classes: Array.from(el.classList || []),
    attrs: exportAttrs(el),
    text: directText(el),
    rect: {
      x: round(rect.left - rootRect.left),
      y: round(rect.top - rootRect.top),
      w: round(rect.width),
      h: round(rect.height),
    },
    style: exportStyle(style),
    children: [],
  };

  if (node.tag === 'svg') {
    node.svg = el.outerHTML;
    return node;
  }

  Array.from(el.children || []).forEach((child) => {
    const next = serializeElement(child, rootRect, depth + 1);
    if (next) node.children.push(next);
  });
  return node;
}

function captureEditableLayers(root, rootRect) {
  const layers = [];
  let order = 0;
  const walk = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.matches(SKIP_SELECTOR) || ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(el.tagName)) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const rect = el.getBoundingClientRect();
    const isRoot = el === root;
    if (!isRoot && (rect.width < 0.5 || rect.height < 0.5)) return;
    const box = layerRect(rect, rootRect);
    const role = componentRole(el);
    const name = layerNameForElement(el, role);
    const layerStyle = exportStyle(style);

    if (el.tagName.toLowerCase() === 'svg') {
      layers.push({
        type: 'svg',
        name,
        role: role || 'vector',
        order: order++,
        rect: box,
        style: layerStyle,
        svg: el.outerHTML,
      });
      return;
    }

    if (hasVisualBox(style, el, isRoot)) {
      layers.push({
        type: 'box',
        name,
        role,
        order: order++,
        rect: box,
        style: layerStyle,
      });
    }

    captureElementTextLayers(el, rootRect, layerStyle).forEach((textLayer) => {
      layers.push({
        ...textLayer,
        order: order++,
      });
    });

    Array.from(el.children || []).forEach(walk);
  };
  walk(root);
  return layers.filter((layer) => layer.rect && layer.rect.w >= 0.5 && layer.rect.h >= 0.5);
}

function layerRect(rect, rootRect) {
  return {
    x: round(rect.left - rootRect.left),
    y: round(rect.top - rootRect.top),
    w: round(rect.width),
    h: round(rect.height),
  };
}

function hasVisualBox(style, el, isRoot) {
  if (isRoot) return true;
  if (componentRole(el)) return true;
  if (!isTransparent(style.backgroundColor)) return true;
  if (style.backgroundImage && style.backgroundImage !== 'none') return true;
  if (style.boxShadow && style.boxShadow !== 'none') return true;
  const borderWidths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
    .map((value) => parseFloat(value) || 0);
  const hasBorder = borderWidths.some((value) => value > 0.1);
  const borderColors = [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor];
  return hasBorder && borderColors.some((value) => !isTransparent(value));
}

function isTransparent(value) {
  if (!value || value === 'transparent') return true;
  const rgba = String(value).match(/rgba?\(([^)]+)\)/);
  if (!rgba) return false;
  const parts = rgba[1].split(',').map((part) => part.trim());
  return parts.length > 3 && Number(parts[3]) <= 0.01;
}

function captureElementTextLayers(el, rootRect, fallbackStyle) {
  const layers = [];
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const text = el.value || el.placeholder || '';
    if (text.trim()) {
      layers.push({
        type: 'text',
        name: text.slice(0, 40),
        role: 'text',
        rect: layerRect(el.getBoundingClientRect(), rootRect),
        style: fallbackStyle,
        text: text.trim(),
      });
    }
    return layers;
  }

  Array.from(el.childNodes || []).forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
    const union = rects.length ? unionRects(rects) : range.getBoundingClientRect();
    range.detach();
    if (!union || union.width < 0.5 || union.height < 0.5) return;
    layers.push({
      type: 'text',
      name: text.slice(0, 40),
      role: 'text',
      rect: layerRect(union, rootRect),
      style: fallbackStyle,
      text,
    });
  });
  return layers;
}

function unionRects(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function layerNameForElement(el, role) {
  if (role) return role;
  const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  if (label) return label;
  const cls = Array.from(el.classList || []).slice(0, 2).join('.');
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}

function exportAttrs(el) {
  const attrs = {};
  Array.from(el.attributes || []).forEach((attr) => {
    if (attr.name === 'style' || attr.name === 'class') return;
    if (attr.name === 'id' || attr.name.startsWith('data-') || attr.name === 'role' || attr.name === 'aria-label' || attr.name === 'title') {
      attrs[attr.name] = attr.value;
    }
  });
  if (el instanceof HTMLInputElement) {
    attrs.value = el.value || '';
    attrs.placeholder = el.placeholder || '';
  }
  return attrs;
}

function directText(el) {
  if (el instanceof HTMLInputElement) return el.value || el.placeholder || '';
  const text = Array.from(el.childNodes || [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function exportStyle(style) {
  return {
    display: style.display,
    position: style.position,
    opacity: style.opacity,
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    color: style.color,
    borderTopColor: style.borderTopColor,
    borderRightColor: style.borderRightColor,
    borderBottomColor: style.borderBottomColor,
    borderLeftColor: style.borderLeftColor,
    borderTopWidth: style.borderTopWidth,
    borderRightWidth: style.borderRightWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderLeftWidth: style.borderLeftWidth,
    borderRadius: style.borderRadius,
    boxShadow: style.boxShadow,
    filter: style.filter,
    backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    whiteSpace: style.whiteSpace,
  };
}

function componentRole(el) {
  if (el.classList.contains('asset-bar')) return 'asset-header';
  if (el.classList.contains('card') || el.hasAttribute('data-card')) return 'card';
  if (el.classList.contains('kpi') || el.classList.contains('metric')) return 'kpi';
  if (el.classList.contains('tabbar')) return 'top-tabs';
  if (el.classList.contains('subtabs')) return 'sub-tabs';
  if (el.classList.contains('ia-tab')) return 'top-tab';
  if (el.classList.contains('subtab')) return 'sub-tab';
  if (el.classList.contains('btn') || el.tagName === 'BUTTON') return 'button';
  if (el.tagName === 'TABLE' || el.classList.contains('ptable')) return 'table';
  if (el.hasAttribute('data-chart') || el.classList.contains('chart-wrap')) return 'chart';
  if (el.classList.contains('badge') || el.classList.contains('status')) return 'badge';
  return null;
}

function collectRoles(node, out) {
  if (!node) return;
  if (node.role) out[node.role] = (out[node.role] || 0) + 1;
  (node.children || []).forEach((child) => collectRoles(child, out));
}

function componentInventory(screens) {
  const roles = {};
  screens.forEach((screen) => {
    Object.keys(screen.componentRoles || {}).forEach((role) => {
      roles[role] = (roles[role] || 0) + screen.componentRoles[role];
    });
  });
  return {
    strategy: 'dedupe-by-role-in-importer',
    roles,
  };
}

function captureTokens() {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  const vars = {};
  for (let i = 0; i < rootStyle.length; i += 1) {
    const name = rootStyle[i];
    if (name && name.startsWith('--')) vars[name] = rootStyle.getPropertyValue(name).trim();
  }
  const attrs = {};
  Array.from(root.attributes || []).forEach((attr) => {
    if (attr.name.startsWith('data-')) attrs[attr.name] = attr.value;
  });
  return {
    schema: FIGMA_EXPORT_SCHEMA,
    rootAttrs: attrs,
    cssVariables: vars,
    mode: root.getAttribute('data-mode') || null,
  };
}

function captureRuntimeState() {
  const activeView = document.querySelector('.view.active');
  const app = document.getElementById('app');
  const canvas = document.querySelector('.ctx-canvas');
  return {
    controls: window.IA && typeof window.IA.captureState === 'function' ? safeCall(window.IA.captureState) : null,
    inverted: window.IA && typeof window.IA.captureInverted === 'function' ? safeCall(window.IA.captureInverted) : [],
    route: app ? app.dataset.route : null,
    activeViewId: activeView ? activeView.getAttribute('data-view') : null,
    canvasScrollTop: canvas ? canvas.scrollTop : 0,
    viewScrollTop: activeView ? activeView.scrollTop : 0,
    subStates: captureSubStates(),
    presetSelectValue: document.getElementById('preset-select')?.value || '',
  };
}

async function restoreRuntimeState(state) {
  if (!state) return;
  if (state.controls && window.IA && typeof window.IA.applyState === 'function') window.IA.applyState(state.controls);
  if (state.activeViewId) {
    if (window.IA && typeof window.IA.restoreScreen === 'function') window.IA.restoreScreen({ viewId: state.activeViewId });
    forceViewNoAnimation(state.activeViewId);
  }
  restoreSubStates(state.subStates || {});
  if (window.IA && typeof window.IA.applyInverted === 'function') window.IA.applyInverted(state.inverted || []);
  setRoute(state.route);
  const canvas = document.querySelector('.ctx-canvas');
  if (canvas) canvas.scrollTop = state.canvasScrollTop || 0;
  const activeView = document.querySelector('.view.active');
  if (activeView) activeView.scrollTop = state.viewScrollTop || 0;
  const sel = document.getElementById('preset-select');
  if (sel) sel.value = state.presetSelectValue || '';
  await settle();
}

function setRoute(route) {
  if (!route) return;
  const app = document.getElementById('app');
  const routeIds = { home: 'route-home', studio: 'route-studio', context: 'route-context', datalake: 'route-datalake', space: 'route-space' };
  Object.keys(routeIds).forEach((key) => {
    const el = document.getElementById(routeIds[key]);
    if (el) el.classList.toggle('active', key === route);
  });
  if (app) app.dataset.route = route;
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.toggle('active', nav.dataset.nav === route));
}

function captureSubStates() {
  const out = {};
  document.querySelectorAll('.view[data-view]').forEach((view) => {
    const active = view.querySelector('.subtab.on');
    if (!active) return;
    let attr = SUBTAB_ATTRS.find((name) => active.hasAttribute(name));
    if (!attr) attr = active.getAttributeNames().find((name) => /^data-.+sub$/.test(name));
    if (attr) out[view.getAttribute('data-view')] = { attr, val: active.getAttribute(attr) };
  });
  return out;
}

function restoreSubStates(states) {
  Object.keys(states || {}).forEach((viewId) => {
    const state = states[viewId];
    const view = document.querySelector(`.view[data-view="${cssEscape(viewId)}"]`);
    if (!view || !state || !state.attr) return;
    const tab = view.querySelector(`.subtab[${state.attr}="${attrEscape(state.val)}"]`);
    if (tab && !tab.classList.contains('on')) tab.click();
  });
}

function captureScrollState(view) {
  const canvas = document.querySelector('.ctx-canvas');
  return {
    canvasTop: canvas ? canvas.scrollTop : 0,
    viewTop: view ? view.scrollTop : 0,
  };
}

function screenPath(screen) {
  const variant = screen.variant && screen.variant.attr ? `${screen.variant.attr}-${screen.variant.val}` : 'default';
  return `screens/${slug(screen.viewId)}/${slug(variant)}.json`;
}

function visualPath(screen) {
  const variant = screen.variant && screen.variant.attr ? `${screen.variant.attr}-${screen.variant.val}` : 'default';
  return `assets/screens/${slug(screen.viewId)}-${slug(variant)}.png`;
}

function filenameFor(name, iso) {
  const stamp = iso.replace(/[:.]/g, '-');
  return `advanced-mock-styles-${slug(name || 'custom')}-${stamp}.figma-export.zip`;
}

function exportReadme(manifest) {
  return [
    '# Advanced Mock Styles Figma Export',
    '',
    `Preset: ${manifest.preset.name}`,
    `Screens: ${manifest.counts.screens}`,
    '',
    'Import this package with the local Figma plugin in figma-importer/.',
    'No Figma auth token or REST API access is required.',
    'Each screen includes a pixel reference image plus editable DOM-derived layers.',
    '',
  ].join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function settle() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (document.fonts && document.fonts.ready) {
          try { await document.fonts.ready; } catch (e) { /* noop */ }
        }
        resolve();
      });
    });
  });
}

function safeCall(fn) {
  try { return fn(); } catch (e) { return null; }
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error || 'Unknown export error');
}

function errorDetails(error) {
  if (!error) return null;
  return {
    name: error.name || null,
    message: error.message || String(error),
    type: error.type || null,
    target: error.target && error.target.tagName ? error.target.tagName : null,
  };
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

function attrEscape(value) {
  return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function slug(value) {
  return String(value || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'default';
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeZip(files) {
  const entries = [];
  let offset = 0;
  const localParts = [];
  Object.keys(files).sort().forEach((path) => {
    const nameBytes = encoder.encode(path);
    const data = toBytes(files[path]);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    write32(view, 0, 0x04034b50);
    write16(view, 4, 20);
    write16(view, 6, 0);
    write16(view, 8, 0);
    write16(view, 10, 0);
    write16(view, 12, 0);
    write32(view, 14, crc);
    write32(view, 18, data.length);
    write32(view, 22, data.length);
    write16(view, 26, nameBytes.length);
    write16(view, 28, 0);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);
    entries.push({ path, nameBytes, data, crc, offset });
    offset += local.length;
  });

  const centralParts = entries.map((entry) => {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    write32(view, 0, 0x02014b50);
    write16(view, 4, 20);
    write16(view, 6, 20);
    write16(view, 8, 0);
    write16(view, 10, 0);
    write16(view, 12, 0);
    write16(view, 14, 0);
    write32(view, 16, entry.crc);
    write32(view, 20, entry.data.length);
    write32(view, 24, entry.data.length);
    write16(view, 28, entry.nameBytes.length);
    write16(view, 30, 0);
    write16(view, 32, 0);
    write16(view, 34, 0);
    write16(view, 36, 0);
    write32(view, 38, 0);
    write32(view, 42, entry.offset);
    central.set(entry.nameBytes, 46);
    return central;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, centralOffset);
  write16(endView, 20, 0);
  return concatBytes([...localParts, ...centralParts, end]);
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return encoder.encode(String(value));
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  const base64 = parts.length > 1 ? parts[1] : parts[0];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
