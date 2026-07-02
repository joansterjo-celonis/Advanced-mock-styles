// ============================================================
//  Chart Playground — interactive prototyping sandbox
// ============================================================
// Lives on the "Build a chart" sub-tab of the (renamed) Chart Playground view
// (internal data-view id kept as "rework-quality" for stability). It is an
// EXPLICIT sandbox, not a real asset: the disclaimer banner in the markup says
// so, and every control here is LOCAL — it scopes to the .pg-build gallery only
// and never touches the global theme knobs. See docs/CONCEPT.md for the
// "prototype vs. outcome" framing this respects.
//
// How local scoping works (no global state is mutated):
//   • material (flat/iso/glass) → per-wrap data-chart-look, honoured by
//     chartMode() in effects.js as an override of the global Charts-look knob.
//   • fill (classic/pattern)    → data-chartfill on the .pg-build container;
//     usePattern() reads the nearest-ancestor override before <html>.
//   • everything else           → CSS classes / custom props on .pg-build,
//     so the effect is confined to descendants of the gallery.
//
// Controls are injected into this view's edit panel and revealed only while the
// "Build a chart" sub-tab is active (CSS keys off data-pgsub on the view), so
// the user "just sees the playground controls" when they open Edit.

const VIEW_ID = 'rework-quality';
const LS_KEY = 'pg-config-v1';

const DEFAULTS = {
  material: 'flat',       // flat | iso | glass     → per-wrap data-chart-look
  fill: 'classic',        // classic | pattern      → container data-chartfill
  barcorner: 'soft',      // sharp | soft | round   → --pg-bar-rx (chart bar/cell rounding)
  legend: 'show',         // show | hide            → .pg-no-legend
  legendpos: 'top',       // top | right | bottom   → .pg-leg-*
  legendorient: 'row',    // row | col              → .pg-leg-col
  swatch: 'dot',          // dot | square | line | pill → .pg-sw-*
  axis: 'show',           // show | hide            → .pg-no-axis
};

// Chart bar/cell corner rounding (overrides the baked SVG rect rx via CSS).
const BAR_RX = { sharp: '0px', soft: '3px', round: '6px' };

