// ============================================================
//  View: OCPM adoption view  (activity breakdown tab)
// ============================================================
// Faithful reproduction of the Celonis "OCPM adoption view" — the "activity
// breakdown" tab. Unlike the other assets, this one ships a right-hand FILTER
// PANEL ("Filter bar") that is toggled by the blue action button in the header.
// Registered as a standalone asset via the view registry; its header is the
// shared component, and every chart uses a registered builder (pie / stackbars
// / hbarcat) so it reacts to the theme / density / 3D knobs.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const CHEV = s(11, 2.2, '<path d="m6 9 6 6 6-6"/>');
const CAL = s(12, 1.8, '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>');
const X = s(13, 2.2, '<path d="M6 6l12 12M18 6L6 18"/>');
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';
const SORT = '<svg class="tr-sort" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v16M6 10l6-6 6 6"/></svg>';

/* ---- header extras (same family as the other OCPM view) ---- */
const ageBadge = '<span class="ocpm-age">' + s(13, 1.8, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '5 days</span>';
const tabNav = '<div class="ocpm-tabnav"><button class="ocpm-tnav" data-dir="-1" title="Scroll left">' + s(14, 2.2, '<path d="m15 6-6 6 6 6"/>') + '</button><button class="ocpm-tnav" data-dir="1" title="Scroll right">' + s(14, 2.2, '<path d="m9 6 6 6-6 6"/>') + '</button><button class="ocpm-tnav" title="All tabs">' + s(14, 2, '<path d="M4 6h16M4 12h16M4 18h16"/>') + '</button></div>';

/* ---- chart legend (HTML) ---- */
const leg = items => '<div class="ocpm2-legend">' + items.map(it =>
  typeof it === 'string' ? '<span>' + it + '</span>'
  : '<span class="ocpm2-legitem"><span class="ocpm2-swatch" style="background:var(' + it.c + ')"></span>' + it.t + '</span>').join('') + '</div>';

/* ---- table ---- */
function table(cols, rows, numIdx) {
  const th = '<thead><tr>' + cols.map((c, ci) => '<th' + (numIdx.indexOf(ci) >= 0 ? ' class="num"' : '') + '>' + c + '</th>').join('') + '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
  const tb = '<tbody>' + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (numIdx.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + c + '</td>').join('') + '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
  return '<div class="ptable-scroll"><table class="ptable">' + th + tb + '</table></div>';
}

const trkCols = ['Ems Servi&hellip;', 'Event', 'type', 'Cpm Details', 'Service Ti&hellip;', '# events' + SORT, 'activity ho&hellip;', ''];
const trkRows = [
  ['Studio', 'Navigation', '-', '-', '-', '30,538,5&hellip;', '27,538,5&hellip;', '41%'],
  ['pql_quer&hellip;', 'pql_quer&hellip;', 'CASE_CE&hellip;', '-', '-', '30,368,2&hellip;', '24,306,0&hellip;', '36%'],
  ['Backend', 'userLogg&hellip;', '-', '-', '-', '22,851,0&hellip;', '22,581,9&hellip;', '33%'],
  ['Studio', 'ViewFilters', '-', '-', '-', '15,171,6&hellip;', '14,746,4&hellip;', '22%'],
  ['Studio', 'AnalysisA&hellip;', '-', '-', '-', '14,286,0&hellip;', '12,554,7&hellip;', '19%'],
  ['Studio', 'Celonis_V&hellip;', '-', '-', '-', '13,974,9&hellip;', '13,397,6&hellip;', '20%'],
  ['Apps', 'views-an&hellip;', '-', '-', '-', '10,702,6&hellip;', '9,225,039', '14%'],
];

/* ---- filter panel ---- */
const dd = label => '<div class="ocpm2-fctl"><span>' + label + '</span>' + CHEV + '</div>';
const dt = label => '<div class="ocpm2-fctl"><span>' + label + '</span>' + CAL + '</div>';
const fbtn = label => '<div class="ocpm2-fctl btn">' + label + '</div>';
const filterBar =
  '<aside class="ocpm2-fbar"><div class="ocpm2-fbar-inner">' +
    '<div class="ocpm2-fbar-head">Filter bar <span class="x" title="Close">' + X + '</span></div>' +
    '<div class="ocpm2-fsec">' +
      '<div class="ocpm2-fsec-title">adoption status</div>' +
      dd('current adoption status') + dd('adoption status 1m ago') + dd('OCPM activation quarter') +
    '</div>' +
    '<div class="ocpm2-fsec">' +
      '<div class="ocpm2-fsec-title">account filters</div>' +
      fbtn('only process based pricing') + fbtn('&quot;land or renewal&quot; filter') +
      dd('OCPM won opportunity?') + dd('Land / Expand') + dd('ARR band') + dd('pricing type') +
      dt('renewal date') + dt('license start date') + dd('health status') +
      dt('First OCPM activation date') + dt('First &quot;tested&quot; status') + dt('first productive change') +
    '</div>' +
    '<div class="ocpm2-fsec">' +
      '<div class="ocpm2-fsec-title">Deployment</div>' +
      dd('deployment type') + dd('cloud region') +
    '</div>' +
  '</div></aside>';

/* ---- dashboard rows ---- */
const dashboard = '<div class="bento ocpm2-content" data-acpanel="ab" data-fixed>' +

  /* row 1 */
  '<section class="card span-6" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:13px;">account average: amount of hours having tracking events (not: total time) <span class="i" tabindex="0" data-tip="Average hours of tracking-event activity per account, by service.">i</span></div>' +
    '<div class="ocpm2-avgkpis">' +
      '<div class="ocpm-kpi"><div class="k">Data Integration</div><div class="ocpm2-bignum" data-counter data-to="1062" data-suffix=" h">0</div></div>' +
      '<div class="ocpm-kpi"><div class="k">Studio</div><div class="ocpm2-bignum" data-counter data-to="9245" data-suffix=" h">0</div></div>' +
      '<div class="ocpm-kpi"><div class="k">PQL</div><div class="ocpm2-bignum" data-counter data-to="7227" data-suffix=" h">0</div></div>' +
      '<div class="ocpm-kpi"><div class="k">Objects &amp; Events</div><div class="ocpm2-bignum" data-counter data-to="145" data-suffix=" h">0</div></div>' +
    '</div>' +
  '</section>' +
  '<section class="card span-2" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-kpi" style="border:0;padding:0;"><div class="k"># accounts</div><div class="ocpm2-bignum" style="font-size:44px;margin-top:6px;" data-counter data-to="789">0</div></div>' +
  '</section>' +
  '<section class="card span-4" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm2-qf-title">Quick Filters</div>' +
    '<div class="ocpm2-qf">' +
      '<div class="ocpm2-qf-row">DI - extractions</div>' +
      '<div class="ocpm2-qf-row">DI - transformations</div>' +
      '<div class="ocpm2-qf-row">DI - data connections</div>' +
      '<div class="ocpm2-qf-row">DI - data model</div>' +
    '</div>' +
  '</section>' +

  /* row 2 */
  '<section class="card span-3" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;color:var(--text-dim);">eligible &rarr; DI activity started (first 10 % fin&hellip;</div>' +
    '<div class="ocpm2-days" data-counter data-to="51" data-suffix=" days">0</div>' +
    '<div class="ocpm2-subm"><span class="lbl">eligible &rarr; 10 % OCPM DI acti&hellip;</span><b>66 days</b></div>' +
    '<div class="ocpm2-subm"><span class="lbl">eligible &rarr; 10 % CC DI activity</span><b>54 days</b></div>' +
  '</section>' +
  '<section class="card span-3" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;color:var(--text-dim);">eligible &rarr; PQL activity started (first 10 % f&hellip;</div>' +
    '<div class="ocpm2-days" data-counter data-to="88" data-suffix=" days">0</div>' +
    '<div class="ocpm2-subm"><span class="lbl">eligible &rarr; 10 % OCPM PQL a&hellip;</span><b>142 days</b></div>' +
    '<div class="ocpm2-subm"><span class="lbl">eligible &rarr; 10 % CC PQL activ&hellip;</span><b>81 days</b></div>' +
  '</section>' +
  '<section class="card span-2 metric" data-card style="min-height:206px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">EMS Service distribution</div>' +
    '<div class="chart-wrap" data-chart="pie" data-segs=\'[["Studio",40.43],["pql_query",31.68],["Apps",22.55],["Data Integration",4.65],["Others (5)",0.69]]\'></div>' +
  '</section>' +
  '<section class="card span-2 metric" data-card style="min-height:206px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:11px;">OCPM / CC activity</div>' +
    '<div class="paxis-label">&uarr; OCPM / Case Centric data type</div>' +
    '<div class="chart-wrap ocpm2-chart ocpm2-chart-sm" data-chart="hbarcat" data-xmax="5000000" data-xticks="0,5000000" data-labelw="38" data-unit="h" data-bars=\'[["OCPM",4200000,"--cstop-1b"],["Case Centric",1850000,"--cstop-1b"]]\'></div>' +
    '<div class="ocpm2-xlabel">user-hours with activity &rarr;</div>' +
    leg([{ c: '--cstop-1b', t: 'OCPM / Case Centric data type' }, '+3']) +
  '</section>' +
  '<section class="card span-2 metric" data-card style="min-height:206px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:11px;">Customer / Celonaut distribution</div>' +
    '<div class="paxis-label">&uarr; Customer / Celonaut distribution</div>' +
    '<div class="chart-wrap ocpm2-chart ocpm2-chart-sm" data-chart="hbarcat" data-xmax="10000" data-xticks="0,5000,10000" data-labelw="48" data-unit="h" data-bars=\'[["Celonaut",2200,"--legend-3"],["Customer",9500,"--legend-3"],["unknown",150,"--legend-3"]]\'></div>' +
    '<div class="ocpm2-xlabel">user-hours with activity &rarr;</div>' +
    leg([{ c: '--legend-3', t: 'Customer / Celonaut distribution' }, '+3']) +
  '</section>' +

  /* row 3 */
  '<section class="card span-6 metric" data-card style="min-height:244px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">amount of hours having tracking events <span class="i" tabindex="0" data-tip="Tracking-event hours per week since eligibility, stacked by service.">i</span></div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="stackbars" data-n="30" data-ymax="200000" data-seed="11" data-series=\'[{"c":"--cstop-1a"},{"c":"--legend-3"},{"c":"--legend-2"},{"c":"--cstop-3a"},{"c":"--legend-4"},{"c":"--legend-1"}]\'></div>' +
    '<div class="ocpm2-xlabel">weeks since eligibility &rarr;</div>' +
    leg([{ c: '--cstop-1a', t: 'Data Integration' }, { c: '--legend-3', t: 'Objects & Events' }, { c: '--legend-2', t: 'Studio' }, { c: '--cstop-3a', t: 'Apps' }, { c: '--legend-4', t: 'PQL' }, { c: '--legend-1', t: 'milestone_mark' }]) +
  '</section>' +
  '<section class="card span-3 metric" data-card style="min-height:244px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">EMS Service distribution</div>' +
    '<div class="paxis-label">&uarr; Main Category</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="hbarcat" data-xmax="5000000" data-xticks="0,5000000" data-labelw="84" data-unit="h" data-bars=\'[["Studio",4800000,"--legend-2"],["Apps",3600000,"--cstop-3a"],["Objects & Events",1800000,"--legend-3"],["Data Integration",1200000,"--cstop-1a"],["null",400000,"--legend-1"],["milestone_mark",120000,"--legend-4"]]\'></div>' +
    '<div class="ocpm2-xlabel">touched user hours &rarr;</div>' +
    leg(['Main Category:', { c: '--cstop-1a', t: 'Data Integration' }, { c: '--legend-2', t: 'Business Graph' }, '+4']) +
  '</section>' +
  '<section class="card span-3 metric" data-card style="min-height:244px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">EMS Service distribution</div>' +
    '<div class="paxis-label">&uarr; detailed view</div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="hbarcat" data-xmax="5000000" data-xticks="0,5000000" data-labelw="84" data-unit="h" data-bars=\'[["Studio",4900000,"--legend-2"],["Apps",3400000,"--cstop-3a"],["Data Integration",2100000,"--cstop-1a"],["Objects & Events",1500000,"--legend-3"],["milestone_mark",300000,"--legend-4"]]\'></div>' +
    '<div class="ocpm2-xlabel">touched user hours &rarr;</div>' +
    leg(['detailed view:', { c: '--cstop-1a', t: 'Data Integration' }, { c: '--legend-2', t: 'Business Graph' }, '+4']) +
  '</section>' +

  /* row 4 */
  '<section class="card span-6 metric" data-card style="min-height:236px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title" style="font-size:12px;">amount of hours having tracking events : OCPM / CC distinction <span class="i" tabindex="0" data-tip="Tracking-event hours split by OCPM vs Case-Centric data type.">i</span></div>' +
    '<div class="chart-wrap ocpm2-chart" data-chart="stackbars" data-n="30" data-ymax="100000" data-seed="5" data-series=\'[{"c":"--cstop-1a"},{"c":"--cstop-1b"},{"c":"--legend-3"},{"c":"--legend-4"},{"c":"--legend-2"}]\'></div>' +
    '<div class="ocpm2-xlabel">weeks since eligibility &rarr;</div>' +
    leg([{ c: '--cstop-1a', t: 'Data Integration (CC)' }, { c: '--cstop-1b', t: 'Data Integration (OC)' }, { c: '--legend-3', t: 'Objects & Events (OC)' }, { c: '--legend-4', t: 'PQL (CC)' }, '+1']) +
  '</section>' +
  '<section class="card span-6" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">Tracking events details</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    table(trkCols, trkRows, [5, 6, 7]) +
  '</section>' +
'</div>';

const emptyPanel = '<div class="bento ocpm2-empty" data-acpanel="empty" style="display:none;">' +
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
  id: 'ocpm-activity',
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
      attr: 'data-acsub',
      trailing: tabNav,
      items: [
        { id: 'summary', label: 'Summary' },
        { id: 'summary_h', label: 'Summary_h' },
        { id: 'ab', label: 'activity breakdown', on: true },
        { id: 'ab2', label: 'activity breakdown II' },
        { id: 'proc', label: 'process, event &amp; objects' },
        { id: 'datajobs', label: 'data jobs' },
        { id: 'persp', label: 'perspectives' },
        { id: 'reuse', label: 'OCPM object re-view' },
        { id: 'valid', label: 'Validation' },
        { id: 'status', label: 'Status' },
      ],
    },
  }) +
  '<div class="ocpm2-body" data-fbar="open"><div class="ocpm2-main">' + dashboard + emptyPanel + '</div>' + filterBar + '</div>',

  render(viewEl) {
    viewEl.classList.add('ocpm-view');
    const sub = viewEl.querySelector('.subtabs');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-acsub]'));
    const ab = viewEl.querySelector('[data-acpanel="ab"]');
    const empty = viewEl.querySelector('[data-acpanel="empty"]');
    const emptyTitle = empty && empty.querySelector('.tr-emt');

    // The filter drawer (.ocpm2-fbar) is toggled by the shared header panel button (.fbar-btn)
    // and its own "x" — both wired once, globally, in engine.js. Sync the button's pressed
    // state to the drawer's initial (open) state.
    const fbarBtn = viewEl.querySelector('.fbar-btn'), fbarBody = viewEl.querySelector('.ocpm2-body');
    if (fbarBtn && fbarBody) fbarBtn.classList.toggle('on', fbarBody.getAttribute('data-fbar') === 'open');

    // tab overflow controls + center the active tab once the view is shown
    viewEl.querySelectorAll('.ocpm-tnav[data-dir]').forEach(b =>
      b.addEventListener('click', () => sub && sub.scrollBy({ left: 220 * parseInt(b.dataset.dir, 10), behavior: 'smooth' })));
    if (sub && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          const active = viewEl.querySelector('.subtab[data-acsub].on');
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
      const isAb = s2.dataset.acsub === 'ab';
      if (ab) ab.style.display = isAb ? 'grid' : 'none';
      if (empty) empty.style.display = isAb ? 'none' : 'grid';
      if (!isAb && emptyTitle) emptyTitle.textContent = (s2.textContent || '').trim();
      if (isAb && window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
