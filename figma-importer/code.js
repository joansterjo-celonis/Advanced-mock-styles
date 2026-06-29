// Advanced Mock Styles Importer
// Runs inside Figma and turns a .figma-export.zip package into native frames.

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

const componentByRole = new Map();
let componentCursor = { x: 0, y: 0 };

figma.ui.onmessage = async (msg) => {
  if (!msg || msg.type !== 'import-package') return;
  try {
    await importPackage(msg.package);
  } catch (error) {
    figma.ui.postMessage({ type: 'import-error', message: error && error.message ? error.message : String(error) });
  }
};

async function importPackage(pkg) {
  if (!pkg || !pkg.manifest || !Array.isArray(pkg.screens)) throw new Error('Invalid export package.');
  componentByRole.clear();
  componentCursor = { x: 0, y: 0 };

  await loadFonts(pkg);

  const manifest = pkg.manifest;
  const pageName = safeName('AMS - ' + (manifest.preset && manifest.preset.name ? manifest.preset.name : 'Export'));
  figma.currentPage.name = pageName;

  const componentShelf = figma.createFrame();
  componentShelf.name = 'Advanced Mock Components';
  componentShelf.x = 0;
  componentShelf.y = -420;
  componentShelf.resize(1200, 320);
  componentShelf.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }];
  figma.currentPage.appendChild(componentShelf);
  componentCursor = { x: componentShelf.x + 24, y: componentShelf.y + 56 };

  const title = await createText('Components generated from first matching screen layers', 18, { x: 24, y: 18, w: 900, h: 28 });
  componentShelf.appendChild(title);

  const imported = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const gap = 96;

  for (const screen of pkg.screens) {
    const frame = figma.createFrame();
    frame.name = screenName(screen);
    frame.x = x;
    frame.y = y;
    frame.resize(Math.max(100, screen.frame.w || 1440), Math.max(100, screen.frame.h || 900));
    frame.clipsContent = true;
    frame.fills = solidFill(screen.nodeTree && screen.nodeTree.style && screen.nodeTree.style.backgroundColor) || [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    figma.currentPage.appendChild(frame);

    if (Array.isArray(screen.editableLayers) && screen.editableLayers.length) {
      await buildEditableLayers(screen, frame);
    } else {
      await buildChildren(screen.nodeTree, frame, { x: 0, y: 0 });
    }
    await createVisualReference(screen, frame, pkg.assets || {});
    imported.push(frame);

    x += frame.width + gap;
    rowHeight = Math.max(rowHeight, frame.height);
    if (x > 4200) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
  }

  if (imported.length) {
    figma.viewport.scrollAndZoomIntoView(imported);
  }

  figma.ui.postMessage({
    type: 'import-complete',
    screens: imported.length,
    components: componentByRole.size,
  });
  figma.notify('Imported ' + imported.length + ' screens and ' + componentByRole.size + ' component samples.');
}

async function createVisualReference(screen, frame, assets) {
  if (!screen || !screen.visual || !screen.visual.path) return false;
  const bytes = assets && assets[screen.visual.path];
  if (!bytes) return false;
  try {
    const image = figma.createImage(bytes);
    const rect = figma.createRectangle();
    rect.name = 'Pixel reference (hidden)';
    rect.x = 0;
    rect.y = 0;
    rect.resize(frame.width, frame.height);
    rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
    rect.locked = true;
    rect.visible = false;
    frame.appendChild(rect);
    return true;
  } catch (e) {
    return false;
  }
}

async function buildEditableLayers(screen, frame) {
  const editable = figma.createFrame();
  editable.name = 'Editable screen';
  editable.x = 0;
  editable.y = 0;
  editable.resize(frame.width, frame.height);
  editable.fills = [];
  editable.clipsContent = false;
  frame.appendChild(editable);

  const layers = screen.editableLayers.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const layer of layers) await buildFlatLayer(layer, editable);
}

async function buildFlatLayer(layer, parent) {
  if (!layer || !layer.rect) return null;
  if (layer.type === 'text') return createTextLayer(layer, parent);
  if (layer.type === 'svg') return createFlatSvgLayer(layer, parent);
  if (layer.type === 'box') return createBoxLayer(layer, parent);
  return null;
}