// Panel layout: section markers (sec) and segmented controls (ctrl).
const GROUPS = [
  { ctrl: 'material', label: 'Chart material', opts: [['flat', 'Flat'], ['iso', 'Isometric'], ['glass', 'Glass']] },
  { ctrl: 'fill', label: 'Fill style', opts: [['classic', 'Classic'], ['pattern', 'Pattern']] },
  { ctrl: 'barcorner', label: 'Corner radius', opts: [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']] },
  { sec: 'Legend' },
  { ctrl: 'legend', label: 'Legend', opts: [['show', 'Show'], ['hide', 'Hide']] },
  { ctrl: 'legendpos', label: 'Position', opts: [['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom']] },
  { ctrl: 'legendorient', label: 'Orientation', opts: [['row', 'Row'], ['col', 'Column']] },
  { ctrl: 'swatch', label: 'Swatch', opts: [['dot', 'Dot'], ['square', 'Square'], ['line', 'Line'], ['pill', 'Pill']] },
  { sec: 'Axes' },
  { ctrl: 'axis', label: 'Axis titles', opts: [['show', 'Show'], ['hide', 'Hide']] },
];

let cfg = { ...DEFAULTS };
let view = null, pgBuild = null, panel = null;

export function initChartPlayground() {
  view = document.querySelector('.view[data-view="' + VIEW_ID + '"]');
  if (!view) return;
  pgBuild = view.querySelector('.pg-build');
  if (!pgBuild) return;

  cfg = loadConfig();
  buildLegends();
  buildPanel();
  mirrorSubtab(currentSubtab());
  wireSubtabs();
  initFocus();
  initDock();
  applyConfig();   // prime container attrs so charts render correctly whenever the tab is shown
}

/* ---------- persistence (best-effort; degrades silently) ---------- */
function loadConfig() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch (e) {}
  return { ...DEFAULTS };
}
function saveConfig() { try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {} }

/* ---------- sub-tab mirror (drives which panel the edit rail shows) ---------- */
function currentSubtab() { const on = view.querySelector('.subtab.on[data-rqsub]'); return on ? on.dataset.rqsub : 'charts'; }
function mirrorSubtab(sub) { view.setAttribute('data-pgsub', sub || 'charts'); }
function wireSubtabs() {
  view.querySelectorAll('.subtab[data-rqsub]').forEach(s => {
    s.addEventListener('click', () => {
      mirrorSubtab(s.dataset.rqsub);
      // The engine's own sub-tab handler re-renders the view (but not counters);
      // on entering the sandbox, re-render once more + animate the composition KPIs.
      if (s.dataset.rqsub === 'build') requestAnimationFrame(() => { render(); runCounters(); });
      requestAnimationFrame(dockPanel);
    });
  });
}

function runCounters() {
  if (window.IA && window.IA.runCounters && pgBuild && pgBuild.offsetParent !== null) window.IA.runCounters(pgBuild);
}

/* ---------- legends (built once from each cell's data-pg-legend) ---------- */
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function buildLegends() {
  pgBuild.querySelectorAll('.pg-legend[data-pg-legend]').forEach(leg => {
    let items = [];
    try { items = JSON.parse(leg.getAttribute('data-pg-legend') || '[]'); } catch (e) { items = []; }
    leg.innerHTML = items.map(it => {
      const label = Array.isArray(it) ? it[0] : it;
      const cvar = (Array.isArray(it) ? it[1] : '--cstop-1a') || '--cstop-1a';
      return '<span class="pg-li"><span class="pg-sw" style="background:var(' + cvar + ')"></span>' +
        '<span class="pg-li-lbl">' + esc(label) + '</span></span>';
    }).join('');
  });
}

/* ---------- control panel (injected into this view's edit rail) ---------- */
function buildPanel() {
  const ep = view.querySelector('.edit-panel');
  if (!ep) return;
  panel = ep.querySelector('.pg-panel');
  if (!panel) { panel = document.createElement('div'); panel.className = 'pg-panel'; ep.appendChild(panel); }

  let h = '<div class="pg-panel-head">' +
    '<div class="pg-panel-title">Chart playground</div>' +
    '<div class="pg-panel-act">' +
    '<button type="button" class="pg-reset">Reset</button>' +
    '<button type="button" class="pg-close" title="Close edit" aria-label="Close edit">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
    '</button></div></div>' +
    '<div class="pg-panel-note">Sandbox controls &mdash; they affect only the charts on this tab, never other views or any saved theme.</div>';

  GROUPS.forEach(g => {
    if ('sec' in g) { h += '<div class="pg-sec">' + g.sec + '</div>'; return; }
    h += '<div class="pg-grp"><div class="pg-lbl">' + g.label + '</div>' +
      '<div class="pg-seg" data-ctrl="' + g.ctrl + '">' +
      g.opts.map(([val, lbl]) => '<button type="button" data-val="' + val + '"' + (cfg[g.ctrl] === val ? ' class="on"' : '') + '>' + lbl + '</button>').join('') +
      '</div></div>';
  });

  panel.innerHTML = h;
  panel.addEventListener('click', onPanelClick);
  updatePanelVis();
}

function onPanelClick(e) {
  if (e.target.closest('.pg-reset')) { cfg = { ...DEFAULTS }; syncPanelState(); applyConfig(); render(); saveConfig(); return; }
  if (e.target.closest('.pg-close')) { const b = document.querySelector('.edit-btn'); if (b) b.click(); return; }
  const btn = e.target.closest('.pg-seg button');
  if (!btn) return;
  const seg = btn.closest('.pg-seg'); const ctrl = seg.dataset.ctrl; const val = btn.dataset.val;
  if (cfg[ctrl] === val) return;
  cfg[ctrl] = val;
  seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === btn));
  if (ctrl === 'material') updatePanelVis();   // pattern fill is flat-only → show/hide Fill style
  applyConfig();
  // material + fill are baked into the SVG at render time; the rest are pure CSS.
  if (ctrl === 'material' || ctrl === 'fill') render();
  saveConfig();
}

function syncPanelState() {
  if (!panel) return;
  panel.querySelectorAll('.pg-seg').forEach(seg => {
    const ctrl = seg.dataset.ctrl;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === cfg[ctrl]));
  });
  updatePanelVis();
}

// Pattern fill only paints on flat charts (usePattern is skipped for iso/glass),
// so the "Fill style" control is meaningless unless material is flat — hide it then.
function updatePanelVis() {
  if (!panel) return;
  const seg = panel.querySelector('.pg-seg[data-ctrl="fill"]');
  const grp = seg && seg.closest('.pg-grp');
  if (grp) grp.classList.toggle('pg-grp-hidden', cfg.material !== 'flat');
}

/* ---------- apply config → local scope only ---------- */
function setClassGroup(el, prefix, vals, active) { vals.forEach(v => el.classList.toggle(prefix + v, v === active)); }

function applyConfig() {
  if (!pgBuild) return;
  // material: per-wrap override ('flat' forces 2D even when the global knob is 3D)
  pgBuild.querySelectorAll('.chart-wrap[data-chart]').forEach(w => w.setAttribute('data-chart-look', cfg.material));
  // fill: local override read by usePattern() (nearest ancestor beats <html>)
  pgBuild.setAttribute('data-chartfill', cfg.fill === 'pattern' ? 'pattern' : 'classic');
  // CSS-only toggles, all confined to the gallery container
  pgBuild.style.setProperty('--pg-bar-rx', BAR_RX[cfg.barcorner] || BAR_RX.soft);
  pgBuild.classList.toggle('pg-no-legend', cfg.legend === 'hide');
  pgBuild.classList.toggle('pg-no-axis', cfg.axis === 'hide');
  pgBuild.classList.toggle('pg-leg-col', cfg.legendorient === 'col');
  setClassGroup(pgBuild, 'pg-leg-', ['top', 'right', 'bottom'], cfg.legendpos);
  setClassGroup(pgBuild, 'pg-sw-', ['dot', 'square', 'line', 'pill'], cfg.swatch);
}

