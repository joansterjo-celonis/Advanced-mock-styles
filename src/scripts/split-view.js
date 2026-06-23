// ============================================================
//  Side-by-side asset split — self-contained, additive layer.
// ============================================================
// Right-click an asset tab that is NOT currently shown → "Open side by side".
// The chosen asset mounts next to the open one inside a .sv-split frame; the
// gap between the two panes is a draggable resize anchor, and each pane scrolls
// + reflows as its own shrinking viewport.
//
// Design contract (keeps the stable single-view code paths untouched):
//   • The LEFT pane is always the currently-active view and KEEPS its .active
//     class, so every existing `querySelector('.view.active')` still resolves
//     to exactly one element. The RIGHT (secondary) pane is shown purely via
//     the `.sv-pane > .view { display:block }` rule in split-view.css — it is
//     never given .active.
//   • Views are MOVED (never cloned) into the panes so their delegated and
//     direct listeners survive, and element IDs are never duplicated.
//   • Any tab click / close exits split first (restoring the DOM), then lets
//     shell.js's existing tab handler run normally — so we add zero risk to
//     the switch/close logic.

import { renderChartsIn, runCounters } from './engine.js';

const ICON_SPLIT =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>';
const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<path d="M6 6l12 12M18 6 6 18"/></svg>';

// Live split state, or null when in normal single-view mode.
//   { splitEl, divider, leftView, rightView, leftAnchor, rightAnchor, ro,
//     onPaneScroll, roTimer }
let state = null;
let menuEl = null;

const DIVIDER_W = 10;     // keep in sync with .sv-split grid-template middle track
const MIN_RATIO = 0.2;    // neither pane may shrink past 20% of the frame
const MAX_RATIO = 0.8;
const FLAP_FLARE = 16;    // keep in sync with --flap-flare in shell.css

function tabsEl() { return document.querySelector('.tabbar .tabs'); }
function canvasEl() { return document.querySelector('.ctx-canvas'); }
function viewFor(v) { return document.querySelector('.view[data-view="' + v + '"]'); }
function tabFor(v) { return document.querySelector('.tabbar .tabs .ia-tab[data-view="' + v + '"]'); }
function activeView() { return document.querySelector('.view.active'); }

// data-views currently on screen: the active one, plus the right pane when split.
function shownViews() {
  const set = new Set();
  const a = activeView(); if (a) set.add(a.dataset.view);
  if (state && state.rightView) set.add(state.rightView.dataset.view);
  return set;
}

/* ===================== right-click tab menu ===================== */
function buildMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement('div');
  menuEl.className = 'ctxmenu glass';
  menuEl.id = 'sv-tab-ctxmenu';
  menuEl.innerHTML =
    '<button class="ctxmenu-item" data-sv-action="split">' + ICON_SPLIT + 'Open side by side</button>';
  document.body.appendChild(menuEl);
  menuEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('[data-sv-action="split"]')) {
      const v = menuEl._target;
      closeMenu();
      if (v) enterSplit(v);
    }
  });
  return menuEl;
}

function openMenu(x, y, viewId) {
  const m = buildMenu();
  m._target = viewId;
  m.classList.add('open');
  const w = m.offsetWidth, h = m.offsetHeight;
  let left = Math.min(x, window.innerWidth - w - 8);
  let top = y;
  if (top + h > window.innerHeight - 8) top = y - h;
  m.style.left = Math.max(8, left) + 'px';
  m.style.top = Math.max(8, top) + 'px';
}

function closeMenu() { if (menuEl) menuEl.classList.remove('open'); }