function createBoxLayer(layer, parent) {
  const rect = layer.rect;
  const style = layer.style || {};
  const node = figma.createFrame();
  node.name = layerName(layer);
  node.x = rect.x || 0;
  node.y = rect.y || 0;
  node.resize(Math.max(1, rect.w || 1), Math.max(1, rect.h || 1));
  node.clipsContent = false;
  node.fills = fillsForBox(style);
  const stroke = solidPaint(style.borderTopColor || style.borderRightColor || style.borderBottomColor || style.borderLeftColor);
  const weight = borderWeight(style);
  if (stroke && weight > 0) {
    node.strokes = [stroke];
    node.strokeWeight = weight;
  }
  node.cornerRadius = radius(style.borderRadius);
  node.opacity = opacity(style.opacity);
  const effects = shadowEffect(style.boxShadow);
  if (effects.length) node.effects = effects;
  parent.appendChild(node);
  maybeCreateComponentSample(layer.role, node);
  return node;
}

function fillsForBox(style) {
  const fill = solidFill(style.backgroundColor);
  if (fill) return fill;
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    const gradientFill = firstGradientColor(style.backgroundImage);
    if (gradientFill) return [gradientFill];
  }
  return [];
}

function firstGradientColor(value) {
  const colorMatch = String(value || '').match(/rgba?\([^)]+\)|color\([^)]+\)|#[0-9a-fA-F]{3,8}/);
  return colorMatch ? solidPaint(colorMatch[0]) : null;
}

async function createTextLayer(layer, parent) {
  const rect = layer.rect || {};
  const textNode = await createText(layer.text || '', fontSize(layer.style && layer.style.fontSize), {
    x: rect.x || 0,
    y: rect.y || 0,
    w: Math.max(1, rect.w || 1),
    h: Math.max(1, rect.h || 1),
  }, layer.style || {});
  textNode.name = layer.name || 'Text';
  parent.appendChild(textNode);
  return textNode;
}

function createFlatSvgLayer(layer, parent) {
  try {
    const svg = figma.createNodeFromSvg(layer.svg);
    svg.name = layerName(layer);
    svg.x = layer.rect.x || 0;
    svg.y = layer.rect.y || 0;
    try { svg.resize(Math.max(1, layer.rect.w || 1), Math.max(1, layer.rect.h || 1)); } catch (e) { /* noop */ }
    parent.appendChild(svg);
    maybeCreateComponentSample(layer.role, svg);
    return svg;
  } catch (e) {
    const fallbackLayer = {
      type: 'box',
      name: layer.name,
      role: layer.role || 'vector',
      rect: layer.rect,
      style: layer.style,
    };
    return createBoxLayer(fallbackLayer, parent);
  }
}

async function loadFonts(pkg) {
  const fonts = new Set(['Inter:Regular', 'Inter:Medium', 'Inter:Semi Bold', 'Inter:Bold']);
  (pkg.screens || []).forEach((screen) => scanFonts(screen.nodeTree, fonts));
  for (const key of fonts) {
    const parts = key.split(':');
    try { await figma.loadFontAsync({ family: parts[0], style: parts[1] || 'Regular' }); }
    catch (e) { /* Figma will fall back if Inter is unavailable in the file. */ }
  }
}

function scanFonts(node, fonts) {
  if (!node) return;
  const style = node.style || {};
  const family = (style.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
  if (family) fonts.add(family + ':' + weightToStyle(style.fontWeight));
  (node.children || []).forEach((child) => scanFonts(child, fonts));
}

async function buildChildren(node, parent, parentAbs) {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) await buildNode(child, parent, parentAbs);
}

