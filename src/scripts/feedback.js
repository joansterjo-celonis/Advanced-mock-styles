// ============================================================
//  Feedback feature — a layer built ON TOP of the prototype.
//
//  Flow:
//   - A launcher button (next to the proto FAB) opens a menu with
//     "Give feedback" and "See all feedback".
//   - Give feedback: drag a rectangle anywhere on screen, write a
//     comment, and it's saved to the shared feedback bin together
//     with a full snapshot of the prototype controls (via the
//     IA.captureState bridge) + the active view + scroll + viewport.
//   - See all feedback: browse everyone's notes; opening one restores
//     the exact controls (IA.applyState), switches to the saved view,
//     and overlays the saved rectangle + comment.
//
//  Storage is JSONBin.io (see cloud-store.js), with a transparent
//  localStorage fallback when no key is configured. This module never
//  touches the prototype's own logic — only the IA.* bridge.
// ============================================================

import { icon } from './icons.js';
import {
  isCloudEnabled, getFeedback, addFeedback, deleteFeedback,
  ensureAuthor, getAuthor,
} from './cloud-store.js';

let launcher, menu, panel, overlay, popup, marker, viewbar, toastEl;
let annotating = false, viewing = false, currentEntry = null;

const SUBTAB_ATTRS = ['data-sub', 'data-rqsub', 'data-ocsub', 'data-acsub', 'data-invsub', 'data-shsub', 'data-trsub'];
const ROOT_CONTEXT_ATTRS = ['data-layout', 'data-tabfx', 'data-tabmodel', 'data-tabs', 'data-density', 'data-composition'];

export function initFeedback() {
  if (typeof document === 'undefined' || document.querySelector('.fab-feedback')) return; // idempotent
  mountLauncher();
  document.addEventListener('keydown', onKey);
  if (import.meta.env.DEV) console.info('[feedback] ready · cloud =', isCloudEnabled());
}

/* ---------------- launcher + menu ---------------- */

function mountLauncher() {
  launcher = document.createElement('button');
  launcher.className = 'fab fab-feedback';
  launcher.id = 'fab-feedback';
  launcher.title = 'Feedback';
  launcher.setAttribute('aria-label', 'Feedback');
  launcher.innerHTML = icon('message');
  document.body.appendChild(launcher);

  menu = document.createElement('div');
  menu.className = 'fb-menu';
  menu.innerHTML =
    `<button type="button" class="fb-menu-item" data-act="give">${icon('edit')}<span><b>Give feedback</b><small>Mark an area and add a comment</small></span></button>` +
    `<button type="button" class="fb-menu-item" data-act="see">${icon('inbox')}<span><b>See all feedback</b><small>Browse what everyone shared</small></span></button>`;
  document.body.appendChild(menu);

  launcher.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
  menu.addEventListener('click', (e) => {
    const it = e.target.closest('.fb-menu-item'); if (!it) return;
    if (it.dataset.act === 'give') startAnnotate(); else openPanel();
  });
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !e.target.closest('.fb-menu') && !e.target.closest('.fab-feedback')) closeMenu();
  });
}

function toggleMenu() { menu.classList.contains('open') ? closeMenu() : openMenu(); }
function openMenu() { closePanel(); menu.classList.add('open'); }
function closeMenu() { if (menu) menu.classList.remove('open'); }

/* ---------------- give feedback (annotate) ---------------- */