/* ===================== enter / swap ===================== */
function enterSplit(secondaryId) {
  const right = viewFor(secondaryId);
  if (!right) return;

  // Already split → just swap the right pane to the newly chosen asset.
  if (state) {
    if (right === state.rightView || right === state.leftView) return;
    swapRight(right);
    return;
  }

  const left = activeView();
  const canvas = canvasEl();
  if (!left || !canvas || left === right) return;

  // Remember where each view lived so we can restore exact DOM order on exit.
  const leftAnchor = { parent: left.parentNode, next: left.nextSibling };
  const rightAnchor = { parent: right.parentNode, next: right.nextSibling };

  const splitEl = document.createElement('div');
  splitEl.className = 'sv-split';
  const paneA = document.createElement('div'); paneA.className = 'sv-pane sv-pane-left';
  const paneB = document.createElement('div'); paneB.className = 'sv-pane sv-pane-right';
  const divider = document.createElement('div');
  divider.className = 'sv-divider';
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.innerHTML = '<button class="sv-divider-close" type="button" title="Close split" aria-label="Close split">' + ICON_X + '</button>';

  splitEl.appendChild(paneA);
  splitEl.appendChild(divider);
  splitEl.appendChild(paneB);

  paneA.appendChild(left);
  paneB.appendChild(right);
  canvas.classList.add('sv-host');
  canvas.appendChild(splitEl);

  // Tabs: the left tab is already .active (it's the active view's tab). Give the
  // secondary tab the SAME .active class so it inherits the exact tab-style knob
  // (filled / underline / color) and reads identically — no bespoke styling that
  // could diverge. .sv-tab-split marks it as the extra one to clean up on exit.
  // (Tab .active is independent of the single .view.active element invariant.)
  const rt = tabFor(right.dataset.view);
  if (rt) rt.classList.add('active', 'sv-tab-split');

  state = { splitEl, divider, leftView: left, rightView: right, leftAnchor, rightAnchor, roTimer: null, flapSpacer: null, rightTabAnchor: null };

  wireDivider(divider, splitEl);
  wireResizeObserver(left, right);
  wirePaneScroll(left, right);

  // Render both panes (the secondary may have never rendered its charts).
  renderPanes();
  runCounters(right);
  relayoutFlapTabs();   // Flap layout: anchor the secondary flap over the right pane
}

function swapRight(newRight) {
  const oldRight = state.rightView;
  const paneB = state.splitEl.querySelector('.sv-pane-right');
  // Return the outgoing secondary flap to its natural tab slot before it loses its role, then
  // forget the anchor so relayout records a fresh one for the incoming secondary tab.
  restoreRightTab();
  state.rightTabAnchor = null;
  removeFlapSpacer();
  // Park the outgoing view back where it belongs (hidden #content), unmark its tab.
  const ot = tabFor(oldRight.dataset.view); if (ot) ot.classList.remove('sv-tab-split', 'active');
  if (state.onPaneScroll) oldRight.removeEventListener('scroll', state.onPaneScroll);
  if (state.ro) state.ro.unobserve(oldRight);
  oldRight.classList.remove('sv-scrolled');
  restoreView(oldRight, state.rightAnchor);

  // Mount the new right view.
  state.rightAnchor = { parent: newRight.parentNode, next: newRight.nextSibling };
  state.rightView = newRight;
  paneB.appendChild(newRight);
  const nt = tabFor(newRight.dataset.view); if (nt) nt.classList.add('active', 'sv-tab-split');
  if (state.ro) state.ro.observe(newRight);
  if (state.onPaneScroll) newRight.addEventListener('scroll', state.onPaneScroll, { passive: true });
  renderPanes();
  runCounters(newRight);
  relayoutFlapTabs();   // re-anchor the (new) secondary flap over the right pane
}

/* ===================== divider drag ===================== */
function wireDivider(divider, splitEl) {
  const onDown = (e) => {
    if (e.target.closest('.sv-divider-close')) return;  // close button, not a drag
    e.preventDefault();
    splitEl.classList.add('sv-dragging');
    document.body.classList.add('sv-dragging');
    try { divider.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onMove = (e) => {
    if (!splitEl.classList.contains('sv-dragging')) return;
    const rect = splitEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = e.clientX - rect.left;
    const min = rect.width * MIN_RATIO, max = rect.width * MAX_RATIO;
    const leftW = Math.max(min, Math.min(max, x - DIVIDER_W / 2));
    splitEl.style.setProperty('--sv-left', leftW + 'px');
    relayoutFlapTabs();   // keep the secondary flap tracking the right pane live
  };
  const onUp = (e) => {
    if (!splitEl.classList.contains('sv-dragging')) return;
    splitEl.classList.remove('sv-dragging');
    document.body.classList.remove('sv-dragging');
    try { divider.releasePointerCapture(e.pointerId); } catch (_) {}
    renderPanes();   // crisp final render once the drag settles
    relayoutFlapTabs();
  };
  divider.addEventListener('pointerdown', onDown);
  divider.addEventListener('pointermove', onMove);
  divider.addEventListener('pointerup', onUp);
  divider.addEventListener('pointercancel', onUp);
  const closeBtn = divider.querySelector('.sv-divider-close');
  if (closeBtn) {
    closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); exitSplit(); });
  }
}