async function buildNode(node, parent, parentAbs) {
  if (!node || !node.rect) return null;
  const rect = node.rect;
  if (rect.w < 1 || rect.h < 1) return null;
  const style = node.style || {};
  const role = node.role || null;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const fill = solidFill(style.backgroundColor);
  const stroke = solidPaint(style.borderTopColor);
  const hasStroke = stroke && borderWeight(style) > 0;
  const hasVisualBox = !!fill || hasStroke || !!role || hasChildren;

  if (node.svg) {
    return createSvgNode(node, parent, parentAbs);
  }

  let container = parent;
  let containerAbs = parentAbs;
  let created = null;

  if (hasVisualBox) {
    created = figma.createFrame();
    created.name = layerName(node);
    created.x = rect.x - parentAbs.x;
    created.y = rect.y - parentAbs.y;
    created.resize(Math.max(1, rect.w), Math.max(1, rect.h));
    created.clipsContent = false;
    created.fills = fill || [];
    if (hasStroke) {
      created.strokes = [stroke];
      created.strokeWeight = borderWeight(style);
    }
    created.cornerRadius = radius(style.borderRadius);
    created.opacity = opacity(style.opacity);
    const effects = shadowEffect(style.boxShadow);
    if (effects.length) created.effects = effects;
    parent.appendChild(created);
    container = created;
    containerAbs = { x: rect.x, y: rect.y };
    maybeCreateComponentSample(role, created);
  }

  if (node.text) {
    const textParent = created || parent;
    const textAbs = created ? { x: rect.x, y: rect.y } : parentAbs;
    const textNode = await createText(node.text, fontSize(style.fontSize), {
      x: (created ? 6 : rect.x - textAbs.x),
      y: created ? Math.max(2, (rect.h - fontSize(style.fontSize)) / 2 - 2) : rect.y - textAbs.y,
      w: Math.max(1, rect.w - (created ? 12 : 0)),
      h: Math.max(1, rect.h),
    }, style);
    textParent.appendChild(textNode);
  }

  if (hasChildren) await buildChildren(node, container, containerAbs);
  return created;
}

function createSvgNode(node, parent, parentAbs) {
  try {
    const svg = figma.createNodeFromSvg(node.svg);
    svg.name = layerName(node);
    svg.x = node.rect.x - parentAbs.x;
    svg.y = node.rect.y - parentAbs.y;
    try { svg.resize(node.rect.w, node.rect.h); } catch (e) { /* noop */ }
    parent.appendChild(svg);
    return svg;
  } catch (e) {
    const fallback = figma.createRectangle();
    fallback.name = layerName(node) + ' placeholder';
    fallback.x = node.rect.x - parentAbs.x;
    fallback.y = node.rect.y - parentAbs.y;
    fallback.resize(Math.max(1, node.rect.w), Math.max(1, node.rect.h));
    fallback.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    parent.appendChild(fallback);
    return fallback;
  }
}

async function createText(text, size, rect, style) {
  const node = figma.createText();
  const fontName = { family: preferredFamily(style), style: weightToStyle(style && style.fontWeight) };
  try { await figma.loadFontAsync(fontName); node.fontName = fontName; }
  catch (e) {
    try { await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }); node.fontName = { family: 'Inter', style: 'Regular' }; }
    catch (err) { /* noop */ }
  }
  node.characters = String(text || '').slice(0, 10000);
  node.fontSize = size || 12;
  node.fills = solidFill(style && style.color) || [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  node.x = rect.x || 0;
  node.y = rect.y || 0;
  try { node.resize(Math.max(1, rect.w || 1), Math.max(1, rect.h || size || 12)); } catch (e) { /* noop */ }
  return node;
}

function maybeCreateComponentSample(role, node) {
  if (!role || componentByRole.has(role)) return;
  if (!['asset-header', 'card', 'kpi', 'top-tabs', 'sub-tabs', 'button', 'table', 'chart', 'badge'].includes(role)) return;
  try {
    const clone = node.clone();
    figma.currentPage.appendChild(clone);
    clone.x = componentCursor.x;
    clone.y = componentCursor.y;
    const component = figma.createComponentFromNode(clone);
    component.name = 'AMS/' + titleCase(role);
    componentByRole.set(role, component);
    componentCursor.x += Math.min(300, Math.max(120, component.width)) + 32;
    if (componentCursor.x > 1100) {
      componentCursor.x = 24;
      componentCursor.y += 150;
    }
  } catch (e) {
    // Component samples are a bonus; screen import should continue if one role fails.
  }
}

function layerName(node) {
  if (node.role) return titleCase(node.role);
  if (node.attrs && node.attrs['aria-label']) return node.attrs['aria-label'];
  if (node.text) return node.text.slice(0, 32);
  return node.tag || 'Layer';
}

function screenName(screen) {
  const base = screen.label || screen.viewId || 'Screen';
  const variant = screen.variant && screen.variant.label && screen.variant.label !== 'Default' ? ' - ' + screen.variant.label : '';
  return safeName(base + variant);
}