function startAnnotate() {
  if (annotating || viewing) return;
  closeMenu();
  annotating = true;

  overlay = document.createElement('div');
  overlay.className = 'fb-overlay';
  overlay.innerHTML = '<div class="fb-hint">Drag to mark the area you want to comment on · <b>Esc</b> to cancel</div>';
  document.body.appendChild(overlay);

  let sx = 0, sy = 0, box = null, drawing = false;

  const onDown = (e) => {
    if (e.button !== 0) return;
    drawing = true; sx = e.clientX; sy = e.clientY;
    box = document.createElement('div'); box.className = 'fb-rect';
    overlay.appendChild(box); positionBox(box, sx, sy, sx, sy);
    try { overlay.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  };
  const onMove = (e) => { if (drawing && box) positionBox(box, sx, sy, e.clientX, e.clientY); };
  const onUp = (e) => {
    if (!drawing) return;
    drawing = false;
    const r = rectFrom(sx, sy, e.clientX, e.clientY);
    if (r.w < 6 || r.h < 6) { if (box) { box.remove(); box = null; } return; } // ignore stray clicks; allow retry
    overlay.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    overlay.style.pointerEvents = 'none'; // let the popup take over; keep the drawn rect visible
    openComment(r);
  };

  overlay.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function cancelAnnotate() {
  annotating = false;
  if (popup) { popup.remove(); popup = null; }
  if (overlay) { overlay.remove(); overlay = null; }
}

function openComment(rect) {
  popup = document.createElement('div');
  popup.className = 'fb-popup';
  popup.innerHTML =
    '<div class="fb-popup-title">Add your feedback</div>' +
    '<textarea class="fb-textarea" rows="4" placeholder="What\'s working, what\'s not, ideas..."></textarea>' +
    '<div class="fb-popup-actions">' +
      '<button type="button" class="fb-btn fb-cancel">Cancel</button>' +
      '<button type="button" class="fb-btn fb-btn-primary fb-submit">Send feedback</button>' +
    '</div>';
  document.body.appendChild(popup);
  placePopup(popup, rect);

  const ta = popup.querySelector('.fb-textarea');
  requestAnimationFrame(() => ta.focus());
  popup.querySelector('.fb-cancel').addEventListener('click', cancelAnnotate);
  popup.querySelector('.fb-submit').addEventListener('click', () => submitComment(rect, ta));
  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitComment(rect, ta); }
  });
}

async function submitComment(rect, ta) {
  const text = (ta.value || '').trim();
  if (!text) { ta.focus(); return; }
  const btn = popup.querySelector('.fb-submit');
  btn.disabled = true; btn.textContent = 'Sending...';

  const author = await ensureAuthor(); // one-time name prompt
  const entry = snapshot(rect);
  entry.text = text;
  entry.author = author || 'Anonymous';

  const ok = await addFeedback(entry);
  cancelAnnotate();
  if (!isCloudEnabled()) toast('Server not configured — saved on this browser only.');
  else if (ok) toast('Feedback sent. Thank you!');
  else toast('Couldn\'t reach the server — saved locally, will retry.');
}

function snapshot(rect) {
  const cap = (window.IA && typeof window.IA.captureState === 'function') ? safe(window.IA.captureState) : null;
  const hit = hitContext(rect);
  const screen = captureScreen(hit.view);
  return {
    id: 'fb-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
    author: getAuthor() || 'Anonymous',
    text: '',
    ts: Date.now(),
    controls: cap,
    screen,
    view: { id: screen.viewId, sub: screen.sub, scroll: screen.scroll.top },
    viewport: { w: window.innerWidth, h: window.innerHeight },
    rect,
    anchor: computeAnchor(rect, hit),
  };
}

function captureScreen(view) {
  const app = document.getElementById('app');
  const rc = document.getElementById('route-context');
  const scroll = scrollState(view);
  return {
    route: (app && app.dataset.route) || null,
    contextMode: rc && rc.classList.contains('mode-editor') ? 'editor' : (rc && rc.classList.contains('mode-overview') ? 'overview' : null),
    viewId: view ? view.getAttribute('data-view') : activeViewId(),
    tabViewId: activeTabId(),
    sub: activeSub(view),
    scroll,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    rootAttrs: captureRootAttrs(),
    split: captureSplitState(view),
    inverted: (window.IA && typeof window.IA.captureInverted === 'function') ? (safe(window.IA.captureInverted) || []) : [],
  };
}

function captureRootAttrs() {
  const attrs = {};
  const root = document.documentElement;
  ROOT_CONTEXT_ATTRS.forEach((name) => { attrs[name] = root.hasAttribute(name) ? (root.getAttribute(name) || '') : null; });
  return attrs;
}

function captureSplitState(view) {
  const split = document.querySelector('.sv-split');
  if (!split) return { active: false };
  const pane = view && view.closest('.sv-pane');
  return {
    active: true,
    pane: pane && pane.classList.contains('sv-pane-right') ? 'right' : 'left',
    views: Array.from(split.querySelectorAll('.sv-pane > .view[data-view]')).map((v) => v.getAttribute('data-view')),
  };
}