/* ===================== chart reflow on width change ===================== */
function renderPanes() {
  if (!state) return;
  renderChartsIn(state.leftView);
  renderChartsIn(state.rightView);
}

function wireResizeObserver(left, right) {
  if (typeof ResizeObserver === 'undefined') return;   // graceful no-op fallback
  const ro = new ResizeObserver(() => {
    if (!state || state.roTimer) return;                // trailing-throttle to ~80ms
    state.roTimer = setTimeout(() => {
      if (state) state.roTimer = null;
      renderPanes();
      relayoutFlapTabs();   // window/layout-driven pane resizes re-anchor the flap too
    }, 80);
  });
  ro.observe(left);
  ro.observe(right);
  state.ro = ro;
}

function wirePaneScroll(left, right) {
  // Per-pane sticky-header shadow (the shared canvas handler can't tell the
  // panes apart). split-view.css drives the shadow off this .sv-scrolled flag.
  const onScroll = (e) => {
    const v = e.currentTarget;
    v.classList.toggle('sv-scrolled', (v.scrollTop || 0) > 2);
  };
  state.onPaneScroll = onScroll;
  left.addEventListener('scroll', onScroll, { passive: true });
  right.addEventListener('scroll', onScroll, { passive: true });
}

/* ===================== flap-layout tab anchoring ===================== */
// In the Flap layout BOTH paired tabs render as folder "flaps" (shell.css targets every
// .ia-tab.active). The active/left flap already sits over the left pane in natural tab order;
// here we anchor the SECONDARY (right) flap over the RIGHT pane by MOVING it to the tab slot
// where its left edge first reaches that pane. The other (inactive) tabs flow in to fill the
// space it vacated, so the strip stays gap-free and tight — no empty spacer is left behind.
// Only when there aren't enough tabs to reach the pane do we fall back to a small residual
// spacer. The slot is recomputed as the divider/window resizes, so the flap tracks its pane.
function isFlapLayout() { return document.documentElement.getAttribute('data-layout') === 'flap'; }

function removeFlapSpacer() {
  if (state && state.flapSpacer && state.flapSpacer.parentNode) state.flapSpacer.parentNode.removeChild(state.flapSpacer);
  if (state) state.flapSpacer = null;
}

// Return the secondary flap to its natural slot in the tab strip (used on exit, swap, and when
// the layout isn't Flap). Other tabs never change relative order, so the recorded next-sibling
// restores the exact original sequence.
function restoreRightTab() {
  if (!state || !state.rightTabAnchor) return;
  const tab = state.rightView && tabFor(state.rightView.dataset.view);
  if (!tab) return;
  const a = state.rightTabAnchor;
  if (a.next && a.next.parentNode === a.parent) a.parent.insertBefore(tab, a.next);
  else if (a.parent) a.parent.appendChild(tab);
}