function safeName(value) {
  return String(value || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

function titleCase(value) {
  return String(value || '').split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function solidFill(css) {
  const paint = solidPaint(css);
  return paint ? [paint] : null;
}

function solidPaint(css) {
  const c = parseColor(css);
  if (!c || c.a <= 0.01) return null;
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
}

function parseColor(css) {
  if (!css || css === 'transparent') return null;
  const raw = String(css).trim();
  if (raw[0] === '#') return parseHexColor(raw);
  const modern = raw.match(/color\(([^)]+)\)/);
  if (modern) return parseModernColor(modern[1]);
  const m = raw.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((part) => part.trim());
  return {
    r: clamp(Number(parts[0]) / 255, 0, 1),
    g: clamp(Number(parts[1]) / 255, 0, 1),
    b: clamp(Number(parts[2]) / 255, 0, 1),
    a: parts[3] == null ? 1 : clamp(Number(parts[3]), 0, 1),
  };
}

function parseHexColor(raw) {
  const hex = raw.replace('#', '').trim();
  if (![3, 4, 6, 8].includes(hex.length)) return null;
  const full = hex.length <= 4 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const int = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(int)) return null;
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
    a: clamp(alpha, 0, 1),
  };
}

function parseModernColor(body) {
  const parts = String(body || '').trim().split(/\s+/);
  if (parts.length < 4) return null;
  const nums = parts.slice(1);
  const slash = nums.indexOf('/');
  const rgbParts = slash >= 0 ? nums.slice(0, slash) : nums.slice(0, 3);
  const alphaPart = slash >= 0 ? nums[slash + 1] : nums[3];
  if (rgbParts.length < 3) return null;
  const rgb = rgbParts.slice(0, 3).map((part) => channel(part));
  const alpha = alphaPart == null ? 1 : alphaValue(alphaPart);
  if (rgb.some((n) => !Number.isFinite(n)) || !Number.isFinite(alpha)) return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
}

function channel(value) {
  const str = String(value || '').trim();
  if (str.endsWith('%')) return clamp(Number(str.slice(0, -1)) / 100, 0, 1);
  const n = Number(str);
  if (!Number.isFinite(n)) return NaN;
  return clamp(n <= 1 ? n : n / 255, 0, 1);
}

function alphaValue(value) {
  const str = String(value || '').trim();
  if (str.endsWith('%')) return clamp(Number(str.slice(0, -1)) / 100, 0, 1);
  return clamp(Number(str), 0, 1);
}

function radius(value) {
  const n = parseFloat(value || '0');
  return Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : 0;
}

function borderWeight(style) {
  const n = parseFloat(style && style.borderTopWidth || '0');
  return Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 0;
}

function opacity(value) {
  const n = parseFloat(value || '1');
  return Number.isFinite(n) ? clamp(n, 0, 1) : 1;
}

function fontSize(value) {
  const n = parseFloat(value || '12');
  return Number.isFinite(n) ? Math.max(6, Math.min(96, n)) : 12;
}

function preferredFamily(style) {
  const raw = style && style.fontFamily ? style.fontFamily.split(',')[0].replace(/["']/g, '').trim() : '';
  return raw || 'Inter';
}

function weightToStyle(weight) {
  const n = parseInt(weight || '400', 10);
  if (n >= 700) return 'Bold';
  if (n >= 600) return 'Semi Bold';
  if (n >= 500) return 'Medium';
  return 'Regular';
}

function shadowEffect(value) {
  if (!value || value === 'none') return [];
  const colorMatch = String(value).match(/rgba?\([^)]+\)/);
  const color = parseColor(colorMatch ? colorMatch[0] : '');
  const nums = value.replace(/rgba?\([^)]+\)/g, '').match(/-?\d+(\.\d+)?px/g) || [];
  if (!color || nums.length < 3) return [];
  return [{
    type: 'DROP_SHADOW',
    visible: true,
    color: { r: color.r, g: color.g, b: color.b, a: color.a },
    offset: { x: parseFloat(nums[0]) || 0, y: parseFloat(nums[1]) || 0 },
    radius: Math.max(0, parseFloat(nums[2]) || 0),
    spread: nums[3] ? parseFloat(nums[3]) || 0 : 0,
    blendMode: 'NORMAL',
  }];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