// Bind the rectangle to the content element under it (a card or chart) so it
// re-lands on the right spot at any window size. Returns null when the mark is
// over empty space / chrome — the viewport-scaled rect is the fallback then.
function computeAnchor(rect, ctx) {
  try {
    const context = ctx || hitContext(rect);
    const view = context.view || activeView();
    if (!view) return null;
    const hit = context.hit;

    const anchorEl = hit ? hit.closest('[data-chart],[data-card]') : null;
    if (!anchorEl || !view.contains(anchorEl)) return null;

    const a = anchorEl.getBoundingClientRect();
    if (a.width < 1 || a.height < 1) return null;
    const nrect = {
      nx: (rect.x - a.left) / a.width,
      ny: (rect.y - a.top) / a.height,
      nw: rect.w / a.width,
      nh: rect.h / a.height,
    };
    const viewId = view.getAttribute('data-view');

    if (anchorEl.matches('[data-chart]')) {
      const chart = anchorEl.getAttribute('data-chart');
      const key = anchorEl.getAttribute('data-key') || null;
      const same = Array.from(view.querySelectorAll('[data-chart="' + cssEsc(chart) + '"]'));
      return { type: 'chart', view: viewId, chart, key, idx: Math.max(0, same.indexOf(anchorEl)), nrect };
    }
    const cards = Array.from(view.querySelectorAll('[data-card]'));
    return { type: 'card', view: viewId, idx: Math.max(0, cards.indexOf(anchorEl)), nrect };
  } catch (e) {
    return null;
  }
}

/* ---------------- see all feedback (panel) ---------------- */

async function openPanel() {
  closeMenu();
  if (!panel) { panel = document.createElement('div'); panel.className = 'fb-panel'; document.body.appendChild(panel); }
  panel.classList.add('open');
  renderPanelLoading();
  renderPanel(await getFeedback());
}
function closePanel() { if (panel) panel.classList.remove('open'); }

function renderPanelLoading() {
  panel.innerHTML =
    '<div class="fb-panel-head"><span class="fb-panel-title">Feedback</span></div>' +
    '<div class="fb-loading">Loading…</div>';
}

function renderPanel(items) {
  const list = (items || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  panel.innerHTML =
    '<div class="fb-panel-head">' +
      '<span class="fb-panel-title">Feedback</span>' +
      '<span class="fb-panel-count">' + list.length + '</span>' +
      '<button type="button" class="fb-btn fb-panel-refresh">Refresh</button>' +
      '<button type="button" class="fb-panel-close" title="Close">' + icon('close') + '</button>' +
    '</div>' +
    '<div class="fb-panel-body"></div>';
  const body = panel.querySelector('.fb-panel-body');
  if (!list.length) {
    body.innerHTML = '<div class="fb-empty">No feedback yet. Use \u201CGive feedback\u201D to add the first note.</div>';
  } else {
    list.forEach((entry) => body.appendChild(panelRow(entry)));
  }
  panel.querySelector('.fb-panel-close').addEventListener('click', closePanel);
  panel.querySelector('.fb-panel-refresh').addEventListener('click', async () => {
    renderPanelLoading(); renderPanel(await getFeedback());
  });
}

function panelRow(entry) {
  const screen = screenFromEntry(entry);
  const row = document.createElement('div');
  row.className = 'fb-row';
  row.innerHTML =
    '<div class="fb-row-main">' +
      '<div class="fb-row-top"><span class="fb-row-author">' + esc(entry.author || 'Anonymous') + '</span>' +
      '<span class="fb-row-time">' + esc(relTime(entry.ts)) + '</span></div>' +
      '<div class="fb-row-text">' + esc(entry.text || '') + '</div>' +
      '<div class="fb-row-meta">' + icon('view') + '<span>' + esc(viewLabel(screen.viewId)) + '</span></div>' +
    '</div>' +
    '<button type="button" class="fb-row-del" title="Delete">' + icon('trash') + '</button>';
  row.querySelector('.fb-row-main').addEventListener('click', () => enterView(entry));
  row.querySelector('.fb-row-del').addEventListener('click', async (e) => {
    e.stopPropagation();
    row.classList.add('removing');
    const ok = await deleteFeedback(entry.id);
    if (ok) { row.remove(); bumpCount(-1); } else { row.classList.remove('removing'); toast('Could not delete.'); }
  });
  return row;
}

function bumpCount(delta) {
  const el = panel && panel.querySelector('.fb-panel-count'); if (!el) return;
  el.textContent = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta);
  const body = panel.querySelector('.fb-panel-body');
  if (body && !body.querySelector('.fb-row')) body.innerHTML = '<div class="fb-empty">No feedback yet. Use \u201CGive feedback\u201D to add the first note.</div>';
}