function relayoutFlapTabs() {
  if (!state) return;
  removeFlapSpacer();

  const tabsC = tabsEl();
  const rightPane = state.splitEl.querySelector('.sv-pane-right');
  const leftTab = tabFor(state.leftView.dataset.view);
  const rightTab = tabFor(state.rightView.dataset.view);
  if (!tabsC || !rightPane || !leftTab || !rightTab) return;

  // Remember the secondary tab's home once, so exit/swap can restore the natural order.
  if (!state.rightTabAnchor) state.rightTabAnchor = { parent: rightTab.parentNode, next: rightTab.nextSibling };

  // Other layouts never reorder — keep the tab in its natural spot.
  if (!isFlapLayout()) { restoreRightTab(); return; }

  // The flap must sit far enough into the right pane that its body + outer flare clear the
  // divider and the pane's rounded top-left corner.
  const card = rightPane.querySelector('.view');
  const cornerR = card ? (parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0) : 0;
  const desiredX = rightPane.getBoundingClientRect().left + FLAP_FLARE + cornerR;

  // Find the slot in the gap-free layout (secondary flap detached, siblings collapsed tight)
  // where a tab's left edge first reaches desiredX; the flap goes there and the tabs before it
  // fill the space. Detach + reinsert happen in one synchronous pass, so there is no flicker.
  rightTab.remove();
  let targetNext = null;
  for (const el of tabsC.children) {
    if (el === leftTab) continue;                         // never land before the active flap
    if (el.getBoundingClientRect().left >= desiredX) { targetNext = el; break; }
  }

  if (targetNext) {
    tabsC.insertBefore(rightTab, targetNext);             // tabs fill up to here — tight, no gap
  } else {
    tabsC.appendChild(rightTab);                          // not enough tabs to reach the pane…
    const gap = Math.round(desiredX - rightTab.getBoundingClientRect().left);
    if (gap > 1) {                                        // …so a small residual spacer finishes the push
      const spacer = document.createElement('div');
      spacer.className = 'sv-flap-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.width = gap + 'px';
      tabsC.insertBefore(spacer, rightTab);
      state.flapSpacer = spacer;
    }
  }
}

/* ===================== exit / restore ===================== */
function restoreView(view, anchor) {
  if (!anchor || !anchor.parent) { return; }
  if (anchor.next && anchor.next.parentNode === anchor.parent) anchor.parent.insertBefore(view, anchor.next);
  else anchor.parent.appendChild(view);
}

function exitSplit() {
  if (!state) return;
  // Put the secondary flap back in its natural tab slot + drop any residual spacer while state
  // (and its anchor) is still live, then clear state so observers/handlers no-op.
  restoreRightTab();
  removeFlapSpacer();
  const s = state;
  state = null;

  if (s.ro) s.ro.disconnect();
  if (s.roTimer) clearTimeout(s.roTimer);
  if (s.onPaneScroll) {
    s.leftView.removeEventListener('scroll', s.onPaneScroll);
    s.rightView.removeEventListener('scroll', s.onPaneScroll);
  }
  s.leftView.classList.remove('sv-scrolled');
  s.rightView.classList.remove('sv-scrolled');

  // Drop the secondary tab's borrowed .active + marker. Only the secondary tab
  // carries .sv-tab-split, so the left/active tab keeps its own .active. (When the
  // exit was triggered by a tab click, shell.js's activateTab then re-points the
  // single active tab at whatever was clicked.)
  document.querySelectorAll('.tabbar .tabs .ia-tab.sv-tab-split').forEach((t) => t.classList.remove('sv-tab-split', 'active'));

  // Move both views back to their original spots in #content, then tear down.
  restoreView(s.leftView, s.leftAnchor);
  restoreView(s.rightView, s.rightAnchor);
  const canvas = canvasEl();
  if (canvas) canvas.classList.remove('sv-host');
  if (s.splitEl && s.splitEl.parentNode) s.splitEl.parentNode.removeChild(s.splitEl);
  document.body.classList.remove('sv-dragging');

  // Re-render the single active view at its restored width.
  const a = activeView();
  if (a) renderChartsIn(a);
}

/* ===================== wiring ===================== */
export function initSplitView() {
  const tabs = tabsEl();
  if (!tabs) return;

  // Right-click an inactive / not-shown tab → offer the split.
  tabs.addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('.ia-tab[data-view]');
    if (!tab) return;
    const v = tab.dataset.view;
    if (shownViews().has(v)) return;     // already on screen — let the native menu be
    e.preventDefault();
    openMenu(e.clientX, e.clientY, v);
  });

  // Capture-phase: when split is active, ANY tab click/close exits split FIRST
  // (restoring the DOM) and then falls through to shell.js's normal handler.
  tabs.addEventListener('click', (e) => {
    if (!state) return;
    if (e.target.closest('.ia-x') || e.target.closest('.ia-tab[data-view]')) exitSplit();
  }, true);

  // Dismiss the menu like every other popover in the shell.
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  // Scrolling the tab strip or resizing shouldn't leave a stray menu floating.
  tabs.addEventListener('scroll', closeMenu, { passive: true });
  window.addEventListener('resize', () => { closeMenu(); relayoutFlapTabs(); });
}
