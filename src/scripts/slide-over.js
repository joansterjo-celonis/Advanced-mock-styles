// ============================================================
//  Slide-over drawer — self-contained, additive layer.
// ============================================================
// Presents a registered view as a right-side sliding modal (a drawer over a
// dimming scrim) instead of pushing it into the side-by-side split. Used by the
// Incident Management master: clicking an Incident List row reveals the tabless
// Incident Details view here, sliding in from the right.
//
// Same safe contract as split-view.js:
//   • The view element is MOVED (never cloned) into the drawer, so its delegated
//     + direct listeners survive and element IDs are never duplicated. On close
//     it is returned to the exact spot it came from in (hidden) #content.
//   • The active single view keeps its .active class and stays mounted behind the
//     scrim, so every existing querySelector('.view.active') still resolves to it.

import { renderChartsIn, runCounters } from './engine.js';

const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<path d="M6 6l12 12M18 6 6 18"/></svg>';

// Live drawer state, or null when closed.
//   { view, anchor, scrim, drawer, onKey }
let state = null;

function viewFor(v) { return document.querySelector('.view[data-view="' + v + '"]'); }

function open(viewId) {
  const view = viewFor(viewId);
  if (!view) return;
  if (state) {
    if (state.view === view) return;   // already showing this one (the event repainted it)
    close(true);                       // swapping to a different view → tear down first
  }

  // Remember where the view lived so we can restore exact DOM order on close.
  const anchor = { parent: view.parentNode, next: view.nextSibling };

  const scrim = document.createElement('div');
  scrim.className = 'so-scrim';

  const drawer = document.createElement('div');
  drawer.className = 'so-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'so-close';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = ICON_X;

  drawer.appendChild(closeBtn);
  drawer.appendChild(view);           // MOVE the view into the drawer
  document.body.appendChild(scrim);
  document.body.appendChild(drawer);
  document.documentElement.classList.add('so-lock');   // freeze background scroll

  // force a reflow so the initial (off-screen) transform is committed before we
  // flip to .open — guarantees the slide-in transition actually runs.
  void drawer.offsetWidth;
  scrim.classList.add('open');
  drawer.classList.add('open');

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => close());
  closeBtn.addEventListener('click', () => close());

  state = { view, anchor, scrim, drawer, onKey };

  // The view may have never rendered (it has no tab); paint its charts + counters now.
  renderChartsIn(view);
  runCounters(view);
}

function close(immediate) {
  if (!state) return;
  const s = state;
  state = null;
  document.removeEventListener('keydown', s.onKey);
  document.documentElement.classList.remove('so-lock');

  const finalize = () => {
    // return the view to its original (hidden) spot in #content
    if (s.anchor && s.anchor.parent) {
      if (s.anchor.next && s.anchor.next.parentNode === s.anchor.parent) s.anchor.parent.insertBefore(s.view, s.anchor.next);
      else s.anchor.parent.appendChild(s.view);
    }
    if (s.scrim.parentNode) s.scrim.parentNode.removeChild(s.scrim);
    if (s.drawer.parentNode) s.drawer.parentNode.removeChild(s.drawer);
  };

  if (immediate) { finalize(); return; }

  // slide out, then tear down on transitionend (with a safety fallback).
  s.scrim.classList.remove('open');
  s.drawer.classList.remove('open');
  let done = false;
  const fin = () => { if (done) return; done = true; finalize(); };
  s.drawer.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') fin(); }, { once: true });
  setTimeout(fin, 420);
}

export function initSlideOver() {
  window.IA = window.IA || {};
  // Programmatic entry: reveal `viewId` as a right-side sliding drawer.
  window.IA.openSlideOver = (viewId) => { if (viewId) open(viewId); };
  window.IA.closeSlideOver = () => close();
  window.IA.isSlideOverActive = () => !!state;
}