/* ---------------- view mode (replay a snapshot) ---------------- */

async function enterView(entry) {
  closePanel();
  exitView();
  viewing = true; currentEntry = entry;

  const screen = screenFromEntry(entry);
  if (screen.rootAttrs) applyRootAttrs(screen.rootAttrs);
  if (window.IA && typeof window.IA.restoreScreen === 'function') {
    safe(() => window.IA.restoreScreen(screen));
  } else if (screen.viewId && window.IA && typeof window.IA.selectView === 'function') {
    safe(() => window.IA.selectView(screen.viewId));
  }
  if (entry.controls && window.IA && typeof window.IA.applyState === 'function') safe(() => window.IA.applyState(entry.controls));
  if (screen.viewId && window.IA && typeof window.IA.selectView === 'function') safe(() => window.IA.selectView(screen.viewId));

  showViewbar(entry);

  await waitForViewReady(screen.viewId);
  if (!viewing) return;
  restoreSub(screen);
  await waitFrames(2);
  if (!viewing) return;
  // Re-apply per-card inversions after controls + view are settled (applyState re-renders
  // charts and clears inverted cards, so this must run last).
  if (window.IA && typeof window.IA.applyInverted === 'function') safe(() => window.IA.applyInverted(screen.inverted || []));
  restoreScroll(screen);
  drawMarker(entry);
  attachTracking();
}

function exitView() {
  if (!viewing && !marker && !viewbar) return;
  viewing = false; currentEntry = null;
  detachTracking();
  removeMarker();
  if (viewbar) { viewbar.remove(); viewbar = null; }
}

// Keep the anchored marker glued to its element as the page scrolls or resizes.
function onViewSync() { if (viewing && currentEntry) positionMarker(currentEntry); }
function attachTracking() {
  window.addEventListener('resize', onViewSync);
  window.addEventListener('scroll', onViewSync, true); // capture: catch inner scrollers too
}
function detachTracking() {
  window.removeEventListener('resize', onViewSync);
  window.removeEventListener('scroll', onViewSync, true);
}

function drawMarker(entry) {
  if (!marker) {
    marker = document.createElement('div');
    marker.className = 'fb-marker';
    marker.innerHTML = '<div class="fb-marker-rect"></div>' +
      '<div class="fb-bubble"><div class="fb-bubble-author">' + esc(entry.author || 'Anonymous') + '</div>' +
      '<div class="fb-bubble-text">' + esc(entry.text || '') + '</div></div>';
    document.body.appendChild(marker);
  }
  positionMarker(entry);
}

// Recompute the marker box every time (cheap) so it tracks its element on scroll/resize.
function positionMarker(entry) {
  if (!marker) return;
  const box = resolveBox(entry);
  const rectEl = marker.querySelector('.fb-marker-rect');
  rectEl.style.left = box.x + 'px'; rectEl.style.top = box.y + 'px';
  rectEl.style.width = box.w + 'px'; rectEl.style.height = box.h + 'px';
  placeBubble(marker.querySelector('.fb-bubble'), box);
  const hint = viewbar && viewbar.querySelector('.fb-vb-hint');
  if (hint) hint.hidden = !box.approx;
}

// Resolve where to draw: prefer the content anchor (consistent across sizes),
// else fall back to scaling the raw rect by the viewport ratio.
function resolveBox(entry) {
  const a = entry.anchor;
  if (a && a.nrect) {
    const el = resolveAnchorEl(a);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        return {
          x: r.left + a.nrect.nx * r.width,
          y: r.top + a.nrect.ny * r.height,
          w: a.nrect.nw * r.width,
          h: a.nrect.nh * r.height,
          approx: false,
        };
      }
    }
  }
  const vp = entry.viewport || { w: window.innerWidth, h: window.innerHeight };
  const sx = window.innerWidth / (vp.w || window.innerWidth);
  const sy = window.innerHeight / (vp.h || window.innerHeight);
  const r = entry.rect || { x: 0, y: 0, w: 0, h: 0 };
  const approx = Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02;
  return { x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy, approx };
}