/* ---------- re-render (scoped to the sandbox, only when it's on-screen) ---------- */
function render() {
  if (!pgBuild || !window.IA || !window.IA.renderChartsIn) return;
  if (pgBuild.offsetParent === null) return;   // sub-tab hidden: nothing to measure (re-renders on activation)
  window.IA.renderChartsIn(pgBuild);
}

/* ---------- focus mode (maximize the asset window inside the app) ----------
   Sets data-pgfocus="on" on <html>; CSS then collapses the surrounding shell
   (#l0 / #l1 / tab bar / status bar) so the open view fills the whole app area.
   This is an in-app maximize — NOT native browser fullscreen. Exits via the
   in-banner toggle, the floating button, or Escape. */
function initFocus() {
  // Floating exit button, mounted once and revealed by CSS only while in focus.
  let exit = document.querySelector('.pg-focus-exit');
  if (!exit) {
    exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'pg-focus-exit';
    exit.setAttribute('aria-label', 'Exit focus mode');
    exit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/></svg><span>Exit focus</span>';
    exit.addEventListener('click', () => setFocus(false));
    document.body.appendChild(exit);
  }

  // In-banner toggle.
  const btn = pgBuild.querySelector('.pg-focus-btn');
  if (btn) btn.addEventListener('click', () => setFocus(!isFocus()));

  // Escape leaves focus.
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isFocus()) setFocus(false); });
}

function isFocus() { return document.documentElement.getAttribute('data-pgfocus') === 'on'; }

function setFocus(on) {
  if (on === isFocus()) return;
  if (on) document.documentElement.setAttribute('data-pgfocus', 'on');
  else document.documentElement.removeAttribute('data-pgfocus');
  const btn = pgBuild && pgBuild.querySelector('.pg-focus-btn');
  if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  // The visible width changed, so re-measure the charts and re-run the KPI counters.
  requestAnimationFrame(() => {
    const v = document.querySelector('.view.active') || view;
    if (window.IA) {
      if (window.IA.renderChartsIn) window.IA.renderChartsIn(v);
      if (window.IA.runCounters) window.IA.runCounters(v);
    }
    dockPanel();
  });
}

/* ---------- panel docking (keep the controls fixed while the gallery scrolls) ----------
   The edit rail is position:absolute inside the view. Depending on the layout knob the
   view either grows tall inside a scrolling .ctx-canvas (default) or scrolls INTERNALLY
   (flowy / flap) — in both cases the absolute rail scrolls away with the gallery. Rather
   than fight per-layout scroll containers, we pin the rail to the visible scroll-viewport
   frame with position:fixed (no ancestor has a transform, so fixed is viewport-accurate).
   Only active while the "Build a chart" sub-tab is open in edit mode; otherwise the inline
   styles are cleared and the rail falls back to its normal CSS placement. */
function initDock() {
  const relayout = () => requestAnimationFrame(dockPanel);
  window.addEventListener('resize', relayout);
  // React to edit toggle / layout knob / focus mode — all flip attributes on <html>.
  new MutationObserver(relayout).observe(document.documentElement, { attributes: true, attributeFilter: ['data-edit', 'data-layout', 'data-pgfocus'] });
  // React to this view being shown / hidden (tab switches toggle .active).
  new MutationObserver(relayout).observe(view, { attributes: true, attributeFilter: ['class'] });
  relayout();
}

function shouldDock() {
  return view.classList.contains('active') &&
    currentSubtab() === 'build' &&
    document.documentElement.getAttribute('data-edit') === 'on';
}

function dockPanel() {
  const ep = view && view.querySelector('.edit-panel');
  if (!ep) return;
  if (!shouldDock()) {
    ep.classList.remove('pg-docked');
    ['position', 'top', 'right', 'bottom', 'left', 'height', 'width'].forEach(p => ep.style.removeProperty(p));
    return;
  }
  const flow = /flowy|flap/.test(document.documentElement.getAttribute('data-layout') || '');
  // scroll viewport: the internally-scrolling card in flowy/flap, else the canvas
  const sv = flow ? view : document.querySelector('.ctx-canvas');
  if (!sv) return;
  const svr = sv.getBoundingClientRect();
  const vr = view.getBoundingClientRect();   // right edge is scroll-independent (vertical only)
  const pad = flow ? 12 : 0;                  // matches the flowy/flap .edit-panel inset
  ep.classList.add('pg-docked');
  ep.style.position = 'fixed';
  ep.style.top = (svr.top + pad) + 'px';
  ep.style.bottom = 'auto';
  ep.style.left = 'auto';
  ep.style.right = (window.innerWidth - vr.right + pad) + 'px';
  ep.style.height = (svr.height - pad * 2) + 'px';
}
