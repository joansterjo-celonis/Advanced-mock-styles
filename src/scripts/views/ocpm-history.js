// ============================================================
//  View: OCPM adoption view  (Summary_h tab)
//  "direct customer maturity funnel - history view"
// ============================================================
// Faithful reproduction of the Celonis "OCPM adoption view" — the "Summary_h"
// tab. A maturity-funnel history dashboard: a cohort KPI, the six-stage funnel
// counts, a % set of stacked-percentage bars, a per-month "time to productive"
// horizontal stacked-bar matrix, a status-history table, and two time-series
// charts at the bottom. Registered as a standalone asset via the registry; the
// header is the shared component and every chart uses a registered builder
// (stackbars / hstackbars) so it reacts to the theme / density / 3D knobs.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const CHEV = s(11, 2.2, '<path d="m6 9 6 6 6-6"/>');
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';

/* ---- header extras (same family as the other OCPM views) ---- */
const ageBadge = '<span class="ocpm-age">' + s(13, 1.8, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '5 days</span>';
const tabNav = '<div class="ocpm-tabnav"><button class="ocpm-tnav" data-dir="-1" title="Scroll left">' + s(14, 2.2, '<path d="m15 6-6 6 6 6"/>') + '</button><button class="ocpm-tnav" data-dir="1" title="Scroll right">' + s(14, 2.2, '<path d="m9 6 6 6-6 6"/>') + '</button><button class="ocpm-tnav" title="All tabs">' + s(14, 2, '<path d="M4 6h16M4 12h16M4 18h16"/>') + '</button></div>';

const info = tip => '<span class="i" tabindex="0" data-tip="' + tip + '">i</span>';

/* ---- HTML chart legend ---- */
const leg = items => '<div class="ocpm2-legend">' + items.map(it =>
  typeof it === 'string' ? '<span>' + it + '</span>'
  : '<span class="ocpm2-legitem"><span class="ocpm2-swatch" style="background:var(' + it.c + ')"></span>' + it.t + '</span>').join('') + '</div>';

/* ---- KPI cell ---- (numeral carries data-counter so it count-ups + obeys the KPI weight/font knob) */
const kpi = (k, v) => '<div class="ocpm-kpi"><div class="k">' + k + '</div><div class="v" data-counter data-to="' + String(v).replace(/[^0-9.-]/g, '') + '">0</div></div>';

/* ---- table ---- */
function table(cols, rows, numIdx) {
  const th = '<thead><tr>' + cols.map((c, ci) => '<th' + (numIdx.indexOf(ci) >= 0 ? ' class="num"' : '') + '>' + c + '</th>').join('') + '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
  const tb = '<tbody>' + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (numIdx.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + c + '</td>').join('') + '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
  return '<div class="ptable-scroll"><table class="ptable">' + th + tb + '</table></div>';
}

const histCols = ['archive month', 'calendar week', 'archive date', 'INDEX_ORDER', 'eligible', 'activated', 'tested', 'active developmen&hellip;'];
const histRows = [
  ['2026-06', '2026 - CW 24', '2026-06-12', '2', '44', '118', '168', '73'],
  ['2026-06', '2026 - CW 24', '2026-06-08', '1', '44', '118', '172', '84'],
  ['2026-06', '2026 - CW 23', '2026-06-07', '4', '39', '117', '173', '83'],
  ['2026-06', '2026 - CW 23', '2026-06-07', '1', '44', '118', '172', '0'],
  ['2026-06', '2026 - CW 23', '2026-06-07', '2', '3', '2', '0', '0'],
  ['2026-06', '2026 - CW 23', '2026-06-05', '3', '41', '116', '170', '80'],
];

/* ---- "time to productive" per-month rows ---- */
const ttMonths = ['2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12', '2025-11', '2025-10', '2025-09', '2025-08', '2025-07', '2025-06', '2025-05', '2025-04', '2025-03', '2025-02'];
const ttSeries = [
  { c: '--success', w: 5 }, { c: '--legend-2', w: 3 }, { c: '--cstop-2a', w: 2 }, { c: '--cstop-1a', w: 1.6 },
  { c: '--legend-4', w: 1.1 }, { c: '--cstop-1b', w: 0.8 }, { c: '--cstop-3a', w: 0.6 }, { c: '--danger', w: 0.5 },
];

/* ---- maturity-funnel layout (deterministic 12-col bento) ---- */
const dashboard = '<div class="bento ocpm3-content" data-shpanel="hist" data-fixed>' +

  /* row 1 — title banner + last load */
  '<section class="card span-9 ocpm3-toprow" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm3-banner"><h2>direct customer maturity funnel - history view</h2></div>' +
  '</section>' +
  '<section class="card span-3 ocpm3-toprow" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm3-loadinfo"><span>Last load date: 2026-06-12</span><a href="#" onclick="return false">maturity state definitions</a></div>' +
  '</section>' +

  /* row 2 — cohort KPI + funnel counts + eligible filters */
  '<section class="card span-3 metric" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">Filter current cohort ( &quot;first dev.&quot; betwee&hellip;</div>' +
    '<div class="metric-sub" style="margin-top:8px;">% of accounts reaching production &lt;= 90 &hellip;</div>' +
    '<div class="ocpm3-bigpct" data-counter data-to="71" data-suffix="%">0</div>' +
    '<div class="ocpm3-cohort-foot">' +
      '<div class="ocpm2-subm"><span class="lbl">accounts reaching &quot;producti&hellip;</span><b>17 accou&hellip;</b></div>' +
      '<div class="ocpm2-subm"><span class="lbl">accounts in cohort (denomin&hellip;</span><b>24 accou&hellip;</b></div>' +
      '<div class="ocpm2-subm"><span class="lbl">KPI at 2025-02-01</span><b>68%</b></div>' +
    '</div>' +
  '</section>' +
  '<section class="card span-6" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:13px;">direct customer maturity funnel ' + info('Counts of accounts at each maturity stage of the OCPM adoption funnel.') + '</div>' +
    '<div class="ocpm3-funnel">' +
      kpi('eligible accounts', '789') + kpi('activated accou&hellip;', '745') + kpi('tested accounts', '627') +
      kpi('accounts in activ&hellip;', '459') + kpi('productive accou&hellip;', '386') + kpi('scaled', '61') +
    '</div>' +
  '</section>' +
  '<section class="card span-3" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm3-filterbtns">' +
      '<button class="ocpm3-fbtn on">OCPM eligible &gt;= 90 days</button>' +
      '<button class="ocpm3-fbtn">OCPM eligible &gt;= 180 days</button>' +
      '<button class="ocpm3-fbtn">OCPM eligible &gt;= 365 days</button>' +
      '<div class="ocpm2-fctl"><span>eligible since x months</span>' + CHEV + '</div>' +
      '<div class="ocpm2-fctl"><span>reached active dev. x months ago</span>' + CHEV + '</div>' +
    '</div>' +
  '</section>' +

  /* row 3 — % reaching production + time to productive */
  '<section class="card span-6 metric" data-card style="min-height:226px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">% of accounts reaching production in &lt;= 90 days</div>' +
    '<div class="paxis-label">&uarr; % of accounts</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="stackbars" data-n="10" data-ymax="100" data-pct="1" data-full="1" data-bias="1" data-seed="17" data-xlabels="2025|2025|2025|2026|2026|2026" data-series=\'[{"c":"--success","w":6},{"c":"--legend-3","w":1.6},{"c":"--danger","w":1}]\'></div>' +
    '<div class="ocpm2-xlabel">first time &quot;in development&quot; &rarr;</div>' +
  '</section>' +
  '<section class="card span-6 metric" data-card style="min-height:226px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm3-segtabs"><button class="ocpm3-segtab" data-tt="dev">time to &quot;in development&quot;</button><button class="ocpm3-segtab on" data-tt="prod">time to &quot;productive&quot;</button></div>' +
    '<div class="card-title" style="font-size:12px;">time to &quot;productive&quot; ' + info('Distribution of how long accounts take to reach productive, by the month they first entered "in development".') + '</div>' +
    '<div class="paxis-label">&uarr; account first &quot;in development&quot; status</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="hstackbars" data-xmax="150" data-xticks="0,50,100,150" data-labelw="46" data-seed="23" data-cats=\'' + JSON.stringify(ttMonths) + '\' data-series=\'' + JSON.stringify(ttSeries) + '\'></div>' +
    leg([{ c: '--success', t: '0d - 15d' }, { c: '--legend-2', t: '16d - 30d' }, { c: '--cstop-2a', t: '31d - 60d' }, { c: '--cstop-1a', t: '61d - 90d' }, { c: '--legend-4', t: '91d - 120d' }, '+3']) +
  '</section>' +

  /* row 4 — status history table */
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">status history table ' + info('Weekly snapshot of account counts per maturity stage.') + '</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    table(histCols, histRows, [3, 4, 5, 6, 7]) +
  '</section>' +

  /* row 5 — status history (area) + first-time productive (bars) */
  '<section class="card span-6 metric" data-card style="min-height:210px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">status history</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="stackbars" data-n="54" data-ymax="650" data-shape="grow" data-seed="31" data-xlabels="2024-12-30|2025-12-29" data-series=\'[{"c":"--cstop-1b","w":3},{"c":"--legend-4","w":2},{"c":"--cstop-1a","w":2},{"c":"--legend-3","w":1.5},{"c":"--success","w":1.2},{"c":"--cstop-3a","w":0.8}]\'></div>' +
    '<div class="ocpm2-xlabel">archive week &rarr;</div>' +
    leg([{ c: '--cstop-3a', t: 'scaled' }, { c: '--success', t: 'productive' }, { c: '--legend-3', t: 'active development' }, { c: '--cstop-1a', t: 'tested' }, { c: '--legend-4', t: 'activated' }, { c: '--cstop-1b', t: 'eligible' }]) +
  '</section>' +
  '<section class="card span-6 metric" data-card style="min-height:210px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">accounts changed to &quot;productive&quot; for the first time</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="stackbars" data-n="17" data-ymax="24" data-shape="rand" data-seed="42" data-xlabels="2025-01|2025-03|2025-05|2025-07|2025-09|2025-11|2026-01|2026-03|2026-05" data-series=\'[{"c":"--cstop-1a","w":8},{"c":"--success","w":1},{"c":"--danger","w":1}]\'></div>' +
    '<div class="ocpm2-xlabel">first productive &rarr;</div>' +
  '</section>' +
'</div>';

const emptyPanel = '<div class="bento ocpm3-empty" data-shpanel="empty" style="display:none;">' +
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-emptybox">' +
      '<svg class="tr-emico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8M8 17h5"/></svg>' +
      '<div class="tr-emt">Summary</div>' +
      '<div>This section is not part of the prototype yet.</div>' +
    '</div>' +
  '</section>' +
'</div>';

registerView({
  id: 'ocpm-history',
  label: 'OCPM adoption view',
  icon,
  html: buildAssetHeader({
    title: 'OCPM adoption view',
    meta: [ageBadge, 'bookmark', 'share', 'comments', 'more'],
    pills: [
      { k: 'Predefined filter', v: 'Enterprise / Sandbox&hellip;' },
      { k: 'Predefined filter', v: 'exclude PoV' },
      { k: 'Predefined filter', v: 'Direct Customers' },
    ],
    subtabs: {
      attr: 'data-shsub',
      trailing: tabNav,
      items: [
        { id: 'summary', label: 'Summary' },
        { id: 'hist', label: 'Summary_h', on: true },
        { id: 'ab', label: 'activity breakdown' },
        { id: 'ab2', label: 'activity breakdown II' },
        { id: 'proc', label: 'process, event &amp; objects' },
        { id: 'datajobs', label: 'data jobs' },
        { id: 'persp', label: 'perspectives' },
        { id: 'reuse', label: 'OCPM object re-use' },
        { id: 'valid', label: 'Validation' },
        { id: 'status', label: 'Status' },
      ],
    },
  }) + dashboard + emptyPanel,

  render(viewEl) {
    viewEl.classList.add('ocpm-view');
    const sub = viewEl.querySelector('.subtabs');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-shsub]'));
    const hist = viewEl.querySelector('[data-shpanel="hist"]');
    const empty = viewEl.querySelector('[data-shpanel="empty"]');
    const emptyTitle = empty && empty.querySelector('.tr-emt');

    // in-card "time to" segmented tabs (visual toggle only)
    viewEl.querySelectorAll('.ocpm3-segtab').forEach(b => b.addEventListener('click', () => {
      viewEl.querySelectorAll('.ocpm3-segtab').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    }));

    // tab overflow controls + center the active tab once visible
    viewEl.querySelectorAll('.ocpm-tnav[data-dir]').forEach(b =>
      b.addEventListener('click', () => sub && sub.scrollBy({ left: 220 * parseInt(b.dataset.dir, 10), behavior: 'smooth' })));
    if (sub && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          const active = viewEl.querySelector('.subtab[data-shsub].on');
          if (active) { const a = active.getBoundingClientRect(), r = sub.getBoundingClientRect(); sub.scrollLeft += (a.left - r.left) - r.width / 2 + a.width / 2; }
          io.disconnect();
        }
      });
      io.observe(viewEl);
    }

    tabs.forEach(s2 => s2.addEventListener('click', e => {
      if (e.target.closest('.x') || e.target.closest('.dots')) return;
      tabs.forEach(x => x.classList.remove('on'));
      s2.classList.add('on');
      const isHist = s2.dataset.shsub === 'hist';
      if (hist) hist.style.display = isHist ? 'grid' : 'none';
      if (empty) empty.style.display = isHist ? 'none' : 'grid';
      if (!isHist && emptyTitle) emptyTitle.textContent = (s2.textContent || '').trim();
      if (isHist && window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