function resolveAnchorEl(a) {
  const view = a.view ? document.querySelector('.view[data-view="' + cssEsc(a.view) + '"]') : activeView();
  const scope = view || document;
  if (a.type === 'chart') {
    let list = Array.from(scope.querySelectorAll('[data-chart="' + cssEsc(a.chart) + '"]'));
    if (a.key) {
      const keyed = list.filter(el => el.getAttribute('data-key') === a.key);
      if (keyed.length) list = keyed;
    }
    return list[a.idx] || list[0] || null;
  }
  return scope.querySelectorAll('[data-card]')[a.idx] || null;
}
function removeMarker() { if (marker) { marker.remove(); marker = null; } }

function showViewbar(entry) {
  viewbar = document.createElement('div');
  viewbar.className = 'fb-viewbar';
  const vp = entry.viewport;
  const sizeBadge = (vp && vp.w && vp.h)
    ? '<span class="fb-vb-badge" title="Window size when this feedback was captured">captured at ' + vp.w + '×' + vp.h + '</span>'
    : '';
  viewbar.innerHTML =
    '<span class="fb-vb-dot"></span>' +
    '<span class="fb-vb-text">Viewing feedback from <b>' + esc(entry.author || 'Anonymous') + '</b> · ' + esc(relTime(entry.ts)) + '</span>' +
    sizeBadge +
    '<span class="fb-vb-hint" hidden>approximate placement</span>' +
    '<button type="button" class="fb-btn fb-vb-exit">Exit</button>';
  document.body.appendChild(viewbar);
  viewbar.querySelector('.fb-vb-exit').addEventListener('click', exitView);
}

/* ---------------- shared helpers ---------------- */

function onKey(e) {
  if (e.key !== 'Escape') return;
  if (popup) cancelAnnotate();
  else if (annotating) cancelAnnotate();
  else if (menu && menu.classList.contains('open')) closeMenu();
  else if (panel && panel.classList.contains('open')) closePanel();
  else if (viewing) exitView();
}

function activeView() { return document.querySelector('.view.active'); }
function activeViewId() { const v = activeView(); return v ? v.getAttribute('data-view') : null; }
function activeTabId() {
  const t = document.querySelector('.tabbar .tabs .ia-tab.active[data-view]:not(.sv-tab-split)');
  return t ? t.getAttribute('data-view') : null;
}
function activeSub(view) {
  const v = view || activeView(); if (!v) return null;
  const s = v.querySelector('.subtab.on'); if (!s) return null;
  for (const a of SUBTAB_ATTRS) { if (s.hasAttribute(a)) return { attr: a, val: s.getAttribute(a) }; }
  const dyn = s.getAttributeNames().find((a) => /^data-.+sub$/.test(a));
  if (dyn) return { attr: dyn, val: s.getAttribute(dyn) };
  return null;
}
function scrollElForView(view) {
  if (view && view.closest('.sv-pane')) return view;
  if (document.documentElement.getAttribute('data-layout') === 'flowy') {
    const v = view || activeView(); if (v) return v;
  }
  return document.querySelector('.ctx-canvas') || document.scrollingElement || document.documentElement;
}
function scrollEl() { return scrollElForView(activeView()); }
function scrollState(view) {
  const el = scrollElForView(view);
  let source = 'document';
  if (el && el.classList && el.classList.contains('view')) source = 'view';
  else if (el && el.classList && el.classList.contains('ctx-canvas')) source = 'ctx-canvas';
  return {
    source,
    top: (el && typeof el.scrollTop === 'number') ? el.scrollTop : 0,
    viewId: view ? view.getAttribute('data-view') : activeViewId(),
  };
}
function screenFromEntry(entry) {
  const s = (entry && entry.screen) || null;
  if (s) {
    const scroll = (s.scroll && typeof s.scroll === 'object') ? s.scroll : { source: 'legacy', top: Number(s.scroll || 0) || 0 };
    return { ...s, viewId: s.viewId || s.id || (entry.view && entry.view.id) || null, scroll, inverted: s.inverted || [] };
  }
  const v = (entry && entry.view) || {};
  return {
    route: 'context',
    contextMode: 'editor',
    viewId: v.id || null,
    tabViewId: v.id || null,
    sub: v.sub || null,
    scroll: { source: 'legacy', top: Number(v.scroll || 0) || 0, viewId: v.id || null },
    viewport: entry && entry.viewport,
    rootAttrs: null,
    split: { active: false },
    inverted: [],
  };
}
function applyRootAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return;
  Object.keys(attrs).forEach((name) => {
    if (!ROOT_CONTEXT_ATTRS.includes(name)) return;
    const val = attrs[name];
    if (val == null) document.documentElement.removeAttribute(name);
    else document.documentElement.setAttribute(name, String(val));
  });
}
function hitContext(rect) {
  return withFeedbackChromeHidden(() => {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { hit, view: (hit && hit.closest('.view[data-view]')) || activeView() };
  });
}
function withFeedbackChromeHidden(fn) {
  const oPrev = overlay ? overlay.style.display : null;
  const pPrev = popup ? popup.style.display : null;
  try {
    if (overlay) overlay.style.display = 'none';
    if (popup) popup.style.display = 'none';
    return fn();
  } finally {
    if (overlay) overlay.style.display = oPrev == null ? '' : oPrev;
    if (popup) popup.style.display = pPrev == null ? '' : pPrev;
  }
}
function restoreSub(view) {
  if (!view || !view.sub) return;
  const attr = view.sub.attr;
  if (!/^data-[\w-]+$/.test(attr || '')) return;
  const scope = view.viewId ? document.querySelector('.view[data-view="' + cssEsc(view.viewId) + '"]') : document.querySelector('.view.active');
  const el = scope && scope.querySelector('.subtab[' + attr + '="' + cssEsc(view.sub.val) + '"]');
  if (el) el.click();
}
function restoreScroll(view) {
  if (!view) return;
  const target = view.viewId ? document.querySelector('.view[data-view="' + cssEsc(view.viewId) + '"]') : activeView();
  const scroll = (view.scroll && typeof view.scroll === 'object') ? view.scroll : { source: 'legacy', top: view.scroll };
  let el = null;
  if (scroll.source === 'view') el = target;
  else if (scroll.source === 'ctx-canvas') el = document.querySelector('.ctx-canvas');
  else el = scrollElForView(target);
  if (el && typeof scroll.top === 'number') {
    el.scrollTop = scroll.top;
    el.dispatchEvent(new Event('scroll', { bubbles: false }));
  }
}
function waitFrames(count) {
  return new Promise((resolve) => {
    let left = Math.max(1, count || 1);
    const tick = () => { if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
function waitForViewReady(viewId) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      if (!viewing) { resolve(false); return; }
      const view = viewId ? document.querySelector('.view[data-view="' + cssEsc(viewId) + '"]') : activeView();
      const ready = !!(view && view.classList.contains('active') && view.getClientRects().length && getComputedStyle(view).display !== 'none');
      if (ready || tries++ > 45) { resolve(ready); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function viewLabel(id) {
  if (!id) return 'Unknown view';
  const t = document.querySelector('.tabs .ia-tab[data-view="' + id + '"] .ia-tab-lbl');
  return (t && t.textContent.trim()) || id;
}

function rectFrom(x0, y0, x1, y1) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}
function positionBox(box, x0, y0, x1, y1) {
  const r = rectFrom(x0, y0, x1, y1);
  box.style.left = r.x + 'px'; box.style.top = r.y + 'px';
  box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
}
function placePopup(el, rect) {
  const m = 12, vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight;
  let left = rect.x + rect.w + m;
  if (left + w > vw - m) left = rect.x - w - m;
  if (left < m) left = Math.max(m, Math.min(vw - w - m, rect.x));
  let top = rect.y;
  if (top + h > vh - m) top = vh - h - m;
  if (top < m) top = m;
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function placeBubble(el, rect) {
  const m = 10, vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight;
  let left = rect.x; if (left + w > vw - m) left = vw - w - m; if (left < m) left = m;
  let top = rect.y + rect.h + 10;
  if (top + h > vh - m) top = rect.y - h - 10;
  if (top < m) top = m;
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

let toastT;
function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = document.createElement('div');
  toastEl.className = 'fb-toast';
  toastEl.textContent = msg;
  document.body.appendChild(toastEl);
  clearTimeout(toastT);
  toastT = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, 2800);
}

function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
  return new Date(ts).toLocaleDateString();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safe(fn) { try { return fn(); } catch (e) { return null; } }
function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'); }
